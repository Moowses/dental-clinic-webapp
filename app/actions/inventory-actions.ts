import { ActionState } from "@/lib/utils";
import { inventorySchema } from "@/lib/validations/inventory";
import { addInventoryItem, updateInventoryItem, adjustStock } from "@/lib/services/inventory-service";
import { getUserProfile } from "@/lib/services/user-service";
import { InventoryItem } from "@/lib/types/inventory";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/firebase";

export async function addInventoryItemAction(prevState: ActionState, data: FormData): Promise<ActionState> {
  console.log("Action: Adding Inventory Item...");
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  const profile = await getUserProfile(auth.currentUser.uid);
  console.log("User Role:", profile.data?.role);
  
  // Allow any Staff member to add items
  if (!profile.success || profile.data?.role === "client") {
    console.error("Action Failed: Unauthorized");
    return { success: false, error: "Unauthorized: Staff access required" };
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
  if (!parsed.success) {
    console.error("Action Failed: Validation Error", parsed.error);
    return { success: false, error: parsed.error.issues[0].message };
  }

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

export async function updateInventoryItemAction(itemId: string, data: FormData): Promise<ActionState> {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || profile.data?.role === "client") {
    return { success: false, error: "Unauthorized" };
  }

  const rawData = Object.fromEntries(data);
  const formattedData = {
    ...rawData,
    stock: Number(rawData.stock),
    minThreshold: Number(rawData.minThreshold),
    costPerUnit: Number(rawData.costPerUnit),
    isActive: rawData.isActive === "true" || rawData.isActive === "on"
  };

  const parsed = inventorySchema.safeParse(formattedData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  return await updateInventoryItem(itemId, parsed.data);
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

export async function getInventoryReport() {
  const snap = await getDocs(collection(db, "inventory"));

  const rows = snap.docs.map((doc) => {
    const data: any = doc.data();

    const qtyOnHand = Number(data.qtyOnHand ?? data.quantity ?? 0);
    const reorderLevel =
      typeof data.reorderLevel === "number" ? data.reorderLevel : undefined;

    return {
      id: doc.id,
      name: data.name ?? "Unnamed Item",
      sku: data.sku,
      category: data.category,
      qtyOnHand,
      reorderLevel,
      unit: data.unit,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? data.updatedAt,
    };
  });

  const totalItems = rows.length;
  const lowStockCount = rows.filter(
    (r) => typeof r.reorderLevel === "number" && r.qtyOnHand <= r.reorderLevel
  ).length;
  const outOfStockCount = rows.filter((r) => r.qtyOnHand <= 0).length;

  return {
    rows,
    summary: {
      totalItems,
      lowStockCount,
      outOfStockCount,
    },
  };
}