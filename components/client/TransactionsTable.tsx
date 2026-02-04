"use client";

import type { Appointment } from "@/lib/types/appointment";
import { formatTime12h } from "@/lib/utils/time";

function money(v: number) {
  return `₱${Number(v || 0).toLocaleString()}`;
}

function toSortTime(appt: Appointment): number {
  const date = String((appt as any).date || "").trim();
  const time = String((appt as any).time || "00:00").trim();
  const t = new Date(`${date} ${time}`).getTime();
  return Number.isFinite(t) ? t : 0;
}

export default function TransactionsTable({
  appointments,
  onOpenModal,
  dentistNameMap,
}: {
  appointments: Appointment[];
  onOpenModal: (appt: Appointment) => void;
  dentistNameMap: Record<string, string>;
}) {
  const rows = appointments
    .filter((a) => ["completed", "cancelled"].includes(String((a as any).status || "").toLowerCase()))
    .sort((a, b) => toSortTime(b) - toSortTime(a)); // latest first

  function resolveDentistName(appt: Appointment): string {
    const dentistId = String((appt as any).dentistId || "").trim();
    if (!dentistId) return "N/A";
    return dentistNameMap[dentistId] || "Dentist";
  }

  function printInvoice(appt: Appointment) {
    const status = String((appt as any).status || "").toLowerCase();
    if (status !== "completed") return;

    const treatment = (appt as any).treatment;
    if (!treatment) return;

    const dentist = resolveDentistName(appt);
    const patientName =
      String((appt as any).patientName || "").trim() ||
      String((appt as any).patientEmail || "").trim() ||
      "Patient";
    const apptDate = String((appt as any).date || "");
    const apptTime = formatTime12h(String((appt as any).time || ""));
    const procedures: { name: string; price: number }[] = Array.isArray(treatment?.procedures) ? treatment.procedures : [];

    const computedTotal =
      typeof treatment?.totalBill === "number"
        ? treatment.totalBill
        : procedures.reduce((sum, p) => sum + (Number(p.price) || 0), 0);

    // Printable HTML (invoice-style, not official)
    const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>J4 Dental Clinic - Invoice</title>
    <style>
      @page { margin: 18mm; }
      body { font-family: "Helvetica Neue", Arial, sans-serif; margin: 0; color: #111; }
      .page { position: relative; padding: 24px; }
      .header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .brand { display: flex; align-items: center; gap: 12px; }
      .brand img { height: 52px; }
      .clinic { font-size: 20px; font-weight: 800; margin: 0; }
      .note { font-size: 12px; color: #555; margin-top: 4px; }
      .invoice-box { text-align: right; }
      .invoice-box .label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: .08em; }
      .invoice-box .value { font-size: 16px; font-weight: 800; margin-top: 4px; }
      .meta { margin-top: 18px; font-size: 13px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .meta p { margin: 6px 0; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { border: 1px solid #e5e7eb; padding: 10px 8px; font-size: 13px; }
      th { background: #f8fafc; text-align: left; }
      .right { text-align: right; }
      .total-row td { font-weight: 800; }
      .foot { margin-top: 18px; font-size: 12px; color: #64748b; border-top: 1px dashed #e2e8f0; padding-top: 10px; }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="header">
        <div class="brand">
          <img src="/dclogo.png" alt="J4 Dental Clinic" />
          <div>
            <p class="clinic">J4 Dental Clinic</p>
            <div class="note">Informal summary (not an official invoice)</div>
          </div>
        </div>
        <div class="invoice-box">
          <div class="label">Appointment Ref</div>
          <div class="value">${String((appt as any).id || "").slice(0, 10)}</div>
        </div>
      </div>

      <div class="meta">
        <p><strong>Patient:</strong> ${patientName}</p>
        <p><strong>Dentist:</strong> ${dentist}</p>
        <p><strong>Date:</strong> ${apptDate}</p>
        <p><strong>Time:</strong> ${apptTime}</p>
        <p><strong>Service:</strong> ${String((appt as any).serviceType || "—")}</p>
      </div>

      <table>
        <thead>
          <tr>
            <th>Procedure</th>
            <th class="right">Price</th>
          </tr>
        </thead>
        <tbody>
          ${
            procedures.length
              ? procedures
                  .map(
                    (p) =>
                      `<tr><td>${String(p.name || "")}</td><td class="right">₱${Number(p.price || 0).toLocaleString()}</td></tr>`
                  )
                  .join("")
              : `<tr><td>—</td><td class="right">₱0</td></tr>`
          }
          <tr class="total-row">
            <td class="right">Total</td>
            <td class="right">₱${Number(computedTotal || 0).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <div class="foot">
        This document is for reference only and is not an official receipt.
      </div>
    </div>
  </body>
</html>
    `;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-700">No transactions yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 px-6 py-4">
        <h3 className="text-lg font-extrabold text-slate-900">Payment History</h3>
        <p className="mt-1 text-xs text-slate-500">
          Completed and cancelled appointments (latest first). Click a row to view more.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold text-slate-600">
            <tr>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Case / Procedure</th>
              <th className="px-6 py-3">Dentist</th>
              <th className="px-6 py-3">Total</th>
              <th className="px-6 py-3">Paid</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {rows.map((a) => {
              const status = String((a as any).status || "").toLowerCase();
              const treatment = (a as any).treatment;

              const proceduresText =
                status === "completed"
                  ? treatment?.procedures?.map((p: any) => p.name).filter(Boolean).join(", ") || "—"
                  : "—";

              const total =
                status === "completed"
                  ? treatment?.totalBill ??
                    treatment?.procedures?.reduce((s: number, p: any) => s + Number(p.price || 0), 0) ??
                    0
                  : 0;

              const dentist = status === "completed" ? resolveDentistName(a) : "N/A";

              return (
                <tr
                  key={String((a as any).id || "")}
                  onClick={() => onOpenModal(a)}
                  title="Click here to view more"
                  className="cursor-pointer hover:bg-slate-50 transition"
                >
                  <td className="px-6 py-4 text-slate-700">{String((a as any).date || "")}</td>

                  <td className="px-6 py-4 font-semibold text-slate-900">{proceduresText}</td>

                  <td className="px-6 py-4 font-semibold text-slate-900">{dentist}</td>

                  <td className="px-6 py-4 font-extrabold text-slate-900">
                    {status === "completed" ? money(total) : money(0)}
                  </td>

                  <td className="px-6 py-4 font-semibold text-slate-900">
                    {status === "completed" ? "Paid" : "N/A"}
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-bold uppercase ${
                          status === "completed"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        }`}
                      >
                        {status}
                      </span>

                      {status === "completed" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            printInvoice(a);
                          }}
                          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                          title="Print / Save as PDF"
                        >
                          Print
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
