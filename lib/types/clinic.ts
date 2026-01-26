import { z } from "zod";
import { clinicSettingsSchema } from "../validations/clinic";

export interface DentalProcedure {
  id: string;
  code: string; // e.g. "D1110"
  name: string; // e.g. "Prophylaxis - Adult"
  basePrice: number; // The standard price charged to the patient
  description?: string;
  isActive: boolean;
  requiredInventory?: { inventoryItemId: string; quantity: number }[];
}

export type ClinicSettings = z.infer<typeof clinicSettingsSchema>;