import { z } from "zod";

export const procedureSchema = z.object({
  code: z.string().min(2, "Code is required (e.g. D1000)"),
  name: z.string().min(2, "Name is required"),
  basePrice: z.number().min(0, "Price cannot be negative"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});
