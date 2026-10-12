(async () => {
  const $ = (s) => document.querySelector(s),
    escape = (s) =>
      String(s).replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      );
  const money = (n) =>
    n == null
      ? "Sob consulta"
      : new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(n / 100);
  let catalog,
    items = [],
    address = null,
    orderId = null,
    busy = false,
    done = false;
  let totalCents = null;
  const isLocalPreview =
    location.protocol === "file:" || location.pathname.includes("/paginas/");
  let previewOnly = false;
  if (isLocalPreview && window.KS_LOCAL_DELIVERY_CATALOG) {
    catalog = window.KS_LOCAL_DELIVERY_CATALOG;
    previewOnly = true;
  } else {
    try {
      const response = await fetch("/api/catalog");
      if (!response.ok) throw Error();
      catalog = await response.json();
    } catch {
      $("#cart-error").textContent =
        "Não foi possível carregar as opções. Atualize a página para tentar novamente.";
      $("#pack-form button").disabled = true;
      return;
    }
  }
  if (previewOnly) {
    $("#preview-notice").hidden = false;
  }
  $("#beverages").innerHTML = catalog.beverages
    .map(
      (beverage, index) =>
        '<div class="extra"><label class="page-inline-4"><input type="checkbox" data-beverage="' +
        index +
        '">' +
        escape(beverage.name) +
        " · " +
        escape(beverage.packageLabel) +
        " · " +
        money(beverage.price) +
        " / unidade" +
        '</label><input class="extra-qty" type="number" min="1" max="99" value="1" data-beverage-qty="' +
        index +
        '" aria-label="Quantidade de ' +
        escape(beverage.name) +
        '" disabled></div>',
    )
    .join("");
  $("#extras").innerHTML = catalog.extras
    .map(
      (e, i) =>
        '<div class="extra"><label  class="page-inline-4"><input type="checkbox" data-extra="' +
        i +
        '">' +
        escape(e.name) +
        '</label><input class="extra-qty" type="number" min="1" max="99" value="1" data-extra-qty="' +
        i +
        '" aria-label="Quantidade de ' +
        escape(e.name) +
        '" disabled></div>',
    )
    .join("");
  const params = new URLSearchParams(location.search);
  if (catalog.brands.includes(params.get("marca")))
    $("#brand").value = params.get("marca");
  const extraIndex = catalog.extras.findIndex(
    (e) => e.name === params.get("extra"),
  );
  if (extraIndex >= 0) {
    $('[data-extra="' + extraIndex + '"]').checked = true;
    $('[data-extra-qty="' + extraIndex + '"]').disabled = false;
  }
  const beverageIndex = catalog.beverages.findIndex(
    (beverage) =>
      beverage.name === (params.get("bebida") || params.get("extra")),
  );
  if (beverageIndex >= 0) {
    $('[data-beverage="' + beverageIndex + '"]').checked = true;
    $('[data-beverage-qty="' + beverageIndex + '"]').disabled = false;
  }
  function selectedBeverages() {
    return [...document.querySelectorAll("[data-beverage]:checked")].map(
      (checkbox) => ({
        name: catalog.beverages[Number(checkbox.dataset.beverage)].name,
        quantity: Number(
          $('[data-beverage-qty="' + checkbox.dataset.beverage + '"]').value,
        ),
      }),
    );
  }
  function hasProducts() {
    return items.length > 0 || selectedBeverages().length > 0;
  }
  function selectedExtras() {
    return [...document.querySelectorAll("[data-extra]:checked")].map((c) => ({
      name: catalog.extras[+c.dataset.extra].name,
      quantity: Number($('[data-extra-qty="' + c.dataset.extra + '"]').value),
    }));
  }
  function changed() {
    orderId = null;
    window.KSPix.hide();
    $("#success").hidden = true;
    $("#order-error").textContent = "";
    update();
  }
  function update() {
    const adds = selectedExtras();
    const drinks = selectedBeverages();
    let subtotal = 0,
      missing = false;
    const rows = items.map((i, index) => {
      const price = catalog.packPrices[i.brand][i.format];
      if (price == null) missing = true;
      else subtotal += price * i.quantity;
      return (
        '<div class="item-row">' +
        i.quantity +
        " × Fardo de " +
        escape(i.brand) +
        " · " +
        escape(catalog.formats[i.format]) +
        '<br><span class="subtle">' +
        money(price) +
        ' por fardo</span><br><button type="button" data-remove="' +
        index +
        '">Remover</button></div>'
      );
    });
    $("#cart-items").innerHTML = rows.join("");
    const summary = items.map((i) => {
      const price = catalog.packPrices[i.brand][i.format];
      return (
        '<div class="summary-line"><span>' +
        i.quantity +
        " × " +
        escape(i.brand) +
        "<br><small>" +
        escape(catalog.formats[i.format]) +
        "</small></span><strong>" +
        money(price == null ? null : price * i.quantity) +
        "</strong></div>"
      );
    });
    for (const i of [...adds, ...drinks]) {
      const e = [...catalog.extras, ...catalog.beverages].find(
        (e) => e.name === i.name,
      );
      if (e.price == null) missing = true;
      else subtotal += e.price * i.quantity;
      summary.push(
        '<div class="summary-line"><span>' +
          i.quantity +
          " × " +
          escape(i.name) +
          "</span><strong>" +
          money(e.price == null ? null : e.price * i.quantity) +
          "</strong></div>",
      );
    }
    const custom = $("#notes").value.trim();
    if (custom)
      summary.push(
        '<p class="subtle">Adicional solicitado: ' +
          escape(custom) +
          " · Sob consulta</p>",
      );
    $("#summary-items").innerHTML =
      summary.join("") || '<p class="subtle">Seu pedido está vazio.</p>';
    $("#subtotal").textContent = hasProducts()
      ? money(missing ? null : subtotal)
      : "—";

    totalCents =
      hasProducts() && !missing && !custom && catalog.deliveryFee !== null
        ? subtotal + catalog.deliveryFee
        : null;
    $("#shipping").textContent =
      catalog.deliveryFee === 0 ? "Grátis" : money(catalog.deliveryFee);
    $("#total").textContent = hasProducts() ? money(totalCents) : "—";
    $("#price-notice").textContent = !hasProducts()
      ? "Escolha uma bebida avulsa ou adicione um fardo para começar."
      : missing || custom || catalog.deliveryFee == null
        ? "O valor final será confirmado pela KS. Há preços, adicionais ou taxa de entrega sob consulta."
        : "Valor calculado para os itens e a entrega. Disponibilidade a confirmar.";
    $("#place-order").disabled = busy || done || !hasProducts();
    $("#step-products").classList.toggle("active", !hasProducts());
    $("#step-address").classList.toggle("active", hasProducts() && !address);
    $("#step-review").classList.toggle("active", !!address);
  }
  $("#pack-form").onsubmit = (e) => {
    e.preventDefault();
    const q = Number($("#quantity").value);
    if (!Number.isInteger(q) || q < 1 || q > 99) return;
    const brand = $("#brand").value,
      format = $("#format").value,
      existing = items.find((i) => i.brand === brand && i.format === format);
    if (existing && existing.quantity + q > 99) {
      $("#cart-error").textContent = "Limite de 99 fardos por opção.";
      return;
    }
    if (!existing && items.length >= 30) {
      $("#cart-error").textContent = "Limite de 30 opções por pedido.";
      return;
    }
    if (existing) existing.quantity += q;
    else items.push({ brand, format, quantity: q });
    $("#cart-error").textContent = "";
    changed();
  };
  $("#cart-items").onclick = (e) => {
    const b = e.target.closest("[data-remove]");
    if (b) {
      items.splice(+b.dataset.remove, 1);
      changed();
    }
  };
  $("#extras").onchange = (e) => {
    if (e.target.matches("[data-extra]"))
      $('[data-extra-qty="' + e.target.dataset.extra + '"]').disabled =
        !e.target.checked;
    changed();
  };
  $("#beverages").onchange = (event) => {
    if (event.target.matches("[data-beverage]")) {
      $(
        '[data-beverage-qty="' + event.target.dataset.beverage + '"]',
      ).disabled = !event.target.checked;
    }
    changed();
  };
  $("#notes").oninput = changed;
  $("#address-form").oninput = () => {
    address = null;
    $("#review").hidden = true;
    $("#address-message").textContent =
      "Confirme o endereço após as alterações.";
    changed();
  };
  $("#address-form").onsubmit = (e) => {
    e.preventDefault();
    if (!hasProducts()) {
      $("#cart-error").textContent =
        "Escolha uma bebida avulsa ou um fardo antes de confirmar o endereço.";
      $("#pack-form").scrollIntoView({ behavior: "smooth" });
      return;
    }
    const a = Object.fromEntries(new FormData(e.target));
    for (const k in a) a[k] = a[k].trim();
    if (
      ["name", "phone", "city", "street", "neighborhood", "number"].some(
        (k) => !a[k],
      )
    ) {
      $("#address-message").textContent =
        "Preencha todos os campos obrigatórios.";
      return;
    }
    if (
      a.phone.replace(/\D/g, "").length < 10 ||
      a.phone.replace(/\D/g, "").length > 13
    ) {
      $("#address-message").textContent = "Informe um telefone válido com DDD.";
      return;
    }
    address = a;
    $("#address-review").textContent =
      a.name +
      " · " +
      a.phone +
      "\n" +
      a.street +
      ", " +
      a.number +
      "\n" +
      a.neighborhood +
      " · " +
      a.city +
      (a.complement ? "\nComplemento: " + a.complement : "") +
      (a.reference ? "\nReferência: " + a.reference : "");
    $("#address-message").textContent =
      "Endereço confirmado. Revise sua encomenda abaixo.";
    $("#review").hidden = false;
    changed();
    $("#review").scrollIntoView({ behavior: "smooth" });
  };
  $("#edit-address").onclick = () => {
    address = null;
    $("#review").hidden = true;
    changed();
    $("#address-form").scrollIntoView({ behavior: "smooth" });
    $("#address-form input").focus();
  };
  $("#place-order").onclick = async () => {
    if (busy || done) return;
    if (!address || !hasProducts()) {
      $("#order-error").textContent =
        "Escolha uma bebida avulsa ou um fardo e confirme o endereço.";
      $("#address-form").scrollIntoView({ behavior: "smooth" });
      $("#address-form input").focus();
      return;
    }
    if (!$("#adult").checked) {
      $("#order-error").textContent = "Confirme que você tem 18 anos ou mais.";
      return;
    }
    const adds = selectedExtras();
    const drinks = selectedBeverages();
    if (
      [...adds, ...drinks].some(
        (e) =>
          !Number.isInteger(e.quantity) || e.quantity < 1 || e.quantity > 99,
      )
    ) {
      $("#order-error").textContent =
        "As bebidas e os adicionais precisam ter uma quantidade entre 1 e 99.";
      return;
    }

    if (previewOnly) {
      orderId = orderId || crypto.randomUUID();
      const message = [
        "Olá, KS! Quero confirmar este pedido:",
        ...items.map(
          (item) =>
            item.quantity +
            " x Fardo de " +
            item.brand +
            " - " +
            catalog.formats[item.format],
        ),
        ...drinks.map((beverage) => beverage.quantity + " x " + beverage.name),
        ...adds.map((extra) => extra.quantity + " x " + extra.name),
        "Nome: " + address.name,
        "Telefone: " + address.phone,
        "Endereço: " + address.street + ", " + address.number,
        "Bairro: " + address.neighborhood + " - " + address.city,
        address.complement ? "Complemento: " + address.complement : "",
        address.reference ? "Referência: " + address.reference : "",
        $("#notes").value.trim()
          ? "Observações: " + $("#notes").value.trim()
          : "",
        "Confirme o valor total e a disponibilidade antes do pagamento.",
      ]
        .filter(Boolean)
        .join("\n");
      const contactUrl =
        "https://wa.me/5532999123002?text=" + encodeURIComponent(message);
      $("#success").hidden = false;
      $("#success").innerHTML =
        '<h3>Pedido preparado</h3><p class="subtle">Nesta visualização o pedido ainda não foi enviado. Envie-o à KS para confirmar disponibilidade e total antes de pagar.</p><a class="btn" target="_blank" rel="noopener noreferrer" href="' +
        contactUrl +
        '">Enviar pedido à KS ↗</a>';
      if (totalCents !== null) {
        window.KSPix.show({ id: orderId, totalCents });
      } else {
        $("#order-error").textContent =
          "Há itens sem preço confirmado. Confirme o valor com a KS antes de pagar.";
      }
      return;
    }

    busy = true;
    const button = $("#place-order");
    button.disabled = true;
    button.textContent = "Registrando…";
    orderId = orderId || crypto.randomUUID();
    const payload = {
      id: orderId,
      adult: true,
      items,
      beverages: drinks,
      extras: adds,
      notes: $("#notes").value.trim(),
      address,
    };
    try {
      const r = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
        res = await r.json();
      if (!r.ok)
        throw Error(
          res.error || "Não foi possível registrar. Tente novamente.",
        );
      done = true;
      $("#edit-address").disabled = true;
      $("#review").hidden = true;
      $("#success").hidden = false;
      $("#success").innerHTML =
        "<h3>Pedido registrado!</h3><p>Protocolo: <strong>" +
        escape(res.id) +
        '</strong></p><p class="subtle">Confirme disponibilidade e valor final com a KS antes de pagar. Consulte as instruções de pagamento abaixo do resumo. O recebimento será conferido pela KS.</p><a class="btn" href="./delivery.html">Fazer outro pedido</a>';
      $("#success").focus();
      document
        .querySelectorAll(
          "form input,form select,form button,#notes,#extras input,#beverages input,#adult",
        )
        .forEach((el) => (el.disabled = true));
      $("#cart-items").innerHTML = items
        .map(
          (i) =>
            "<p>" +
            i.quantity +
            " × " +
            escape(i.brand) +
            " · " +
            escape(catalog.formats[i.format]) +
            "</p>",
        )
        .join("");
      $("#subtotal").textContent = money(res.price.subtotal);
      $("#total").textContent = money(res.price.total);
      if (res.price.total !== null) {
        window.KSPix.show({ id: res.id, totalCents: res.price.total });
      } else {
        $("#order-error").textContent =
          "Há itens sem preço confirmado. A KS confirmará o total antes do pagamento.";
      }
    } catch (err) {
      $("#order-error").textContent = err.message;
    } finally {
      busy = false;
      button.disabled = done;
      button.textContent = done ? "Pedido finalizado" : "Finalizar compra →";
    }
  };
  update();
})();
