"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { getDentistScheduleAction } from "@/app/actions/appointment-actions";
import { getTreatmentToolsAction, completeTreatmentAction } from "@/app/actions/treatment-actions";

import type { Appointment } from "@/lib/types/appointment";
import type { DentalProcedure } from "@/lib/types/clinic";
import type { InventoryItem } from "@/lib/types/inventory";

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h3 className="text-lg font-extrabold text-slate-900">{title}</h3>
        {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

const inputBase =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-300";

function StatusPill({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  const cls =
    s === "pending"
      ? "bg-orange-50 text-orange-700 border-orange-200"
      : s === "confirmed"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : s === "completed"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : s === "cancelled"
      ? "bg-red-50 text-red-700 border-red-200"
      : "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full border text-[11px] font-extrabold uppercase tracking-wide ${cls}`}
    >
      {status}
    </span>
  );
}

function toISODate(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().split("T")[0];
}

function addDays(isoDate: string, days: number) {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

function formatNiceDate(isoDate: string) {
  const d = new Date(isoDate + "T00:00:00");
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatRangeLabel(startISO: string, days: number) {
  const start = new Date(startISO + "T00:00:00");
  const end = new Date(startISO + "T00:00:00");
  end.setDate(end.getDate() + (days - 1));

  const startLabel = start.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
  });
  const endLabel = end.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

  return `${startLabel} – ${endLabel}`;
}

function parseTimeToSortable(time?: string) {
  // supports "09:00", "9:00", "09:00 AM" loosely
  if (!time) return "99:99";
  const t = time.trim().toUpperCase();

  // If already HH:MM
  const hhmm = t.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmm) {
    const h = String(hhmm[1]).padStart(2, "0");
    const m = String(hhmm[2]).padStart(2, "0");
    return `${h}:${m}`;
  }

  // If "HH:MM AM/PM"
  const ampm = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = String(ampm[2]).padStart(2, "0");
    const ap = ampm[3];
    if (ap === "AM") {
      if (h === 12) h = 0;
    } else {
      if (h !== 12) h += 12;
    }
    return `${String(h).padStart(2, "0")}:${m}`;
  }

  // Fallback: push unknown times to bottom
  return "99:99";
}

function TreatmentModal({
  appointment,
  onClose,
  onComplete,
}: {
  appointment: Appointment;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [tools, setTools] = useState<{
    procedures: DentalProcedure[];
    inventory: InventoryItem[];
  } | null>(null);

  const [selectedProcs, setSelectedProcs] = useState<string[]>([]);
  const [usedInv, setUsedInv] = useState<{ [id: string]: number }>({});
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getTreatmentToolsAction().then((res) => {
      if (res.success && res.data) setTools(res.data);
    });
  }, []);

  const handleSave = async () => {
    if (!tools) return;
    setIsSaving(true);

    const res = await completeTreatmentAction(appointment.id, {
      notes,
      procedures: tools.procedures
        .filter((p) => selectedProcs.includes(p.id))
        .map((p) => ({ id: p.id, name: p.name, price: p.basePrice })),
      inventoryUsed: tools.inventory
        .filter((i) => usedInv[i.id] > 0)
        .map((i) => ({ id: i.id, name: i.name, quantity: usedInv[i.id] })),
    });

    if (res.success) {
      onComplete();
      onClose();
    } else {
      alert(res.error);
    }

    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-extrabold text-slate-900">
            Record Treatment — {appointment.serviceType}
          </h3>
          <p className="text-sm text-slate-500">Dentist tools</p>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-84px)]">
          <textarea
            placeholder="Clinical Notes..."
            className={`${inputBase} h-24 resize-none`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-2xl p-4">
              <p className="text-xs font-extrabold text-slate-800">Procedures</p>
              <div className="mt-3 space-y-2 text-sm">
                {tools?.procedures.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        onChange={(e) =>
                          e.target.checked
                            ? setSelectedProcs([...selectedProcs, p.id])
                            : setSelectedProcs(selectedProcs.filter((id) => id !== p.id))
                        }
                      />
                      <span className="font-bold text-slate-900">{p.name}</span>
                    </div>
                    <span className="font-extrabold text-slate-900">${p.basePrice}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl p-4">
              <p className="text-xs font-extrabold text-slate-800">Inventory Used</p>
              <div className="mt-3 space-y-2 text-sm">
                {tools?.inventory.map((i) => (
                  <div
                    key={i.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{i.name}</p>
                      <p className="text-xs text-slate-500">Current stock: {i.stock}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setUsedInv({
                            ...usedInv,
                            [i.id]: Math.max(0, (usedInv[i.id] || 0) - 1),
                          })
                        }
                        className="h-9 w-9 rounded-xl border border-slate-200 bg-white font-extrabold hover:bg-slate-50"
                      >
                        -
                      </button>
                      <span className="min-w-8 text-center font-extrabold text-slate-900">
                        {usedInv[i.id] || 0}
                      </span>
                      <button
                        type="button"
                        onClick={() => setUsedInv({ ...usedInv, [i.id]: (usedInv[i.id] || 0) + 1 })}
                        className="h-9 w-9 rounded-xl border border-slate-200 bg-white font-extrabold hover:bg-slate-50"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full rounded-xl bg-teal-700 text-white py-2.5 font-extrabold hover:bg-teal-800 disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Finalize Treatment"}
          </button>

          <button onClick={onClose} className="w-full text-xs text-slate-500 hover:text-slate-700">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DentistSchedulePanel() {
  const todayISO = useMemo(() => toISODate(new Date()), []);
  const [startDate, setStartDate] = useState(todayISO);

  // Range options
  const [rangeDays, setRangeDays] = useState<7 | 30>(7);

  // Flattened merged schedule (for next N days)
  const [schedule, setSchedule] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTreatment, setActiveTreatment] = useState<Appointment | null>(null);

  const datesToFetch = useMemo(() => {
    const list: string[] = [];
    for (let i = 0; i < rangeDays; i++) list.push(addDays(startDate, i));
    return list;
  }, [startDate, rangeDays]);

  const refresh = useCallback(async () => {
    setLoading(true);

    // Fetch each day using existing backend action (no backend change)
    const results = await Promise.all(
      datesToFetch.map(async (d) => {
        const res = await getDentistScheduleAction(d);
        if (res?.success && res.data) {
          const rows = ((res.data as Appointment[]) || []).map((a) => ({
            ...a,
            // ensure date is set consistently for sorting/group label
            date: (a as any).date || d,
          }));
          return rows;
        }
        return [];
      })
    );

    const merged = results.flat();

    // Sort by date then time (stable schedule)
    merged.sort((a, b) => {
      const da = String((a as any).date || "");
      const db = String((b as any).date || "");
      if (da !== db) return da.localeCompare(db);

      const ta = parseTimeToSortable((a as any).time);
      const tb = parseTimeToSortable((b as any).time);
      return ta.localeCompare(tb);
    });

    setSchedule(merged);
    setLoading(false);
  }, [datesToFetch]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const subtitle = useMemo(() => {
    const label = formatRangeLabel(startDate, rangeDays);
    return `Showing: ${label}`;
  }, [startDate, rangeDays]);

  return (
    <Card title="Upcoming Patient Schedule" subtitle={subtitle}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex items-center gap-3">
            <label className="text-xs font-extrabold text-slate-600 uppercase tracking-widest">
              Start
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={`${inputBase} max-w-[180px]`}
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-extrabold text-slate-600 uppercase tracking-widest">
              Range
            </label>
            <select
              value={rangeDays}
              onChange={(e) => setRangeDays((e.target.value === "30" ? 30 : 7) as 7 | 30)}
              className={`${inputBase} max-w-[220px]`}
            >
              <option value={7}>Next 7 days</option>
              <option value={30}>Next 30 days</option>
            </select>
          </div>
        </div>

        <button
          onClick={refresh}
          className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-extrabold hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-slate-500">Loading schedule...</p>
        ) : schedule.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-extrabold text-slate-900">No upcoming appointments</p>
            <p className="mt-1 text-xs text-slate-500">
              No assigned appointments for the selected range.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {schedule.map((app) => {
              const patientLabel =
                (app as any).patientName ||
                (app as any).patientFullName ||
                (app as any).patientEmail ||
                (app as any).patientId ||
                "Patient";

              const dateLabel = formatNiceDate(String((app as any).date || ""));

              return (
                <div
                  key={app.id}
                  className="border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-base font-extrabold text-slate-900">
                      {(app as any).time} — {(app as any).serviceType}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusPill status={(app as any).status} />
                      <span className="text-xs text-slate-500">{dateLabel}</span>
                    </div>

                    <p className="mt-2 text-sm text-slate-700">
                      <span className="font-bold text-slate-900">Patient:</span> {patientLabel}
                    </p>
                  </div>

                  {(app as any).status !== "completed" ? (
                    <button
                      onClick={() => setActiveTreatment(app)}
                      className="px-4 py-2 rounded-xl bg-teal-700 text-white font-extrabold text-sm hover:bg-teal-800"
                    >
                      Treat
                    </button>
                  ) : (
                    <span className="text-xs font-extrabold text-slate-500">Completed</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {activeTreatment && (
        <TreatmentModal
          appointment={activeTreatment}
          onClose={() => setActiveTreatment(null)}
          onComplete={refresh}
        />
      )}
    </Card>
  );
}
