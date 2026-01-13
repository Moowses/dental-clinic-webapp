import { Timestamp } from "firebase/firestore";

export interface Shift {
  start: string; // HH:mm (e.g., "09:00")
  end: string;   // HH:mm (e.g., "17:00")
  isActive: boolean;
}

export interface WeeklySchedule {
  monday?: Shift;
  tuesday?: Shift;
  wednesday?: Shift;
  thursday?: Shift;
  friday?: Shift;
  saturday?: Shift;
  sunday?: Shift;
}

export interface DentistProfile {
  uid: string; // Matches UserProfile.uid
  bio?: string;
  specialties: string[];
  supportedServiceIds: string[]; // List of IDs from the 'services' collection
  schedule: WeeklySchedule;
  updatedAt: Timestamp;
}