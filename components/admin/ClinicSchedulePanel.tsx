"use client";

import React, { useCallback, useEffect, useState } from "react";

import {
  getClinicScheduleAction,
  updateAppointmentStatusAction,
  assignDentistAction,
  recordPaymentAction,
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
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full border text-[11px] font-extrabold uppercase tracking-wide ${cls}`}
    >
      {status}
    </span>
  );
}

function PendingPaymentButton({
  amount,
  onClick,
}: {
  amount: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full px-4 py-2 rounded-xl bg-red-600 text-white font-extrabold text-sm hover:bg-red-700 transition"
      title="View bill and process payment"
    >
      Pending Payment • View Bill (${amount})
    </button>
  );
}

function PaidButton() {
  return (
    <button
      disabled
      className="w-full px-4 py-2 rounded-xl bg-emerald-100 text-emerald-800 font-extrabold text-sm border border-emerald-200 cursor-not-allowed"
      title="Payment completed"
    >
      Paid ✓
    </button>
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

function PaymentModal({
  appointment,
  onClose,
  onComplete,
}: {
  appointment: AppointmentWithPatient;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [method, setMethod] = useState("cash");
  const [loading, setLoading] = useState(false);

  const procedures = (appointment as any).treatment?.procedures || [];
  const inventoryUsed = (appointment as any).treatment?.inventoryUsed || [];
  const totalBill = (appointment as any).treatment?.totalBill || 0;

  const handlePayment = async () => {
    setLoading(true);
    await recordPaymentAction(appointment.id, method);
    onComplete();
    onClose();
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-lg font-extrabold text-slate-900">View Bill</h3>
          <p className="text-sm text-slate-500">Review the bill and confirm payment</p>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold text-slate-600 uppercase tracking-widest">
                Bill Details
              </p>
              <span className="text-xs font-extrabold text-slate-700">
                {appointment.patientName}
              </span>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-extrabold text-slate-500 uppercase">
                Procedures
              </p>
              {procedures.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No procedures found.</p>
              ) : (
                procedures.map((p: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-slate-700">{p.name}</span>
                    <span className="font-extrabold text-slate-900">${p.price}</span>
                  </div>
                ))
              )}
            </div>

            {inventoryUsed.length > 0 && (
              <div className="pt-3 border-t border-slate-200 space-y-2">
                <p className="text-[11px] font-extrabold text-slate-500 uppercase">
                  Materials Used
                </p>
                {inventoryUsed.map((i: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex justify-between text-sm text-slate-600"
                  >
                    <span>{i.name}</span>
                    <span className="font-bold">x{i.quantity}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-slate-300 flex justify-between text-base">
              <span className="font-extrabold text-slate-900">Total Bill</span>
              <span className="font-extrabold text-slate-900">${totalBill}</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-extrabold text-slate-600">
              Payment Method
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className={inputBase}
            >
              <option value="cash">Cash</option>
              <option value="card">Credit Card</option>
              <option value="insurance">Insurance</option>
            </select>
          </div>

          <button
            disabled={loading}
            onClick={handlePayment}
            className="w-full rounded-xl bg-red-600 text-white py-2.5 font-extrabold hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? "Processing..." : "Confirm Payment"}
          </button>

          <button
            onClick={onClose}
            className="w-full text-xs text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
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
  const [billingId, setBillingId] = useState<string | null>(null);

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

  const billingTarget = billingId
    ? schedule.find((a) => a.id === billingId) || null
    : null;

  return (
    <Card title="Clinic Schedule" subtitle="Confirm, complete, assign dentist, and bill patients">
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
            {schedule.map((app) => {
              const isCompleted = app.status === "completed";
              const isPaid = (app as any).paymentStatus === "paid";
              const billAmount = (app as any).treatment?.totalBill || 0;

              return (
                <div key={app.id} className="border border-slate-200 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* LEFT: Details */}
                    <div className="min-w-0">
                      <p className="font-extrabold text-slate-900">
                        {app.time} — {app.patientName}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {app.serviceType || "Service"}
                        {app.dentistName ? ` • Dentist: ${app.dentistName}` : ""}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StatusPill status={app.status} />

                        {!app.isProfileComplete && (
                          <span className="text-[11px] font-extrabold text-red-700 bg-red-50 border border-red-200 px-3 py-1 rounded-full">
                            Profile incomplete
                          </span>
                        )}

                        {isCompleted && (
                          <span className="text-[11px] font-extrabold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">
                            Treatment completed
                          </span>
                        )}
                      </div>
                    </div>

                    {/* RIGHT: Actions */}
                    <div className="w-full max-w-[220px] flex flex-col gap-2">
                      <button
                        onClick={() => setViewingId(app.patientId)}
                        className="w-full px-4 py-2 rounded-xl bg-slate-100 text-slate-900 font-extrabold text-sm hover:bg-slate-200 transition"
                      >
                        View Patient
                      </button>

                      {isCompleted &&
                        (isPaid ? (
                          <PaidButton />
                        ) : (
                          <PendingPaymentButton
                            amount={billAmount}
                            onClick={() => setBillingId(app.id)}
                          />
                        ))}
                    </div>
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
                      onChange={(e) =>
                        assignDentistAction(app.id, e.target.value).then(refresh)
                      }
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
              );
            })}
          </div>
        )}
      </div>

      {viewingId && (
        <PatientDetailsModal patientId={viewingId} onClose={() => setViewingId(null)} />
      )}

      {billingTarget && (
        <PaymentModal
          appointment={billingTarget}
          onClose={() => setBillingId(null)}
          onComplete={refresh}
        />
      )}
    </Card>
  );
}
