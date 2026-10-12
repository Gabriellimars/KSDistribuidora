const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const path = require("node:path");
const root = path.resolve(__dirname, "..");

function createContext(mode = "local") {
  const nodes = new Map();
  function getNode(selector) {
    if (!nodes.has(selector)) {
      nodes.set(selector, {
        value: "",
        checked: false,
        hidden: true,
        disabled: false,
        textContent: "",
        innerHTML: "",
        classList: { toggle() {} },
        focus() {},
        select() {},
        scrollIntoView() {},
        addEventListener(name, handler) {
          this[name] = handler;
        },
      });
    }
    return nodes.get(selector);
  }
  const context = vm.createContext({
    window: {},
    Intl,
    URLSearchParams,
    crypto: webcrypto,
    navigator: {},
    location: {
      protocol: "http:",
      pathname:
        mode === "local" ? "/project/paginas/delivery.html" : "/delivery.html",
      search: "",
    },
    FormData: function (form) {
      return Object.entries(form.data);
    },
    document: {
      querySelector: getNode,
      querySelectorAll() {
        return [];
      },
      execCommand() {
        return true;
      },
    },
  });
  const run = (file) =>
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context);
  run("public/js/vendor/qrcode.js");
  run("public/js/pix-config.js");
  run("public/js/pix.js");
  run("public/js/delivery-options.js");
  return { context, getNode, run };
}

function parseFields(payload) {
  const fields = {};
  for (let offset = 0; offset < payload.length; ) {
    const id = payload.slice(offset, offset + 2);
    const length = Number(payload.slice(offset + 2, offset + 4));
    assert.ok(Number.isInteger(length) && length >= 0);
    const value = payload.slice(offset + 4, offset + 4 + length);
    assert.equal(value.length, length);
    fields[id] = value;
    offset += 4 + length;
  }
  return fields;
}

test("CRC matches the published Banco Central test vector", () => {
  const { context } = createContext();
  const official =
    "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304";
  assert.equal(context.window.KSPix.crc16(official), "1D3D");
});

test("Pix preserves the configured telephone key, optional amount and valid TLV", () => {
  const { context } = createContext();
  const config = context.window.KS_PIX_CONFIG;
  const code = context.window.KSPix.createPayload({
    ...config,
    reference: "KS123456789",
    totalCents: null,
  });
  const fields = parseFields(code);
  const account = parseFields(fields["26"]);
  assert.equal(account["00"], "br.gov.bcb.pix");
  assert.equal(account["01"], config.key);
  assert.match(account["01"], /^\+55\d{11}$/);
  assert.equal(fields["53"], "986");
  assert.equal(fields["58"], "BR");
  assert.equal(fields["54"], undefined);
  assert.equal(parseFields(fields["62"])["05"], "KS123456789");
  assert.equal(fields["63"], context.window.KSPix.crc16(code.slice(0, -4)));
  const withAmount = context.window.KSPix.createPayload({
    ...config,
    totalCents: 12345,
  });
  assert.equal(parseFields(withAmount)["54"], "123.45");
  for (const amount of [-1, 0, 1.5, NaN, Infinity]) {
    assert.throws(() =>
      context.window.KSPix.createPayload({ ...config, totalCents: amount }),
    );
  }
});

const decoderPath = path.join(root, ".sites-runtime/qa/jsQR.js");
test(
  "An independent QR decoder reads the generated Pix without changing the payload",
  { skip: !fs.existsSync(decoderPath) },
  () => {
    const decoderContext = { module: { exports: {} }, exports: {} };
    vm.runInNewContext(fs.readFileSync(decoderPath, "utf8"), decoderContext);
    const decode = decoderContext.module.exports;
    const { context } = createContext();
    const payload = context.window.KSPix.createPayload({
      ...context.window.KS_PIX_CONFIG,
      reference: "KS123",
      totalCents: 2050,
    });
    const qr = context.qrcode(0, "M");
    qr.addData(payload, "Byte");
    qr.make();
    const modules = qr.getModuleCount(),
      scale = 6,
      margin = 4;
    const size = (modules + margin * 2) * scale;
    const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
    for (let row = 0; row < modules; row++) {
      for (let col = 0; col < modules; col++) {
        if (!qr.isDark(row, col)) continue;
        for (let y = 0; y < scale; y++)
          for (let x = 0; x < scale; x++) {
            const offset =
              (((row + margin) * scale + y) * size +
                (col + margin) * scale +
                x) *
              4;
            pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 0;
          }
      }
    }
    assert.equal(decode(pixels, size, size).data, payload);
  },
);

for (const mode of ["local", "server"]) {
  test(
    "Checkout validates address and age, opens Pix, and respects " +
      mode +
      " order handling",
    async () => {
      const { context, getNode: node, run } = createContext(mode);
      const requests = [];
      context.fetch = async (url, options) => {
        requests.push({ url, options });
        if (url === "/api/catalog")
          return {
            ok: true,
            json: async () => context.window.KS_LOCAL_DELIVERY_CATALOG,
          };
        const order = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({
            id: order.id,
            price: { subtotal: null, total: null },
          }),
        };
      };
      await run("public/js/delivery.js");
      assert.equal(node("#place-order").disabled, true);
      node("#quantity").value = "2";
      node("#brand").value = "Itaipava";
      node("#format").value = "latinha";
      node("#pack-form").onsubmit({ preventDefault() {} });
      assert.equal(node("#place-order").disabled, false);
      await node("#place-order").onclick();
      assert.equal(node("#pix-payment").hidden, true);
      node("#address-form").data = {
        name: "Cliente teste",
        phone: "32999999999",
        city: "Coimbra",
        street: "Rua teste",
        neighborhood: "Centro",
        number: "1",
        complement: "",
        reference: "",
      };
      node("#address-form").onsubmit({
        preventDefault() {},
        target: node("#address-form"),
      });
      await node("#place-order").onclick();
      assert.equal(node("#pix-payment").hidden, true);
      node("#adult").checked = true;
      await node("#place-order").onclick();
      assert.equal(node("#pix-payment").hidden, true);
      assert.equal(node("#pix-code").value, "");
      assert.ok(node("#order-error").textContent.length > 0);
      assert.equal(node("#pix-code").disabled, false);
      if (mode === "local") {
        assert.equal(requests.length, 0);
        assert.ok(node("#success").innerHTML.includes("wa.me"));
        node("#notes").value = "Outra observacao";
        node("#notes").oninput();
        assert.equal(node("#pix-payment").hidden, true);
        assert.equal(node("#pix-code").value, "");
      } else {
        assert.equal(
          requests.filter((request) => request.url === "/api/orders").length,
          1,
        );
        assert.equal(node("#place-order").disabled, true);
        await node("#place-order").onclick();
        assert.equal(
          requests.filter((request) => request.url === "/api/orders").length,
          1,
        );
      }
    },
  );
}

test("The checkout button and Pix appear once and after the order summary", () => {
  const html = fs.readFileSync(
    path.join(root, "paginas/delivery.html"),
    "utf8",
  );
  assert.equal((html.match(/id="place-order"/g) || []).length, 1);
  assert.ok(html.indexOf('id="place-order"') > html.indexOf('id="total"'));
  assert.ok(
    html.indexOf('id="pix-payment"') > html.indexOf('id="place-order"'),
  );
  assert.ok(
    !html.includes('class="btn" href="./delivery.html">Pedir delivery'),
  );
  for (const match of html.matchAll(/(?:src|href)="(\.\.\/public\/[^"]+)"/g)) {
    assert.ok(fs.existsSync(path.resolve(root, "paginas", match[1].split("?")[0])));
  }
});

for (const mode of ["local", "server"]) {
  test(
    "A beverage-only order can be finalized without a pack in " + mode,
    async () => {
      const { context, getNode: node, run } = createContext(mode);
      const selected = {
        checked: false,
        dataset: { beverage: "4" },
        matches() {
          return true;
        },
      };
      context.document.querySelectorAll = (selector) =>
        selector === "[data-beverage]:checked" && selected.checked
          ? [selected]
          : [];
      const requests = [];
      context.fetch = async (url, options) => {
        requests.push({ url, options });
        if (url === "/api/catalog")
          return {
            ok: true,
            json: async () => context.window.KS_LOCAL_DELIVERY_CATALOG,
          };
        const payload = JSON.parse(options.body);
        assert.equal(payload.items.length, 0);
        assert.equal(payload.beverages[0].name, "Tanqueray");
        assert.equal(payload.beverages[0].quantity, 2);
        assert.equal(payload.extras.length, 0);
        return {
          ok: true,
          json: async () => ({
            id: payload.id,
            price: { subtotal: 18998, total: 18998 },
          }),
        };
      };
      await run("public/js/delivery.js");
      assert.equal(context.window.KS_LOCAL_DELIVERY_CATALOG.extras.length, 2);
      assert.ok(!node("#extras").innerHTML.includes("Tanqueray"));
      selected.checked = true;
      node('[data-beverage-qty="4"]').value = "2";
      node("#beverages").onchange({ target: selected });
      assert.equal(node("#place-order").disabled, false);
      assert.ok(node("#summary-items").innerHTML.includes("Tanqueray"));
      node("#address-form").data = {
        name: "Cliente teste",
        phone: "32999999999",
        city: "Coimbra",
        street: "Rua teste",
        neighborhood: "Centro",
        number: "1",
        complement: "",
        reference: "",
      };
      node("#address-form").onsubmit({
        preventDefault() {},
        target: node("#address-form"),
      });
      assert.equal(node("#review").hidden, false);
      node("#adult").checked = true;
      await node("#place-order").onclick();
      assert.equal(node("#pix-payment").hidden, false);
      assert.equal(parseFields(node("#pix-code").value)["54"], "189.98");
      assert.equal(node("#pix-amount").textContent, node("#total").textContent);
      if (mode === "server")
        assert.equal(
          requests.filter((request) => request.url === "/api/orders").length,
          1,
        );
      else assert.equal(requests.length, 0);
    },
  );
}

const zodPath = path.join(root, ".sites-runtime/qa/node_modules/zod");
test(
  "Server validation accepts beverage-only orders and rejects empty orders or drinks sent as extras",
  { skip: !fs.existsSync(zodPath) },
  async () => {
    const { stripTypeScriptTypes } = require("node:module");
    const z = require(zodPath).z;
    const serverContext = vm.createContext({
      z,
      Object,
      Response,
      Request,
      URL,
      console,
    });
    const transform = (file) =>
      stripTypeScriptTypes(fs.readFileSync(path.join(root, file), "utf8"))
        .replace(/^import .*$/gm, "")
        .replace(/export /g, "");
    vm.runInContext(
      transform("lib/delivery-catalog.ts") +
        "\nglobalThis.beveragesList = beverages; globalThis.calculatePrice = calculate;",
      serverContext,
    );
    vm.runInContext(
      transform("lib/order-schema.ts") + "\nglobalThis.schema = orderSchema;",
      serverContext,
    );
    const payload = {
      id: "00000000-0000-4000-8000-000000000001",
      adult: true,
      items: [],
      beverages: [{ name: "Tanqueray", quantity: 2 }],
      extras: [],
      notes: "",
      address: {
        name: "Cliente",
        phone: "32999999999",
        city: "Coimbra",
        street: "Rua",
        neighborhood: "Centro",
        number: "1",
      },
    };
    assert.equal(serverContext.schema.safeParse(payload).success, true);
    assert.equal(
      serverContext.schema.safeParse({ ...payload, beverages: [] }).success,
      false,
    );
    assert.equal(
      serverContext.schema.safeParse({
        ...payload,
        beverages: [],
        extras: [{ name: "Tanqueray", quantity: 1 }],
      }).success,
      false,
    );
    assert.equal(
      serverContext.schema.safeParse({
        ...payload,
        beverages: [{ name: "Tanqueray", quantity: 0 }],
      }).success,
      false,
    );
    serverContext.beveragesList.find(
      (beverage) => beverage.name === "Tanqueray",
    ).price = 10000;
    assert.equal(
      serverContext.calculatePrice([], [], "", payload.beverages).knownSubtotal,
      20000,
    );

    let stored;
    serverContext.getCustomer = async () => null;
    serverContext.env = {
      DB: {
        prepare(query) {
          return {
            bind(...args) {
              return {
                async first() {
                  return null;
                },
                async run() {
                  stored = args;
                  return {};
                },
              };
            },
          };
        },
      },
    };

    vm.runInContext(transform("app/api/orders/route.ts"), serverContext);
    const response = await serverContext.POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          origin: "http://localhost",
        },
        body: JSON.stringify(payload),
      }),
    );
    assert.equal(response.status, 201);
    assert.equal(JSON.parse(stored[6])[0].kind, "beverage");
    assert.equal(JSON.parse(stored[6])[0].name, "Tanqueray");
  },
);

test("All eight unit prices match the drinks catalog in local preview and on the server", () => {
  const { context } = createContext();
  const productsSource = fs
    .readFileSync(path.join(root, "public/js/bebidas.js"), "utf8")
    .split("const imageDirectory")[0];
  vm.runInContext(
    productsSource + "\nwindow.referenceProducts = products;",
    context,
  );
  const { stripTypeScriptTypes } = require("node:module");
  const catalogSource = stripTypeScriptTypes(
    fs.readFileSync(path.join(root, "lib/delivery-catalog.ts"), "utf8"),
  ).replace(/export /g, "");
  vm.runInContext(
    catalogSource +
      "\nwindow.serverBeverages = beverages; window.calculatePrice = calculate;",
    context,
  );
  for (const product of context.window.referenceProducts) {
    const local = context.window.KS_LOCAL_DELIVERY_CATALOG.beverages.find(
      (item) => item.name === product.orderName,
    );
    const server = context.window.serverBeverages.find(
      (item) => item.name === product.orderName,
    );
    assert.equal(local.price, product.priceCents);
    assert.equal(server.price, product.priceCents);
  }
  const price = context.window.calculatePrice([], [], "", [
    { name: "Tanqueray", quantity: 2 },
    { name: "Beats", quantity: 3 },
  ]);
  assert.equal(price.subtotal, 2 * 9499 + 3 * 649);
  assert.equal(price.total, 2 * 9499 + 3 * 649); // Entrega gratuita.
});

test("Payment panel refuses a Pix without a confirmed total", () => {
  const { context, getNode: node } = createContext();
  assert.throws(() =>
    context.window.KSPix.show({ id: "KS123", totalCents: null }),
  );
  assert.equal(node("#pix-payment").hidden, true);
  assert.equal(node("#pix-code").value, "");
});
