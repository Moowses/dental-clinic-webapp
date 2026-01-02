import { Timestamp } from "firebase/firestore";

export type UserRole = "client" | "admin" | "front-desk" | "dentist";

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  displayName?: string;
  createdAt: Timestamp;
}
