"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getClinicScheduleAction, AppointmentWithPatient } from "@/app/actions/appointment-actions";

function formatLocalYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseLocalYMD(ymd: string) {
  return new Date(`${ymd}T00:00:00`);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

type RangeKey = "today" | "7" | "14" | "30";

type ApptRow = (AppointmentWithPatient & { dateStr: string });

export default function UpcomingAppointmentsPanel() {
  const [range, setRange] = useState<RangeKey>("7");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<ApptRow[]>([]);

  const rangeDays = useMemo(() => {
    if (range === "today") return 1;
    return Number(range);
  }, [range]);

  const fetchUpcoming = useCallback(async () => {
    setLoading(true);
    setErr(null);

    try {
      const start = new Date();
      const dates: string[] = [];

      for (let i = 0; i < rangeDays; i++) {
        dates.push(formatLocalYMD(addDays(start, i)));
      }

      const concurrency = 6;
      let idx = 0;
      const results: ApptRow[] = [];

      const workers = new Array(concurrency).fill(0).map(async () => {
        while (idx < dates.length) {
          const my = idx++;
          const dateStr = dates[my];

          const res = await getClinicScheduleAction(dateStr);
          if (res.success && res.data) {
            for (const a of res.data as any[]) {
              results.push({ ...(a as any), dateStr });
            }
          }
        }
      });

      await Promise.all(workers);

      results.sort((a, b) => {
        const da = a.dateStr.localeCompare(b.dateStr);
        if (da !== 0) return da;
        return String(a.time || "").localeCompare(String(b.time || ""));
      });

      setRows(results);
    } catch (e: any) {
      setErr(e?.message || "Failed to load upcoming appointments.");
    } finally {
      setLoading(false);
    }
  }, [rangeDays]);

  useEffect(() => {
    fetchUpcoming();
  }, [fetchUpcoming]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900">Upcoming</h3>
          <p className="text-sm text-slate-500">Upcoming appointments list</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as RangeKey)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="today">Today</option>
            <option value="7">Next 7 days</option>
            <option value="14">Next 14 days</option>
            <option value="30">Next 30 days</option>
          </select>

          <button
            onClick={fetchUpcoming}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : err ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {err}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No upcoming appointments.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((a) => (
              <div
                key={`${a.dateStr}-${a.id}`}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-extrabold text-slate-900 truncate">
                      {a.patientName || "Unknown Patient"}
                    </p>
                    <p className="text-sm text-slate-700 mt-1">
                      {parseLocalYMD(a.dateStr).toLocaleDateString(undefined, {
                        month: "short",
                        day: "2-digit",
                        year: "numeric",
                      })}
                      {a.time ? ` • ${a.time}` : ""}
                      {a.serviceType ? ` • ${a.serviceType}` : ""}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Status: {String(a.status || "pending").toUpperCase()}
                    </p>
                  </div>

                  <div className="text-xs font-extrabold text-slate-600">
                    {a.dentistId ? "ASSIGNED" : "UNASSIGNED"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
