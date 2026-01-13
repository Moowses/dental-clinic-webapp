import { Timestamp } from "firebase/firestore";

export type InventoryCategory = "consumable" | "instrument" | "material" | "medication";

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  stock: number; // Current quantity
  unit: string;  // e.g. "box", "piece", "ml"
  minThreshold: number; // For low stock alerts
  costPerUnit: number;  // For billing/cost calculation
  isActive: boolean;
  updatedAt: Timestamp;
}
