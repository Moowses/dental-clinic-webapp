"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  getClinicScheduleAction,
  AppointmentWithPatient,
} from "@/app/actions/appointment-actions";

/** Local YYYY-MM-DD (prevents timezone off-by-one) */
function formatLocalYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD safely to local date */
function parseLocalYMD(ymd: string) {
  return new Date(`${ymd}T00:00:00`);
}

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
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900">{title}</h3>
          {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

type AppointmentLite = Pick<
  AppointmentWithPatient,
  "id" | "patientName" | "time" | "serviceType" | "status"
> & {
  dentistId?: string | null;
};

export default function ClinicSchedulePanel() {
  const todayStr = formatLocalYMD(new Date());

  const [cursorMonth, setCursorMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const [scheduleByDate, setScheduleByDate] = useState<
    Record<string, AppointmentLite[]>
  >({});

  const [loadingDates, setLoadingDates] = useState<Record<string, boolean>>({});
  const [loadingSelected, setLoadingSelected] = useState(true);

  const fetchScheduleForDate = useCallback(
    async (dateStr: string, force = false) => {
      if (!dateStr) return;
      if (!force && scheduleByDate[dateStr]) return;
      if (loadingDates[dateStr]) return;

      setLoadingDates((prev) => ({ ...prev, [dateStr]: true }));
      try {
        const res = await getClinicScheduleAction(dateStr);
        if (res.success) {
          setScheduleByDate((prev) => ({
            ...prev,
            [dateStr]: (res.data || []) as any,
          }));
        }
      } finally {
        setLoadingDates((prev) => ({ ...prev, [dateStr]: false }));
      }
    },
    [loadingDates, scheduleByDate]
  );

  const refreshSelected = useCallback(() => {
    setLoadingSelected(true);
    fetchScheduleForDate(selectedDate, true).finally(() => setLoadingSelected(false));
  }, [fetchScheduleForDate, selectedDate]);

  useEffect(() => {
    fetchScheduleForDate(selectedDate, true).finally(() => setLoadingSelected(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep month cursor synced when selectedDate changes
  useEffect(() => {
    const d = parseLocalYMD(selectedDate);
    if (!Number.isNaN(d.getTime())) {
      setCursorMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [selectedDate]);

  // Prefetch current month for counts/time preview
  useEffect(() => {
    const year = cursorMonth.getFullYear();
    const month = cursorMonth.getMonth();
    const last = new Date(year, month + 1, 0).getDate();

    const dates: string[] = [];
    for (let day = 1; day <= last; day++) {
      dates.push(formatLocalYMD(new Date(year, month, day)));
    }

    const concurrency = 6;
    let i = 0;
    const workers = new Array(concurrency).fill(0).map(async () => {
      while (i < dates.length) {
        const idx = i++;
        await fetchScheduleForDate(dates[idx]);
      }
    });

    Promise.all(workers).catch(() => {});
  }, [cursorMonth, fetchScheduleForDate]);

  const selectedSchedule = scheduleByDate[selectedDate] || [];

  const calendarDays = useMemo(() => {
    const start = new Date(cursorMonth);
    const dayOfWeek = start.getDay(); // 0..6 Sun..Sat
    start.setDate(start.getDate() - dayOfWeek);

    const out: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push(d);
    }
    return out;
  }, [cursorMonth]);

  return (
    <Card
      title="Clinic Calendar"
      subtitle="View bookings by day (read-only)"
    >
      {/* Header Controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">
            {cursorMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}
          </h2>
          <p className="text-sm text-slate-500">Click a day to view names below</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              setCursorMonth(new Date(cursorMonth.getFullYear(), cursorMonth.getMonth() - 1, 1))
            }
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Prev
          </button>

          <button
            onClick={() => {
              const now = new Date();
              const ymd = formatLocalYMD(now);
              setCursorMonth(new Date(now.getFullYear(), now.getMonth(), 1));
              setSelectedDate(ymd);
              fetchScheduleForDate(ymd, true);
            }}
            className="px-3 py-2 rounded-lg bg-teal-600 text-sm font-semibold text-white hover:bg-teal-700"
          >
            Today
          </button>

          <button
            onClick={() =>
              setCursorMonth(new Date(cursorMonth.getFullYear(), cursorMonth.getMonth() + 1, 1))
            }
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Next
          </button>

          <button
            onClick={refreshSelected}
            className="ml-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="mt-4 rounded-2xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div
              key={d}
              className="px-3 py-2 text-xs font-extrabold text-slate-600 uppercase tracking-wider"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {calendarDays.map((d) => {
            const ds = formatLocalYMD(d);
            const inMonth = d.getMonth() === cursorMonth.getMonth();
            const isSelected = ds === selectedDate;
            const isToday = ds === todayStr;

            const items = scheduleByDate[ds] || [];
            const count = items.length;
            const isLoadingCell = !!loadingDates[ds];

            const timePreview = items
              .slice(0, 2)
              .map((a) => a.time)
              .filter(Boolean);

            return (
              <button
                key={ds}
                type="button"
                onClick={() => {
                  setSelectedDate(ds);
                  fetchScheduleForDate(ds);
                }}
                className={
                  "min-h-[92px] border-b border-r border-slate-200 p-3 text-left hover:bg-slate-50 transition " +
                  (inMonth ? "bg-white" : "bg-slate-50") +
                  (isSelected ? " ring-2 ring-teal-500/30 bg-teal-50/30" : "")
                }
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        "text-sm font-extrabold " +
                        (inMonth ? "text-slate-900" : "text-slate-400")
                      }
                    >
                      {d.getDate()}
                    </span>
                    {isToday ? (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-900 text-white">
                        Today
                      </span>
                    ) : null}
                  </div>

                  {count > 0 ? (
                    <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-slate-900 text-white">
                      {count}
                    </span>
                  ) : null}
                </div>

                <div className="mt-2 space-y-1">
                  {isLoadingCell ? (
                    <p className="text-xs text-slate-400">Loading...</p>
                  ) : count === 0 ? (
                    <p className="text-xs text-slate-400">No bookings</p>
                  ) : (
                    <>
                      {timePreview.map((t, idx) => (
                        <p key={idx} className="text-xs font-bold text-slate-700">
                          {t}
                        </p>
                      ))}
                      {count > 2 ? (
                        <p className="text-xs text-slate-500 font-bold">
                          +{count - 2} more
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day list (names-only) */}
      <div className="mt-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-extrabold text-slate-900">
              Selected day:{" "}
              {parseLocalYMD(selectedDate).toLocaleDateString(undefined, {
                month: "short",
                day: "2-digit",
                year: "numeric",
              })}
            </p>
            <p className="text-xs text-slate-500">Names and time only</p>
          </div>
          <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700">
            {selectedSchedule.length} item(s)
          </span>
        </div>

        {loadingSelected || loadingDates[selectedDate] ? (
          <p className="text-sm text-slate-500">Loading schedule...</p>
        ) : selectedSchedule.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No appointments for this date.</p>
        ) : (
          <div className="space-y-2">
            {selectedSchedule
              .slice()
              .sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")))
              .map((app) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="min-w-0">
                    <p className="font-extrabold text-slate-900 truncate">
                      {app.patientName || "Unknown Patient"}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {app.time ? `${app.time}` : "—"}
                      {app.serviceType ? ` • ${app.serviceType}` : ""}
                    </p>
                  </div>
                  <div className="text-xs font-extrabold text-slate-600">
                    {app.status ? String(app.status).toUpperCase() : ""}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </Card>
  );
}
