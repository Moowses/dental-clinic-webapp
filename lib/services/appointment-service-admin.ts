import "server-only";
import { adminDb } from "../firebase/server";
import { Appointment } from "../types/appointment";

const APPOINTMENTS_COLLECTION = "appointments";

export async function getAppointmentByIdAdmin(appointmentId: string): Promise<{ success: boolean; data?: Appointment; error?: string }> {
  try {
    // Use Admin SDK (bypasses rules)
    const docRef = adminDb.collection(APPOINTMENTS_COLLECTION).doc(appointmentId);
    const snap = await docRef.get();
    
    if (!snap.exists) {
      return { success: false, error: "Appointment not found" };
    }

    const data = snap.data();
    
    // Convert Firestore Timestamps to ISO strings for Next.js serialization
    const serializedData = {
      ...data,
      id: snap.id,
      // Handle known timestamp fields if they exist
      createdAt: (data?.createdAt && typeof data.createdAt.toDate === 'function') 
        ? data.createdAt.toDate().toISOString() 
        : data?.createdAt,
      paymentDate: (data?.paymentDate && typeof data.paymentDate.toDate === 'function')
        ? data.paymentDate.toDate().toISOString()
        : data?.paymentDate,
        
      // Also handle nested treatment completedAt if it exists
      treatment: data?.treatment ? {
        ...data.treatment,
        completedAt: (data.treatment.completedAt && typeof data.treatment.completedAt.toDate === 'function')
          ? data.treatment.completedAt.toDate().toISOString()
          : data.treatment.completedAt
      } : undefined
    };

    return { success: true, data: serializedData as unknown as Appointment };
  } catch (error) {
    console.error("Error fetching appointment (Admin):", error);
    return { success: false, error: "Failed to fetch appointment" };
  }
}
