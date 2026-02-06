import { db } from "../firebase/firebase";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
  runTransaction,
} from "firebase/firestore";
import { PatientRecord } from "../types/patient";
import { patientRecordSchema } from "../validations/auth";
import {
  patientRegistrationSchema,
  PatientRegistrationData,
} from "../validations/patient-registration";
import { z } from "zod";

const COLLECTION_NAME = "patient_records";
const COUNTER_DOC = "patientId";

function formatPatientId(year: number, seq: number) {
  return `${year}-${String(seq).padStart(4, "0")}`;
}

export async function assignPatientId(uid: string) {
  try {
    const docRef = doc(db, COLLECTION_NAME, uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data: any = snap.data();
      if (data?.patientId) return { success: true, patientId: data.patientId };
    }

    const nowYear = new Date().getFullYear();
    const counterRef = doc(db, "counters", COUNTER_DOC);

    const nextId = await runTransaction(db, async (tx) => {
      const counterSnap = await tx.get(counterRef);
      let year = nowYear;
      let seq = 0;

      if (counterSnap.exists()) {
        const data: any = counterSnap.data();
        const storedYear = Number(data?.year || 0);
        const storedSeq = Number(data?.seq || 0);
        if (storedYear === nowYear) {
          year = storedYear;
          seq = Number.isFinite(storedSeq) ? storedSeq : 0;
        }
      }

      const nextSeq = seq + 1;
      const pid = formatPatientId(year, nextSeq);

      tx.set(
        counterRef,
        { year, seq: nextSeq, updatedAt: serverTimestamp() },
        { merge: true }
      );

      tx.set(
        docRef,
        { uid, patientId: pid, updatedAt: serverTimestamp() },
        { merge: true }
      );

      return pid;
    });

    return { success: true, patientId: nextId };
  } catch (error) {
    console.error("Error assigning patient ID:", error);
    return { success: false, error: "Failed to assign patient ID" };
  }
}

export async function resetPatientIdCounter(year?: number) {
  try {
    const y = Number(year) || new Date().getFullYear();
    const counterRef = doc(db, "counters", COUNTER_DOC);
    await setDoc(
      counterRef,
      { year: y, seq: 0, updatedAt: serverTimestamp() },
      { merge: true }
    );
    return { success: true };
  } catch (error) {
    console.error("Error resetting patient ID counter:", error);
    return { success: false, error: "Failed to reset counter" };
  }
}

export async function getPatientRecord(uid: string) {
  try {
    const docRef = doc(db, COLLECTION_NAME, uid);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data();
      
      // Backward Compatibility: If the record is in the old flat format, 
      // wrap it in a virtual 'registration' object so the backend doesn't break.
      if (!data.registration) {
        return { 
          success: true, 
          data: {
            ...data,
            registration: {
              personal_information: {
                name: { first_name: "", last_name: "", middle_initial: "" },
                birthdate: (data as any).dateOfBirth || "",
                sex: (data as any).gender || "",
              },
              contact_information: {
                mobile_no: (data as any).phoneNumber || "",
                home_address: (data as any).address || "",
              },
              medical_history: (data as any).medicalHistory || { 
                allergies: { others: "" }, 
                conditions_checklist: [] 
              },
            }
          } as unknown as PatientRecord 
        };
      }

      return { success: true, data: data as PatientRecord };
    }
    return { success: false, error: "Record not found" };
  } catch (error) {
    console.error("Error fetching patient record:", error);
    return { success: false, error: "Failed to fetch record" };
  }
}

/**
 * Updates the comprehensive patient registration record.
 */
export async function updatePatientRegistration(
  uid: string,
  registrationData: PatientRegistrationData
) {
  try {
    // 1. Validate data structure
    const validData = patientRegistrationSchema.parse(registrationData);

    const finalDoc = {
      uid,
      registration: validData,
      updatedAt: serverTimestamp(),
      isProfileComplete: true, // Assuming if they submit this full form, it's complete
    };

    // 2. Save to Firestore
    const docRef = doc(db, COLLECTION_NAME, uid);
    await setDoc(docRef, finalDoc, { merge: true });

    return { success: true };
  } catch (error) {
    console.error("Error updating patient registration:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to update registration" };
  }
}

export async function updatePatientRecord(
  uid: string,
  data: z.input<typeof patientRecordSchema>,
  isStaff: boolean = false
) {
  try {
    // 1. Validate data structure (Old Schema)
    const validData = patientRecordSchema.parse(data);

    // 2. Map Old Schema to New Nested Registration Schema
    // We use "dot notation" for Firestore to update specific nested fields without overwriting the whole object
    const updates: any = {
      updatedAt: serverTimestamp(),
    };

    if (validData.phoneNumber) {
      updates["registration.contact_information.mobile_no"] =
        validData.phoneNumber;
    }

    if (isStaff) {
      // Map other staff-only fields
      if (validData.dateOfBirth)
        updates["registration.personal_information.birthdate"] =
          validData.dateOfBirth;
      if (validData.gender)
        updates["registration.personal_information.sex"] = validData.gender;
      if (validData.address)
        updates["registration.contact_information.home_address"] =
          validData.address;
      if (validData.emergencyContact) {
        // We might need to split this string if the new schema expects objects,
        // but for now let's assume we map it to a note or similar if strict,
        // OR just save it if the schema allows.
        // The new schema doesn't have a simple string for emergency contact, it has "contact_information".
        // Let's map it to office_no as a fallback or just ignore for now if it doesn't fit perfectly.
        // Actually, let's skip emergencyContact mapping for legacy updates to avoid breaking validation
        // unless we map it to "contact_information.home_no" or similar.
      }

      // Medical History Mapping
      if (validData.medicalHistory) {
        if (validData.medicalHistory.allergies) {
          // This is tricky because the new schema has specific boolean flags + "others" string.
          // We will map the array to the "others" string for safety.
          updates["registration.medical_history.allergies.others"] =
            validData.medicalHistory.allergies.join(", ");
        }
        if (validData.medicalHistory.conditions) {
          updates["registration.medical_history.conditions_checklist"] =
            validData.medicalHistory.conditions;
        }
        if (validData.medicalHistory.medications) {
          updates[
            "registration.medical_history.general_health_screening.taking_medication.medication_list"
          ] = validData.medicalHistory.medications;
          updates[
            "registration.medical_history.general_health_screening.taking_medication.status"
          ] = true;
        }
      }

      // Check completeness (Simple logic for legacy update)
      if (validData.dateOfBirth && validData.address && validData.gender) {
        updates.isProfileComplete = true;
      }
    }

    // 3. Save to Firestore
    const docRef = doc(db, COLLECTION_NAME, uid);
    await setDoc(docRef, updates, { merge: true });

    return { success: true };
  } catch (error) {
    console.error("Error updating patient record:", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to update record" };
  }
}
