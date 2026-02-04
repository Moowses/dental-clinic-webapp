// components/client/AppointmentDetailsModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { formatTime12h } from "@/lib/utils/time";
import type { Appointment } from "@/lib/types/appointment";
import type { DentistProfile } from "@/lib/services/dentist-profile-service";

function fmtTimestamp(ts: any) {
  try {
    if (!ts) return "—";
    const d: Date = typeof ts?.toDate === "function" ? ts.toDate() : new Date(ts);
    return d.toLocaleString();
  } catch {
    return "—";
  }
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export type AppointmentModalTab = "details" | "transactions";

export default function AppointmentDetailsModal({
  open,
  onClose,
  appointment,
  dentistProfile,
  dentistLoading,
  brandColor,
  initialTab = "details",
}: {
  open: boolean;
  onClose: () => void;
  appointment: Appointment | null;

  dentistProfile: DentistProfile | null;
  dentistLoading: boolean;

  brandColor: string;
  initialTab?: AppointmentModalTab;
}) {
  const [tab, setTab] = useState<AppointmentModalTab>("details");

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  const canTransactions = useMemo(() => {
    if (!appointment) return false;
    const status = String((appointment as any).status || "").toLowerCase();
    return status === "completed" && !!(appointment as any).treatment;
  }, [appointment]);

  if (!open || !appointment) return null;

  const dentistId = (appointment as any).dentistId as string | undefined;

  const dentistLabel = !dentistId
    ? "Unassigned dentist"
    : dentistLoading
      ? "Loading dentist…"
      : dentistProfile?.displayName || dentistProfile?.email || "Dentist (profile not found)";

  const treatment = (appointment as any).treatment as
    | {
        completedAt?: any;
        notes?: string;
        totalBill?: number;
        procedures?: { id?: string; name: string; price: number }[];
      }
    | undefined;

  const procedures = treatment?.procedures || [];
  const totalBill =
    typeof treatment?.totalBill === "number"
      ? treatment.totalBill
      : procedures.reduce((sum, p) => sum + (Number(p.price) || 0), 0);

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <button className="absolute inset-0 bg-black/50" aria-label="Close modal" onClick={onClose} />

      {/* Panel */}
      <div className="absolute left-1/2 top-1/2 w-[94vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <p className="text-lg font-extrabold text-slate-900">Appointment</p>
            <p className="text-sm text-slate-500">
              {(appointment as any).date} • {formatTime12h((appointment as any).time)}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200 px-5 pt-4">
          <button
            onClick={() => setTab("details")}
            className={[
              "rounded-xl px-4 py-2 text-sm font-semibold",
              tab === "details" ? "text-white" : "text-slate-700 hover:bg-slate-50",
            ].join(" ")}
            style={tab === "details" ? { backgroundColor: brandColor } : undefined}
          >
            View
          </button>

          <button
            onClick={() => canTransactions && setTab("transactions")}
            disabled={!canTransactions}
            className={[
              "rounded-xl px-4 py-2 text-sm font-semibold",
              canTransactions
                ? tab === "transactions"
                  ? "text-white"
                  : "text-slate-700 hover:bg-slate-50"
                : "cursor-not-allowed text-slate-400",
            ].join(" ")}
            style={canTransactions && tab === "transactions" ? { backgroundColor: brandColor } : undefined}
            title={!canTransactions ? "Transactions available after completion" : ""}
          >
            Transactions
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {tab === "details" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Info label="Service Type" value={String((appointment as any).serviceType || "—")} />
                <Info label="Status" value={String((appointment as any).status || "—")} />
                <Info label="Payment" value={String((appointment as any).paymentStatus || "—")} />
                <Info label="Dentist" value={dentistLabel} />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-500">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                  {String((appointment as any).notes || "").trim() ? String((appointment as any).notes) : "—"}
                </p>
              </div>
            </div>
          )}

          {tab === "transactions" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Info label="Completed At" value={fmtTimestamp(treatment?.completedAt)} />
                <Info label="Total Bill" value={`₱${Number(totalBill || 0).toLocaleString()}`} />
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-extrabold text-slate-900">Procedures</p>

                {!procedures.length ? (
                  <p className="mt-2 text-sm text-slate-500">No procedures recorded.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {procedures.map((p, idx) => (
                      <div
                        key={`${p.id || idx}`}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2"
                      >
                        <p className="truncate text-sm font-semibold text-slate-900">{p.name}</p>
                        <p className="text-sm font-bold text-slate-800">₱{Number(p.price || 0).toLocaleString()}</p>
                      </div>
                    ))}

                    <div className="flex items-center justify-between pt-2">
                      <p className="text-sm font-bold text-slate-700">Total</p>
                      <p className="text-sm font-extrabold text-slate-900">
                        ₱{Number(totalBill || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-500">Treatment Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                  {String(treatment?.notes || "").trim() ? String(treatment?.notes) : "—"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
