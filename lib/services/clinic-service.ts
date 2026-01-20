import { db } from "../firebase/firebase";
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDoc,
  setDoc,
  query, 
  where, 
  orderBy 
} from "firebase/firestore";
import { DentalProcedure, ClinicSettings } from "../types/clinic";
import { procedureSchema, clinicSettingsSchema } from "../validations/clinic";
import { z } from "zod";

const COLLECTION_NAME = "procedures";
const SETTINGS_COLLECTION = "clinic_settings";
const SETTINGS_DOC_ID = "general";

const DEFAULT_HOURS = {
  open: "09:00",
  close: "17:00",
  isOpen: true
};

const DEFAULT_SETTINGS: ClinicSettings = {
  maxConcurrentPatients: 1,
  operatingHours: {
    monday: DEFAULT_HOURS,
    tuesday: DEFAULT_HOURS,
    wednesday: DEFAULT_HOURS,
    thursday: DEFAULT_HOURS,
    friday: DEFAULT_HOURS,
    saturday: { ...DEFAULT_HOURS, close: "12:00" },
    sunday: { ...DEFAULT_HOURS, isOpen: false }
  }
};

export async function getClinicSettings() {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    const snap = await getDoc(docRef);
    
    if (snap.exists()) {
      return { success: true, data: snap.data() as ClinicSettings };
    }
    
    // Return defaults if not set
    return { success: true, data: DEFAULT_SETTINGS };
  } catch (error) {
    console.error("Error loading clinic settings:", error);
    return { success: false, error: "Failed to load settings" };
  }
}

export async function updateClinicSettings(data: ClinicSettings) {
  try {
    const validData = clinicSettingsSchema.parse(data);
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    await setDoc(docRef, validData, { merge: true });
    return { success: true };
  } catch (error) {
    console.error("Error saving clinic settings:", error);
    return { success: false, error: "Failed to save settings" };
  }
}

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
