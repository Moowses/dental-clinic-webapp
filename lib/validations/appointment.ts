import { z } from "zod";

export const bookingSchema = z.object({
  serviceType: z.string().min(1, "Please select a service"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)"),
  notes: z.string().optional(),
  
  // Conditional Profile Update Fields
  displayName: z.string().optional(),
  phoneNumber: z.string().optional(), 
});

export const paymentSchema = z.object({
  method: z.enum(["cash", "card", "insurance", "other"]),
  notes: z.string().optional(),
});

// Helper to validate business rules (can be used in the Action)
export function validateAppointmentDate(dateStr: string) {
  const inputDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 14);

  if (inputDate < tomorrow) {
    return "Appointments must be booked at least 1 day in advance.";
  }
  if (inputDate > maxDate) {
    return "Appointments cannot be booked more than 2 weeks in advance.";
  }
  return null; // Valid
}

export function validateAppointmentTime(timeStr: string) {
  const [hours, minutes] = timeStr.split(":").map(Number);
  
  if (hours < 8 || hours > 17 || (hours === 17 && minutes > 0)) {
    return "Appointments are only available between 08:00 and 17:00.";
  }
  return null; // Valid
}