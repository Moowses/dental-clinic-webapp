import { actionWrapper, ActionState } from "@/lib/utils";
import {
  bookingSchema,
  paymentSchema,
  validateAppointmentDate,
  validateAppointmentTime,
} from "@/lib/validations/appointment";
import {
  createAppointment,
  getTakenSlots,
  getClinicOffDays,
  getAllAppointments,
  updateAppointmentStatus,
  assignDentist,
  getDentistAppointments,
} from "@/lib/services/appointment-service";
import { processPayment } from "@/lib/services/billing-service";
import {
  updatePatientRecord,
  getPatientRecord,
} from "@/lib/services/patient-service";
import { updateUserProfile } from "@/lib/services/auth-service";
import { getUserProfile } from "@/lib/services/user-service";
import { patientRecordSchema } from "@/lib/validations/auth";
import { z } from "zod";
import {
  AppointmentStatus,
  Appointment,
  PaymentMethod,
} from "@/lib/types/appointment";
import { sendAppointmentEmail } from "@/lib/services/email-service";

export type BookingState = ActionState;

export interface CalendarAvailability {
  takenSlots: string[];
  isHoliday: boolean;
  holidayReason?: string | null;
}

export interface AppointmentWithPatient extends Appointment {
  patientName?: string;
  isProfileComplete?: boolean;
}

// Client Action: Book Appointment
export async function bookAppointmentAction(
  prevState: BookingState,
  data: FormData
): Promise<BookingState> {
  const { auth } = await import("@/lib/firebase/firebase");

  if (!auth.currentUser) {
    return {
      success: false,
      error: "You must be logged in to book an appointment.",
    };
  }

  const uid = auth.currentUser.uid;
  const userEmail = auth.currentUser.email;

  return actionWrapper(
    bookingSchema,
    async (parsedData) => {
      // 1. Validate Business Rules (Date/Time)
      const dateError = validateAppointmentDate(parsedData.date);
      if (dateError) throw new Error(dateError);

      const timeError = validateAppointmentTime(parsedData.time);
      if (timeError) throw new Error(timeError);

      // 2. Conditional Profile Update
      if (
        parsedData.displayName &&
        parsedData.displayName !== auth.currentUser?.displayName
      ) {
        await updateUserProfile(auth.currentUser!, {
          displayName: parsedData.displayName,
        });
      }

      if (parsedData.phoneNumber) {
        const patientData: z.input<typeof patientRecordSchema> = {
          phoneNumber: parsedData.phoneNumber,
        };
        await updatePatientRecord(uid, patientData);
      }

      // 3. Create the Appointment
      const result = await createAppointment(uid, parsedData);
      if (!result.success || !result.id) {
        throw new Error(result.error || "Failed to create appointment");
      }

      // 4. Send Email Notification
      if (userEmail) {
        // We don't await this strictly to fail the request if email fails, 
        // but for now let's await to ensure it works during testing.
        await sendAppointmentEmail({
          id: result.id,
          date: parsedData.date,
          time: parsedData.time,
          serviceName: parsedData.serviceType,
          patientName:
            parsedData.displayName ||
            auth.currentUser?.displayName ||
            "Patient",
          patientEmail: userEmail,
        });
      }

      return { success: true };
    },
    data
  );
}

// Client Action: Confirm Appointment (from Email)
export async function confirmAppointmentAction(
  appointmentId: string
): Promise<{ success: boolean; error?: string }> {
  // This action is public (via email link) so we don't strictly check for auth session,
  // but in a real app you might want a signed token.
  // For now, ID is sufficient proof of access for this specific action.

  // We use the service directly.
  const result = await updateAppointmentStatus(appointmentId, "confirmed");
  if (!result)
    return { success: false, error: "Failed to confirm appointment" };

  return { success: true };
}

// Client Action: Cancel Appointment (from Email/Page)
export async function cancelAppointmentAction(
  appointmentId: string
): Promise<{ success: boolean; error?: string }> {
  // Similar to confirm, this allows cancellation via the public link
  const result = await updateAppointmentStatus(appointmentId, "cancelled");
  // updateAppointmentStatus returns void promise in service, assuming success if no throw
  return { success: true };
}

// Client Action: Check Availability
export async function getAvailabilityAction(
  date: string
): Promise<CalendarAvailability> {
  const takenRes = await getTakenSlots(date);
  const offDaysRes = await getClinicOffDays(date, date);
  const isHoliday = !!(
    offDaysRes.success &&
    offDaysRes.data &&
    offDaysRes.data.length > 0
  );

  return {
    takenSlots: takenRes.data || [],
    isHoliday,
    holidayReason:
      isHoliday && offDaysRes.data ? offDaysRes.data[0].reason : null,
  };
}

// Staff Action: Fetch Clinic Schedule
export async function getClinicScheduleAction(date?: string): Promise<{
  success: boolean;
  data?: AppointmentWithPatient[];
  error?: string;
}> {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || !profile.data)
    return { success: false, error: "User profile not found" };

  const role = profile.data.role;
  if (role === "client") {
    return { success: false, error: "Unauthorized: Staff access required" };
  }

  const result = await getAllAppointments(date);
  if (!result.success || !result.data) return result;

  const enrichedAppointments = await Promise.all(
    result.data.map(async (app) => {
      const [patientProfile, patientRecord] = await Promise.all([
        getUserProfile(app.patientId),
        getPatientRecord(app.patientId),
      ]);

      return {
        ...app,
        patientName: patientProfile.data?.displayName || "Unknown",
        isProfileComplete: patientRecord.data?.isProfileComplete || false,
      } as AppointmentWithPatient;
    })
  );

  return { success: true, data: enrichedAppointments };
}

// Staff Action: Assign Dentist
export async function assignDentistAction(
  appointmentId: string,
  dentistId: string
) {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || !profile.data || profile.data.role === "client") {
    return { success: false, error: "Unauthorized" };
  }

  return await assignDentist(appointmentId, dentistId);
}

// Dentist Action: Get My Schedule
export async function getDentistScheduleAction(
  date?: string
): Promise<{ success: boolean; data?: Appointment[]; error?: string }> {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || !profile.data)
    return { success: false, error: "Unauthorized" };

  const role = profile.data.role;
  if (role === "client") return { success: false, error: "Unauthorized" };

  if (role === "dentist") {
    return await getDentistAppointments(auth.currentUser.uid, date);
  }

  return { success: false, error: "Use Clinic Schedule for Admin view" };
}

// Staff Action: Update Status
export async function updateAppointmentStatusAction(
  appointmentId: string,
  status: AppointmentStatus
) {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || !profile.data || profile.data.role === "client") {
    return { success: false, error: "Unauthorized" };
  }

  return await updateAppointmentStatus(appointmentId, status);
}

// Staff Action: Record Payment
export async function recordPaymentAction(
  appointmentId: string,
  method: string,
  amount?: number
) {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || !profile.data || profile.data.role === "client") {
    return { success: false, error: "Unauthorized" };
  }

  // Validate method
  const parsed = paymentSchema.safeParse({ method });
  if (!parsed.success)
    return { success: false, error: "Invalid payment method" };

  // For backward compatibility, if amount is not provided, we need to fetch the total bill
  // But processPayment logic handles partials. 
  // If the UI calls this without amount, we assume they are paying the Full Balance.
  // We'll let the service handle validation, but here we ideally need the amount.
  // Since the old UI didn't send amount, we default to a placeholder or fetch.
  // Let's rely on the service fetching if needed, OR force the UI to send it.
  
  // CRITICAL: The old UI calls this with just (id, method).
  // We need to fetch the bill to know what "Full Payment" is.
  // For now, let's update the signature to accept amount, but default to 0 which will fail validation
  // unless we fetch the bill here.
  
  // Strategy: If amount is missing, we fetch the billing record to get the remaining balance.
  let paymentAmount = amount;
  if (!paymentAmount) {
     const { getBillingDetails } = await import("@/lib/services/billing-service");
     const bill = await getBillingDetails(appointmentId);
     if (bill.success && bill.data) {
        paymentAmount = bill.data.remainingBalance;
     } else {
        return { success: false, error: "Could not determine payment amount" };
     }
  }

  return await processPayment(
    appointmentId,
    paymentAmount,
    parsed.data.method,
    auth.currentUser.uid
  );
}
