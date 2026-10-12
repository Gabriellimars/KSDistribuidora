import { z } from "zod";
import { brands, formats, beverages, extras } from "./delivery-catalog";

const field = (max: number) => z.string().trim().min(1).max(max);
const optional = (max: number) => z.string().trim().max(max).default("");
const quantity = z.number().int().min(1).max(99);

export const orderSchema = z
  .object({
    id: z.string().uuid(),
    adult: z.literal(true),
    items: z
      .array(
        z.object({
          brand: z.string().refine((brand) => brands.includes(brand)),
          format: z.string().refine((format) => Object.hasOwn(formats, format)),
          quantity,
        }),
      )
      .max(30),
    beverages: z
      .array(
        z.object({
          name: z
            .string()
            .refine((name) =>
              beverages.some((beverage) => beverage.name === name),
            ),
          quantity,
        }),
      )
      .max(20)
      .default([]),
    extras: z
      .array(
        z.object({
          name: z
            .string()
            .refine((name) => extras.some((extra) => extra.name === name)),
          quantity,
        }),
      )
      .max(20),
    notes: optional(500),
    address: z.object({
      name: field(120),
      phone: field(20).refine((phone) => {
        const length = phone.replace(/\D/g, "").length;
        return length >= 10 && length <= 13;
      }),
      city: field(100),
      street: field(160),
      neighborhood: field(100),
      number: field(20),
      complement: optional(100),
      reference: optional(160),
    }),
  })
  .refine((order) => order.items.length > 0 || order.beverages.length > 0, {
    message: "Adicione uma bebida avulsa ou um fardo ao pedido.",
  });
