"use client";

import React, { useEffect, useMemo, useState } from "react";

//  Adjust these imports to your real action file path if different
import {
  getClinicSettingsAction,
  updateClinicSettingsAction,
} from "@/app/actions/clinic-actions";

/**
 * If your project already exports ClinicSettings type from a shared types file,
 * replace this with an import:
 *   import type { ClinicSettings } from "@/lib/types/clinic-settings";
 */
type OperatingHoursDay = {
  isOpen: boolean;
  open: string; // "09:00"
  close: string; // "17:00"
};

type ClinicSettings = {
  maxConcurrentPatients: number;
  operatingHours: Record<string, OperatingHoursDay>;
};

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const dayLabel = (d: string) => d.charAt(0).toUpperCase() + d.slice(1);

const normalizeTime = (v: any, fallback: string) => {
  const s = String(v ?? "").trim();
  // allow "09:00" or "9:00" -> normalize to 09:00 if possible
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return fallback;
  const hh = Math.min(23, Math.max(0, Number(m[1])));
  const mm = Math.min(59, Math.max(0, Number(m[2])));
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

function buildDefault(): ClinicSettings {
  const operatingHours: Record<string, OperatingHoursDay> = {};
  for (const d of DAY_ORDER) {
    operatingHours[d] = { isOpen: d !== "sunday", open: "09:00", close: "17:00" };
  }
  return { maxConcurrentPatients: 4, operatingHours };
}

export default function ClinicSettings() {
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; msg: string } | null>(
    null
  );

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const res = await getClinicSettingsAction();
        if (!mounted) return;

        if (res?.success) {
          const raw = (res.data || null) as ClinicSettings | null;

          if (!raw) {
            setSettings(buildDefault());
          } else {
            // normalize shape a bit (prevents UI crashes if day keys missing)
            const merged = buildDefault();
            merged.maxConcurrentPatients = Number(raw.maxConcurrentPatients ?? merged.maxConcurrentPatients);

            const rawHours = (raw.operatingHours || {}) as Record<string, any>;
            for (const d of DAY_ORDER) {
              const h = rawHours[d] || rawHours[dayLabel(d)] || null;
              if (h) {
                merged.operatingHours[d] = {
                  isOpen: Boolean(h.isOpen),
                  open: normalizeTime(h.open, merged.operatingHours[d].open),
                  close: normalizeTime(h.close, merged.operatingHours[d].close),
                };
              }
            }

            // also keep any custom day keys that backend might store
            for (const k of Object.keys(rawHours)) {
              if (!merged.operatingHours[k]) {
                merged.operatingHours[k] = {
                  isOpen: Boolean(rawHours[k]?.isOpen),
                  open: normalizeTime(rawHours[k]?.open, "09:00"),
                  close: normalizeTime(rawHours[k]?.close, "17:00"),
                };
              }
            }

            setSettings(merged);
          }
        } else {
          setSettings(buildDefault());
          setBanner({ type: "err", msg: res?.error || "Failed to load clinic settings." });
        }
      } catch (e) {
        console.error(e);
        setSettings(buildDefault());
        setBanner({ type: "err", msg: "Failed to load clinic settings." });
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const daysToRender = useMemo(() => {
    if (!settings?.operatingHours) return [];
    // Prefer known order, then append any extra keys
    const known = DAY_ORDER.filter((d) => settings.operatingHours[d]);
    const extras = Object.keys(settings.operatingHours).filter(
      (k) => !DAY_ORDER.includes(k as any)
    );
    return [...known, ...extras];
  }, [settings]);

  const updateDay = (day: string, field: keyof OperatingHoursDay, value: any) => {
    if (!settings) return;
    setSettings({
      ...settings,
      operatingHours: {
        ...settings.operatingHours,
        [day]: {
          ...(settings.operatingHours[day] || { isOpen: false, open: "09:00", close: "17:00" }),
          [field]: value,
        },
      },
    });
  };

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    setBanner(null);

    try {
      const res = await updateClinicSettingsAction(settings);
      if (res?.success) {
        setBanner({ type: "ok", msg: "Clinic settings updated successfully." });
      } else {
        setBanner({ type: "err", msg: res?.error || "Failed to update clinic settings." });
      }
    } catch (e) {
      console.error(e);
      setBanner({ type: "err", msg: "Failed to update clinic settings." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xl font-extrabold text-slate-900">Clinic Settings</p>
          <p className="text-sm text-slate-500">
            Configure clinic capacity and weekly operating hours.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={loading || isSaving || !settings}
          className={`px-4 py-2 rounded-xl font-extrabold text-sm transition ${
            loading || isSaving || !settings
              ? "bg-slate-200 text-slate-500 cursor-not-allowed"
              : "bg-slate-900 text-white hover:opacity-95"
          }`}
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {banner && (
        <div
          className={`mt-4 rounded-2xl border p-4 text-sm font-bold ${
            banner.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {banner.msg}
        </div>
      )}

      {loading ? (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600 animate-pulse">
          Loading clinic settings…
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Max Patients/Hour */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-extrabold text-slate-900">Capacity</p>
            <p className="mt-1 text-xs text-slate-500">
              Controls how many patients can be handled concurrently per hour (or per slot logic).
            </p>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 font-extrabold">
                  Max Patients / Hour
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Used for scheduling orchestration.
                </p>
              </div>

              <input
                type="number"
                min={0}
                value={settings?.maxConcurrentPatients ?? 0}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setSettings((prev) =>
                    prev ? { ...prev, maxConcurrentPatients: Number.isFinite(v) ? v : 0 } : prev
                  );
                }}
                className="w-24 rounded-xl border border-slate-300 bg-white px-3 py-2 text-center font-extrabold text-slate-900"
              />
            </div>
          </div>

          {/* Weekly Routine */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-extrabold text-slate-900">Weekly Routine</p>
            <p className="mt-1 text-xs text-slate-500">
              Set which days are open and the operating hours.
            </p>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 max-h-[360px] overflow-y-auto">
              <div className="grid grid-cols-1 gap-2">
                {daysToRender.map((day) => {
                  const hours = settings?.operatingHours?.[day] || {
                    isOpen: false,
                    open: "09:00",
                    close: "17:00",
                  };

                  return (
                    <div
                      key={day}
                      className="rounded-2xl border border-slate-200 bg-white p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={Boolean(hours.isOpen)}
                            onChange={(e) => updateDay(day, "isOpen", e.target.checked)}
                            className="h-4 w-4"
                          />
                          <div>
                            <p className="text-sm font-extrabold text-slate-900">
                              {dayLabel(day)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {hours.isOpen ? "Open" : "Closed"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={normalizeTime(hours.open, "09:00")}
                            disabled={!hours.isOpen}
                            onChange={(e) => updateDay(day, "open", e.target.value)}
                            className={`rounded-xl border px-2 py-1 text-sm font-bold ${
                              hours.isOpen
                                ? "border-slate-300 bg-white text-slate-900"
                                : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                            }`}
                          />
                          <span className="text-slate-400 font-extrabold">–</span>
                          <input
                            type="time"
                            value={normalizeTime(hours.close, "17:00")}
                            disabled={!hours.isOpen}
                            onChange={(e) => updateDay(day, "close", e.target.value)}
                            className={`rounded-xl border px-2 py-1 text-sm font-bold ${
                              hours.isOpen
                                ? "border-slate-300 bg-white text-slate-900"
                                : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !settings}
                className={`px-4 py-2 rounded-xl font-extrabold text-sm transition ${
                  isSaving || !settings
                    ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                    : "bg-emerald-600 text-white hover:opacity-95"
                }`}
              >
                {isSaving ? "Saving..." : "Save Clinic Settings"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
