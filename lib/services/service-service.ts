import { db } from "../firebase/firebase";
import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy 
} from "firebase/firestore";
import { DentalService } from "../types/service";
import { serviceSchema } from "../validations/service";
import { z } from "zod";

const COLLECTION_NAME = "services";

export async function getAllServices(onlyActive: boolean = true) {
  try {
    const servicesRef = collection(db, COLLECTION_NAME);
    let q;
    
    if (onlyActive) {
      q = query(servicesRef, where("isActive", "==", true), orderBy("name", "asc"));
    } else {
      q = query(servicesRef, orderBy("name", "asc"));
    }

    const snap = await getDocs(q);
    return { 
      success: true, 
      data: snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DentalService)) 
    };
  } catch (error) {
    console.error("Error fetching services:", error);
    return { success: false, error: "Failed to load services" };
  }
}

export async function createService(data: z.infer<typeof serviceSchema>) {
  try {
    const validData = serviceSchema.parse(data);
    const docRef = await addDoc(collection(db, COLLECTION_NAME), validData);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error creating service:", error);
    return { success: false, error: "Failed to create service" };
  }
}

export async function updateService(id: string, data: Partial<z.infer<typeof serviceSchema>>) {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, data);
    return { success: true };
  } catch (error) {
    console.error("Error updating service:", error);
    return { success: false, error: "Failed to update service" };
  }
}

export async function deleteService(id: string, hardDelete: boolean = false) {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    if (hardDelete) {
      await deleteDoc(docRef);
    } else {
      await updateDoc(docRef, { isActive: false });
    }
    return { success: true };
  } catch (error) {
    console.error("Error deleting service:", error);
    return { success: false, error: "Failed to delete service" };
  }
}
