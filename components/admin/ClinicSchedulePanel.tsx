"use client";

import React, { useCallback, useEffect, useState } from "react";

import {
  getClinicScheduleAction,
  updateAppointmentStatusAction,
  assignDentistAction,
  AppointmentWithPatient,
} from "@/app/actions/appointment-actions";

import { getDentistListAction } from "@/app/actions/dentist-actions";

import { getPatientRecord } from "@/lib/services/patient-service";
import { getUserProfile } from "@/lib/services/user-service";

import type { PatientRecord } from "@/lib/types/patient";
import type { UserProfile } from "@/lib/types/user";
import type { AppointmentStatus } from "@/lib/types/appointment";

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
    <span className={`inline-flex items-center px-3 py-1 rounded-full border text-[11px] font-extrabold uppercase tracking-wide ${cls}`}>
      {status}
    </span>
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

export default function ClinicSchedulePanel() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [schedule, setSchedule] = useState<AppointmentWithPatient[]>([]);
  const [dentists, setDentists] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewingId, setViewingId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    getClinicScheduleAction(date).then((res) => {
      if (res.success && res.data) setSchedule(res.data);
      setLoading(false);
    });
  }, [date]);

  useEffect(() => {
    refresh();
    getDentistListAction().then((res) => {
      if (res.success && res.data) setDentists(res.data as any);
    });
  }, [date, refresh]);

  return (
    <Card title="Clinic Schedule" subtitle="Confirm, cancel, and assign dentists">
      <div className="flex items-center justify-between gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={`${inputBase} max-w-[180px]`}
        />
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
          <p className="text-sm text-slate-500 italic">No appointments for this date.</p>
        ) : (
          <div className="space-y-3">
            {schedule.map((app) => (
              <div key={app.id} className="border border-slate-200 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-extrabold text-slate-900">
                      {app.time} — {app.patientName}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {app.serviceType || "Service"}
                      {app.dentistName ? ` • Dentist: ${app.dentistName}` : ""}
                    </p>

                    <div className="mt-2 flex items-center gap-2">
                      <StatusPill status={app.status} />
                      {!app.isProfileComplete && (
                        <span className="text-[11px] font-extrabold text-red-700 bg-red-50 border border-red-200 px-3 py-1 rounded-full">
                          Profile incomplete
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => setViewingId(app.patientId)}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-900 font-extrabold text-sm hover:bg-slate-200"
                  >
                    View Patient
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <select
                    value={app.status}
                    onChange={(e) =>
                      updateAppointmentStatusAction(
                        app.id,
                        e.target.value as AppointmentStatus
                      ).then(refresh)
                    }
                    className={`${inputBase} font-extrabold uppercase`}
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>

                  <select
                    value={app.dentistId || ""}
                    onChange={(e) => assignDentistAction(app.id, e.target.value).then(refresh)}
                    className={inputBase}
                  >
                    <option value="">Assign Dentist</option>
                    {dentists.map((d) => (
                      <option key={d.uid} value={d.uid}>
                        {d.displayName || d.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewingId && (
        <PatientDetailsModal patientId={viewingId} onClose={() => setViewingId(null)} />
      )}
    </Card>
  );
}
