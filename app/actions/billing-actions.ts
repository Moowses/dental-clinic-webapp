import { getUserProfile } from "@/lib/services/user-service";
import { 
  getBillingDetails, 
  setupPaymentPlan 
} from "@/lib/services/billing-service";
import { BillingInstallment, BillingRecord } from "@/lib/types/billing";

export async function getBillingDetailsAction(appointmentId: string): Promise<{ success: boolean; data?: BillingRecord; error?: string; isVirtual?: boolean }> {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  // Ideally check if user owns appointment OR is staff
  return await getBillingDetails(appointmentId);
}

export async function createPaymentPlanAction(
  appointmentId: string, 
  months: number,
  selectedItemIds: string[] = []
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

  let planTotal = billRes.data.remainingBalance;

  // If specific items selected, sum them up
  if (selectedItemIds.length > 0 && billRes.data.items) {
    planTotal = billRes.data.items
      .filter(item => selectedItemIds.includes(item.id))
      .reduce((sum, item) => sum + item.price, 0);
  }

  if (planTotal <= 0) return { success: false, error: "No balance to split" };

  const amountPerMonth = Math.floor((planTotal / months) * 100) / 100;
  const installments: BillingInstallment[] = [];
  let currentDate = new Date();

  for (let i = 0; i < months; i++) {
    currentDate.setMonth(currentDate.getMonth() + 1);
    installments.push({
      id: crypto.randomUUID(),
      dueDate: currentDate.toISOString().split('T')[0],
      amount: i === months - 1 ? (planTotal - (amountPerMonth * (months - 1))) : amountPerMonth, // Handle rounding remainder
      status: 'pending'
    });
  }

  return await setupPaymentPlan(appointmentId, installments, selectedItemIds);
}

export async function getAllBillingAction(filter: 'paid' | 'unpaid' | 'partial' | 'all' = 'all'): Promise<{ success: boolean; data?: BillingRecord[]; error?: string }> {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || !profile.data || profile.data.role === 'client') {
    return { success: false, error: "Unauthorized: Staff only" };
  }

  const { getAllBillingRecords } = await import("@/lib/services/billing-service");
  return await getAllBillingRecords(filter);
}
