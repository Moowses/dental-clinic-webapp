"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  bookAppointmentAction,
  staffBookAppointmentAction,
  CalendarAvailability,
  getAvailabilityAction,
} from "@/app/actions/appointment-actions";

import { getAllProcedures } from "@/lib/services/clinic-service";
import type { DentalProcedure } from "@/lib/types/clinic";

import { searchPatients } from "@/lib/services/user-service";
import type { UserProfile } from "@/lib/types/user";

const BRAND = "#0E4B5A";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIME_SLOTS = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function monthLabel(d: Date) {
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}
function buildMonthGrid(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startWeekday);

  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    cells.push({ date: d, inMonth: d.getMonth() === month });
  }
  return cells;
}

function isPastSlotForSelectedDate(selectedISO: string, timeHHMM: string) {
  if (!selectedISO) return false;

  const now = new Date();
  const today = startOfDay(now);
  const selected = startOfDay(new Date(selectedISO + "T00:00:00"));

  if (selected.getTime() < today.getTime()) return true;
  if (selected.getTime() > today.getTime()) return false;

  const [hh, mm] = timeHHMM.split(":").map((x) => parseInt(x, 10));
  const slot = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
  return slot.getTime() < now.getTime();
}

function SlotButton({
  time,
  disabled,
  selected,
  onClick,
  label,
}: {
  time: string;
  disabled: boolean;
  selected: boolean;
  onClick: () => void;
  label?: string;
}) {
  const base =
    "w-full rounded-xl border px-3 py-3 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-offset-2";

  if (disabled) {
    return (
      <button type="button" disabled className={`${base} border-slate-200 bg-slate-50 text-slate-400`}>
        {time} <span className="ml-2 text-xs font-extrabold">({label || "Unavailable"})</span>
      </button>
    );
  }

  if (selected) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} border-transparent text-white`}
        style={{ backgroundColor: BRAND }}
      >
        {time} <span className="ml-2 text-xs font-extrabold">(Selected)</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} border-slate-200 bg-white text-slate-800 hover:bg-slate-50`}
    >
      {time}
    </button>
  );
}

export default function WalkInBookingModal({
  open,
  onClose,
  onBooked,
  forceStaff = false, // ✅ pass true from admin-dashboard
}: {
  open: boolean;
  onClose: () => void;
  onBooked: () => void;
  forceStaff?: boolean;
}) {
  const { user } = useAuth();
  const router = useRouter();

  const role = (user as any)?.role as "admin" | "staff" | "client" | undefined;

  // ✅ staff mode works even if user.role isn't present
  const isStaff = forceStaff || role === "admin" || role === "staff";

  const [state, formAction, isPending] = useActionState(
    isStaff ? staffBookAppointmentAction : bookAppointmentAction,
    { success: false, error: "" }
  );

  const today = useMemo(() => startOfDay(new Date()), []);
  const minBookDate = useMemo(() => today, [today]);

  const [viewDate, setViewDate] = useState<Date>(() => startOfDay(new Date()));
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [availability, setAvailability] = useState<CalendarAvailability | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [clientError, setClientError] = useState<string>("");
  const successHandledRef = useRef(false);
  const gridCells = useMemo(() => buildMonthGrid(viewDate), [viewDate]);

  const taken = useMemo(() => new Set(availability?.takenSlots || []), [availability]);
  const isHoliday = availability?.isHoliday ?? false;

  // Patient selection (staff)
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<UserProfile[]>([]);
  const [patientLoading, setPatientLoading] = useState(false);
  const [patientOpen, setPatientOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<UserProfile | null>(null);

  // Name used for booking (display only + passed to action)
  const [fullName, setFullName] = useState("");

  const [procedures, setProcedures] = useState<DentalProcedure[]>([]);
  const [procLoading, setProcLoading] = useState(false);
  const [procError, setProcError] = useState("");

  // Load availability
  useEffect(() => {
    if (!selectedDate) {
      setAvailability(null);
      setSelectedTime("");
      return;
    }

    let cancelled = false;
    setLoadingSlots(true);
    setSelectedTime("");

    getAvailabilityAction(selectedDate)
      .then((res) => {
        if (!cancelled) setAvailability(res);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  // Procedures
  useEffect(() => {
    if (!open) return;
    if (procedures.length > 0) return;

    let cancelled = false;
    setProcLoading(true);
    setProcError("");

    getAllProcedures(true)
      .then((res: any) => {
        if (cancelled) return;
        if (res.success && res.data) setProcedures(res.data as DentalProcedure[]);
        else setProcError(res.error || "Failed to load services");
      })
      .catch((e: any) => {
        if (!cancelled) setProcError(e?.message || "Failed to load services");
      })
      .finally(() => {
        if (!cancelled) setProcLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, procedures.length]);

  // Patient search (debounced + only when 2+ chars)
  useEffect(() => {
    if (!open) return;
    if (!isStaff) return;

    const term = patientQuery.trim();

    if (term.length < 2) {
      setPatientResults([]);
      setPatientLoading(false);
      return;
    }

    setPatientLoading(true);

    const t = setTimeout(async () => {
      const res = await searchPatients(term);
      if (res.success && res.data) setPatientResults(res.data as UserProfile[]);
      else setPatientResults([]);
      setPatientLoading(false);
    }, 250);

    return () => clearTimeout(t);
  }, [patientQuery, open, isStaff]);

  // Reset on open/close
  useEffect(() => {
    if (!open) {
      setSelectedDate("");
      setSelectedTime("");
      setAvailability(null);
      setLoadingSlots(false);
      setClientError("");
      setViewDate(startOfDay(new Date()));
      setProcError("");

      setPatientQuery("");
      setPatientResults([]);
      setPatientOpen(false);
      setSelectedPatient(null);

      setFullName("");
      return;
    }

    successHandledRef.current = false;
    setClientError("");

    // ✅ IMPORTANT: in staff mode, DO NOT auto-fill from logged-in user
    if (isStaff) {
      setFullName("");
    } else {
      // client mode (kept behavior)
      setFullName(user?.displayName || "");
    }
  }, [open, isStaff, user?.displayName]);

  // When staff selects patient → set fullName
  useEffect(() => {
    if (!isStaff) return;
    if (!selectedPatient) return;
    setFullName(selectedPatient.displayName || "");
  }, [selectedPatient, isStaff]);

  // Handle success
  useEffect(() => {
    if (!state.success) return;
    if (successHandledRef.current) return;

    successHandledRef.current = true;

    try {
      onBooked();
    } catch {}

    onClose();
    router.refresh();
  }, [state.success, onBooked, onClose, router]);

  if (!open) return null;

  const selectedDateObj = selectedDate ? new Date(selectedDate + "T00:00:00") : null;
  const selectedIsPastDate =
    !!selectedDateObj && startOfDay(selectedDateObj).getTime() < minBookDate.getTime();
  const selectedTimeIsPastForToday =
    !!selectedDate && !!selectedTime && isPastSlotForSelectedDate(selectedDate, selectedTime);

  const patientReady = !isStaff || !!selectedPatient;

  const canSubmit =
    patientReady &&
    !!selectedDate &&
    !!selectedTime &&
    !selectedIsPastDate &&
    !selectedTimeIsPastForToday &&
    !isHoliday &&
    !isPending &&
    !taken.has(selectedTime) &&
    (!procError && !procLoading);

  const goPrevMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const goNextMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">Walk-In Booking</h3>
            <p className="mt-1 text-xs text-slate-500">
              Select patient → date → time → service. Past dates and past times are blocked.
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

        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr]">
          {/* Left: Calendar + slots (UNCHANGED DESIGN) */}
          <div className="p-6 md:border-r border-slate-100">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={goPrevMonth}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                ←
              </button>

              <div className="text-center">
                <p className="text-sm font-extrabold text-slate-900">{monthLabel(viewDate)}</p>
                <p className="text-xs text-slate-500">Today is allowed (past time slots disabled)</p>
              </div>

              <button
                type="button"
                onClick={goNextMonth}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                →
              </button>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-2">
              {WEEKDAYS.map((w) => (
                <div key={w} className="text-center text-xs font-extrabold text-slate-500">
                  {w}
                </div>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-7 gap-2">
              {gridCells.map(({ date, inMonth }, idx) => {
                const d0 = startOfDay(date);
                const isTooEarly = d0.getTime() < minBookDate.getTime();
                const isToday = isSameDay(d0, today);
                const isSelected = selectedDateObj ? isSameDay(d0, selectedDateObj) : false;

                const base = "h-10 rounded-xl border text-sm font-bold transition focus:outline-none";
                const classes = isTooEarly
                  ? `${base} border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed`
                  : isSelected
                  ? `${base} border-transparent text-white`
                  : `${base} border-slate-200 bg-white text-slate-800 hover:bg-slate-50`;

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={isTooEarly}
                    onClick={() => {
                      setClientError("");
                      setSelectedDate(toISODate(d0));
                      setSelectedTime("");
                    }}
                    className={classes}
                    style={isSelected ? { backgroundColor: BRAND } : undefined}
                    aria-label={toISODate(d0)}
                    title={isTooEarly ? "Past dates cannot be booked." : ""}
                  >
                    <span className={`${!inMonth ? "opacity-40" : ""}`}>{d0.getDate()}</span>
                    {isToday && !isSelected && (
                      <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold text-slate-600">Time slots</p>
                {loadingSlots && <span className="text-xs font-semibold text-slate-500">Loading...</span>}
              </div>

              {!selectedDate && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Select a date from the calendar to view slots.
                </div>
              )}

              {selectedDate && isHoliday && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                  Clinic is closed on this day
                  {availability?.holidayReason ? `: ${availability.holidayReason}` : "."}
                </div>
              )}

              {selectedDate && !isHoliday && (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {TIME_SLOTS.map((t) => {
                    const booked = taken.has(t);
                    const past = isPastSlotForSelectedDate(selectedDate, t);
                    const disabled = booked || past;

                    return (
                      <SlotButton
                        key={t}
                        time={t}
                        disabled={disabled}
                        label={booked ? "Booked" : past ? "Past" : "Unavailable"}
                        selected={selectedTime === t}
                        onClick={() => {
                          setClientError("");
                          setSelectedTime(t);
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: Patient + details */}
          <div className="p-6">
            <form
              action={formAction}
              className="space-y-4"
              onSubmit={(e) => {
                if (isStaff && !selectedPatient) {
                  e.preventDefault();
                  setClientError("Please select a patient first.");
                  return;
                }

                if (selectedDate) {
                  const sel = startOfDay(new Date(selectedDate + "T00:00:00"));
                  if (sel.getTime() < minBookDate.getTime()) {
                    e.preventDefault();
                    setClientError("Past dates cannot be booked.");
                    return;
                  }
                }

                if (selectedDate && selectedTime && isPastSlotForSelectedDate(selectedDate, selectedTime)) {
                  e.preventDefault();
                  setClientError("That time slot is already in the past. Please choose a later slot.");
                  return;
                }
              }}
            >
              <input type="hidden" name="date" value={selectedDate} />
              <input type="hidden" name="time" value={selectedTime} />
              <input type="hidden" name="displayName" value={fullName} />
              <input type="hidden" name="patientId" value={selectedPatient?.uid || ""} />

              {/* Staff patient search */}
              {isStaff ? (
                <div className="relative">
                  <label className="text-xs font-bold text-slate-600">Search Patient (Name / Email)</label>

                  <input
                    value={patientQuery}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPatientQuery(v);
                      setPatientOpen(true);
                      setSelectedPatient(null);
                      setFullName("");
                      setClientError("");
                    }}
                    onFocus={() => setPatientOpen(true)}
                    placeholder="Type at least 2 characters..."
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
                  />

                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    {patientQuery.trim().length < 2
                      ? "Type at least 2 characters to search."
                      : patientLoading
                      ? "Searching..."
                      : "Select a patient from results."}
                  </div>

                  {patientOpen && patientQuery.trim().length >= 2 ? (
                    <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                      <div className="max-h-64 overflow-auto">
                        {patientLoading ? (
                          <div className="px-4 py-3 text-sm text-slate-500">Searching...</div>
                        ) : patientResults.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-slate-500">No patients found.</div>
                        ) : (
                          patientResults.map((p) => (
                            <button
                              key={p.uid}
                              type="button"
                              onClick={() => {
                                setSelectedPatient(p);
                                setPatientQuery(p.displayName || p.email || "");
                                setPatientOpen(false);
                                setClientError("");
                              }}
                              className="w-full px-4 py-3 text-left hover:bg-slate-50"
                            >
                              <div className="text-sm font-extrabold text-slate-900">
                                {p.displayName || "Unnamed Patient"}
                              </div>
                              <div className="text-xs text-slate-500">{p.email || ""}</div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}

                  {selectedPatient ? (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                      Selected:{" "}
                      <span className="font-extrabold">
                        {selectedPatient.displayName || selectedPatient.email}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold text-slate-600">Full Name</label>
                  <input
                    value={fullName}
                    disabled
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300 disabled:bg-slate-50 disabled:text-slate-600"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-600">Service Type</label>
                <select
                  name="serviceType"
                  required
                  disabled={procLoading || !!procError}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300 disabled:bg-slate-50 disabled:text-slate-500"
                >
                  <option value="">{procLoading ? "Loading services..." : "Select Service"}</option>
                  {procedures.map((p: any) => (
                    <option key={p.id} value={p.name || "Service"}>
                      {p.name || "Service"}
                    </option>
                  ))}
                </select>
                {procError ? <p className="mt-2 text-xs font-semibold text-red-600">{procError}</p> : null}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Notes</label>
                <textarea
                  name="notes"
                  placeholder="Additional notes..."
                  className="mt-2 h-28 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
                />
              </div>

              {(clientError || (state as any).error) && (
                <p className="text-sm font-bold text-red-600 text-center">
                  {clientError || (state as any).error}
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
                  disabled={!canSubmit}
                  className="flex-1 rounded-xl px-4 py-3 text-sm font-bold text-white hover:opacity-95 disabled:opacity-60"
                  style={{ backgroundColor: BRAND }}
                >
                  {isPending ? "Booking..." : "Confirm Booking"}
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Flow: Select patient → date → time → service. Past dates and past time slots are blocked.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
