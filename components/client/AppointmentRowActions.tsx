// components/client/AppointmentRowActions.tsx
"use client";

import type { Appointment } from "@/lib/types/appointment";
import { cancelAppointmentAction } from "@/app/actions/appointment-actions";

export default function AppointmentRowActions({
  appointment,
  onView,
  onTransactions,
  onCancel,
}: {
  appointment: Appointment;
  onView: () => void;
  onTransactions: () => void;
  onCancel: () => void;
}) {
  const status = String((appointment as any).status || "").toLowerCase();
  const canCancel = status === "pending";
  const canTransactions = status === "completed" && !!(appointment as any).treatment;

  return (
    <div className="flex gap-2">
      <button
        className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200"
        onClick={onView}
      >
        View
      </button>

      <button
        className={[
          "rounded-lg px-3 py-2 text-xs font-bold",
          canTransactions
            ? "bg-slate-900 text-white hover:opacity-95"
            : "cursor-not-allowed bg-slate-100 text-slate-400",
        ].join(" ")}
        onClick={onTransactions}
        disabled={!canTransactions}
        title={!canTransactions ? "Available after completion" : ""}
      >
        Transactions
      </button>

      {canCancel && (
        <button
          className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
          onClick={onCancel}
        >
          Cancel
        </button>
      )}
    </div>
  );
}
