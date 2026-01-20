import type { Timestamp } from "firebase/firestore";
import type { PatientRegistrationData } from "../validations/patient-registration";

export type PatientRecord = {
  uid: string; // Matches UserProfile.uid

  // Account profile fields used across pages
  displayName?: string;
  email?: string;
  phoneNumber?: string;

  dateOfBirth?: string;
  gender?: "male" | "female" | "other";
  emergencyContact?: string;
  address?: string;

  // Admin/booking flags
  isProfileComplete?: boolean;

  // Backend-test / registration flow (make optional to avoid TS build breaks)
  registration?: PatientRegistrationData;

  // Legacy/simple medical history used by admin panel
  medicalHistory?: {
    allergies?: string[];
    conditions?: string[];
    medications?: string;
  };

  createdAt?: Timestamp | any;
  updatedAt?: Timestamp | any;
};
