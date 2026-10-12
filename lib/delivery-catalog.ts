export const brands = ["Itaipava", "Skol", "Heineken", "Local", "Brahma"];
export const formats: Record<string, string> = {
  latinha: "Latinha",
  litrao: "Litrão (1 L)",
  "600ml": "600 ml",
};
// Valores em centavos. null indica preço a confirmar com a KS.
export const packPrices: Record<
  string,
  Record<string, number | null>
> = Object.fromEntries(
  brands.map((brand) => [
    brand,
    { latinha: null, litrao: null, "600ml": null },
  ]),
);
export const beverages = [
  { name: "Heineken", packageLabel: "Long neck · 330 ml", price: 719 },
  { name: "Baly", packageLabel: "Tradicional · 2 litros", price: 990 },
  { name: "Beats", packageLabel: "Senses · 269 ml", price: 649 },
  { name: "Smirnoff", packageLabel: "Garrafa · 998 ml", price: 3099 },
  { name: "Tanqueray", packageLabel: "London Dry · 750 ml", price: 9499 },
  { name: "Johnnie Walker", packageLabel: "Red Label · 1 litro", price: 8999 },
  { name: "White Horse", packageLabel: "Garrafa · 1 litro", price: 7999 },
  {
    name: "Chopp de vinho Sempel",
    packageLabel: "Stempel Red · 600 ml",
    price: 1286,
  },
].map((beverage) => ({ ...beverage, price: beverage.price as number | null }));
export const extras = ["Gelo", "Gelo de sabor"].map((name) => ({
  name,
  price: null as number | null,
}));
export const deliveryFee: number | null = 0;
export function calculate(
  items: { brand: string; format: string; quantity: number }[],
  adds: { name: string; quantity: number }[],
  notes: string,
  drinks: { name: string; quantity: number }[] = [],
) {
  let known = 0,
    missing = false;
  for (const item of items) {
    const price = packPrices[item.brand]?.[item.format];
    if (price == null) missing = true;
    else known += price * item.quantity;
  }
  for (const [selected, options] of [
    [adds, extras],
    [drinks, beverages],
  ] as const) {
    for (const item of selected) {
      const price = options.find((option) => option.name === item.name)?.price;
      if (price == null) missing = true;
      else known += price * item.quantity;
    }
  }
  return {
    knownSubtotal: known,
    subtotal: missing ? null : known,
    deliveryFee,
    total:
      missing || deliveryFee === null || notes.trim()
        ? null
        : known + deliveryFee,
  };
}
