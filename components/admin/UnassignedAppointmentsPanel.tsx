"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  getClinicScheduleAction,
  assignDentistAction,
  AppointmentWithPatient,
} from "@/app/actions/appointment-actions";

import { getDentistListAction } from "@/app/actions/dentist-actions";
import type { UserProfile } from "@/lib/types/user";

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

type UnassignedRow = AppointmentWithPatient & { dateStr: string };

const inputBase =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-300";

export default function UnassignedAppointmentsPanel() {
  const [days, setDays] = useState<7 | 14 | 30>(14);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [dentists, setDentists] = useState<UserProfile[]>([]);
  const [rows, setRows] = useState<UnassignedRow[]>([]);

  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchDentists = useCallback(async () => {
    const res = await getDentistListAction();
    if (res.success && res.data) setDentists(res.data as any);
  }, []);

  const fetchUnassigned = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setSuccessMsg(null);

    try {
      const start = new Date();
      const dates: string[] = [];
      for (let i = 0; i < days; i++) {
        dates.push(formatLocalYMD(addDays(start, i)));
      }

      const concurrency = 6;
      let idx = 0;
      const results: UnassignedRow[] = [];

      const workers = new Array(concurrency).fill(0).map(async () => {
        while (idx < dates.length) {
          const my = idx++;
          const dateStr = dates[my];

          const res = await getClinicScheduleAction(dateStr);
          if (res.success && res.data) {
            for (const a of res.data as any[]) {
              const appt = a as any;
              if (!appt.dentistId) {
                results.push({ ...appt, dateStr });
              }
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
      setErr(e?.message || "Failed to load unassigned appointments.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchDentists();
    fetchUnassigned();
  }, [fetchDentists, fetchUnassigned]);

  const dentistOptions = useMemo(
    () =>
      dentists.map((d) => ({
        id: d.uid,
        label: d.displayName || d.email || d.uid,
      })),
    [dentists]
  );

  async function handleAssign(appointmentId: string, dentistId: string) {
    if (!dentistId) return;
    setAssigningId(appointmentId);
    setErr(null);
    setSuccessMsg(null);

    try {
      await assignDentistAction(appointmentId, dentistId);
      setSuccessMsg("Doctor assigned successfully.");
      await fetchUnassigned();
    } catch (e: any) {
      setErr(e?.message || "Failed to assign doctor.");
    } finally {
      setAssigningId(null);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900">Unassigned</h3>
          <p className="text-sm text-slate-500">Appointments that need doctor assignment</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value) as 7 | 14 | 30)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value={7}>Next 7 days</option>
            <option value={14}>Next 14 days</option>
            <option value={30}>Next 30 days</option>
          </select>

          <button
            onClick={fetchUnassigned}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="p-6">
        {err ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {err}
          </div>
        ) : null}

        {successMsg ? (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            {successMsg}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No unassigned appointments.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((a) => (
              <div key={`${a.dateStr}-${a.id}`} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
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

                  <div className="w-full md:max-w-[320px]">
                    <label className="text-xs font-extrabold text-slate-600">
                      Assign Doctor
                    </label>
                    <select
                      className={`${inputBase} mt-1`}
                      defaultValue=""
                      disabled={assigningId === a.id}
                      onChange={(e) => handleAssign(a.id, e.target.value)}
                    >
                      <option value="">Select dentist…</option>
                      {dentistOptions.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label}
                        </option>
                      ))}
                    </select>

                    {assigningId === a.id ? (
                      <p className="mt-2 text-xs text-slate-500">Assigning...</p>
                    ) : null}
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
