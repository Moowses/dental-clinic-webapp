import { getUserProfile } from "@/lib/services/user-service";
import { 
  getBillingDetails, 
  setupPaymentPlan 
} from "@/lib/services/billing-service";
import { BillingInstallment } from "@/lib/types/billing";

export async function getBillingDetailsAction(appointmentId: string) {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  // Ideally check if user owns appointment OR is staff
  return await getBillingDetails(appointmentId);
}

export async function createPaymentPlanAction(
  appointmentId: string, 
  months: number
) {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || !profile.data || profile.data.role === 'client') {
    return { success: false, error: "Unauthorized: Staff only" };
  }

  // Logic to calculate dates and amounts
  const billRes = await getBillingDetails(appointmentId);
  if (!billRes.success || !billRes.data) return { success: false, error: "Bill not found" };

  const balance = billRes.data.remainingBalance;
  if (balance <= 0) return { success: false, error: "No balance to split" };

  const amountPerMonth = Math.floor((balance / months) * 100) / 100;
  const installments: BillingInstallment[] = [];
  let currentDate = new Date();

  for (let i = 0; i < months; i++) {
    currentDate.setMonth(currentDate.getMonth() + 1);
    installments.push({
      id: crypto.randomUUID(),
      dueDate: currentDate.toISOString().split('T')[0],
      amount: i === months - 1 ? (balance - (amountPerMonth * (months - 1))) : amountPerMonth, // Handle rounding remainder
      status: 'pending'
    });
  }

  return await setupPaymentPlan(appointmentId, installments);
}

export async function getAllBillingAction(filter: 'paid' | 'unpaid' | 'partial' | 'all' = 'all') {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || !profile.data || profile.data.role === 'client') {
    return { success: false, error: "Unauthorized: Staff only" };
  }

  const { getAllBillingRecords } = await import("@/lib/services/billing-service");
  return await getAllBillingRecords(filter);
}
