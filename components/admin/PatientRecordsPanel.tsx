"use client";

import React, { useEffect, useMemo, useState } from "react";

import { getPatientListAction, submitPatientRegistrationAction } from "@/app/actions/patient-actions";
import {
  getPatientDentalChartAction,
  updatePatientDentalChartAction,
} from "@/app/actions/appointment-admin-actions";
import { getPatientRecord } from "@/lib/services/patient-service";
import { getUserProfile, searchPatients } from "@/lib/services/user-service";
import { auth } from "@/lib/firebase/firebase";
import { useAuth } from "@/lib/hooks/useAuth";
import { Odontogram } from "react-odontogram";

import type { PatientRecord } from "@/lib/types/patient";
import type { UserProfile } from "@/lib/types/user";

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
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-300";
const labelSm = "text-[11px] font-extrabold uppercase tracking-widest text-slate-600";
const sectionCard = "rounded-2xl border border-slate-200 bg-white p-4";
const checkBox = "h-4 w-4";

function toBool(v: FormDataEntryValue | null) {
  return v === "on" || v === "true" || v === "1";
}
function toStr(v: FormDataEntryValue | null) {
  return typeof v === "string" ? v : "";
}
function splitComma(v: string) {
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function toMillis(value: any) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  const d = new Date(value);
  const ms = d.getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function universalToFdi(universal: number) {
  if (universal >= 1 && universal <= 8) return 19 - universal;
  if (universal >= 9 && universal <= 16) return universal + 12;
  if (universal >= 17 && universal <= 24) return 55 - universal;
  if (universal >= 25 && universal <= 32) return universal + 16;
  return null;
}

function fdiToUniversal(fdi: number) {
  const map: Record<number, number> = {
    11: 8, 12: 7, 13: 6, 14: 5, 15: 4, 16: 3, 17: 2, 18: 1,
    21: 9, 22: 10, 23: 11, 24: 12, 25: 13, 26: 14, 27: 15, 28: 16,
    31: 24, 32: 23, 33: 22, 34: 21, 35: 20, 36: 19, 37: 18, 38: 17,
    41: 25, 42: 26, 43: 27, 44: 28, 45: 29, 46: 30, 47: 31, 48: 32,
  };
  return map[fdi] ?? null;
}

function normalizeChartKeys(
  chart: Record<string, { status?: string; notes?: string }>
) {
  const next: Record<string, { status?: string; notes?: string }> = {};
  Object.entries(chart || {}).forEach(([key, value]) => {
    const raw = String(key || "").trim();
    if (!raw) return;
    const num = Number(raw.replace("teeth-", ""));
    if (!Number.isFinite(num)) {
      next[raw] = value;
      return;
    }
    if (num >= 1 && num <= 32) {
      next[String(num)] = value;
      return;
    }
    if (num >= 11 && num <= 48) {
      const uni = fdiToUniversal(num);
      if (uni) {
        next[String(uni)] = value;
        return;
      }
    }
    next[raw] = value;
  });
  return next;
}

function keyToToothId(key: string) {
  const raw = String(key || "").trim();
  if (!raw) return null;
  if (raw.startsWith("teeth-")) return raw;
  const num = Number(raw);
  if (!Number.isFinite(num)) return null;
  if (num >= 1 && num <= 32) {
    const fdi = universalToFdi(num);
    return fdi ? `teeth-${fdi}` : null;
  }
  if (num >= 11 && num <= 48) return `teeth-${num}`;
  return null;
}

function toothToUniversal(tooth: any) {
  return (
    tooth?.notations?.universal ||
    tooth?.notations?.fdi ||
    String(tooth?.id || "").replace("teeth-", "")
  );
}

function payloadToUniversal(payload: any) {
  const raw = payload?.notations?.universal || payload?.notations?.fdi || "";
  if (!raw) return "";
  const num = Number(raw);
  if (Number.isFinite(num)) return String(num);
  return String(raw);
}

function DentalChartModal({
  patientId,
  patientName,
  canEdit,
  onClose,
}: {
  patientId: string;
  patientName?: string | null;
  canEdit: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [chart, setChart] = useState<Record<string, { status?: string; notes?: string }>>({});
  const [meta, setMeta] = useState<{
    date?: string;
    time?: string;
    completedAt?: any;
    appointmentId?: string;
  } | null>(null);
  const [draft, setDraft] = useState<Record<string, { status?: string; notes?: string }>>({});
  const [toothNumber, setToothNumber] = useState("");
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [selectedTeeth, setSelectedTeeth] = useState<any[]>([]);
  const pendingRef = React.useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const load = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
          if (!active) return;
          setChart({});
          setMeta(null);
          setLoading(false);
          return;
        }

        const res = await getPatientDentalChartAction({
          patientId,
          idToken: token,
        });

        if (!active) return;
        if (!res?.success || !res.data) {
          setChart({});
          setMeta(null);
          setDraft({});
          setLoading(false);
          return;
        }

        const nextChart = normalizeChartKeys(res.data.chart || {});
        setChart(nextChart);
        setDraft(nextChart);
        setMeta(res.data.meta || null);
        setSelectedTeeth([]);
        setLoading(false);
      } catch {
        if (!active) return;
        setChart({});
        setMeta(null);
        setDraft({});
        setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [patientId]);

  const rows = Object.entries(chart || {});
  const initialSelected = rows
    .map(([key]) => keyToToothId(key))
    .filter(Boolean) as string[];

  const lastUpdatedLabel = (() => {
    if (!meta) return "N/A";
    const ts = meta.completedAt ? toMillis(meta.completedAt) : 0;
    if (ts) return new Date(ts).toLocaleString();
    if (meta.date) {
      return meta.time ? `${meta.date} ${meta.time}` : meta.date;
    }
    return "N/A";
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-lg font-extrabold text-slate-900">Dental Chart</h3>
          <p className="text-sm text-slate-500">
            {patientName ? `${patientName} - ` : ""}Latest update: {lastUpdatedLabel}
          </p>
        </div>

        <div className="p-5">
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
                  Adult Chart (1-32)
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {canEdit
                    ? "Click a tooth to edit notes. Use Save Chart to persist."
                    : "Hover a tooth to view notes. Editing is dentist-only."}
                </p>
                <div className="mt-3">
                  <Odontogram
                    key={initialSelected.join(",")}
                    initialSelected={initialSelected}
                    readOnly={!canEdit}
                    tooltip={{
                      content: (payload: any) => {
                        const key = payloadToUniversal(payload);
                        const entry = key ? chart[key] : null;
                        return (
                          <div>
                            <div>Tooth: {key || "—"}</div>
                            <div>Status: {entry?.status || "—"}</div>
                            <div>Notes: {entry?.notes || "—"}</div>
                          </div>
                        );
                      },
                    }}
                    onChange={(next: any) => {
                      if (!canEdit) return;
                      if (!next || typeof next !== "object") return;
                      const list = Array.isArray(next) ? next : [];
                      if (!list.length) return;
                      const picked = list[list.length - 1];
                      const key = String(toothToUniversal(picked) || "").trim();
                      if (!key) return;
                      if (pendingRef.current) {
                        window.clearTimeout(pendingRef.current);
                      }
                      pendingRef.current = window.setTimeout(() => {
                        setToothNumber(key);
                        setStatus(draft[key]?.status || "");
                        setNotes(draft[key]?.notes || "");
                        setSelectedTeeth(list);
                      }, 0);
                    }}
                  />
                </div>
              </div>

              {canEdit && (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-[140px_160px_1fr] gap-3">
                    <input
                      value={toothNumber}
                      onChange={(e) => setToothNumber(e.target.value)}
                      className={inputBase}
                      placeholder="Tooth #"
                    />
                    <input
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className={inputBase}
                      placeholder="Status (e.g. caries)"
                    />
                    <input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className={inputBase}
                      placeholder="Notes"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const key = toothNumber.trim();
                        if (!key) return;
                        const next = {
                          ...draft,
                          [key]: {
                            status: status.trim() || undefined,
                            notes: notes.trim() || undefined,
                          },
                        };
                        setDraft(next);
                        setChart(next);
                        setToothNumber("");
                        setStatus("");
                        setNotes("");
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-extrabold hover:bg-black"
                    >
                      Add / Update
                    </button>
                    <button
                      onClick={() => {
                        setToothNumber("");
                        setStatus("");
                        setNotes("");
                      }}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-extrabold hover:bg-slate-50"
                    >
                      Clear
                    </button>
                    <button
                      onClick={async () => {
                        if (!meta?.appointmentId) return;
                        const token = await auth.currentUser?.getIdToken();
                        if (!token) return;
                        setSaveStatus(null);
                        setSaving(true);
                        const now = Date.now();
                        const patch = Object.keys(draft).reduce(
                          (acc: Record<string, any>, key) => {
                            acc[key] = {
                              ...draft[key],
                              updatedAt: now,
                              updatedBy: auth.currentUser?.uid,
                            };
                            return acc;
                          },
                          {}
                        );

                        const res = await updatePatientDentalChartAction({
                          appointmentId: meta.appointmentId,
                          idToken: token,
                          dentalChartPatch: patch,
                        });

                        setSaving(false);
                        if (!res?.success) {
                          setSaveStatus(res?.error || "Failed to save chart.");
                          return;
                        }
                        setChart({ ...draft });
                        setSaveStatus("Saved.");
                      }}
                      className="ml-auto px-4 py-2 rounded-xl bg-emerald-700 text-white text-sm font-extrabold hover:bg-emerald-800 disabled:opacity-60"
                      disabled={saving || !meta?.appointmentId}
                    >
                      {saving ? "Saving..." : "Save Chart"}
                    </button>
                  </div>
                  {saveStatus && (
                    <p className="text-xs font-extrabold text-slate-600">{saveStatus}</p>
                  )}
                </div>
              )}

              {!canEdit && rows.length === 0 && (
                <p className="text-sm text-slate-500 mt-3">No dental chart entries found.</p>
              )}

              {rows.length > 0 && (
                <div className="mt-4 space-y-2">
                  {rows.map(([tooth, entry]) => (
                    <div
                      key={tooth}
                      className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-slate-900">Tooth {tooth}</p>
                        <p className="text-xs text-slate-600">
                          {entry.status || "No status"} {entry.notes ? `- ${entry.notes}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <button
            onClick={onClose}
            className="mt-5 w-full rounded-xl bg-slate-900 text-white py-2.5 font-extrabold hover:bg-black"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function PatientDetailsModal({
  patientId,
  onClose,
}: {
  patientId: string;
  onClose: () => void;
}) {
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getPatientRecord(patientId), getUserProfile(patientId)]).then(([r, p]) => {
      if (r.success) setRecord((r.data as any) || null);
      if (p.success) setProfile((p.data as any) || null);
      setLoading(false);
    });
  }, [patientId]);

  const reg: any = (record as any)?.registration;
  const pi = reg?.personal_information;
  const ci = reg?.contact_information;

  const name =
    [
      pi?.name?.first_name,
      pi?.name?.middle_initial,
      pi?.name?.last_name,
    ]
      .filter(Boolean)
      .join(" ")
      .trim() || profile?.displayName || "N/A";

  const phone = ci?.mobile_no || (record as any)?.phoneNumber || "N/A";
  const email = ci?.email_address || profile?.email || "N/A";
  const address = ci?.home_address || (record as any)?.address || "N/A";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-lg font-extrabold text-slate-900">Patient Details</h3>
          <p className="text-sm text-slate-500">Quick overview</p>
        </div>

        <div className="p-5">
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Name</span>
                <span className="font-bold text-slate-900 text-right">{name}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Phone</span>
                <span className="font-bold text-slate-900">{phone}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Email</span>
                <span className="font-bold text-slate-900 text-right">{email}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Address</span>
                <span className="font-bold text-slate-900 text-right">{address}</span>
              </div>
            </div>
          )}

          <button
            onClick={onClose}
            className="mt-5 w-full rounded-xl bg-slate-900 text-white py-2.5 font-extrabold hover:bg-black"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function PatientEditForm({
  patientId,
  onClose,
}: {
  patientId: string;
  onClose: () => void;
}) {
  const [record, setRecord] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ success: boolean; message?: string } | null>(null);

  // Used for conditional UI (e.g., hide Women Only section when Male)
  const [sexValue, setSexValue] = useState<string>("male");

  useEffect(() => {
    setLoading(true);
    Promise.all([getPatientRecord(patientId), getUserProfile(patientId)]).then(([r, p]) => {
      if (r.success) {
        setRecord(r.data || null);
        const s = ((r.data as any)?.registration?.personal_information?.sex as string) || "male";
        setSexValue(s);
      }
      if (p.success) setProfile(p.data || null);
      setLoading(false);
    });
  }, [patientId]);

  const reg = record?.registration || {};
  const pi = reg?.personal_information || {};
  const ci = reg?.contact_information || {};
  const ei = reg?.employment_information || {};
  const md = reg?.minor_details || {};
  const dh = reg?.dental_history || {};
  const rd = reg?.referral_details || {};
  const mh = reg?.medical_history || {};
  const ghs = mh?.general_health_screening || {};
  const phy = mh?.physician || {};
  const vit = mh?.vitals || {};
  const all = mh?.allergies || {};
  const wom = mh?.women_only || {};

  const fallbackEmail = ci?.email_address || profile?.email || "";

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);

    try {
      const form = new FormData(e.currentTarget);

      // Support both backend-test variants
      const dateOfBirth = toStr(form.get("dateOfBirth")) || toStr(form.get("birthdate"));
      const phoneNumber = toStr(form.get("phoneNumber")) || toStr(form.get("mobileNo"));

      const sex = toStr(form.get("sex")) || "male";

      // Required fields (Personal Information except Middle Initial) + Contact Details (except Office No & Fax No)
      const requiredMissing: string[] = [];
      if (!toStr(form.get("firstName")).trim()) requiredMissing.push("First name");
      if (!toStr(form.get("lastName")).trim()) requiredMissing.push("Last name");
      if (!toStr(form.get("nickname")).trim()) requiredMissing.push("Nickname");
      if (!dateOfBirth.trim()) requiredMissing.push("Birthdate");
      if (!sex.trim()) requiredMissing.push("Sex");
      if (!toStr(form.get("religion")).trim()) requiredMissing.push("Religion");
      if (!toStr(form.get("nationality")).trim()) requiredMissing.push("Nationality");

      if (!phoneNumber.trim()) requiredMissing.push("Mobile no.");
      if (!toStr(form.get("homeNo")).trim()) requiredMissing.push("Home no.");
      const emailAddr = (toStr(form.get("emailAddress")) || fallbackEmail || "").trim();
      if (!emailAddr) requiredMissing.push("Email address");
      if (!toStr(form.get("address")).trim()) requiredMissing.push("Home address");

      if (requiredMissing.length) {
        setStatus({
          success: false,
          message: `Please complete required field(s): ${requiredMissing.join(", ")}.`,
        });
        setSaving(false);
        return;
      }

      const structuredData: any = {
        personal_information: {
          name: {
            first_name: toStr(form.get("firstName")),
            last_name: toStr(form.get("lastName")),
            middle_initial: toStr(form.get("middleInitial")),
          },
          nickname: toStr(form.get("nickname")),
          birthdate: dateOfBirth,
          sex,
          religion: toStr(form.get("religion")),
          nationality: toStr(form.get("nationality")),
          effective_date: new Date().toISOString().split("T")[0],
        },
        contact_information: {
          home_address: toStr(form.get("address")),
          home_no: toStr(form.get("homeNo")),
          mobile_no: phoneNumber,
          office_no: toStr(form.get("officeNo")),
          fax_no: toStr(form.get("faxNo")),
          // backend-test uses fallback if not provided
          email_address: emailAddr,
        },
        employment_information: {
          occupation: toStr(form.get("occupation")),
        },
        minor_details: {
          is_minor: toBool(form.get("isMinor")),
          parent_guardian_name: toStr(form.get("guardianName")),
          parent_guardian_occupation: toStr(form.get("guardianOccupation")),
        },
        dental_history: {
          previous_dentist: toStr(form.get("previousDentist")),
          last_dental_visit: toStr(form.get("lastDentalVisit")),
        },
        referral_details: {
          referred_by: toStr(form.get("referredBy")),
          reason_for_consultation: toStr(form.get("consultationReason")),
        },
        medical_history: {
          physician: {
            name: toStr(form.get("physicianName")),
            specialty: toStr(form.get("physicianSpecialty")),
            office_address: toStr(form.get("physicianOffice")),
            office_number: toStr(form.get("physicianNumber")),
          },
          vitals: {
            blood_type: toStr(form.get("bloodType")),
            blood_pressure: toStr(form.get("bloodPressure")),
            bleeding_time: toStr(form.get("bleedingTime")),
          },
          general_health_screening: {
            in_good_health: toBool(form.get("inGoodHealth")),
            under_medical_condition: {
              status: toBool(form.get("underMedicalCondition")),
              condition_description: toStr(form.get("conditionDesc")),
            },
            serious_illness_or_surgery: {
              status: toBool(form.get("seriousIllness")),
              details: toStr(form.get("illnessDetails")),
            },
            hospitalized: {
              status: toBool(form.get("hospitalized")),
              when_and_why: toStr(form.get("hospitalizedDetails")),
            },
            taking_medication: {
              status: toBool(form.get("takingMeds")),
              medication_list: toStr(form.get("medicationList")),
            },
            uses_tobacco: toBool(form.get("usesTobacco")),
            uses_alcohol_or_drugs: toBool(form.get("usesDrugs")),
          },
          allergies: {
            local_anesthetic: toBool(form.get("allergyAnaesthetic")),
            penicillin_antibiotics: toBool(form.get("allergyPenicillin")),
            sulfa_drugs: toBool(form.get("allergySulfa")),
            aspirin: toBool(form.get("allergyAspirin")),
            latex: toBool(form.get("allergyLatex")),
            others: toStr(form.get("allergyOthers")),
          },
          // If Male, don't overwrite existing women-only fields (they won't be visible in the UI).
          women_only:
            (toStr(form.get("sex")) || "male") === "male"
              ? (wom || { is_pregnant: false, is_nursing: false, taking_birth_control: false })
              : {
                  is_pregnant: toBool(form.get("isPregnant")),
                  is_nursing: toBool(form.get("isNursing")),
                  taking_birth_control: toBool(form.get("birthControl")),
                },
          conditions_checklist: splitComma(toStr(form.get("conditions"))),
        },
        authorization: reg?.authorization || { signature_present: false },
      };

      const res: any = await submitPatientRegistrationAction(patientId, structuredData);

      if (res?.success) {
        setStatus({ success: true, message: "Saved successfully." });
      } else {
        setStatus({ success: false, message: res?.message || "Failed to save record." });
      }
    } catch (err: any) {
      setStatus({ success: false, message: err?.message || "Failed to save record." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-slate-500">Loading record...</p>;

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {/* Patient Record */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className={labelSm}>Patient Record</p>

        <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Personal */}
          <div className={sectionCard}>
            <p className={labelSm}>Personal Information</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input name="firstName" required defaultValue={pi?.name?.first_name || ""} className={inputBase} placeholder="First name" />
              <input name="lastName" required defaultValue={pi?.name?.last_name || ""} className={inputBase} placeholder="Last name" />
              <input name="middleInitial" defaultValue={pi?.name?.middle_initial || ""} className={inputBase} placeholder="Middle initial" />
              <input name="nickname" required defaultValue={pi?.nickname || ""} className={inputBase} placeholder="Nickname" />

              {/* backend-test sometimes uses dateOfBirth */}
              <input
                name="dateOfBirth"
                type="date"
                defaultValue={pi?.birthdate || ""}
                className={inputBase}
                required
              />

              <select name="sex" defaultValue={pi?.sex || "male"} className={inputBase} required onChange={(e) => setSexValue(e.target.value)}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>

              <input name="religion" required defaultValue={pi?.religion || ""} className={inputBase} placeholder="Religion" />
              <input name="nationality" required defaultValue={pi?.nationality || ""} className={inputBase} placeholder="Nationality" />
            </div>
          </div>

          {/* Contact */}
          <div className={sectionCard}>
            <p className={labelSm}>Contact Details</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {/* backend-test expects phoneNumber */}
              <input name="phoneNumber" required defaultValue={ci?.mobile_no || ""} className={inputBase} placeholder="Mobile no." />
              <input name="homeNo" required defaultValue={ci?.home_no || ""} className={inputBase} placeholder="Home no." />
              <input name="officeNo" defaultValue={ci?.office_no || ""} className={inputBase} placeholder="Office no." />
              <input name="faxNo" defaultValue={ci?.fax_no || ""} className={inputBase} placeholder="Fax no." />

              <div className="sm:col-span-2">
                {/* not always in backend-test form, but structuredData supports it */}
                <input name="emailAddress" required defaultValue={fallbackEmail} className={inputBase} placeholder="Email address" />
              </div>

              <div className="sm:col-span-2">
                <input name="address" required defaultValue={ci?.home_address || ""} className={inputBase} placeholder="Home address" />
              </div>
            </div>
          </div>

          {/* Employment + Minor */}
          <div className={sectionCard}>
            <p className={labelSm}>Employment & Minor Details</p>
            <div className="mt-3 grid gap-3">
              <input name="occupation" defaultValue={ei?.occupation || ""} className={inputBase} placeholder="Occupation" />

              <div className="pt-3 border-t border-slate-100">
                <label className="flex items-center gap-2 text-sm text-slate-800">
                  <input type="checkbox" name="isMinor" defaultChecked={!!md?.is_minor} className={checkBox} />
                  Minor (under legal age)
                </label>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input name="guardianName" defaultValue={md?.parent_guardian_name || ""} className={inputBase} placeholder="Parent/Guardian name" />
                  <input name="guardianOccupation" defaultValue={md?.parent_guardian_occupation || ""} className={inputBase} placeholder="Parent/Guardian occupation" />
                </div>
              </div>
            </div>
          </div>

          {/* Dental + Referral */}
          <div className={sectionCard}>
            <p className={labelSm}>Dental & Referral</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input name="previousDentist" defaultValue={dh?.previous_dentist || ""} className={inputBase} placeholder="Previous dentist" />
              <input name="lastDentalVisit" defaultValue={dh?.last_dental_visit || ""} className={inputBase} placeholder="Last dental visit" />
              <input name="referredBy" defaultValue={rd?.referred_by || ""} className={inputBase} placeholder="Referred by" />
              <input name="consultationReason" defaultValue={rd?.reason_for_consultation || ""} className={inputBase} placeholder="Reason for consultation" />
            </div>
          </div>
        </div>
      </div>

      {/* Medical History (Clinical) */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
        <div>
          <p className="text-sm font-extrabold text-slate-900">Medical History (Clinical)</p>
          <p className="text-xs text-slate-500">Chairside clinical screening fields</p>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {/* Left */}
          <div className="space-y-4">
            <div className={sectionCard}>
              <p className={labelSm}>Physician</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input name="physicianName" defaultValue={phy?.name || ""} className={inputBase} placeholder="Physician name" />
                <input name="physicianSpecialty" defaultValue={phy?.specialty || ""} className={inputBase} placeholder="Specialty" />
                <input name="physicianOffice" defaultValue={phy?.office_address || ""} className={inputBase} placeholder="Office address" />
                <input name="physicianNumber" defaultValue={phy?.office_number || ""} className={inputBase} placeholder="Office no." />
              </div>
            </div>

            <div className={sectionCard}>
              <div className="flex items-center justify-between gap-3">
                <p className={labelSm}>General Screening</p>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <input type="checkbox" name="inGoodHealth" defaultChecked={!!ghs?.in_good_health} className={checkBox} />
                  In good health
                </label>
              </div>

              <div className="mt-4 grid gap-3">
                <div className="grid gap-2 sm:grid-cols-[220px_1fr] sm:items-center">
                  <label className="flex items-center gap-2 text-sm text-slate-800">
                    <input type="checkbox" name="underMedicalCondition" defaultChecked={!!ghs?.under_medical_condition?.status} className={checkBox} />
                    Under medical treatment
                  </label>
                  <input name="conditionDesc" defaultValue={ghs?.under_medical_condition?.condition_description || ""} className={inputBase} placeholder="Condition details" />
                </div>

                <div className="grid gap-2 sm:grid-cols-[220px_1fr] sm:items-center">
                  <label className="flex items-center gap-2 text-sm text-slate-800">
                    <input type="checkbox" name="seriousIllness" defaultChecked={!!ghs?.serious_illness_or_surgery?.status} className={checkBox} />
                    Serious illness / surgery
                  </label>
                  <input name="illnessDetails" defaultValue={ghs?.serious_illness_or_surgery?.details || ""} className={inputBase} placeholder="Details" />
                </div>

                <div className="grid gap-2 sm:grid-cols-[220px_1fr] sm:items-center">
                  <label className="flex items-center gap-2 text-sm text-slate-800">
                    <input type="checkbox" name="hospitalized" defaultChecked={!!ghs?.hospitalized?.status} className={checkBox} />
                    Hospitalized recently
                  </label>
                  <input name="hospitalizedDetails" defaultValue={ghs?.hospitalized?.when_and_why || ""} className={inputBase} placeholder="When and why" />
                </div>

                <div className="grid gap-2 sm:grid-cols-[220px_1fr] sm:items-start">
                  <label className="flex items-center gap-2 text-sm text-slate-800 pt-1">
                    <input type="checkbox" name="takingMeds" defaultChecked={!!ghs?.taking_medication?.status} className={checkBox} />
                    Taking medication
                  </label>
                  <textarea
                    name="medicationList"
                    defaultValue={ghs?.taking_medication?.medication_list || ""}
                    className={`${inputBase} h-20 resize-none`}
                    placeholder="List medications"
                  />
                </div>

                <div className="pt-1 flex flex-wrap items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-slate-800">
                    <input type="checkbox" name="usesTobacco" defaultChecked={!!ghs?.uses_tobacco} className={checkBox} />
                    Uses tobacco
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-800">
                    <input type="checkbox" name="usesDrugs" defaultChecked={!!ghs?.uses_alcohol_or_drugs} className={checkBox} />
                    Alcohol / drugs
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="space-y-4">
            <div className={sectionCard}>
              <p className={labelSm}>Vitals</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <input name="bloodType" defaultValue={vit?.blood_type || ""} className={inputBase} placeholder="Blood type" />
                <input name="bloodPressure" defaultValue={vit?.blood_pressure || ""} className={inputBase} placeholder="Blood pressure" />
                <input name="bleedingTime" defaultValue={vit?.bleeding_time || ""} className={inputBase} placeholder="Bleeding time" />
              </div>
            </div>

            <div className={sectionCard}>
              <p className={labelSm}>Allergies</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm text-slate-800">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="allergyAnaesthetic" defaultChecked={!!all?.local_anesthetic} className={checkBox} />
                  Local anaesthetic
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="allergyPenicillin" defaultChecked={!!all?.penicillin_antibiotics} className={checkBox} />
                  Penicillin
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="allergySulfa" defaultChecked={!!all?.sulfa_drugs} className={checkBox} />
                  Sulfa drugs
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="allergyAspirin" defaultChecked={!!all?.aspirin} className={checkBox} />
                  Aspirin
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="allergyLatex" defaultChecked={!!all?.latex} className={checkBox} />
                  Latex
                </label>
              </div>

              <input name="allergyOthers" defaultValue={all?.others || ""} className={`${inputBase} mt-3`} placeholder="Other allergies" />
            </div>

            {sexValue !== "male" ? (
              <div className={sectionCard}>
                <p className={labelSm}>For Women Only</p>
                <div className="mt-3 flex flex-wrap items-center gap-6 text-sm text-slate-800">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="isPregnant" defaultChecked={!!wom?.is_pregnant} className={checkBox} />
                    Pregnant
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="isNursing" defaultChecked={!!wom?.is_nursing} className={checkBox} />
                    Nursing
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="birthControl" defaultChecked={!!wom?.taking_birth_control} className={checkBox} />
                    Birth control
                  </label>
                </div>
              </div>
            ) : null}

            <div className={sectionCard}>
              <p className={labelSm}>Conditions Checklist</p>
              <textarea
                name="conditions"
                defaultValue={(mh?.conditions_checklist || []).join(", ")}
                className={`${inputBase} mt-3 h-28 resize-none`}
                placeholder="Comma separated (e.g., Hypertension, Diabetes, Asthma)"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <button
          disabled={saving}
          className="w-full rounded-xl bg-teal-700 text-white py-3 font-extrabold hover:bg-teal-800 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Patient Record"}
        </button>

        {status ? (
          <p className={`text-xs font-extrabold text-center ${status.success ? "text-emerald-700" : "text-rose-700"}`}>
            {status.message || (status.success ? "Saved." : "Failed.")}
          </p>
        ) : null}

        <button type="button" onClick={onClose} className="w-full text-xs text-slate-500 hover:text-slate-700">
          Close
        </button>
      </div>
    </form>
  );
}

function PatientEditModal({
  patientId,
  onClose,
}: {
  patientId: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-6xl rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-extrabold text-slate-900">Edit Patient Record</h3>
          <p className="text-sm text-slate-500">Updates follow backend-test structured registration schema.</p>
        </div>
        <div className="p-6 max-h-[85vh] overflow-y-auto">
          <PatientEditForm patientId={patientId} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}

export default function PatientRecordsPanel() {
  const { role } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);

  const [directory, setDirectory] = useState<UserProfile[]>([]);
  const [dirLoading, setDirLoading] = useState(true);

  const [viewingUid, setViewingUid] = useState<string | null>(null);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [chartUid, setChartUid] = useState<string | null>(null);
  const [chartName, setChartName] = useState<string | null>(null);

  useEffect(() => {
    setDirLoading(true);
    getPatientListAction().then((res: any) => {
      if (res?.success) setDirectory(res.data || []);
      setDirLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const t = setTimeout(async () => {
      setSearching(true);
      const res = await searchPatients(searchQuery);
      if (res.success) setSearchResults(res.data || []);
      setShowDropdown(true);
      setSearching(false);
    }, 250);

    return () => clearTimeout(t);
  }, [searchQuery]);

  const tableRows = useMemo(() => {
    if (searchQuery.trim()) return searchResults;
    return directory;
  }, [searchQuery, searchResults, directory]);

  return (
    <Card title="Patient Search & Records" subtitle="Search, view, and update patient medical history (clinical)">
      <div className="space-y-3">
        <div className="relative">
          <input
            className={inputBase}
            placeholder="Search patient by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowDropdown(true)}
          />

          {showDropdown && searchQuery.trim() && (searching || searchResults.length > 0) && (
            <ul className="absolute z-10 w-full bg-white border border-slate-200 rounded-2xl shadow-lg max-h-60 overflow-y-auto mt-2">
              {searching && <li className="p-3 text-sm text-slate-500">Searching...</li>}
              {!searching &&
                searchResults.map((u) => (
                  <li
                    key={u.uid}
                    className="p-3 hover:bg-slate-50 cursor-pointer text-sm border-b border-slate-100 last:border-0"
                    onClick={() => {
                      setSearchQuery(u.displayName || u.email);
                      setShowDropdown(false);
                    }}
                  >
                    <div className="font-bold text-slate-900">{u.displayName || "No Name"}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </li>
                ))}
            </ul>
          )}
        </div>

        <div className="pt-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-extrabold text-slate-700">
              {searchQuery.trim() ? "Search Results" : "Patient Directory (Staff)"}
            </p>
            <p className="text-[11px] text-slate-500">
              {searchQuery.trim()
                ? `${tableRows.length} result(s)`
                : dirLoading
                ? "Loading directory..."
                : `${tableRows.length} patient(s)`}
            </p>
          </div>

          <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-[11px] uppercase tracking-widest text-slate-500">
                  <th className="p-3">Name</th>
                  <th className="p-3 hidden md:table-cell">Email</th>
                  <th className="p-3 hidden lg:table-cell">UID</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {dirLoading && !searchQuery.trim() ? (
                  <tr>
                    <td className="p-3 text-slate-500" colSpan={4}>
                      Loading patient directory...
                    </td>
                  </tr>
                ) : tableRows.length === 0 ? (
                  <tr>
                    <td className="p-3 text-slate-500" colSpan={4}>
                      {searchQuery.trim() ? "No matching patients found." : "No patients found in directory."}
                    </td>
                  </tr>
                ) : (
                  tableRows.map((u) => (
                    <tr key={u.uid} className="border-t border-slate-100">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{u.displayName || "No Name"}</div>
                        <div className="text-xs text-slate-500 md:hidden">{u.email}</div>
                      </td>
                      <td className="p-3 hidden md:table-cell text-slate-700">{u.email}</td>
                      <td className="p-3 hidden lg:table-cell text-[11px] text-slate-500">{u.uid}</td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setViewingUid(u.uid)}
                            className="px-3 py-2 rounded-xl bg-slate-100 font-extrabold text-xs hover:bg-slate-200"
                          >
                            View
                          </button>
                          <button
                            onClick={() => {
                              setChartUid(u.uid);
                              setChartName(u.displayName || u.email || null);
                            }}
                            className="px-3 py-2 rounded-xl bg-slate-100 font-extrabold text-xs hover:bg-slate-200"
                          >
                            Dental Chart
                          </button>
                          <button
                            onClick={() => setEditingUid(u.uid)}
                            className="px-3 py-2 rounded-xl bg-teal-700 text-white font-extrabold text-xs hover:bg-teal-800"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {searchQuery.trim() && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSearchResults([]);
                setShowDropdown(false);
              }}
              className="mt-2 text-xs font-extrabold text-slate-600 hover:text-slate-900"
            >
              Clear search (back to directory)
            </button>
          )}
        </div>

        {viewingUid && <PatientDetailsModal patientId={viewingUid} onClose={() => setViewingUid(null)} />}
        {editingUid && <PatientEditModal patientId={editingUid} onClose={() => setEditingUid(null)} />}
        {chartUid && (
          <DentalChartModal
            patientId={chartUid}
            patientName={chartName}
            canEdit={role === "dentist"}
            onClose={() => {
              setChartUid(null);
              setChartName(null);
            }}
          />
        )}
      </div>
    </Card>
  );
}
