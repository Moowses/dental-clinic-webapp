"use server";

import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/firebase";

export async function getBillingReport(rangeDays: number) {
  const { fromStr, toStr } = computeDateRangeStrings(rangeDays);

  const q = query(
    collection(db, "billing_records"),
    where("date", ">=", fromStr),
    where("date", "<=", toStr)
  );

  const snap = await getDocs(q);

  const rows = snap.docs
    .map((doc) => {
      const a: any = doc.data();
      const total = Number(a.totalBill ?? 0);
      if (!Number.isFinite(total) || total <= 0) return null;

      const paymentStatus = String(a.paymentStatus ?? "").toLowerCase();
      const status =
        paymentStatus === "paid"
          ? "paid"
          : paymentStatus === "partial"
          ? "partial"
          : "unpaid";

      const remainingBalance =
        status === "paid"
          ? 0
          : status === "partial"
          ? Number(a.remainingBalance ?? total)
          : total;

      const createdAt =
        a.paymentDate?.toDate?.()?.toISOString?.() ??
        a.createdAt?.toDate?.()?.toISOString?.() ??
        (a.date && a.time ? new Date(`${a.date}T${a.time}:00`).toISOString() : undefined);

      return {
        id: doc.id,
        appointmentId: doc.id,
        patientId: a.patientId,
        patientName: a.patientName,
        totalAmount: total,
        remainingBalance: Number.isFinite(remainingBalance) ? remainingBalance : total,
        status,
        createdAt,
      };
    })
    .filter(Boolean) as any[];

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
 * Backwards-compatible alias for the report panel.
 * BillingReportPanel currently calls getBillingDetailsAction(rangeDays as string).
 * Keeping this avoids breaking other imports while fixing the runtime error.
 */
export async function getBillingDetailsAction(rangeDays: string | number) {
  const n =
    typeof rangeDays === "number"
      ? rangeDays
      : Number.parseInt(String(rangeDays), 10);

  const safeDays = Number.isFinite(n) && n > 0 ? n : 30;
  return getBillingReport(safeDays);
}

function computeDateRangeStrings(rangeDays: number) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - (rangeDays - 1));
  return { fromStr: toLocalYYYYMMDD(start), toStr: toLocalYYYYMMDD(now) };
}

function toLocalYYYYMMDD(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
