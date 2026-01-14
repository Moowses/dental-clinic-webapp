"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useActionState } from "react";

import { updatePatientRecordAction } from "@/app/actions/auth-actions";
import { getPatientRecord } from "@/lib/services/patient-service";
import { searchPatients, getUserProfile } from "@/lib/services/user-service";

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
                  {record?.medicalHistory?.allergies?.join(", ") || "None"}
                </p>
                <p className="text-sm text-slate-700">
                  <span className="font-bold">Conditions:</span>{" "}
                  {record?.medicalHistory?.conditions?.join(", ") || "None"}
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
  onClose?: () => void;
}) {
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);

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
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="targetUid" value={patientId} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
      </div>

      <input name="address" defaultValue={record?.address} className={inputBase} placeholder="Address" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <input
          name="allergies"
          defaultValue={record?.medicalHistory?.allergies?.join(", ")}
          className={inputBase}
          placeholder="Allergies (comma separated)"
        />
        <input
          name="conditions"
          defaultValue={record?.medicalHistory?.conditions?.join(", ")}
          className={inputBase}
          placeholder="Conditions (comma separated)"
        />
      </div>

      <textarea
        name="medications"
        defaultValue={record?.medicalHistory?.medications || ""}
        className={`${inputBase} h-20 resize-none`}
        placeholder="Medications / Notes"
      />

      <button
        disabled={isPending}
        className="w-full rounded-xl bg-teal-700 text-white py-2.5 font-extrabold hover:bg-teal-800 disabled:opacity-60"
      >
        {isPending ? "Saving..." : "Save Patient Record"}
      </button>

      {state.success ? (
        <p className="text-emerald-700 text-xs font-extrabold text-center">
          Update Successful
        </p>
      ) : null}

      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="w-full text-xs text-slate-500 hover:text-slate-700"
        >
          Close
        </button>
      ) : null}
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
      <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-lg font-extrabold text-slate-900">Finalize Patient Record</h3>
          <p className="text-sm text-slate-500">
            Complete missing information before continuing
          </p>
        </div>
        <div className="p-5">
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
  const [loading, setLoading] = useState(false);

  const [selectedUid, setSelectedUid] = useState<string>("");
  const [viewingUid, setViewingUid] = useState<string | null>(null);
  const [editingUid, setEditingUid] = useState<string | null>(null);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSelectedUid("");
      return;
    }

    const t = setTimeout(async () => {
      setLoading(true);
      const res = await searchPatients(searchQuery);
      if (res.success) setSearchResults(res.data || []);
      setShowDropdown(true);
      setLoading(false);
    }, 250);

    return () => clearTimeout(t);
  }, [searchQuery]);

  const rows = useMemo(() => searchResults || [], [searchResults]);

  const selectPatient = (u: UserProfile) => {
    setSelectedUid(u.uid);
    setSearchQuery(u.displayName || u.email);
    setShowDropdown(false);
  };

  return (
    <Card title="Patient Search & Records" subtitle="Search, view, and complete patient records">
      <div className="space-y-3">
        <div className="relative">
          <input
            className={inputBase}
            placeholder="Search patient by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowDropdown(true)}
          />

          {showDropdown && (loading || searchResults.length > 0) && (
            <ul className="absolute z-10 w-full bg-white border border-slate-200 rounded-2xl shadow-lg max-h-60 overflow-y-auto mt-2">
              {loading && (
                <li className="p-3 text-sm text-slate-500">Searching...</li>
              )}
              {!loading &&
                searchResults.map((u) => (
                  <li
                    key={u.uid}
                    className="p-3 hover:bg-slate-50 cursor-pointer text-sm border-b border-slate-100 last:border-0"
                    onClick={() => selectPatient(u)}
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

        <div className="flex gap-2">
          <button
            disabled={!selectedUid}
            onClick={() => setViewingUid(selectedUid)}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white font-extrabold text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            View
          </button>
          <button
            disabled={!selectedUid}
            onClick={() => setEditingUid(selectedUid)}
            className="flex-1 px-4 py-3 rounded-xl bg-teal-700 text-white font-extrabold text-sm hover:bg-teal-800 disabled:opacity-50"
          >
            Edit / Complete
          </button>
        </div>

        {/* Table */}
        <div className="pt-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-extrabold text-slate-700">Search Results</p>
            <p className="text-[11px] text-slate-500">
              {rows.length ? `${rows.length} result(s)` : "Type to search"}
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
                {rows.length === 0 ? (
                  <tr>
                    <td className="p-3 text-slate-500" colSpan={4}>
                      No records to show. Search a patient to populate the table.
                    </td>
                  </tr>
                ) : (
                  rows.map((u) => (
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
