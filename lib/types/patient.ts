import { Timestamp } from "firebase/firestore";

export type Gender = "male" | "female" | "other";

export interface MedicalHistory {
  allergies: string[];      // e.g. ["Penicillin", "Latex"]
  conditions: string[];     // e.g. ["Diabetes", "Hypertension"]
  medications?: string;     // Free text for current meds
  notes?: string;           // "Anxious patient", "Gag reflex"
}

export interface PatientRecord {
  uid: string; // Matches UserProfile.uid
  phoneNumber: string;
  dateOfBirth?: string;
  gender?: Gender;
  address?: string;
  emergencyContact?: string;
  medicalHistory: MedicalHistory; // Now required, but can be empty arrays
  isProfileComplete: boolean;
  updatedAt: Timestamp;
}