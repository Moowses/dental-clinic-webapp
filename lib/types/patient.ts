import { Timestamp } from "firebase/firestore";
import { PatientRegistrationData } from "../validations/patient-registration";

export interface PatientRecord {
  uid: string; // Matches UserProfile.uid
  registration: PatientRegistrationData;
  isProfileComplete: boolean;
  updatedAt: Timestamp;
}
