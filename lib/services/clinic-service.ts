import { db } from "../firebase/firebase";
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy 
} from "firebase/firestore";
import { DentalProcedure } from "../types/clinic";
import { procedureSchema } from "../validations/clinic";
import { z } from "zod";

const COLLECTION_NAME = "procedures";

export async function getAllProcedures(onlyActive: boolean = true) {
  try {
    const ref = collection(db, COLLECTION_NAME);
    let q;
    
    if (onlyActive) {
      q = query(ref, where("isActive", "==", true), orderBy("code", "asc"));
    } else {
      q = query(ref, orderBy("code", "asc"));
    }

    const snap = await getDocs(q);
    return { 
      success: true, 
      data: snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DentalProcedure)) 
    };
  } catch (error) {
    console.error("Error fetching procedures:", error);
    return { success: false, error: "Failed to load procedures" };
  }
}

export async function createProcedure(data: z.infer<typeof procedureSchema>) {
  try {
    const validData = procedureSchema.parse(data);
    const docRef = await addDoc(collection(db, COLLECTION_NAME), validData);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error creating procedure:", error);
    return { success: false, error: "Failed to create procedure" };
  }
}

export async function updateProcedure(id: string, data: Partial<z.infer<typeof procedureSchema>>) {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, data);
    return { success: true };
  } catch (error) {
    console.error("Error updating procedure:", error);
    return { success: false, error: "Failed to update procedure" };
  }
}

export async function deleteProcedure(id: string) {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    // Soft delete by default
    await updateDoc(docRef, { isActive: false });
    return { success: true };
  } catch (error) {
    console.error("Error deleting procedure:", error);
    return { success: false, error: "Failed to delete procedure" };
  }
}
