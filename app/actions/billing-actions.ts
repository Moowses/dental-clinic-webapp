import { getUserProfile } from "@/lib/services/user-service";
import {
  getBillingDetails,
  setupPaymentPlan,
  getAllBillingRecords,
  getBillingRecordsByPatient,
  processPayment,
  payInstallment,
} from "@/lib/services/billing-service";
import { BillingInstallment, BillingRecord } from "@/lib/types/billing";

/**
 * Get billing details for ONE appointment
 */
export async function getBillingDetailsAction(
  appointmentId: string
): Promise<{ success: boolean; data?: BillingRecord; error?: string; isVirtual?: boolean }> {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  // Keep your existing behavior
  return await getBillingDetails(appointmentId);
}

type BillableStatus = "unpaid" | "paid" | "plan" | "void" | "waived" | string;

function isExcludedFromBalance(status: BillableStatus) {
  const s = String(status || "").toLowerCase();
  return s === "paid" || s === "void" || s === "waived";
}

/**
 * LEGACY: Creates plan at appointment-level (paymentPlan.installments)
 * and marks selected items as "plan"
 */
export async function createPaymentPlanAction(
  appointmentId: string,
  months: number,
  selectedItemIds: string[] = []
): Promise<{ success: boolean; error?: string }> {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || !profile.data || profile.data.role === "client") {
    return { success: false, error: "Unauthorized: Staff only" };
  }

  const safeMonths = Number(months);
  if (!Number.isFinite(safeMonths) || safeMonths < 1 || safeMonths > 36) {
    return { success: false, error: "Invalid months. Must be 1–36." };
  }

  const billRes = await getBillingDetails(appointmentId);
  if (!billRes.success || !billRes.data) return { success: false, error: "Bill not found" };

  const bill = billRes.data;
  const items = Array.isArray((bill as any).items) ? ((bill as any).items as any[]) : [];

  const eligibleIds =
    selectedItemIds.length > 0
      ? selectedItemIds
      : items
          .filter((it) => !isExcludedFromBalance(it.status as BillableStatus))
          .map((it) => it.id);

  let planTotal = 0;

  if (items.length > 0) {
    planTotal = items
      .filter((it) => eligibleIds.includes(it.id))
      .filter((it) => !isExcludedFromBalance(it.status as BillableStatus))
      .reduce((sum, it) => sum + Number(it.price || 0), 0);
  } else {
    planTotal = Number((bill as any).remainingBalance || 0);
  }

  if (!Number.isFinite(planTotal) || planTotal <= 0) {
    return { success: false, error: "No balance to split" };
  }

  const rawPerMonth = planTotal / safeMonths;
  const amountPerMonth = Math.floor(rawPerMonth * 100) / 100;

  const installments: BillingInstallment[] = [];
  let due = new Date();

  for (let i = 0; i < safeMonths; i++) {
    due = new Date(due);
    due.setMonth(due.getMonth() + 1);

    const amt =
      i === safeMonths - 1
        ? Number((planTotal - amountPerMonth * (safeMonths - 1)).toFixed(2))
        : amountPerMonth;

    installments.push({
      id: crypto.randomUUID(),
      dueDate: due.toISOString().split("T")[0],
      amount: amt,
      status: "pending",
      // Optional description (helps UI)
      description: `Installment ${i + 1} of ${safeMonths}`,
    } as any);
  }

  // Uses your real service function
  return await setupPaymentPlan(appointmentId, installments, eligibleIds);
}

/**
 * Get all billing records (admin)
 */
export async function getAllBillingAction(
  filter: "paid" | "unpaid" | "partial" | "all" = "all"
): Promise<{ success: boolean; data?: BillingRecord[]; error?: string }> {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || !profile.data || profile.data.role === "client") {
    return { success: false, error: "Unauthorized: Staff only" };
  }

  return await getAllBillingRecords(filter);
}

/**
 * LEGACY installment payment (appointmentId + installmentId)
 */
export async function payInstallmentAction(
  appointmentId: string,
  installmentId: string,
  method: string
) {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || !profile.data || profile.data.role === "client") {
    return { success: false, error: "Unauthorized: Staff only" };
  }

  return await payInstallment(appointmentId, installmentId, method, auth.currentUser.uid);
}

/**
 * NEW (compat): Installment payment signature used by your new UI
 * (appointmentId + itemId + installmentId + method)
 * - service still pays by installmentId, so itemId is ignored (for now)
 */
export async function payItemInstallmentAction(
  appointmentId: string,
  itemId: string,
  installmentId: string,
  method: string
) {
  // itemId is currently not needed by the legacy service data model
  return await payInstallmentAction(appointmentId, installmentId, method);
}

/**
 * Billing records by patient (admin)
 */
export async function getBillingByPatientAction(
  patientId: string,
  filter: "paid" | "unpaid" | "partial" | "all" = "all"
): Promise<{ success: boolean; data?: BillingRecord[]; error?: string }> {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || !profile.data || profile.data.role === "client") {
    return { success: false, error: "Unauthorized: Staff only" };
  }

  return await getBillingRecordsByPatient(patientId, filter);
}

/**
 * NEW: Payment recorder used by the new BillingPaymentPlansPanel
 * - uses processPayment (existing service)
 */
export async function recordBillingPaymentAction(input: {
  appointmentId: string;
  amount: number;
  method: string;
  note?: string;
  itemIds?: string[];
}) {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || !profile.data || profile.data.role === "client") {
    return { success: false, error: "Unauthorized: Staff only" };
  }

  return await processPayment(
    input.appointmentId,
    Number(input.amount || 0),
    String(input.method || "cash"),
    auth.currentUser.uid,
    Array.isArray(input.itemIds) ? input.itemIds : []
  );
}
export async function createItemPaymentPlanAction(input: {
  appointmentId: string;
  itemId: string;
  terms: number;
  description?: string;
}) {
  // If your service already has createItemInstallmentPlan wrapper (from our previous patch),
  // call it. Otherwise fallback to legacy createPaymentPlanAction.
  try {
    const { createItemInstallmentPlan } = await import("@/lib/services/billing-service");
    const res = await createItemInstallmentPlan(
      input.appointmentId,
      input.itemId,
      input.terms,
      input.description || ""
    );
    return res?.success === false ? res : { success: true };
  } catch {
    // fallback: create plan using legacy function (months = terms) for the single item
    return await createPaymentPlanAction(input.appointmentId, input.terms, [input.itemId]);
  }
}