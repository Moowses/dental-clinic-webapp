// lib/services/dentist-profile-service.ts
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/firebase";

export type DentistProfile = {
  uid: string;
  displayName?: string;
  email?: string;
  specialties?: string[];
  updatedAt?: any;
};

export async function getDentistProfileByUid(dentistUid: string): Promise<DentistProfile | null> {
  if (!dentistUid) return null;

  const q = query(collection(db, "dentist_profiles"), where("uid", "==", dentistUid));
  const snap = await getDocs(q);

  if (snap.empty) return null;

  const doc = snap.docs[0];
  return doc.data() as DentistProfile;
}
