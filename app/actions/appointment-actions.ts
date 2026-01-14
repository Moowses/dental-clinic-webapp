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
  recordPayment
} from "@/lib/services/appointment-service";
import { updatePatientRecord, getPatientRecord } from "@/lib/services/patient-service";
import { updateUserProfile } from "@/lib/services/auth-service";
import { getUserProfile } from "@/lib/services/user-service";
import { patientRecordSchema } from "@/lib/validations/auth";
import { z } from "zod";
import { AppointmentStatus, Appointment, PaymentMethod } from "@/lib/types/appointment";

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
  if (!auth.currentUser)
    return {
      success: false,
      error: "You must be logged in to book an appointment.",
    };
  const uid = auth.currentUser.uid;

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
      if (!result.success) throw new Error(result.error);

      return { success: true };
    },
    data
  );
}

// TODO: Normalize this action to return { success, data, error } in the future
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
export async function getClinicScheduleAction(date?: string): Promise<{ success: boolean; data?: AppointmentWithPatient[]; error?: string }> {
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
        getPatientRecord(app.patientId)
      ]);
      
      return {
        ...app,
        patientName: patientProfile.data?.displayName || "Unknown",
        isProfileComplete: patientRecord.data?.isProfileComplete || false
      } as AppointmentWithPatient;
    })
  );

  return { success: true, data: enrichedAppointments };
}

// Staff Action: Assign Dentist
export async function assignDentistAction(appointmentId: string, dentistId: string) {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || !profile.data || profile.data.role === 'client') {
    return { success: false, error: "Unauthorized" };
  }

  return await assignDentist(appointmentId, dentistId);
}

// Dentist Action: Get My Schedule
export async function getDentistScheduleAction(date?: string): Promise<{ success: boolean; data?: Appointment[]; error?: string }> {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || !profile.data) return { success: false, error: "Unauthorized" };

  const role = profile.data.role;
  if (role === 'client') return { success: false, error: "Unauthorized" };

  if (role === 'dentist') {
    return await getDentistAppointments(auth.currentUser.uid, date);
  }
  
  return { success: false, error: "Use Clinic Schedule for Admin view" };
}

// Staff Action: Update Status
export async function updateAppointmentStatusAction(appointmentId: string, status: AppointmentStatus) {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || !profile.data || profile.data.role === 'client') {
    return { success: false, error: "Unauthorized" };
  }

  return await updateAppointmentStatus(appointmentId, status);
}

// Staff Action: Record Payment
export async function recordPaymentAction(appointmentId: string, method: string) {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || !profile.data || profile.data.role === 'client') {
    return { success: false, error: "Unauthorized" };
  }

  // Validate method
  const parsed = paymentSchema.safeParse({ method });
  if (!parsed.success) return { success: false, error: "Invalid payment method" };

  return await recordPayment(appointmentId, parsed.data.method as PaymentMethod);
}
