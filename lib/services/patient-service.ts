import { db } from "../firebase/firebase";
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { PatientRecord } from "../types/patient";
import { patientRecordSchema } from "../validations/auth";
import { z } from "zod";

const COLLECTION_NAME = "patient_records";

export async function getPatientRecord(uid: string) {
  try {
    const docRef = doc(db, COLLECTION_NAME, uid);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      return { success: true, data: snap.data() as PatientRecord };
    }
    return { success: false, error: "Record not found" };
  } catch (error) {
    console.error("Error fetching patient record:", error);
    return { success: false, error: "Failed to fetch record" };
  }
}

export async function updatePatientRecord(uid: string, data: z.input<typeof patientRecordSchema>, isStaff: boolean = false) {
  try {
    // 1. Validate data structure
    const validData = patientRecordSchema.parse(data);

    const finalData: Partial<PatientRecord> & { updatedAt: ReturnType<typeof serverTimestamp> } = {
      uid,
      updatedAt: serverTimestamp() as unknown as Timestamp,
    };

    if (isStaff) {
      // Staff can update everything
      Object.assign(finalData, validData);

      // Check for clinical completeness
      finalData.isProfileComplete = !!(
        validData.dateOfBirth &&
        validData.address &&
        validData.emergencyContact &&
        validData.gender &&
        validData.medicalHistory // Ensure medical history object exists
      );
    } else {
      // Clients can ONLY update their phone number
      finalData.phoneNumber = validData.phoneNumber;
      // We do NOT set isProfileComplete to true here, even if it was true before.
      // Usually, we keep the existing status.
    }

    // 2. Save to Firestore
    const docRef = doc(db, COLLECTION_NAME, uid);
    await setDoc(docRef, finalData, { merge: true });

    return { success: true };
  } catch (error) {
    console.error("Error updating patient record:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to update record" };
  }
}
