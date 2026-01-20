import { db } from "../firebase/firebase";
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp, 
  Timestamp, 
  collection, 
  addDoc,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { BillingRecord, BillingTransaction, BillingInstallment, BillingItem } from "../types/billing";
import { billingRecordSchema } from "../validations/billing";
import { z } from "zod";

const BILLING_COLLECTION = "billing_records";
const APPOINTMENTS_COLLECTION = "appointments";

export async function createBillingRecord(
  appointmentId: string, 
  patientId: string, 
  totalAmount: number,
  items: BillingItem[] = []
) {
  try {
    const id = appointmentId; // We force 1-to-1 mapping
    const docRef = doc(db, BILLING_COLLECTION, id);
    
    // Check if exists to avoid overwrite
    const snap = await getDoc(docRef);
    if (snap.exists()) return { success: false, error: "Billing record already exists" };

    const newRecord: Partial<BillingRecord> & { createdAt: any, updatedAt: any } = {
      id,
      appointmentId,
      patientId,
      totalAmount,
      remainingBalance: totalAmount,
      status: totalAmount === 0 ? "paid" : "unpaid",
      items, // Save the itemized list
      paymentPlan: { type: "full", installments: [] },
      transactions: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(docRef, newRecord);
    return { success: true, id };
  } catch (error) {
    console.error("Error creating billing record:", error);
    return { success: false, error: "Failed to create billing record" };
  }
}

export async function getBillingDetails(appointmentId: string) {
  try {
    const docRef = doc(db, BILLING_COLLECTION, appointmentId);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      return { success: true, data: snap.data() as BillingRecord };
    }

    // --- SHIM / FALLBACK ---
    // If no billing record exists, check the appointment.
    // If appointment is completed with a totalBill, we generate a virtual record.
    const appRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
    const appSnap = await getDoc(appRef);

    if (appSnap.exists()) {
      const appData = appSnap.data();
      // If it has treatment data but no billing record, show a virtual one
      if (appData.treatment?.totalBill !== undefined) {
        const virtualRecord: BillingRecord = {
          id: appointmentId,
          appointmentId,
          patientId: appData.patientId,
          totalAmount: appData.treatment.totalBill,
          remainingBalance: appData.paymentStatus === 'paid' ? 0 : appData.treatment.totalBill,
          status: appData.paymentStatus === 'paid' ? 'paid' : 'unpaid',
          paymentPlan: { type: 'full', installments: [] },
          transactions: [],
          createdAt: appData.createdAt,
          updatedAt: appData.createdAt
        };
        return { success: true, data: virtualRecord, isVirtual: true };
      }
    }

    return { success: false, error: "No billing information found" };
  } catch (error) {
    console.error("Error fetching billing:", error);
    return { success: false, error: "Failed to fetch billing" };
  }
}

export async function processPayment(
  appointmentId: string, 
  amount: number, 
  method: string, 
  staffId?: string
) {
  try {
    const docRef = doc(db, BILLING_COLLECTION, appointmentId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      // If payment is attempted on a virtual record, we must materialize it first!
      // This requires fetching the appointment first to get the total.
      // For now, assume creation happens at treatment completion.
      return { success: false, error: "Billing record not found. Finalize treatment first." };
    }

    const current = snap.data() as BillingRecord;
    
    if (amount <= 0) return { success: false, error: "Invalid amount" };
    if (current.status === "paid" && current.remainingBalance <= 0) {
      return { success: false, error: "Already fully paid" };
    }

    const newBalance = Math.max(0, current.remainingBalance - amount);
    const newStatus = newBalance === 0 ? "paid" : "partial";

    const transaction: any = {
      id: crypto.randomUUID(),
      amount,
      method,
      date: Timestamp.now(),
      recordedBy: staffId || "system"
    };

    await updateDoc(docRef, {
      remainingBalance: newBalance,
      status: newStatus,
      transactions: [...current.transactions, transaction],
      updatedAt: serverTimestamp()
    });

    // Also update the legacy Appointment status for dashboard compatibility
    const appRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
    await updateDoc(appRef, {
      paymentStatus: newStatus,
      paymentMethod: method, // Tracks last used method
      paymentDate: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error("Error processing payment:", error);
    return { success: false, error: "Payment processing failed" };
  }
}

export async function setupPaymentPlan(
  appointmentId: string, 
  installments: BillingInstallment[], 
  selectedItemIds?: string[]
) {
  try {
    const docRef = doc(db, BILLING_COLLECTION, appointmentId);
    const snap = await getDoc(docRef);
    
    if (!snap.exists()) return { success: false, error: "Record not found" };
    const current = snap.data() as BillingRecord;

    // If items were selected, update their status to 'plan'
    let updatedItems = current.items || [];
    if (selectedItemIds && selectedItemIds.length > 0) {
      updatedItems = updatedItems.map(item => ({
        ...item,
        status: selectedItemIds.includes(item.id) ? "plan" : item.status
      }));
    }
    
    await updateDoc(docRef, {
      "paymentPlan.type": "installments",
      "paymentPlan.installments": installments,
      items: updatedItems,
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error("Error setting plan:", error);
    return { success: false, error: "Failed to set payment plan" };
  }
}

export async function getAllBillingRecords(statusFilter: 'paid' | 'unpaid' | 'partial' | 'all' = 'all') {
  try {
    const billingRef = collection(db, BILLING_COLLECTION);
    let q = query(billingRef); // Default: All

    if (statusFilter !== 'all') {
      q = query(billingRef, where("status", "==", statusFilter));
    }

    const snapshot = await getDocs(q);
    const bills = snapshot.docs.map(doc => doc.data() as BillingRecord);
    
    // Sort by date manually if index is missing (createdAt descending)
    bills.sort((a, b) => {
      const timeA = (a.createdAt as any)?.seconds || 0;
      const timeB = (b.createdAt as any)?.seconds || 0;
      return timeB - timeA;
    });

    return { success: true, data: bills };
  } catch (error) {
    console.error("Error fetching all bills:", error);
    return { success: false, error: "Failed to fetch bills" };
  }
}
