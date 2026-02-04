import { Timestamp } from "firebase/firestore";

export type InventoryCategory =
  | "supplies"
  | "consumables"
  | "medicines"
  | "instruments"
  | "tools"
  | "equipment"
  | "sterilization"
  | "anesthetics"
  | "impression"
  | "restorative"
  | "endodontic"
  | "orthodontic"
  | "prosthodontic"
  | "surgical"
  | "ppe"
  | "syringes-needles"
  | "other";

export interface InventoryItem {
  id: string;
  itemCode?: string; // INV-XXXX
  name: string;
  category: InventoryCategory;
  tag?: "consumable" | "material";
  stock: number; // Current quantity
  unit: string;  // e.g. "box", "piece", "ml"
  minThreshold: number; // For low stock alerts
  costPerUnit: number;  // For billing/cost calculation
  batchNumber?: string;
  expirationDate?: string; // YYYY-MM-DD
  isActive: boolean;
  updatedAt: Timestamp;
}
