// app/actions/billing-report-actions.ts
// NOTE:
// This file is imported by a Client Component (BillingReportPanel.tsx).
// Do NOT add `"use server"` here.
//
// Why?
// - Firestore security rules require request.auth for reads.
// - If this runs as a Server Action, there is no Firebase Auth context,
//   so reads to `billing_records` will fail with:
//   "Missing or insufficient permissions."

import {
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase/firebase";
import { getUserProfile } from "@/lib/services/user-service";

type ReportRow = {
  id: string;
  appointmentId?: string;
  patientId?: string;
  patientName?: string;
  totalAmount: number;
  remainingBalance: number;
  status: string;
  createdAt?: string;
};

export async function getBillingReport(rangeDays: number) {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) throw new Error("Not authenticated");

  // Ensure only staff can view the report (align with your app behavior)
  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || !profile.data) throw new Error("Unable to load user profile");
  if (profile.data.role === "client") throw new Error("Unauthorized: Staff only");

  const { fromTs, toTs } = computeDateRangeTimestamps(rangeDays);

  // Your documents have `createdAt` (Timestamp). Using date strings will not work.
  // Also, range queries require an orderBy on the same field.
  const q = query(
    collection(db, "billing_records"),
    where("createdAt", ">=", fromTs),
    where("createdAt", "<=", toTs),
    orderBy("createdAt", "desc")
  );

  const snap = await getDocs(q);

  const rows: ReportRow[] = snap.docs.map((doc) => {
    const a: any = doc.data();

    const totalAmount = Number(a.totalAmount ?? a.totalBill ?? a.total ?? 0);
    const remainingBalance = Number(a.remainingBalance ?? a.remaining ?? 0);
    const status = String(a.status ?? a.paymentStatus ?? "unpaid").toLowerCase();

    const createdAtIso =
      a.createdAt?.toDate?.()?.toISOString?.() ??
      a.updatedAt?.toDate?.()?.toISOString?.() ??
      undefined;

    return {
      id: doc.id,
      appointmentId: String(a.appointmentId ?? doc.id),
      patientId: a.patientId,
      patientName: a.patientName,
      totalAmount: Number.isFinite(totalAmount) ? totalAmount : 0,
      remainingBalance: Number.isFinite(remainingBalance)
        ? remainingBalance
        : Number.isFinite(totalAmount)
        ? totalAmount
        : 0,
      status,
      createdAt: createdAtIso,
    };
  });

  // Summary
  let totalBilled = 0;
  let totalOutstanding = 0;
  const byStatus: Record<string, number> = {};

  for (const r of rows) {
    totalBilled += r.totalAmount || 0;
    totalOutstanding += r.remainingBalance || 0;
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  }

  const totalCollected = Math.max(0, totalBilled - totalOutstanding);

  return {
    rows,
    summary: {
      totalRecords: rows.length,
      totalBilled,
      totalCollected,
      totalOutstanding,
      byStatus,
    },
  };
}

/**
 * Backwards-compatible alias.
 * Some older UI versions called `getBillingDetailsAction(String(rangeDays))`.
 */
export async function getBillingDetailsAction(rangeDays: string | number) {
  const n = typeof rangeDays === "number" ? rangeDays : Number.parseInt(String(rangeDays), 10);
  const safeDays = Number.isFinite(n) && n > 0 ? n : 30;
  return getBillingReport(safeDays);
}

function computeDateRangeTimestamps(rangeDays: number) {
  const safe = Number.isFinite(rangeDays) && rangeDays > 0 ? rangeDays : 30;

  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - (safe - 1));

  // Normalize to day boundaries (local time) for a nicer UX.
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  return {
    fromTs: Timestamp.fromDate(start),
    toTs: Timestamp.fromDate(end),
  };
}
