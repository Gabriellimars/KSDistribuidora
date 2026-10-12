// Catálogo da visualização local. Bebidas avulsas usam os valores da página Nossas bebidas.
window.KS_LOCAL_DELIVERY_CATALOG = {
  brands: ["Itaipava", "Skol", "Heineken", "Local", "Brahma"],
  formats: { latinha: "Latinha", litrao: "Litrão (1 L)", "600ml": "600 ml" },
  packPrices: Object.fromEntries(
    ["Itaipava", "Skol", "Heineken", "Local", "Brahma"].map((brand) => [
      brand,
      { latinha: null, litrao: null, "600ml": null },
    ]),
  ),
  beverages: [
    { name: "Heineken", packageLabel: "Long neck · 330 ml", price: 719 },
    { name: "Baly", packageLabel: "Tradicional · 2 litros", price: 990 },
    { name: "Beats", packageLabel: "Senses · 269 ml", price: 649 },
    { name: "Smirnoff", packageLabel: "Garrafa · 998 ml", price: 3099 },
    { name: "Tanqueray", packageLabel: "London Dry · 750 ml", price: 9499 },
    {
      name: "Johnnie Walker",
      packageLabel: "Red Label · 1 litro",
      price: 8999,
    },
    { name: "White Horse", packageLabel: "Garrafa · 1 litro", price: 7999 },
    {
      name: "Chopp de vinho Sempel",
      packageLabel: "Stempel Red · 600 ml",
      price: 1286,
    },
  ],
  extras: ["Gelo", "Gelo de sabor"].map((name) => ({ name, price: null })),
  deliveryFee: 0,
};
