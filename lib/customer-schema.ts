import { z } from "zod";
const required = (max: number) => z.string().trim().min(1).max(max);
const optional = (max: number) => z.string().trim().max(max).default("");
export const customerAddressSchema = z.object({
  name: required(120), phone: required(20).refine(phone => { const n = phone.replace(/\D/g, "").length; return n >= 10 && n <= 13; }),
  city: required(100), street: required(160), neighborhood: required(100), number: required(20),
  complement: optional(100), reference: optional(160),
}).strict();
