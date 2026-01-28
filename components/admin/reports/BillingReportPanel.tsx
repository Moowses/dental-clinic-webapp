"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import ReportShell from "./ReportShell";
import { getBillingReport } from "@/app/actions/billing-report-actions";

import { db } from "@/lib/firebase/firebase";
import { doc, getDoc } from "firebase/firestore";

type BillingRow = {
  id: string;
  appointmentId?: string;
  patientId?: string;
  patientName?: string;
  totalAmount: number;
  remainingBalance: number;
  status: string;
  createdAt?: string;
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
  items?: { id: string; name: string }[];
  paymentPlan?: {
    installments?: {
      id: string;
      amount: number;
      description?: string;
      status?: string;
      paidAt?: any;
      paidMethod?: string;
      paidBy?: string;
    }[];
  };
  transactions?: {
    id?: string;
    amount: number;
    date?: any;
    method?: string;
    mode?: string;
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
  description: string;
  txnType: "Procedure" | "Installment";
  method: string;
  amount: number;
  status: string;
};

function toDate(input: any): Date | null {
  try {
    if (!input) return null;
    if (input?.seconds) return new Date(input.seconds * 1000);
    if (typeof input === "string" || typeof input === "number") return new Date(input);
    if (input instanceof Date) return input;
    if (input?.toDate) return input.toDate();
    return null;
  } catch {
    return null;
  }
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function money(n: number) {
  const num = Number(n || 0);
  return `₱${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
    status: String(r.status ?? r.paymentStatus ?? "unpaid"),
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

function looksLikeUid(s: string) {
  return s.length >= 20 && !s.includes(" ");
}

function shortUid(uid: string) {
  if (!uid) return "—";
  return uid.length > 12 ? `${uid.slice(0, 6)}…${uid.slice(-4)}` : uid;
}

async function resolvePatientLabel(
  patientId?: string,
  patientName?: string,
  cache?: Map<string, string>
) {
  if (patientName && patientName.trim() && !looksLikeUid(patientName)) return patientName;
  if (!patientId) return "—";
  if (cache?.has(patientId)) return cache.get(patientId)!;

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
        shortUid(patientId);

      const out = String(label);
      cache?.set(patientId, out);
      return out;
    }
  } catch {
    // ignore
  }

  const fallback = shortUid(patientId);
  cache?.set(patientId, fallback);
  return fallback;
}

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

  function onPrint() {
    window.print();
  }

  // Load summary report + enrich rows with patientName
  useEffect(() => {
    let cancelled = false;
    setErr(null);
    setDetailsErr(null);

    startTransition(async () => {
      try {
        const raw = await getBillingReport(rangeDays);
        const res = normalizeBillingReport(raw);

        const cache = new Map<string, string>();
        const enrichedRows = await Promise.all(
          (res.rows || []).map(async (r) => {
            const label = await resolvePatientLabel(r.patientId, r.patientName, cache);
            return { ...r, patientName: label };
          })
        );

        if (!cancelled) setData({ ...res, rows: enrichedRows });
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load billing report.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [rangeDays]);

  // Build transaction log by fetching billing_records doc details
  useEffect(() => {
    if (!data?.rows?.length) {
      setTxns([]);
      return;
    }

    let cancelled = false;
    setDetailsErr(null);

    startDetailsTransition(async () => {
      try {
        const cache = new Map<string, string>();
        const all: TxnRow[] = [];

        for (const row of data.rows) {
          const recordId = row.id;
          const snap = await getDoc(doc(db, "billing_records", recordId));
          if (!snap.exists()) continue;

          const rec = snap.data() as BillingRecordDoc;

          const patientLabel = await resolvePatientLabel(
            rec.patientId ?? row.patientId,
            row.patientName,
            cache
          );

          const appointmentId = rec.appointmentId ?? row.appointmentId;
          const items = Array.isArray(rec.items) ? rec.items : [];
          const installments = Array.isArray(rec.paymentPlan?.installments)
            ? rec.paymentPlan!.installments!
            : [];
          const transactions = Array.isArray(rec.transactions) ? rec.transactions : [];

          for (const t of transactions) {
            const mode = String(t.mode ?? "").toLowerCase();
            const dateISO = toDate(t.date)?.toISOString?.();

            if (mode === "installment") {
              const inst = installments.find((x) => x.id === t.installmentId);
              all.push({
                id: t.id ?? `${recordId}_${t.installmentId ?? "installment"}_${dateISO ?? ""}`,
                dateISO,
                patientLabel,
                appointmentId,
                description: inst?.description ?? "Installment Payment",
                txnType: "Installment",
                method: t.method ?? inst?.paidMethod ?? "—",
                amount: Number(t.amount ?? 0),
                status: String(inst?.status ?? "paid"),
              });
            } else {
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
              });
            }
          }
        }

        all.sort(
          (a, b) =>
            (b.dateISO ? new Date(b.dateISO).getTime() : 0) -
            (a.dateISO ? new Date(a.dateISO).getTime() : 0)
        );

        if (!cancelled) setTxns(all);
      } catch (e: any) {
        if (!cancelled) setDetailsErr(e?.message ?? "Failed to load transaction details.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [data]);

  const empty =
    !data || data.rows.length === 0
      ? {
          title: pending ? "Loading report…" : "No billing records found",
          description: pending
            ? "Please wait while we generate the report."
            : "Try expanding the date range.",
        }
      : undefined;

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

  return (
    <>
      {/* PRINT: ONLY TABLE + TODAY DATE */}
      <style jsx global>{`
@media print {
  @page { margin: 16mm; }

  /* Hide EVERYTHING */
  body * {
    visibility: hidden !important;
  }

  /* Show ONLY print scope */
  #billing-report-print,
  #billing-report-print * {
    visibility: visible !important;
  }

  /* Position report */
  #billing-report-print {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    font-family: system-ui, -apple-system, BlinkMacSystemFont;
  }

  /* Header */
  .print-header {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 14px;
  }

  .print-header img {
    width: 48px;
    height: 48px;
  }

  .clinic-name {
    font-size: 18px;
    font-weight: 800;
  }

  .report-title {
    font-size: 14px;
    font-weight: 700;
  }

  .print-date {
    font-size: 11px;
    opacity: 0.7;
    margin-top: 2px;
  }

  /* Table */
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  th, td {
    border: 1px solid #d1d5db;
    padding: 6px 8px;
    text-align: left;
  }

  thead {
    display: table-header-group;
    background: #f8fafc;
  }

  tr {
    page-break-inside: avoid;
  }

  /* WATERMARK (3 faint lines) */
  body::before {
    content:
      "J4 Dental Clinic Billing Transaction Report\\A"
      "J4 Dental Clinic Billing Transaction Report\\A"
      "J4 Dental Clinic Billing Transaction Report";
    white-space: pre;
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-size: 32px;
    font-weight: 800;
    opacity: 0.04;
    transform: rotate(-20deg);
    pointer-events: none;
  }

  body::after {
    content: "";
    position: fixed;
    inset: 0;
    background-image: url("/dclogo.png");
    background-repeat: no-repeat;
    background-position: center;
    background-size: 380px;
    opacity: 0.04;
    pointer-events: none;
  }
}
`}</style>

      <ReportShell reportName="Billing & Payment Report" subtitle={subtitle} empty={empty}>
        {!data ? null : (
          <div className="space-y-4">
            {/* controls (screen only) */}
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

                <button
                  onClick={onPrint}
                  className="ml-2 rounded-full px-4 py-1.5 text-sm font-extrabold bg-slate-900 text-white hover:bg-slate-800"
                >
                  Print
                </button>
              </div>
            </div>

            {detailsErr ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <p className="font-bold">Transactions view is limited</p>
                <p className="mt-1">{detailsErr}</p>
              </div>
            ) : null}

            {/* PRINT SCOPE: only this prints */}
            <div id="billing-report-print">
              <div className="print-date-only text-xs text-slate-700 mb-3">
                Printed: {new Date().toLocaleString()}
              </div>

              {view === "transactions" ? (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 print-clean">
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
                            <div className="text-xs text-slate-500">Appt: {t.appointmentId ?? "—"}</div>
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
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 print-clean">
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
                            {r.patientName ?? "—"}
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
              )}
            </div>
          </div>
        )}
      </ReportShell>
    </>
  );
}
