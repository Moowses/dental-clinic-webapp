import { Timestamp } from "firebase/firestore";

export type AppointmentStatus = "pending" | "confirmed" | "completed" | "cancelled";

export interface TreatmentRecord {
  notes: string;
  procedures: { id: string; name: string; price: number }[];
  inventoryUsed: { id: string; name: string; quantity: number }[];
  totalBill: number;
  completedAt: Timestamp;
}

export interface Appointment {
  id: string; // Firestore Document ID
  patientId: string; // User UID
  dentistId?: string; // Optional (assigned later or selected)
  serviceType: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  status: AppointmentStatus;
  notes?: string;
  treatment?: TreatmentRecord; // Added for clinical records
  createdAt: Timestamp;
}
