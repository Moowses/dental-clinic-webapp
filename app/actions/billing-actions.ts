import { getUserProfile } from "@/lib/services/user-service";
import { getBillingDetails, setupPaymentPlan } from "@/lib/services/billing-service";
import { BillingInstallment, BillingRecord } from "@/lib/types/billing";

export async function getBillingDetailsAction(
  appointmentId: string
): Promise<{ success: boolean; data?: BillingRecord; error?: string; isVirtual?: boolean }> {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  // Ideally check if user owns appointment OR is staff
  return await getBillingDetails(appointmentId);
}

type BillableStatus = "unpaid" | "paid" | "plan" | "void" | "waived" | string;

function isExcludedFromBalance(status: BillableStatus) {
  const s = String(status || "").toLowerCase();
  return s === "paid" || s === "void" || s === "waived";
}

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

  // If no billable items exist, fallback to remainingBalance behavior (legacy)
  const items = Array.isArray((bill as any).items) ? ((bill as any).items as any[]) : [];

  // Determine which IDs should be planned:
  // - if selectedItemIds provided: only those
  // - else: all items that are NOT excluded (unpaid + plan)
  const eligibleIds =
    selectedItemIds.length > 0
      ? selectedItemIds
      : items
          .filter((it) => !isExcludedFromBalance(it.status as BillableStatus))
          .map((it) => it.id);

  // Compute plan total
  let planTotal = 0;

  if (items.length > 0) {
    // Sum only the items included in eligibleIds, but ignore excluded statuses
    planTotal = items
      .filter((it) => eligibleIds.includes(it.id))
      .filter((it) => !isExcludedFromBalance(it.status as BillableStatus))
      .reduce((sum, it) => sum + Number(it.price || 0), 0);
  } else {
    // Legacy fallback: use remainingBalance
    planTotal = Number((bill as any).remainingBalance || 0);
  }

  if (!Number.isFinite(planTotal) || planTotal <= 0) {
    return { success: false, error: "No balance to split" };
  }

  // Installments
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
    });
  }

  // IMPORTANT:
  // setupPaymentPlan currently accepts only (appointmentId, installments, selectedItemIds)
  // We pass the computed IDs (eligibleIds) so the service can mark those items as "plan".
  return await setupPaymentPlan(appointmentId, installments, eligibleIds);
}

export async function getAllBillingAction(
  filter: "paid" | "unpaid" | "partial" | "all" = "all"
): Promise<{ success: boolean; data?: BillingRecord[]; error?: string }> {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || !profile.data || profile.data.role === "client") {
    return { success: false, error: "Unauthorized: Staff only" };
  }

  const { getAllBillingRecords } = await import("@/lib/services/billing-service");
  return await getAllBillingRecords(filter);
}

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

  const { payInstallment } = await import("@/lib/services/billing-service");
  return await payInstallment(appointmentId, installmentId, method, auth.currentUser.uid);
}

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

  const { getBillingRecordsByPatient } = await import("@/lib/services/billing-service");
  return await getBillingRecordsByPatient(patientId, filter);
}
