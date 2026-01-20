import type { Timestamp } from "firebase/firestore";
import type { PatientRegistrationData } from "../validations/patient-registration";

export type PatientRecord = {
  uid: string;

  // Used in client-dashboard + admin panel
  displayName?: string;
  email?: string;
  phoneNumber?: string;

  dateOfBirth?: string;
  gender?: "male" | "female" | "other";
  emergencyContact?: string;
  address?: string;

  // Used in appointment-actions.ts
  isProfileComplete?: boolean;

  // Used in backend-test/page.tsx
  registration?: PatientRegistrationData;

  // Used in PatientRecordsPanel.tsx
  medicalHistory?: {
    allergies?: string[];
    conditions?: string[];
    medications?: string;
  };

  createdAt?: Timestamp | any;
  updatedAt?: Timestamp | any;
};
