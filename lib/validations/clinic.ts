import { z } from "zod";

export const procedureSchema = z.object({
  code: z.string().min(2, "Code is required (e.g. D1000)"),
  name: z.string().min(2, "Name is required"),
  basePrice: z.number().min(0, "Price cannot be negative"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

const dayHoursSchema = z.object({
  open: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format"),
  close: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format"),
  isOpen: z.boolean(),
});

export const clinicSettingsSchema = z.object({
  maxConcurrentPatients: z.number().min(1).default(1),
  operatingHours: z.object({
    monday: dayHoursSchema,
    tuesday: dayHoursSchema,
    wednesday: dayHoursSchema,
    thursday: dayHoursSchema,
    friday: dayHoursSchema,
    saturday: dayHoursSchema,
    sunday: dayHoursSchema,
  })
});

export type ClinicSettings = z.infer<typeof clinicSettingsSchema>;

