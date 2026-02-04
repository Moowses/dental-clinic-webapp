"use client";

import React, { useEffect, useMemo, useState } from "react";

import { getPatientListAction, submitPatientRegistrationAction } from "@/app/actions/patient-actions";
import { getPatientRecord } from "@/lib/services/patient-service";
import { getUserProfile, searchPatients } from "@/lib/services/user-service";

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

const defaultRegistration = {
  personal_information: {
    name: { first_name: "", last_name: "", middle_initial: "" },
    nickname: "",
    birthdate: "",
    age: null as number | null,
    sex: "",
    religion: "",
    nationality: "",
    effective_date: "",
  },
  contact_information: {
    home_address: "",
    home_no: "",
    mobile_no: "",
    email_address: "",
    office_no: "",
    fax_no: "",
  },
  employment_information: { occupation: "" },
  minor_details: { is_minor: false, parent_guardian_name: "", parent_guardian_occupation: "" },
  referral_details: { referred_by: "", reason_for_consultation: "" },
  dental_history: { previous_dentist: "", last_dental_visit: "" },
  medical_history: {
    physician: { name: "", specialty: "", office_address: "", office_number: "" },
    general_health_screening: {
      in_good_health: null as boolean | null,
      under_medical_condition: { status: null as boolean | null, condition_description: "" },
      serious_illness_or_surgery: { status: null as boolean | null, details: "" },
      hospitalized: { status: null as boolean | null, when_and_why: "" },
      taking_medication: { status: null as boolean | null, medication_list: "" },
      uses_tobacco: null as boolean | null,
      uses_alcohol_or_drugs: null as boolean | null,
    },
    allergies: {
      local_anesthetic: false,
      penicillin_antibiotics: false,
      sulfa_drugs: false,
      aspirin: false,
      latex: false,
      others: "",
    },
    vitals: { bleeding_time: "", blood_type: "", blood_pressure: "" },
    women_only: { is_pregnant: null as boolean | null, is_nursing: null as boolean | null, taking_birth_control: null as boolean | null },
    conditions_checklist: [] as string[],
  },
  authorization: { signature_present: false, date_signed: "" },
};

function normalizeReg(source: any) {
  return {
    ...defaultRegistration,
    ...source,
    personal_information: {
      ...defaultRegistration.personal_information,
      ...(source?.personal_information || {}),
      name: {
        ...defaultRegistration.personal_information.name,
        ...(source?.personal_information?.name || {}),
      },
    },
    contact_information: {
      ...defaultRegistration.contact_information,
      ...(source?.contact_information || {}),
    },
    employment_information: {
      ...defaultRegistration.employment_information,
      ...(source?.employment_information || {}),
    },
    minor_details: {
      ...defaultRegistration.minor_details,
      ...(source?.minor_details || {}),
    },
    referral_details: {
      ...defaultRegistration.referral_details,
      ...(source?.referral_details || {}),
    },
    dental_history: {
      ...defaultRegistration.dental_history,
      ...(source?.dental_history || {}),
    },
    medical_history: {
      ...defaultRegistration.medical_history,
      ...(source?.medical_history || {}),
      physician: {
        ...defaultRegistration.medical_history.physician,
        ...(source?.medical_history?.physician || {}),
      },
      general_health_screening: {
        ...defaultRegistration.medical_history.general_health_screening,
        ...(source?.medical_history?.general_health_screening || {}),
        under_medical_condition: {
          ...defaultRegistration.medical_history.general_health_screening.under_medical_condition,
          ...(source?.medical_history?.general_health_screening?.under_medical_condition || {}),
        },
        serious_illness_or_surgery: {
          ...defaultRegistration.medical_history.general_health_screening.serious_illness_or_surgery,
          ...(source?.medical_history?.general_health_screening?.serious_illness_or_surgery || {}),
        },
        hospitalized: {
          ...defaultRegistration.medical_history.general_health_screening.hospitalized,
          ...(source?.medical_history?.general_health_screening?.hospitalized || {}),
        },
        taking_medication: {
          ...defaultRegistration.medical_history.general_health_screening.taking_medication,
          ...(source?.medical_history?.general_health_screening?.taking_medication || {}),
        },
      },
      allergies: {
        ...defaultRegistration.medical_history.allergies,
        ...(source?.medical_history?.allergies || {}),
      },
      vitals: {
        ...defaultRegistration.medical_history.vitals,
        ...(source?.medical_history?.vitals || {}),
      },
      women_only: {
        ...defaultRegistration.medical_history.women_only,
        ...(source?.medical_history?.women_only || {}),
      },
      conditions_checklist: Array.isArray(source?.medical_history?.conditions_checklist)
        ? source.medical_history.conditions_checklist
        : [],
    },
    authorization: {
      ...defaultRegistration.authorization,
      ...(source?.authorization || {}),
    },
  };
}

function yesNoNull(value: boolean | null) {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "";
}

function PatientDetailsModal({
  patientId,
  onClose,
}: {
  patientId: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setRecord(null);
    setProfile(null);

    (async () => {
      const [recRes, profRes] = await Promise.all([
        getPatientRecord(patientId),
        (async () => {
          try {
            return await getUserProfile(patientId);
          } catch {
            return null;
          }
        })(),
      ]);

      if (!active) return;
      if (recRes && recRes.success) setRecord(recRes.data || null);
      setProfile(profRes || null);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [patientId]);

  const reg = record?.registration || {};
  const name =
    reg?.personal_information?.name
      ? `${reg.personal_information.name.first_name || ""} ${
          reg.personal_information.name.middle_initial || ""
        } ${reg.personal_information.name.last_name || ""}`.replace(/\s+/g, " ").trim()
      : profile?.displayName || profile?.email || "Patient";
  const contact = reg?.contact_information || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-lg font-extrabold text-slate-900">Patient Details</h3>
          <p className="text-sm text-slate-500">{name}</p>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : (
            <>
              <div className={sectionCard}>
                <p className={labelSm}>Personal Information</p>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-700">
                  <div>Name: {name}</div>
                  <div>Birthdate: {reg?.personal_information?.birthdate || "—"}</div>
                  <div>Sex: {reg?.personal_information?.sex || "—"}</div>
                  <div>Nationality: {reg?.personal_information?.nationality || "—"}</div>
                </div>
              </div>

              <div className={sectionCard}>
                <p className={labelSm}>Contact Details</p>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-700">
                  <div>Mobile: {contact?.mobile_no || "—"}</div>
                  <div>Email: {contact?.email_address || profile?.email || "—"}</div>
                  <div>Address: {contact?.home_address || "—"}</div>
                </div>
              </div>

              <div className={sectionCard}>
                <p className={labelSm}>Medical</p>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-700">
                  <div>Blood Type: {reg?.medical_history?.vitals?.blood_type || "—"}</div>
                  <div>Blood Pressure: {reg?.medical_history?.vitals?.blood_pressure || "—"}</div>
                  <div>Allergies: {reg?.medical_history?.allergies?.others || "—"}</div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full text-center text-sm text-slate-500 hover:text-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function PatientEditModal({
  patientId,
  onClose,
}: {
  patientId: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() => normalizeReg(null));

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    (async () => {
      const res = await getPatientRecord(patientId);
      if (!active) return;
      if (res?.success) setForm(normalizeReg(res.data?.registration || null));
      else setForm(normalizeReg(null));
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [patientId]);

  const validateRequired = () => {
    const p = form.personal_information;
    const c = form.contact_information;
    const errs: string[] = [];
    if (!p.name.first_name.trim()) errs.push("First name is required.");
    if (!p.name.last_name.trim()) errs.push("Last name is required.");
    if (!p.birthdate.trim()) errs.push("Birthdate is required.");
    if (!c.home_address.trim()) errs.push("Home address is required.");
    if (!c.mobile_no.trim()) errs.push("Mobile number is required.");
    return errs;
  };

  const handleSave = async () => {
    const errs = validateRequired();
    if (errs.length) {
      setError(errs.join(" "));
      return;
    }
    setSaving(true);
    setError(null);
    const res = await submitPatientRegistrationAction(patientId, form as any);
    if (!res?.success) {
      setError(res?.error || "Failed to update patient record.");
      setSaving(false);
      return;
    }
    setSaving(false);
    onClose();
  };

  const p = form.personal_information;
  const c = form.contact_information;
  const m = form.medical_history;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-5xl rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-lg font-extrabold text-slate-900">Edit Patient Record</h3>
          <p className="text-sm text-slate-500">Fields marked * are required.</p>
        </div>

        <div className="p-5 max-h-[80vh] overflow-y-auto space-y-4">
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : (
            <>
              <div className={sectionCard}>
                <p className={labelSm}>Personal Information</p>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className={labelSm}>First Name *</label>
                    <input
                      className={inputBase}
                      value={p.name.first_name}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          personal_information: {
                            ...p,
                            name: { ...p.name, first_name: e.target.value },
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelSm}>Last Name *</label>
                    <input
                      className={inputBase}
                      value={p.name.last_name}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          personal_information: {
                            ...p,
                            name: { ...p.name, last_name: e.target.value },
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelSm}>Middle Initial</label>
                    <input
                      className={inputBase}
                      value={p.name.middle_initial}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          personal_information: {
                            ...p,
                            name: { ...p.name, middle_initial: e.target.value },
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelSm}>Birthdate *</label>
                    <input
                      type="date"
                      className={inputBase}
                      value={p.birthdate}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          personal_information: { ...p, birthdate: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelSm}>Age</label>
                    <input
                      type="number"
                      className={inputBase}
                      value={p.age ?? ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          personal_information: {
                            ...p,
                            age: e.target.value ? Number(e.target.value) : null,
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelSm}>Sex</label>
                    <input
                      className={inputBase}
                      value={p.sex}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          personal_information: { ...p, sex: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className={sectionCard}>
                <p className={labelSm}>Contact Details</p>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className={labelSm}>Home Address *</label>
                    <input
                      className={inputBase}
                      value={c.home_address}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          contact_information: { ...c, home_address: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelSm}>Mobile No *</label>
                    <input
                      className={inputBase}
                      value={c.mobile_no}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          contact_information: { ...c, mobile_no: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelSm}>Email</label>
                    <input
                      className={inputBase}
                      value={c.email_address}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          contact_information: { ...c, email_address: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelSm}>Home No</label>
                    <input
                      className={inputBase}
                      value={c.home_no}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          contact_information: { ...c, home_no: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className={sectionCard}>
                <p className={labelSm}>Other Details</p>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className={labelSm}>Occupation</label>
                    <input
                      className={inputBase}
                      value={form.employment_information.occupation}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          employment_information: { occupation: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelSm}>Previous Dentist</label>
                    <input
                      className={inputBase}
                      value={form.dental_history.previous_dentist}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          dental_history: { ...form.dental_history, previous_dentist: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelSm}>Last Dental Visit</label>
                    <input
                      className={inputBase}
                      value={form.dental_history.last_dental_visit}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          dental_history: { ...form.dental_history, last_dental_visit: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className={sectionCard}>
                <p className={labelSm}>Vitals & Allergies</p>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className={labelSm}>Blood Type</label>
                    <input
                      className={inputBase}
                      value={m.vitals.blood_type}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          medical_history: { ...m, vitals: { ...m.vitals, blood_type: e.target.value } },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelSm}>Blood Pressure</label>
                    <input
                      className={inputBase}
                      value={m.vitals.blood_pressure}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          medical_history: { ...m, vitals: { ...m.vitals, blood_pressure: e.target.value } },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelSm}>Bleeding Time</label>
                    <input
                      className={inputBase}
                      value={m.vitals.bleeding_time}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          medical_history: { ...m, vitals: { ...m.vitals, bleeding_time: e.target.value } },
                        })
                      }
                    />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelSm}>Allergies (select)</label>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700">
                      {[
                        ["local_anesthetic", "Local Anesthetic"],
                        ["penicillin_antibiotics", "Penicillin"],
                        ["sulfa_drugs", "Sulfa Drugs"],
                        ["aspirin", "Aspirin"],
                        ["latex", "Latex"],
                      ].map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={(m.allergies as any)[key] || false}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                medical_history: {
                                  ...m,
                                  allergies: { ...m.allergies, [key]: e.target.checked },
                                },
                              })
                            }
                            className={checkBox}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={labelSm}>Other Allergies</label>
                    <input
                      className={inputBase}
                      value={m.allergies.others}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          medical_history: { ...m, allergies: { ...m.allergies, others: e.target.value } },
                        })
                      }
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className={labelSm}>Conditions Checklist (comma-separated)</label>
                  <input
                    className={inputBase}
                    value={m.conditions_checklist.join(", ")}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        medical_history: { ...m, conditions_checklist: splitComma(e.target.value) },
                      })
                    }
                  />
                </div>
              </div>

              <div className={sectionCard}>
                <p className={labelSm}>Authorization</p>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                  <label className="flex items-center gap-2 text-xs font-extrabold text-slate-600 uppercase tracking-widest">
                    <input
                      type="checkbox"
                      checked={form.authorization.signature_present}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          authorization: { ...form.authorization, signature_present: e.target.checked },
                        })
                      }
                      className={checkBox}
                    />
                    Signature Present
                  </label>
                  <div>
                    <label className={labelSm}>Date Signed</label>
                    <input
                      type="date"
                      className={inputBase}
                      value={form.authorization.date_signed}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          authorization: { ...form.authorization, date_signed: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {error && <p className="text-sm font-extrabold text-rose-600">{error}</p>}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex flex-col gap-2">
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="w-full rounded-xl bg-emerald-700 py-3 text-white font-black hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button onClick={onClose} className="w-full text-center text-sm text-slate-500 hover:text-slate-700">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}



export default function PatientRecordsPanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);

  const [directory, setDirectory] = useState<UserProfile[]>([]);
  const [dirLoading, setDirLoading] = useState(true);

  const [viewingUid, setViewingUid] = useState<string | null>(null);
  const [editingUid, setEditingUid] = useState<string | null>(null);

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
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
                <tbody>
                  {dirLoading && !searchQuery.trim() ? (
                    <tr>
                      <td className="p-3 text-slate-500" colSpan={3}>
                        Loading patient directory...
                      </td>
                    </tr>
                  ) : tableRows.length === 0 ? (
                    <tr>
                      <td className="p-3 text-slate-500" colSpan={3}>
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
                        <td className="p-3">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setViewingUid(u.uid)}
                                className="px-3 py-2 rounded-xl bg-slate-100 font-extrabold text-xs hover:bg-slate-200"
                              >
                                View
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
      </div>
    </Card>
  );
}




