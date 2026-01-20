import type { Timestamp, FieldValue } from "firebase/firestore";

export type BillingStatus = "unpaid" | "partial" | "paid" | "overdue" | "refunded";

export interface BillingTransaction {
  id: string;
  amount: number;
  method: "cash" | "card" | "insurance" | "bank_transfer" | "other";
  date: Timestamp;
  note?: string;
  recordedBy?: string;
}

export interface BillingInstallment {
  id: string;
  dueDate: string; // YYYY-MM-DD
  amount: number;
  status: "pending" | "paid" | "overdue" | "cancelled";
  paidAt?: Timestamp;
}

export interface BillingItem {
  id: string;
  name: string;
  price: number;
  status: "unpaid" | "plan" | "paid";
}

export interface BillingRecord {
  id: string;
  appointmentId: string;
  patientId: string;

  totalAmount: number;
  remainingBalance: number;
  status: BillingStatus;

  items: BillingItem[];

  paymentPlan: {
    type: "full" | "installments";
    installments: BillingInstallment[];
  };

  transactions: BillingTransaction[];

  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
}
