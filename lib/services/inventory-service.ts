import { db } from "../firebase/firebase";
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  where, 
  orderBy,
  increment,
  serverTimestamp
} from "firebase/firestore";
import { InventoryItem } from "../types/inventory";
import { inventorySchema } from "../validations/inventory";
import { z } from "zod";

const COLLECTION_NAME = "inventory";

export async function getInventory(onlyActive: boolean = true) {
  try {
    const ref = collection(db, COLLECTION_NAME);
    let q;
    
    if (onlyActive) {
      q = query(ref, where("isActive", "==", true), orderBy("name", "asc"));
    } else {
      q = query(ref, orderBy("name", "asc"));
    }

    const snap = await getDocs(q);
    return { 
      success: true, 
      data: snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem)) 
    };
  } catch (error) {
    console.error("Error fetching inventory:", error);
    return { success: false, error: "Failed to load inventory" };
  }
}

export async function addInventoryItem(data: z.infer<typeof inventorySchema>) {
  try {
    const validData = inventorySchema.parse(data);
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...validData,
      updatedAt: serverTimestamp(),
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error adding inventory item:", error);
    return { success: false, error: "Failed to add item" };
  }
}

export async function updateInventoryItem(id: string, data: Partial<z.infer<typeof inventorySchema>>) {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error updating inventory item:", error);
    return { success: false, error: "Failed to update item" };
  }
}

export async function adjustStock(id: string, amount: number) {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      stock: increment(amount),
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error adjusting stock:", error);
    return { success: false, error: "Failed to adjust stock" };
  }
}
