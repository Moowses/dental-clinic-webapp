"use client";

import type { Appointment } from "@/lib/types/appointment";

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
    const procedures: { name: string; price: number }[] = Array.isArray(treatment?.procedures) ? treatment.procedures : [];

    const computedTotal =
      typeof treatment?.totalBill === "number"
        ? treatment.totalBill
        : procedures.reduce((sum, p) => sum + (Number(p.price) || 0), 0);

    // Printable HTML with watermark
    const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>J4 Dental Clinic - Invoice</title>
    <style>
      @page { margin: 18mm; }
      body { font-family: Arial, sans-serif; margin: 0; color: #111; }
      .page { position: relative; padding: 24px; }
      .header { display: flex; align-items: center; gap: 12px; }
      .header img { height: 48px; }
      .clinic { font-size: 18px; font-weight: 800; margin: 0; }
      .note { font-size: 12px; color: #555; margin-top: 4px; }
      .meta { margin-top: 16px; font-size: 13px; }
      .meta p { margin: 6px 0; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { border: 1px solid #ddd; padding: 10px 8px; font-size: 13px; }
      th { background: #f7f7f7; text-align: left; }
      .right { text-align: right; }
      .total-row td { font-weight: 800; }
      /* Watermark */
      .watermark {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        z-index: 0;
      }
      .watermark span {
        transform: rotate(-28deg);
        font-size: 64px;
        font-weight: 900;
        letter-spacing: 2px;
        color: rgba(0,0,0,0.08);
        text-transform: uppercase;
        white-space: nowrap;
      }
      .content { position: relative; z-index: 1; }
    </style>
  </head>
  <body>
    <div class="watermark"><span>NOT OFFICIAL RECEIPT</span></div>

    <div class="page">
      <div class="content">
        <div class="header">
          <img src="/dclogo.png" alt="J4 Dental Clinic" />
          <div>
            <p class="clinic">J4 Dental Clinic</p>
            <div class="note">Note: This is not an official receipt</div>
          </div>
        </div>

        <div class="meta">
          <p><strong>Date:</strong> ${String((appt as any).date || "")}</p>
          <p><strong>Dentist:</strong> ${dentist}</p>
          <p><strong>Services:</strong> ${String((appt as any).serviceType || "—")}</p>
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
        <h3 className="text-lg font-extrabold text-slate-900">Transactions</h3>
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

                  <td className="px-6 py-4">{dentist}</td>

                  <td className="px-6 py-4 font-bold">{status === "completed" ? money(total) : money(0)}</td>

                  <td className="px-6 py-4">{status === "completed" ? "Paid" : "N/A"}</td>

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
