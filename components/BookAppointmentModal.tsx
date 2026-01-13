"use client";

import { useActionState, useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  bookAppointmentAction,
  CalendarAvailability,
  getAvailabilityAction,
  type Availability,
} from "@/app/actions/appointment-actions";

export default function BookAppointmentModal({
  open,
  onClose,
  onBooked,
}: {
  open: boolean;
  onClose: () => void;
  onBooked: () => void;
}) {
  const { user } = useAuth();

  const [state, formAction, isPending] = useActionState(bookAppointmentAction, {
    success: false,
  });

  const [availability, setAvailability] = useState<CalendarAvailability | null>(null);
  const [selectedDate, setSelectedDate] = useState("");

  const timeSlots = [
    "08:00",
    "09:00",
    "10:00",
    "11:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
  ];

  useEffect(() => {
    if (!selectedDate) return;
    getAvailabilityAction(selectedDate).then(setAvailability);
  }, [selectedDate]);

  useEffect(() => {
    if (!open) {
      setSelectedDate("");
      setAvailability(null);
    }
  }, [open]);

  useEffect(() => {
    if (state.success) {
      onBooked();
      onClose();
    }
  }, [state.success, onBooked, onClose]);

  if (!open) return null;

  const isHoliday = availability?.isHoliday ?? false;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">
              Book an Appointment
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Choose your service, date, and time. Unavailable slots are disabled.
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5">
          <form action={formAction} className="space-y-4">
            {!user?.displayName && (
              <div>
                <label className="text-xs font-bold text-slate-600">
                  Full Name
                </label>
                <input
                  name="displayName"
                  required
                  placeholder="Your full name"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-600">
                Service Type
              </label>
              <select
                name="serviceType"
                required
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
              >
                <option value="">Select Service</option>
                <option value="General Checkup">General Checkup</option>
                <option value="Cleaning">Cleaning</option>
                <option value="Tooth Extraction">Tooth Extraction</option>
                <option value="Emergency">Emergency Case</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600">Date</label>
              <input
                name="date"
                type="date"
                required
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
                onChange={(e) => setSelectedDate(e.target.value)}
              />

              {isHoliday && (
                <p className="mt-2 text-xs font-bold text-red-600">
                  Clinic is closed on this day
                  {availability?.holidayReason ? `: ${availability.holidayReason}` : "."}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600">Time</label>
              <select
                name="time"
                required
                disabled={isHoliday}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300 disabled:bg-slate-50 disabled:text-slate-500"
              >
                <option value="">Select Time</option>
                {timeSlots.map((t) => {
                  const booked = availability?.takenSlots?.includes(t) ?? false;
                  return (
                    <option key={t} value={t} disabled={booked}>
                      {t} {booked ? "(Booked)" : ""}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600">Notes</label>
              <textarea
                name="notes"
                placeholder="Additional notes..."
                className="mt-2 h-24 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
              />
            </div>

            {state.error && (
              <p className="text-sm font-bold text-red-600 text-center">
                {state.error}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isPending || isHoliday}
                className="flex-1 rounded-xl px-4 py-3 text-sm font-bold text-white hover:opacity-95 disabled:opacity-60"
                style={{ backgroundColor: "#0E4B5A" }}
              >
                {isPending ? "Booking..." : "Submit Booking Request"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
