"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useActionState } from "react";

import { updatePatientRecordAction } from "@/app/actions/auth-actions";
import { getPatientListAction } from "@/app/actions/patient-actions";

import { getPatientRecord } from "@/lib/services/patient-service";
import { getUserProfile, searchPatients } from "@/lib/services/user-service";

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

const inputBase =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-300";

const labelSm = "text-[11px] font-extrabold uppercase tracking-widest text-slate-600";
const sectionCard = "rounded-2xl border border-slate-200 bg-white p-4";
const checkLabel = "flex items-center gap-2 text-sm text-slate-800";
const checkBox = "h-4 w-4";

function PatientDetailsModal({
  patientId,
  onClose,
}: {
  patientId: string;
  onClose: () => void;
}) {
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);

  const reg: any = (record as any)?.registration;

  useEffect(() => {
    Promise.all([getPatientRecord(patientId), getUserProfile(patientId)]).then(
      ([recordRes, profileRes]) => {
        if (recordRes.success) setRecord(recordRes.data || null);
        if (profileRes.success && profileRes.data)
          setDisplayName(profileRes.data.displayName || "");
        setLoading(false);
      }
    );
  }, [patientId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-lg font-extrabold text-slate-900">Patient Details</h3>
          <p className="text-sm text-slate-500">Record overview</p>
        </div>

        <div className="p-5">
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : (
            <div className="text-sm space-y-2">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Name</span>
                <span className="font-bold text-slate-900">{displayName || "N/A"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Phone</span>
                <span className="font-bold text-slate-900">
                  {record?.phoneNumber || "N/A"}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Address</span>
                <span className="font-bold text-slate-900 text-right">
                  {record?.address || "N/A"}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <p className="text-xs font-extrabold text-slate-700 uppercase tracking-wide">
                  Medical
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  <span className="font-bold">Allergies:</span>{" "}
                  {reg?.medical_history?.allergies
                    ? [
                        reg?.medical_history?.allergies?.local_anesthetic
                          ? "Local Anaesthetic"
                          : null,
                        reg?.medical_history?.allergies?.penicillin_antibiotics
                          ? "Penicillin"
                          : null,
                        reg?.medical_history?.allergies?.sulfa_drugs ? "Sulfa" : null,
                        reg?.medical_history?.allergies?.aspirin ? "Aspirin" : null,
                        reg?.medical_history?.allergies?.latex ? "Latex" : null,
                        reg?.medical_history?.allergies?.others || null,
                      ]
                        .filter(Boolean)
                        .join(", ") || "None"
                    : record?.medicalHistory?.allergies?.join(", ") || "None"}
                </p>
                <p className="text-sm text-slate-700">
                  <span className="font-bold">Conditions:</span>{" "}
                  {reg?.medical_history?.conditions_checklist?.join(", ") ||
                    record?.medicalHistory?.conditions?.join(", ") ||
                    "None"}
                </p>
              </div>
            </div>
          )}

          <div className="mt-5">
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-slate-900 text-white py-2.5 font-extrabold hover:bg-black"
            >
              Close
            </button>
          </div>
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
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);

  const reg: any = (record as any)?.registration;

  const [state, formAction, isPending] = useActionState(updatePatientRecordAction, {
    success: false,
  });

  useEffect(() => {
    setLoading(true);
    Promise.all([getPatientRecord(patientId), getUserProfile(patientId)]).then(
      ([recordRes, profileRes]) => {
        if (recordRes.success) setRecord(recordRes.data || null);
        if (profileRes.success && profileRes.data)
          setDisplayName(profileRes.data.displayName || "");
        setLoading(false);
      }
    );
  }, [patientId, state.success]);

  if (loading) return <p className="text-sm text-slate-500">Loading record...</p>;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="targetUid" value={patientId} />

      {/* Header */}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-extrabold text-slate-900">Patient Record</p>
        <p className="text-xs text-slate-500">
          Update patient profile + clinical medical history for dental screening.
        </p>
      </div>

      {/* Core patient info */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className={labelSm}>Basic Information</p>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
          <input
            name="displayName"
            defaultValue={displayName}
            className={inputBase}
            placeholder="Full Name"
          />
          <input
            name="phoneNumber"
            defaultValue={record?.phoneNumber}
            className={inputBase}
            placeholder="Phone"
          />

          <input
            name="dateOfBirth"
            type="date"
            defaultValue={record?.dateOfBirth}
            className={inputBase}
          />
          <select name="gender" defaultValue={record?.gender || "male"} className={inputBase}>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>

          <div className="lg:col-span-2">
            <input
              name="address"
              defaultValue={record?.address}
              className={inputBase}
              placeholder="Address"
            />
          </div>

          <input
            name="allergies"
            defaultValue={record?.medicalHistory?.allergies?.join(", ")}
            className={inputBase}
            placeholder="Allergies (legacy, comma separated)"
          />
          <input
            name="conditions"
            defaultValue={record?.medicalHistory?.conditions?.join(", ")}
            className={inputBase}
            placeholder="Conditions (legacy, comma separated)"
          />

          <div className="lg:col-span-2">
            <textarea
              name="medications"
              defaultValue={record?.medicalHistory?.medications || ""}
              className={`${inputBase} h-24 resize-none`}
              placeholder="Medications / Notes"
            />
          </div>
        </div>
      </div>

      {/* Medical History (Clinical) – redesigned */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-extrabold text-slate-900">Medical History (Clinical)</p>
          <p className="text-xs text-slate-500">
            Staff-only clinical fields. Layout is wide for fast chairside review.
          </p>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {/* LEFT: Physician + Screening */}
          <div className="space-y-4">
            {/* Physician */}
            <div className={sectionCard}>
              <p className={labelSm}>Physician</p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input
                  name="physicianName"
                  defaultValue={reg?.medical_history?.physician?.name || ""}
                  className={inputBase}
                  placeholder="Physician Name"
                />
                <input
                  name="physicianSpecialty"
                  defaultValue={reg?.medical_history?.physician?.specialty || ""}
                  className={inputBase}
                  placeholder="Specialty"
                />
                <input
                  name="physicianOffice"
                  defaultValue={reg?.medical_history?.physician?.office_address || ""}
                  className={inputBase}
                  placeholder="Office Address"
                />
                <input
                  name="physicianNumber"
                  defaultValue={reg?.medical_history?.physician?.office_number || ""}
                  className={inputBase}
                  placeholder="Office No."
                />
              </div>
            </div>

            {/* General screening */}
            <div className={sectionCard}>
              <div className="flex items-center justify-between gap-3">
                <p className={labelSm}>General Screening</p>

                <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    name="inGoodHealth"
                    defaultChecked={!!reg?.medical_history?.general_health_screening?.in_good_health}
                    className={checkBox}
                  />
                  In good health
                </label>
              </div>

              <div className="mt-4 grid gap-3">
                <div className="grid gap-2 sm:grid-cols-[210px_1fr] sm:items-center">
                  <label className={checkLabel}>
                    <input
                      type="checkbox"
                      name="underMedicalCondition"
                      defaultChecked={
                        !!reg?.medical_history?.general_health_screening?.under_medical_condition
                          ?.status
                      }
                      className={checkBox}
                    />
                    Under medical treatment
                  </label>
                  <input
                    name="conditionDesc"
                    defaultValue={
                      reg?.medical_history?.general_health_screening?.under_medical_condition
                        ?.condition_description || ""
                    }
                    className={inputBase}
                    placeholder="Condition details"
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-[210px_1fr] sm:items-center">
                  <label className={checkLabel}>
                    <input
                      type="checkbox"
                      name="seriousIllness"
                      defaultChecked={
                        !!reg?.medical_history?.general_health_screening?.serious_illness_or_surgery
                          ?.status
                      }
                      className={checkBox}
                    />
                    Serious illness / surgery
                  </label>
                  <input
                    name="illnessDetails"
                    defaultValue={
                      reg?.medical_history?.general_health_screening?.serious_illness_or_surgery
                        ?.details || ""
                    }
                    className={inputBase}
                    placeholder="Details"
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-[210px_1fr] sm:items-center">
                  <label className={checkLabel}>
                    <input
                      type="checkbox"
                      name="hospitalized"
                      defaultChecked={
                        !!reg?.medical_history?.general_health_screening?.hospitalized?.status
                      }
                      className={checkBox}
                    />
                    Hospitalized recently
                  </label>
                  <input
                    name="hospitalizedDetails"
                    defaultValue={
                      reg?.medical_history?.general_health_screening?.hospitalized?.when_and_why ||
                      ""
                    }
                    className={inputBase}
                    placeholder="When and why"
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-[210px_1fr] sm:items-start">
                  <label className={`${checkLabel} pt-1`}>
                    <input
                      type="checkbox"
                      name="takingMeds"
                      defaultChecked={
                        !!reg?.medical_history?.general_health_screening?.taking_medication?.status
                      }
                      className={checkBox}
                    />
                    Taking medication
                  </label>
                  <textarea
                    name="medicationList"
                    defaultValue={
                      reg?.medical_history?.general_health_screening?.taking_medication
                        ?.medication_list || ""
                    }
                    className={`${inputBase} h-20 resize-none`}
                    placeholder="List medications"
                  />
                </div>

                <div className="pt-1 flex flex-wrap items-center gap-6">
                  <label className={checkLabel}>
                    <input
                      type="checkbox"
                      name="usesTobacco"
                      defaultChecked={
                        !!reg?.medical_history?.general_health_screening?.uses_tobacco
                      }
                      className={checkBox}
                    />
                    Uses tobacco
                  </label>
                  <label className={checkLabel}>
                    <input
                      type="checkbox"
                      name="usesDrugs"
                      defaultChecked={
                        !!reg?.medical_history?.general_health_screening?.uses_alcohol_or_drugs
                      }
                      className={checkBox}
                    />
                    Alcohol / drugs
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Allergies + Vitals + Women + Conditions */}
          <div className="space-y-4">
            {/* Allergies */}
            <div className={sectionCard}>
              <p className={labelSm}>Allergies</p>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm text-slate-800">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="allergyAnaesthetic"
                    defaultChecked={!!reg?.medical_history?.allergies?.local_anesthetic}
                    className={checkBox}
                  />
                  Local anaesthetic
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="allergyPenicillin"
                    defaultChecked={!!reg?.medical_history?.allergies?.penicillin_antibiotics}
                    className={checkBox}
                  />
                  Penicillin
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="allergySulfa"
                    defaultChecked={!!reg?.medical_history?.allergies?.sulfa_drugs}
                    className={checkBox}
                  />
                  Sulfa drugs
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="allergyAspirin"
                    defaultChecked={!!reg?.medical_history?.allergies?.aspirin}
                    className={checkBox}
                  />
                  Aspirin
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="allergyLatex"
                    defaultChecked={!!reg?.medical_history?.allergies?.latex}
                    className={checkBox}
                  />
                  Latex
                </label>
              </div>

              <input
                name="allergyOthers"
                defaultValue={reg?.medical_history?.allergies?.others || ""}
                className={`${inputBase} mt-3`}
                placeholder="Other allergies"
              />
            </div>

            {/* Vitals */}
            <div className={sectionCard}>
              <p className={labelSm}>Vitals</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <input
                  name="bloodType"
                  defaultValue={reg?.medical_history?.vitals?.blood_type || ""}
                  className={inputBase}
                  placeholder="Blood Type"
                />
                <input
                  name="bloodPressure"
                  defaultValue={reg?.medical_history?.vitals?.blood_pressure || ""}
                  className={inputBase}
                  placeholder="Blood Pressure"
                />
                <input
                  name="bleedingTime"
                  defaultValue={reg?.medical_history?.vitals?.bleeding_time || ""}
                  className={inputBase}
                  placeholder="Bleeding Time"
                />
              </div>
            </div>

            {/* Women only */}
            <div className={sectionCard}>
              <p className={labelSm}>For Women Only</p>
              <div className="mt-3 flex flex-wrap items-center gap-6 text-sm text-slate-800">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="isPregnant"
                    defaultChecked={!!reg?.medical_history?.women_only?.is_pregnant}
                    className={checkBox}
                  />
                  Pregnant
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="isNursing"
                    defaultChecked={!!reg?.medical_history?.women_only?.is_nursing}
                    className={checkBox}
                  />
                  Nursing
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="birthControl"
                    defaultChecked={!!reg?.medical_history?.women_only?.taking_birth_control}
                    className={checkBox}
                  />
                  Birth control
                </label>
              </div>
            </div>

            {/* Conditions checklist */}
            <div className={sectionCard}>
              <p className={labelSm}>Conditions Checklist</p>
              <textarea
                name="conditionsClinical"
                defaultValue={(reg?.medical_history?.conditions_checklist || []).join(", ")}
                className={`${inputBase} mt-3 h-28 resize-none`}
                placeholder="Comma separated (e.g., Hypertension, Diabetes, Asthma)"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button
          disabled={isPending}
          className="w-full rounded-xl bg-teal-700 text-white py-3 font-extrabold hover:bg-teal-800 disabled:opacity-60"
        >
          {isPending ? "Saving..." : "Save Patient Record"}
        </button>

        {state.success ? (
          <p className="text-emerald-700 text-xs font-extrabold text-center">
            Update Successful
          </p>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          className="w-full text-xs text-slate-500 hover:text-slate-700"
        >
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
      {/* Wider professional modal */}
      <div className="w-full max-w-6xl rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-extrabold text-slate-900">Edit Patient Record</h3>
          <p className="text-sm text-slate-500">
            Complete clinical details for proper dental assessment.
          </p>
        </div>
        {/* Scrollable body */}
        <div className="p-6 max-h-[85vh] overflow-y-auto">
          <PatientEditForm patientId={patientId} onClose={onClose} />
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

  const tableModeLabel = searchQuery.trim()
    ? "Search Results"
    : "Patient Directory (Staff Only)";

  return (
    <Card
      title="Patient Search & Records"
      subtitle="Search, view, and update patient medical history"
    >
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
                    <div className="font-bold text-slate-900">
                      {u.displayName || "No Name"}
                    </div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </li>
                ))}
            </ul>
          )}
        </div>

        <div className="pt-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-extrabold text-slate-700">{tableModeLabel}</p>

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
                      {searchQuery.trim()
                        ? "No matching patients found."
                        : "No patients found in directory."}
                    </td>
                  </tr>
                ) : (
                  tableRows.map((u) => (
                    <tr key={u.uid} className="border-t border-slate-100">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">
                          {u.displayName || "No Name"}
                        </div>
                        <div className="text-xs text-slate-500 md:hidden">{u.email}</div>
                      </td>
                      <td className="p-3 hidden md:table-cell text-slate-700">{u.email}</td>
                      <td className="p-3 hidden lg:table-cell text-[11px] text-slate-500">
                        {u.uid}
                      </td>
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

        {viewingUid && (
          <PatientDetailsModal patientId={viewingUid} onClose={() => setViewingUid(null)} />
        )}
        {editingUid && (
          <PatientEditModal patientId={editingUid} onClose={() => setEditingUid(null)} />
        )}
      </div>
    </Card>
  );
}
