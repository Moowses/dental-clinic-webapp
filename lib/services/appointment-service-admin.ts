import "server-only";
import { adminDb } from "../firebase/server";
import { Appointment } from "../types/appointment";

const APPOINTMENTS_COLLECTION = "appointments";

function serializeAppointment(data: any, id: string): Appointment {
  return {
    ...data,
    id,
    createdAt:
      data?.createdAt && typeof data.createdAt.toDate === "function"
        ? data.createdAt.toDate().toISOString()
        : data?.createdAt,
    paymentDate:
      data?.paymentDate && typeof data.paymentDate.toDate === "function"
        ? data.paymentDate.toDate().toISOString()
        : data?.paymentDate,
    treatment: data?.treatment
      ? {
          ...data.treatment,
          completedAt:
            data.treatment.completedAt &&
            typeof data.treatment.completedAt.toDate === "function"
              ? data.treatment.completedAt.toDate().toISOString()
              : data.treatment.completedAt,
        }
      : undefined,
  } as Appointment;
}

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
    return { success: true, data: serializeAppointment(data, snap.id) };
  } catch (error) {
    console.error("Error fetching appointment (Admin):", error);
    return { success: false, error: "Failed to fetch appointment" };
  }
}

export async function getAppointmentsByPatientIdAdmin(
  patientId: string
): Promise<{ success: boolean; data?: Appointment[]; error?: string }> {
  try {
    const snap = await adminDb
      .collection(APPOINTMENTS_COLLECTION)
      .where("patientId", "==", patientId)
      .orderBy("date", "desc")
      .orderBy("time", "desc")
      .get();

    const rows = snap.docs.map((doc) =>
      serializeAppointment(doc.data(), doc.id)
    );

    return { success: true, data: rows };
  } catch (error) {
    console.error("Error fetching appointments by patient (Admin):", error);
    return { success: false, error: "Failed to fetch appointment history" };
  }
}

export async function updateTreatmentExtrasAdmin(
  appointmentId: string,
  updates: {
    notes?: string;
    imageUrls?: string[];
    dentalChartPatch?: Record<
      string,
      { status?: string; notes?: string; updatedAt?: number; updatedBy?: string }
    >;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = adminDb.collection(APPOINTMENTS_COLLECTION).doc(appointmentId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return { success: false, error: "Appointment not found" };
    }

    const data = snap.data() as Appointment;
    if (!data?.treatment) {
      return { success: false, error: "Treatment record not found" };
    }

    const nextTreatment = {
      ...data.treatment,
      notes: typeof updates.notes === "string" ? updates.notes : data.treatment.notes,
      imageUrls: Array.isArray(updates.imageUrls)
        ? updates.imageUrls
        : data.treatment.imageUrls,
      dentalChart: updates.dentalChartPatch
        ? { ...(data.treatment.dentalChart || {}), ...updates.dentalChartPatch }
        : data.treatment.dentalChart,
    };

    await docRef.update({ treatment: nextTreatment });

    return { success: true };
  } catch (error) {
    console.error("Error updating treatment extras (Admin):", error);
    return { success: false, error: "Failed to update treatment record" };
  }
}
