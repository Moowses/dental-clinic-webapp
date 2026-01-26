"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import ReportShell from "./ReportShell";

// TODO: update these imports to your actual action exports

import { getBillingReport } from "@/app/actions/billing-report-actions";

type BillingRow = {
  id: string;
  appointmentId?: string;
  patientId?: string;
  patientName?: string;
  totalAmount: number;
  remainingBalance: number;
  status: "unpaid" | "paid" | "partial" | "overdue" | "refunded";
  createdAt?: string; // ISO
};

type BillingReportResponse = {
  rows: BillingRow[];
  summary: {
    totalRecords: number;
    totalBilled: number;
    totalCollected: number;
    totalOutstanding: number;
    byStatus: Record<string, number>;
  };
};

export default function BillingReportPanel() {
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<BillingReportResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const subtitle = useMemo(() => `Last ${rangeDays} days`, [rangeDays]);

useEffect(() => {
  let cancelled = false;
  setErr(null);

startTransition(async () => {
  try {
    const raw = await getBillingDetailsAction(String(rangeDays));
    const res = normalizeBillingReport(raw);
    if (!cancelled) setData(res);
  } catch (e: any) {
    if (!cancelled) setErr(e?.message ?? "Failed to load billing report.");
  }
});

  return () => {
    cancelled = true;
  };
}, [rangeDays]);


  if (err) {
    return (
      <ReportShell
        reportName="Billing & Payment Report"
        subtitle={subtitle}
        empty={{ title: "Error loading report", description: err }}
      >
        <div />
      </ReportShell>
    );
  }

  const empty =
    !data || data.rows.length === 0
      ? {
          title: pending ? "Loading report…" : "No billing records found",
          description: pending
            ? "Please wait while we generate the report."
            : "Try expanding the date range.",
        }
      : undefined;

  return (
    <ReportShell reportName="Billing & Payment Report" subtitle={subtitle} empty={empty}>
      {!data ? null : (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <SummaryCard label="Records" value={data.summary.totalRecords} />
            <SummaryCard label="Total Billed" value={money(data.summary.totalBilled)} />
            <SummaryCard label="Collected" value={money(data.summary.totalCollected)} />
            <SummaryCard label="Outstanding" value={money(data.summary.totalOutstanding)} />
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">Range:</span>
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setRangeDays(d as any)}
                className={[
                  "rounded-full px-3 py-1.5 text-sm font-semibold transition",
                  rangeDays === d
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                ].join(" ")}
              >
                {d}d
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-600">
                  <th className="px-4 py-3 font-bold">Date</th>
                  <th className="px-4 py-3 font-bold">Patient</th>
                  <th className="px-4 py-3 font-bold">Appointment</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Total</th>
                  <th className="px-4 py-3 font-bold">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-200">
                    <td className="px-4 py-3 text-slate-700">{formatDate(r.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-900 font-semibold">
                      {r.patientName ?? r.patientId ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{r.appointmentId ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700">
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{money(r.totalAmount)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {money(r.remainingBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Status counts */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-extrabold text-slate-900">Status Breakdown</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(data.summary.byStatus ?? {}).map(([k, v]) => (
                <span
                  key={k}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700"
                >
                  {k}: {v}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </ReportShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-slate-900">{value}</p>
    </div>
  );
}
function normalizeBillingReport(raw: any): BillingReportResponse {
  if (raw?.rows && raw?.summary) return raw as BillingReportResponse;

  const rowsCandidate = raw?.records ?? raw?.rows ?? raw?.data ?? raw ?? [];
  const rows: BillingRow[] = (Array.isArray(rowsCandidate) ? rowsCandidate : []).map((r: any) => ({
    id: String(r.id ?? r.billingId ?? r.docId ?? `${Math.random()}_${Date.now()}`),
    appointmentId: r.appointmentId ?? r.appointment_id,
    patientId: r.patientId ?? r.patient_id,
    patientName: r.patientName ?? r.patient_name,
    totalAmount: Number(r.totalAmount ?? r.total ?? r.amount ?? 0),
    remainingBalance: Number(r.remainingBalance ?? r.remaining ?? r.outstanding ?? 0),
    status: (r.status ?? r.paymentStatus ?? "unpaid") as BillingRow["status"],
    createdAt: r.createdAt?.toDate?.()?.toISOString?.() ?? r.createdAt ?? r.created_at,
  }));

  let totalBilled = 0;
  let totalOutstanding = 0;
  const byStatus: Record<string, number> = {};

  for (const r of rows) {
    totalBilled += r.totalAmount || 0;
    totalOutstanding += r.remainingBalance || 0;
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  }

  const totalCollected = Math.max(0, totalBilled - totalOutstanding);

  return {
    rows,
    summary: {
      totalRecords: rows.length,
      totalBilled,
      totalCollected,
      totalOutstanding,
      byStatus,
    },
  };
}

function cryptoRandomId() {
  // browser-safe fallback
  return `row_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function money(n: number) {
  return (n ?? 0).toLocaleString(undefined, { style: "currency", currency: "PHP" });
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}
