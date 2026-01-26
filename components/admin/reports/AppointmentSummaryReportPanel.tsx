"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import ReportShell from "./ReportShell";

// TODO: implement this action
import { getAppointmentsInRange } from "@/app/actions/appointment-actions";

type AppointmentRow = {
  id: string;
  startAt: string; // ISO datetime
  status?: string;
};

type AppointmentReportResponse = {
  rows: AppointmentRow[];
};

type Preset = "7d" | "30d" | "thisMonth" | "lastMonth";

export default function AppointmentSummaryReportPanel() {
  const [preset, setPreset] = useState<Preset>("thisMonth");
  const [data, setData] = useState<AppointmentReportResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const { fromISO, toISO, subtitle } = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

    if (preset === "7d") {
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { fromISO: start.toISOString(), toISO: end.toISOString(), subtitle: "Last 7 days" };
    }

    if (preset === "30d") {
      start.setDate(now.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { fromISO: start.toISOString(), toISO: end.toISOString(), subtitle: "Last 30 days" };
    }

    if (preset === "lastMonth") {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { fromISO: s.toISOString(), toISO: e.toISOString(), subtitle: monthLabel(s) };
    }

    // thisMonth
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { fromISO: s.toISOString(), toISO: e.toISOString(), subtitle: monthLabel(s) };
  }, [preset]);

  useEffect(() => {
    let cancelled = false;
    setErr(null);

    startTransition(async () => {
      try {
        const res = (await getAppointmentsInRange({ fromISO, toISO })) as AppointmentReportResponse;
        if (!cancelled) setData(res);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load appointment summary.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [fromISO, toISO]);

  if (err) {
    return (
      <ReportShell
        reportName="Appointment Summary Report"
        subtitle={subtitle}
        empty={{ title: "Error loading report", description: err }}
      >
        <div />
      </ReportShell>
    );
  }

  const rows = data?.rows ?? [];
  const stats = useMemo(() => computeAppointmentStats(rows), [rows]);

  const empty =
    !data || rows.length === 0
      ? {
          title: pending ? "Loading report…" : "No appointments found",
          description: pending
            ? "Please wait while we generate the report."
            : "Try another time range.",
        }
      : undefined;

  return (
    <ReportShell reportName="Appointment Summary Report" subtitle={subtitle} empty={empty}>
      {!data ? null : (
        <div className="space-y-4">
          {/* Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">Range:</span>
            <PresetBtn label="This month" active={preset === "thisMonth"} onClick={() => setPreset("thisMonth")} />
            <PresetBtn label="Last month" active={preset === "lastMonth"} onClick={() => setPreset("lastMonth")} />
            <PresetBtn label="7 days" active={preset === "7d"} onClick={() => setPreset("7d")} />
            <PresetBtn label="30 days" active={preset === "30d"} onClick={() => setPreset("30d")} />
          </div>

          {/* Summary */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Card label="Total appointments" value={stats.total} />
            <Card label="Avg per day" value={stats.avgPerDayText} />
            <Card label="Busiest day" value={stats.peakDayText} />
            <Card label="Peak hour" value={stats.peakHourText} />
          </div>

          {/* Comparison */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-extrabold text-slate-900">Comparisons</p>
            <p className="mt-1 text-sm text-slate-700">
              This week vs last week:{" "}
              <span className="font-extrabold">{stats.weekVsWeekText}</span>
            </p>
            <p className="mt-1 text-sm text-slate-700">
              This month vs last month:{" "}
              <span className="font-extrabold">{stats.monthVsMonthText}</span>
            </p>
          </div>

          {/* Daily table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-600">
                  <th className="px-4 py-3 font-bold">Day</th>
                  <th className="px-4 py-3 font-bold">Appointments</th>
                </tr>
              </thead>
            <tbody>
                {stats.dailyCounts.map((d) => (
                    <tr key={d.day} className="border-t border-slate-200">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                        {new Date(d.day).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                        {d.count}
                    </td>
                    </tr>
                ))}
                </tbody>
            </table>
          </div>

          {/* Example line like you wanted */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-700">
              Example: <span className="font-extrabold">{subtitle}:</span>{" "}
              <span className="font-extrabold">{stats.total}</span> total appointments • Avg/day:{" "}
              <span className="font-extrabold">{stats.avgPerDayText}</span> • Busiest day:{" "}
              <span className="font-extrabold">{stats.peakDayText}</span>
            </p>
          </div>
        </div>
      )}
    </ReportShell>
  );
}

function PresetBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-full px-3 py-1.5 text-sm font-semibold transition",
        active ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function Card({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-slate-900">{value}</p>
    </div>
  );
}

function monthLabel(d: Date) {
  return d.toLocaleString(undefined, { month: "short", year: "numeric" });
}

/**
 * Computes:
 * - Total appointments
 * - Daily counts
 * - Avg per day
 * - Peak day
 * - Peak hour
 * - Week vs week (based on current date)
 * - Month vs month (based on current date)
 */
function computeAppointmentStats(rows: AppointmentRow[]) {
  const total = rows.length;

  // Daily counts by DATE (YYYY-MM-DD)  ✅
  const byDate = new Map<string, number>();

  // Weekday totals (Mon–Sun) ✅ for busiest weekday
  const byWeekday = new Map<string, number>();

  // Hour totals ✅ for peak hour
  const byHour = new Map<number, number>();

  for (const r of rows) {
    const d = new Date(r.startAt);
    if (Number.isNaN(d.getTime())) continue;

    const dateKey = d.toISOString().slice(0, 10); // YYYY-MM-DD
    byDate.set(dateKey, (byDate.get(dateKey) ?? 0) + 1);

    const weekdayKey = d.toLocaleDateString(undefined, { weekday: "long" });
    byWeekday.set(weekdayKey, (byWeekday.get(weekdayKey) ?? 0) + 1);

    const h = d.getHours();
    byHour.set(h, (byHour.get(h) ?? 0) + 1);
  }

  // ✅ Daily table should be chronological (not by count)
  const dailyCounts = [...byDate.entries()]
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day)); // YYYY-MM-DD sorts lexicographically

  // ✅ Busiest weekday (Mon–Sun total within range)
  const peakWeekdayEntry = [...byWeekday.entries()].sort((a, b) => b[1] - a[1])[0];
  const peakDayText = peakWeekdayEntry ? `${peakWeekdayEntry[0]} (${peakWeekdayEntry[1]})` : "—";

  // ✅ Peak hour
  const peakHourEntry = [...byHour.entries()].sort((a, b) => b[1] - a[1])[0];
  const peakHourText = peakHourEntry
    ? `${String(peakHourEntry[0]).padStart(2, "0")}:00 (${peakHourEntry[1]})`
    : "—";

  // ✅ Avg/day uses distinct dates present in data
  const daysCount = Math.max(1, byDate.size);
  const avgPerDay = total / daysCount;
  const avgPerDayText =
    avgPerDay >= 10 ? `${Math.floor(avgPerDay)}–${Math.ceil(avgPerDay)}` : avgPerDay.toFixed(1);

  //  Comparisons (local time)
  const now = new Date();
  const startOfWeek = startOfLocalWeek(now); // Monday 00:00 local
  const startOfLastWeek = new Date(startOfWeek);
  startOfLastWeek.setDate(startOfWeek.getDate() - 7);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const countInRange = (from: Date, to: Date) =>
    rows.reduce((acc, r) => {
      const d = new Date(r.startAt);
      if (Number.isNaN(d.getTime())) return acc;
      return d >= from && d <= to ? acc + 1 : acc;
    }, 0);

  const thisWeek = countInRange(startOfWeek, now);
  const lastWeek = countInRange(startOfLastWeek, new Date(startOfWeek.getTime() - 1));

  const thisMonth = countInRange(startOfMonth, now);
  const lastMonth = countInRange(startOfLastMonth, endOfLastMonth);

  const weekVsWeekText = `${thisWeek} vs ${lastWeek}`;
  const monthVsMonthText = `${thisMonth} vs ${lastMonth}`;

  return {
    total,
    // now this is per DATE for the table 
    dailyCounts: dailyCounts.length ? dailyCounts : [{ day: "—", count: 0 }],
    avgPerDayText,
    // now this is busiest WEEKDAY 
    peakDayText,
    peakHourText,
    weekVsWeekText,
    monthVsMonthText,
  };
}


function startOfLocalWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1) - day; // Monday start
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}
