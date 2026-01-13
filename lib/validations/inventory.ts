import { z } from "zod";

export const inventorySchema = z.object({
  name: z.string().min(2, "Name is required"),
  category: z.enum(["consumable", "instrument", "material", "medication"]),
  stock: z.number().min(0, "Stock cannot be negative"),
  unit: z.string().min(1, "Unit is required (e.g. box)"),
  minThreshold: z.number().min(0, "Threshold cannot be negative"),
  costPerUnit: z.number().min(0, "Cost cannot be negative"),
  isActive: z.boolean().default(true),
});
