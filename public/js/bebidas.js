// Preços de referência pesquisados em 12/10/2026. Valores em centavos.
// Os mesmos valores foram aplicados às bebidas avulsas no delivery.
const products = [
  {
    name: "Heineken",
    category: "cervejas",
    type: "Cerveja puro malte",
    packageLabel: "Long neck · 330 ml",
    priceCents: 719,
    image: "heineken.png",
    priceSource:
      "https://www.paodeacucar.com/produto/340565/cerveja-heineken-garrafa-long-neck-330ml",
    retailer: "Pão de Açúcar",
    photoSource: "https://www.grupoima.com.br/cerveja-heineken-long-neck-330ml",
    orderParam: "bebida",
    orderName: "Heineken",
    checkedAt: "2026-10-12",
  },
  {
    name: "Tanqueray",
    category: "destilados",
    type: "London Dry Gin",
    packageLabel: "Garrafa · 750 ml",
    priceCents: 9499,
    image: "tanqueray.png",
    priceSource:
      "https://www.paodeacucar.com/produto/37355/gin-tanqueray-london-dry-750ml",
    retailer: "Pão de Açúcar",
    photoSource:
      "https://www.paodeacucar.com/produto/37355/gin-london-dry-tanqueray-garrafa-750ml",
    orderParam: "bebida",
    orderName: "Tanqueray",
    checkedAt: "2026-10-12",
  },
  {
    name: "Johnnie Walker Red Label",
    category: "destilados",
    type: "Whisky escocês",
    packageLabel: "Garrafa · 1 litro",
    priceCents: 8999,
    image: "red-label.jpg",
    priceSource:
      "https://www.paodeacucar.com/produto/16238/whisky-escoces-blended-red-label-johnnie-walker-garrafa-1l",
    retailer: "Pão de Açúcar",
    photoSource:
      "https://www.pricesmart.com/es-gt/categoria/Licor-cerveza-y-vino-G10D08014/Whisky-G10D08014018/G10D08014018",
    orderParam: "bebida",
    orderName: "Johnnie Walker",
    checkedAt: "2026-10-12",
  },
  {
    name: "Baly Tradicional",
    category: "energeticos",
    type: "Energético",
    packageLabel: "Garrafa · 2 litros",
    priceCents: 990,
    image: "baly.png",
    priceSource:
      "https://mercado.carrefour.com.br/produto/energetico-baly-garrafa-2-l-17325",
    retailer: "Carrefour",
    photoSource:
      "https://www.farmaciasnissei.com.br/energetico-baly-tradicional-garrafa-2l",
    orderParam: "bebida",
    orderName: "Baly",
    checkedAt: "2026-10-12",
  },
  {
    name: "Beats Senses",
    category: "cervejas",
    type: "Drink pronto",
    packageLabel: "Lata · 269 ml",
    priceCents: 649,
    image: "beats.jpg",
    priceSource: "https://www.paodeacucar.com/produto/313589",
    retailer: "Pão de Açúcar",
    photoSource:
      "https://mercado.carrefour.com.br/produto/drink-pronto-beats-senses-ml-lata-6698",
    orderParam: "bebida",
    orderName: "Beats",
    checkedAt: "2026-10-12",
  },
  {
    name: "Smirnoff",
    category: "destilados",
    type: "Vodka",
    packageLabel: "Garrafa · 998 ml",
    priceCents: 3099,
    image: "smirnoff.png",
    priceSource:
      "https://www.paodeacucar.com/produto/134026/Vodka%2BSMIRNOFF%2BGarrafa%2B998ml",
    retailer: "Pão de Açúcar",
    photoSource:
      "https://www.emporiowiniarski.com.br/vodka-smirnoff-red-998ml-vidro",
    orderParam: "bebida",
    orderName: "Smirnoff",
    checkedAt: "2026-10-12",
  },
  {
    name: "White Horse",
    category: "destilados",
    type: "Whisky escocês",
    packageLabel: "Garrafa · 1 litro",
    priceCents: 7999,
    image: "white-horse.png",
    priceSource:
      "https://www.paodeacucar.com/produto/73838/whisky-escoces-blended-fine-old-white-horse-garrafa-1l",
    retailer: "Pão de Açúcar",
    photoSource:
      "https://www.superpaguemenos.com.br/whisky-nacional-white-horse-1l/p",
    orderParam: "bebida",
    orderName: "White Horse",
    checkedAt: "2026-10-12",
  },
  {
    name: "Stempel Red",
    category: "cervejas",
    type: "Chopp de vinho",
    packageLabel: "Garrafa · 600 ml",
    priceCents: 1286,
    image: "stempel.jpg",
    priceSource:
      "https://www.michelassi.com.br/p/Chopp-de-Vinho-Tinto-STEMPEL-600ml",
    retailer: "Supermercado Michelassi",
    photoSource:
      "https://www.arenaatacado.com.br/Coquetel-Alco%C3%B3lico-Stempel-Red-600ml-992364.html",
    orderParam: "bebida",
    orderName: "Chopp de vinho Sempel",
    checkedAt: "2026-10-12",
  },
];

const imageDirectory = new URL(
  "../images/bebidas/",
  document.currentScript.src,
);
const grid = document.querySelector("#products");
const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function render(filter = "todos") {
  grid.innerHTML = products
    .map((product, index) => ({ product, index }))
    .filter(({ product }) => filter === "todos" || product.category === filter)
    .map(
      ({ product, index }) => `
      <article class="card">
        <div class="product-art">
          <img
            src="${new URL(product.image, imageDirectory).href}"
            alt="${product.name}, ${product.packageLabel}"
            width="220"
            height="220"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div class="card-info">
          <small>${product.type}</small>
          <h3>${product.name}</h3>
          <p class="product-package">${product.packageLabel} · 1 unidade</p>
          <p class="product-price">${currency.format(product.priceCents / 100)}</p>
          <p class="price-caption">Preço de referência na internet</p>
          <details class="product-sources">
            <summary>Fontes e data da consulta</summary>
            <p>Consultado em 12/10/2026. Valores podem variar por região e promoção; frete não incluído.</p>
            <a href="${product.priceSource}" target="_blank" rel="noopener noreferrer">Preço: ${product.retailer} ↗</a>
            <a href="${product.photoSource}" target="_blank" rel="noopener noreferrer">Fonte da foto ↗</a>
          </details>
          <button class="add" data-id="${index}" aria-label="Consultar ${product.name} com a KS">
            Consultar na KS <span>↗</span>
          </button>
        </div>
      </article>
    `,
    )
    .join("");
}

render();

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach((filterButton) => {
      const isActive = filterButton === button;
      filterButton.classList.toggle("active", isActive);
      filterButton.setAttribute("aria-pressed", String(isActive));
    });
    render(button.dataset.filter);
  });
});

grid.addEventListener("click", (event) => {
  const button = event.target.closest(".add");
  if (!button) return;

  const product = products[Number(button.dataset.id)];
  const deliveryUrl = new URL("./delivery.html", location.href);
  deliveryUrl.searchParams.set(product.orderParam, product.orderName);
  location.href = deliveryUrl.href;
});
