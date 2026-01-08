import { actionWrapper, ActionState } from "@/lib/utils";
import {
  bookingSchema,
  validateAppointmentDate,
  validateAppointmentTime,
} from "@/lib/validations/appointment";
import {
  createAppointment,
  getTakenSlots,
  getClinicOffDays,
  getAllAppointments,
} from "@/lib/services/appointment-service";
import { updatePatientRecord } from "@/lib/services/patient-service";
import { updateUserProfile } from "@/lib/services/auth-service";
import { getUserProfile } from "@/lib/services/user-service";
import { patientRecordSchema } from "@/lib/validations/auth";
import { z } from "zod";

export type BookingState = ActionState;

export interface CalendarAvailability {
  takenSlots: string[];
  isHoliday: boolean;
  holidayReason?: string | null;
}

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
      // If the form provided a name, update Auth Profile
      if (
        parsedData.displayName &&
        parsedData.displayName !== auth.currentUser?.displayName
      ) {
        await updateUserProfile(auth.currentUser!, {
          displayName: parsedData.displayName,
        });
      }

      // If the form provided a phone, update Patient Record
      if (parsedData.phoneNumber) {
        // We assume the data matches the schema requirement.
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

// Helper to fetch calendar data for the frontend
export async function getAvailabilityAction(
  date: string
): Promise<CalendarAvailability> {
  // 1. Get taken slots for this specific date
  const takenRes = await getTakenSlots(date);

  // 2. Check if it's a holiday (Simplified: just checking if the date exists in off_days)
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
export async function getClinicScheduleAction(date?: string) {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  // Verify Role
  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || !profile.data)
    return { success: false, error: "User profile not found" };

  const role = profile.data.role;
  if (role === "client") {
    return { success: false, error: "Unauthorized: Staff access required" };
  }

  // Fetch Data
  return await getAllAppointments(date);
}
