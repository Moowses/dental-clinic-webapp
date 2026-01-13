import { ActionState } from "@/lib/utils";
import { inventorySchema } from "@/lib/validations/inventory";
import { addInventoryItem, updateInventoryItem, adjustStock } from "@/lib/services/inventory-service";
import { getUserProfile } from "@/lib/services/user-service";
import { InventoryItem } from "@/lib/types/inventory";

export async function addInventoryItemAction(prevState: ActionState, data: FormData): Promise<ActionState> {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || profile.data?.role !== "admin") {
    return { success: false, error: "Unauthorized: Admin access required" };
  }

  const rawData = Object.fromEntries(data);
  const formattedData = {
    ...rawData,
    stock: Number(rawData.stock),
    minThreshold: Number(rawData.minThreshold),
    costPerUnit: Number(rawData.costPerUnit),
    isActive: true
  };

  const parsed = inventorySchema.safeParse(formattedData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  return await addInventoryItem(parsed.data);
}

export async function adjustStockAction(itemId: string, amount: number): Promise<ActionState> {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  const profile = await getUserProfile(auth.currentUser.uid);
  const isStaff = profile.success && profile.data && profile.data.role !== "client";
  
  if (!isStaff) return { success: false, error: "Unauthorized" };

  return await adjustStock(itemId, amount);
}

export async function deleteInventoryItemAction(itemId: string): Promise<ActionState> {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || profile.data?.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  return await updateInventoryItem(itemId, { isActive: false } as Partial<InventoryItem>);
}
