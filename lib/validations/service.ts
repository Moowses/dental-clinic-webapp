import { z } from "zod";

export const serviceSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  category: z.enum(["preventative", "restorative", "cosmetic", "surgery", "orthodontics", "emergency"]),
  price: z.number().min(0, "Price cannot be negative"),
  durationMinutes: z.number().int().min(5, "Duration must be at least 5 minutes"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});
