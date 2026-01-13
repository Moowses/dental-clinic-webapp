import { db } from "../firebase/firebase";
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { DentistProfile } from "../types/dentist";
import { UserProfile } from "../types/user";
import { dentistProfileSchema } from "../validations/auth";
import { z } from "zod";

const COLLECTION_NAME = "dentist_profiles";

export async function getAllDentists() {
  try {
    // 1. Get all users with role 'dentist'
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("role", "==", "dentist"));
    const userSnap = await getDocs(q);
    
    // 2. Fetch all profiles from dentist_profiles
    const profilesSnap = await getDocs(collection(db, COLLECTION_NAME));
    const profilesMap = new Map(profilesSnap.docs.map(doc => [doc.id, doc.data() as DentistProfile]));

    // 3. Join them
    const dentists = userSnap.docs.map(doc => {
      const userData = doc.data() as UserProfile;
      return {
        ...userData,
        profile: profilesMap.get(doc.id)
      };
    });

    return { success: true, data: dentists };
  } catch (error) {
    console.error("Error fetching all dentists:", error);
    return { success: false, error: "Failed to load dentist list" };
  }
}

export async function updateDentistServices(uid: string, serviceIds: string[]) {
  try {
    const docRef = doc(db, COLLECTION_NAME, uid);
    await setDoc(docRef, {
      supportedServiceIds: serviceIds,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error("Error updating dentist services:", error);
    return { success: false, error: "Failed to update skills" };
  }
}

export async function getDentistProfile(uid: string) {
  try {
    const docRef = doc(db, COLLECTION_NAME, uid);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      return { success: true, data: snap.data() as DentistProfile };
    }
    return { success: false, error: "Profile not found" };
  } catch (error) {
    console.error("Error fetching dentist profile:", error);
    return { success: false, error: "Failed to fetch profile" };
  }
}

export async function updateDentistProfile(uid: string, data: z.infer<typeof dentistProfileSchema>) {
  try {
    const validData = dentistProfileSchema.parse(data);

    const docRef = doc(db, COLLECTION_NAME, uid);
    await setDoc(docRef, {
      ...validData,
      uid,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    return { success: true };
  } catch (error) {
    console.error("Error updating dentist profile:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to update profile" };
  }
}
