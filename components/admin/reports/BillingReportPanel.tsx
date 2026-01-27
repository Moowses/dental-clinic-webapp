"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import ReportShell from "./ReportShell";
import { getBillingReport } from "@/app/actions/billing-report-actions";

import { db } from "@/lib/firebase/firebase";
import { doc, getDoc } from "firebase/firestore";

type BillingRow = {
  id: string; // billing_records docId
  appointmentId?: string;
  patientId?: string;
  patientName?: string;
  totalAmount: number;
  remainingBalance: number;
  status: "unpaid" | "paid" | "partial" | "overdue" | "refunded" | string;
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

type BillingRecordDoc = {
  appointmentId?: string;
  patientId?: string;
  createdAt?: any; // Firestore Timestamp
  updatedAt?: any;

  totalAmount?: number;
  remainingBalance?: number;
  status?: string;

  items?: { id: string; name: string; price?: number; status?: string; toothNumber?: string }[];

  paymentPlan?: {
    type?: string;
    installments?: {
      id: string;
      amount: number;
      description?: string;
      dueDate?: string;
      status?: string;
      paidAt?: any;
      paidBy?: string;
      paidMethod?: string;
    }[];
  };

  transactions?: {
    id?: string;
    amount: number;
    date?: any; // Timestamp
    method?: string;
    mode?: "item" | "installment" | string;
    itemIds?: string[];
    installmentId?: string;
    recordedBy?: string;
  }[];
};

type TxnRow = {
  id: string;
  dateISO?: string;
  patientLabel: string;
  appointmentId?: string;

  description: string; // procedure(s) / installment description
  txnType: "Procedure" | "Installment";
  method: string;

  amount: number;
  status: string;
  recordedBy?: string;

  recordId: string;
};

export default function BillingReportPanel() {
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<BillingReportResponse | null>(null);
  const [txns, setTxns] = useState<TxnRow[]>([]);
  const [view, setView] = useState<"transactions" | "bills">("transactions");

  const [err, setErr] = useState<string | null>(null);
  const [detailsErr, setDetailsErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingDetails, startDetailsTransition] = useTransition();

  const subtitle = useMemo(() => `Last ${rangeDays} days`, [rangeDays]);

  // 1) Load summary report
  useEffect(() => {
    let cancelled = false;
    setErr(null);
    setDetailsErr(null);

    startTransition(async () => {
      try {
        const raw = await getBillingReport(rangeDays);
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

  // 2) Build transaction log by fetching each billing_records doc
  useEffect(() => {
    if (!data?.rows?.length) {
      setTxns([]);
      return;
    }

    let cancelled = false;
    setDetailsErr(null);

    startDetailsTransition(async () => {
      try {
        const patientCache = new Map<string, string>();

        const all: TxnRow[] = [];

        for (const row of data.rows) {
          const recordId = row.id;
          const recordRef = doc(db, "billing_records", recordId);
          const snap = await getDoc(recordRef);

          if (!snap.exists()) {
            // fallback: show at least the bill row in Bills view; txns skip
            continue;
          }

          const rec = snap.data() as BillingRecordDoc;

          const patientId = rec.patientId ?? row.patientId;
          const patientLabel = await resolvePatientLabel(
            patientId,
            row.patientName,
            patientCache
          );

          const appointmentId = rec.appointmentId ?? row.appointmentId;

          const items = Array.isArray(rec.items) ? rec.items : [];
          const installments = Array.isArray(rec.paymentPlan?.installments)
            ? rec.paymentPlan!.installments!
            : [];
          const transactions = Array.isArray(rec.transactions) ? rec.transactions : [];

          // Build rows from actual money movements (transactions)
          for (const t of transactions) {
            const mode = String(t.mode ?? "").toLowerCase();
            const dateISO =
              t.date?.toDate?.()?.toISOString?.() ??
              (typeof t.date === "string" ? t.date : undefined);

            if (mode === "installment") {
              const inst = installments.find((x) => x.id === t.installmentId);
              all.push({
                id: t.id ?? `${recordId}_${t.installmentId ?? "installment"}_${dateISO ?? ""}`,
                dateISO,
                patientLabel,
                appointmentId,
                description:
                  inst?.description ??
                  `Installment Payment${t.installmentId ? ` (${t.installmentId.slice(0, 6)}…)` : ""}`,
                txnType: "Installment",
                method: t.method ?? inst?.paidMethod ?? "—",
                amount: Number(t.amount ?? 0),
                status: inst?.status ?? "paid",
                recordedBy: t.recordedBy ?? inst?.paidBy,
                recordId,
              });
            } else {
              // item mode (procedure payment)
              const paidFor =
                (t.itemIds ?? [])
                  .map((id) => items.find((it) => it.id === id)?.name)
                  .filter(Boolean) as string[];

              const description =
                paidFor.length > 0
                  ? paidFor.join(", ")
                  : items.length
                  ? items.map((it) => it.name).join(", ")
                  : "Procedure Payment";

              all.push({
                id: t.id ?? `${recordId}_${(t.itemIds?.[0] ?? "item")}_${dateISO ?? ""}`,
                dateISO,
                patientLabel,
                appointmentId,
                description,
                txnType: "Procedure",
                method: t.method ?? "—",
                amount: Number(t.amount ?? 0),
                status: "paid",
                recordedBy: t.recordedBy,
                recordId,
              });
            }
          }
        }

        // Sort newest first
        all.sort((a, b) => {
          const ta = a.dateISO ? new Date(a.dateISO).getTime() : 0;
          const tb = b.dateISO ? new Date(b.dateISO).getTime() : 0;
          return tb - ta;
        });

        if (!cancelled) setTxns(all);
      } catch (e: any) {
        if (!cancelled) setDetailsErr(e?.message ?? "Failed to load transaction details.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [data]);

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

  const txnEmpty =
    view === "transactions" && data && data.rows.length > 0 && txns.length === 0
      ? {
          title: pendingDetails ? "Loading transactions…" : "No transactions found",
          description: pendingDetails
            ? "Fetching transaction details…"
            : "Bills exist, but no recorded payments yet.",
        }
      : undefined;

  return (
    <ReportShell reportName="Billing & Payment Report" subtitle={subtitle} empty={empty ?? txnEmpty}>
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
          <div className="flex flex-wrap items-center justify-between gap-3">
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

            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">View:</span>
              <button
                onClick={() => setView("transactions")}
                className={[
                  "rounded-full px-3 py-1.5 text-sm font-semibold transition",
                  view === "transactions"
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                ].join(" ")}
              >
                Transactions
              </button>
              <button
                onClick={() => setView("bills")}
                className={[
                  "rounded-full px-3 py-1.5 text-sm font-semibold transition",
                  view === "bills"
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                ].join(" ")}
              >
                Bills
              </button>
            </div>
          </div>

          {/* Details load warning (non-blocking) */}
          {detailsErr ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-bold">Transactions view is limited</p>
              <p className="mt-1">{detailsErr}</p>
            </div>
          ) : null}

          {view === "transactions" ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-600">
                    <th className="px-4 py-3 font-bold">Date</th>
                    <th className="px-4 py-3 font-bold">Patient</th>
                    <th className="px-4 py-3 font-bold">Procedure / Description</th>
                    <th className="px-4 py-3 font-bold">Type</th>
                    <th className="px-4 py-3 font-bold">Method</th>
                    <th className="px-4 py-3 font-bold">Amount</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {txns.map((t) => (
                    <tr key={t.id} className="border-t border-slate-200">
                      <td className="px-4 py-3 text-slate-700">{formatDate(t.dateISO)}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{t.patientLabel}</div>
                        <div className="text-xs text-slate-500">
                          Appt: {t.appointmentId ?? "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-900 font-semibold">{t.description}</td>
                      <td className="px-4 py-3 text-slate-700">{t.txnType}</td>
                      <td className="px-4 py-3 text-slate-700">{t.method}</td>
                      <td className="px-4 py-3 text-slate-700">{money(t.amount)}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700">
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {pendingDetails ? (
                <div className="border-t border-slate-200 p-3 text-xs text-slate-500">
                  Loading transaction details…
                </div>
              ) : null}
            </div>
          ) : (
            <>
              {/* Bills table (original view) */}
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
                        <td className="px-4 py-3 text-slate-700">{money(r.remainingBalance)}</td>
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
            </>
          )}
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

async function resolvePatientLabel(
  patientId?: string,
  patientName?: string,
  cache?: Map<string, string>
) {
  // If we already have a friendly name, use it.
  if (patientName && patientName.trim() && !looksLikeUid(patientName)) return patientName;

  if (!patientId) return "—";

  if (cache?.has(patientId)) return cache.get(patientId)!;

  // Try to resolve from users/{uid}
  try {
    const snap = await getDoc(doc(db, "users", patientId));
    if (snap.exists()) {
      const u: any = snap.data();
      const label =
        u.fullName ??
        u.name ??
        u.displayName ??
        u.firstName ??
        u.email ??
        patientId;
      cache?.set(patientId, String(label));
      return String(label);
    }
  } catch {
    // ignore
  }

  cache?.set(patientId, patientId);
  return patientId;
}

function looksLikeUid(s: string) {
  // Firebase UID-ish heuristic
  return s.length >= 20 && !s.includes(" ");
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
