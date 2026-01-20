"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getAllBillingAction } from "@/app/actions/billing-actions";
import { getUserProfile } from "@/lib/services/user-service";
import type { UserProfile } from "@/lib/types/user";

type FilterKey = "all" | "paid" | "unpaid";

type AnyBill = {
  id: string;
  patientId?: string;
  appointmentId?: string;
  createdAt?: any;
  updatedAt?: any;
  status?: string;
  totalAmount?: number;
  remainingBalance?: number;
  transactions?: Array<{ id: string; amount: number; date: any; method?: string }>;
  paymentPlan?: any;
};

type RowStatus = "paid" | "unpaid" | "mixed";

type PatientRow = {
  patientId: string;
  patientName: string;
  status: RowStatus;
  totalAmount: number;
  remainingBalance: number;
  billsCount: number;
  unpaidBills: number;
  paidBills: number;
  lastActivityAt?: string;
  manageBillId: string; // Prefer unpaid bill ID; fallback latest bill
};

function money(n: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n || 0);
}

function toDate(input: any): Date | null {
  try {
    if (!input) return null;
    if (input?.seconds) return new Date(input.seconds * 1000);
    if (typeof input === "string" || typeof input === "number") return new Date(input);
    if (input instanceof Date) return input;
    return null;
  } catch {
    return null;
  }
}

function fmtDate(input: any) {
  const d = toDate(input);
  if (!d) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getBillingNumbers(bill: AnyBill) {
  const pp = bill?.paymentPlan || {};
  const inst = pp?.installments;

  const remaining =
    typeof inst?.remainingBalance === "number"
      ? inst.remainingBalance
      : typeof pp?.remainingBalance === "number"
        ? pp.remainingBalance
        : typeof bill?.remainingBalance === "number"
          ? bill.remainingBalance
          : 0;

  const total =
    typeof inst?.totalAmount === "number"
      ? inst.totalAmount
      : typeof pp?.totalAmount === "number"
        ? pp.totalAmount
        : typeof bill?.totalAmount === "number"
          ? bill.totalAmount
          : 0;

  const statusRaw =
    typeof inst?.status === "string"
      ? inst.status
      : typeof pp?.status === "string"
        ? pp.status
        : typeof bill?.status === "string"
          ? bill.status
          : Number(remaining) > 0
            ? "unpaid"
            : "paid";

  const status = String(statusRaw || "").toLowerCase() === "paid" ? "paid" : "unpaid";

  return {
    remaining: Number(remaining || 0),
    total: Number(total || 0),
    status,
  } as const;
}

function getBillLastActivity(bill: AnyBill) {
  let best: Date | null = null;

  const upd = toDate(bill.updatedAt);
  const crt = toDate(bill.createdAt);

  if (upd && (!best || upd > best)) best = upd;
  if (crt && (!best || crt > best)) best = crt;

  const tx = bill.transactions || [];
  for (const t of tx) {
    const td = toDate(t?.date);
    if (td && (!best || td > best)) best = td;
  }

  return best ? fmtDate(best) : "—";
}

export default function BillingOverviewPanel({
  onSelectBill,
  refreshKey = 0,
}: {
  onSelectBill: (billingId: string) => void;
  refreshKey?: number;
}) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErr(null);

      try {
        const res = await getAllBillingAction(filter as any);
        if (!res?.success) throw new Error(res?.error || "Failed to load billing.");

        const bills = (res?.data || []) as AnyBill[];

        // normalize filter client-side in case backend uses old fields
        const normalizedBills = bills.filter((b) => {
          const n = getBillingNumbers(b);
          if (filter === "paid") return n.remaining <= 0;
          if (filter === "unpaid") return n.remaining > 0;
          return true;
        });

        // load patient profiles
        const patientIds = Array.from(
          new Set(normalizedBills.map((b) => b.patientId).filter(Boolean) as string[])
        );

        const profileMap = new Map<string, UserProfile>();

        await Promise.all(
          patientIds.map(async (pid) => {
            const pr = await getUserProfile(pid);
            if (pr?.success && pr.data) profileMap.set(pid, pr.data as any);
          })
        );

        const agg = new Map<string, PatientRow>();

        for (const b of normalizedBills) {
          const pid = b.patientId;
          if (!pid) continue;

          const profile: any = profileMap.get(pid);
          const name =
            profile?.displayName ||
            profile?.fullName ||
            profile?.name ||
            profile?.email ||
            `${pid.slice(0, 10)}...`;

          const n = getBillingNumbers(b);
          const last = getBillLastActivity(b);

          const isPaidBill = n.remaining <= 0;
          const isUnpaidBill = n.remaining > 0;

          const prev = agg.get(pid);

          if (!prev) {
            const status: RowStatus =
              n.remaining <= 0 ? "paid" : n.remaining < n.total ? "mixed" : "unpaid";

            agg.set(pid, {
              patientId: pid,
              patientName: name,
              status,
              totalAmount: n.total,
              remainingBalance: n.remaining,
              billsCount: 1,
              unpaidBills: isUnpaidBill ? 1 : 0,
              paidBills: isPaidBill ? 1 : 0,
              lastActivityAt: last,
              // Prefer unpaid bill as Manage target
              manageBillId: isUnpaidBill ? b.id : b.id,
            });
          } else {
            prev.totalAmount += n.total;
            prev.remainingBalance += n.remaining;
            prev.billsCount += 1;
            prev.unpaidBills += isUnpaidBill ? 1 : 0;
            prev.paidBills += isPaidBill ? 1 : 0;

            // row status:
            if (prev.remainingBalance <= 0) prev.status = "paid";
            else if (prev.remainingBalance < prev.totalAmount) prev.status = "mixed";
            else prev.status = "unpaid";

            // Prefer unpaid bill for Manage
            if (isUnpaidBill) prev.manageBillId = b.id;

            // keep latest activity timestamp (for display)
            const prevT = prev.lastActivityAt ? new Date(prev.lastActivityAt).getTime() : 0;
            const nextT = last !== "—" ? new Date(last).getTime() : 0;
            if (nextT > prevT) {
              prev.lastActivityAt = last;
              // If no unpaid bill exists, fall back to most recent bill
              if (prev.unpaidBills === 0) prev.manageBillId = b.id;
            }
          }
        }

        const result = Array.from(agg.values()).sort((a, b) => {
          // unpaid/mixed first, then newest activity
          const rank = (s: RowStatus) => (s === "unpaid" ? 0 : s === "mixed" ? 1 : 2);
          const ra = rank(a.status);
          const rb = rank(b.status);
          if (ra !== rb) return ra - rb;

          const da = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
          const db = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
          return db - da;
        });

        if (!alive) return;
        setRows(result);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Failed to load billing.");
        setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [filter, refreshKey]);

  const stats = useMemo(() => {
    const unpaid = rows.filter((r) => r.status === "unpaid").length;
    const mixed = rows.filter((r) => r.status === "mixed").length;
    const paid = rows.filter((r) => r.status === "paid").length;
    return { unpaid, mixed, paid, total: rows.length };
  }, [rows]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900">Billing Overview</h3>
          <p className="text-sm text-slate-500">
            Patient-level billing summary (auto-detect paid/unpaid/mixed)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700">
            Unpaid: {stats.unpaid}
          </span>
          <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700">
            Mixed: {stats.mixed}
          </span>
          <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700">
            Paid: {stats.paid}
          </span>

          <div className="ml-0 sm:ml-2 flex gap-1">
            {(["all", "unpaid", "paid"] as const).map((k) => {
              const active = filter === k;
              return (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={`px-3 py-2 rounded-xl text-xs font-extrabold uppercase transition ${
                    active
                      ? "bg-slate-900 text-white"
                      : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {k}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <p className="text-sm text-slate-500">Loading billing records...</p>
        ) : err ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {err}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No billing records found.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-xs font-extrabold text-slate-600">
                  <th className="p-3">Patient</th>
                  <th className="p-3">Bills</th>
                  <th className="p-3">Paid</th>
                  <th className="p-3">Unpaid</th>
                  <th className="p-3">Remaining</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Last Activity</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.patientId} className="text-sm">
                    <td className="p-3">
                      <div className="font-extrabold text-slate-900">{r.patientName}</div>
                      <div className="text-xs text-slate-500">{r.patientId.slice(0, 10)}...</div>
                    </td>
                    <td className="p-3 text-slate-700 font-bold whitespace-nowrap">{r.billsCount}</td>
                    <td className="p-3 text-slate-700 font-bold whitespace-nowrap">{r.paidBills}</td>
                    <td className="p-3 text-slate-700 font-bold whitespace-nowrap">{r.unpaidBills}</td>
                    <td className="p-3 text-slate-700 font-bold whitespace-nowrap">₱ {money(r.remainingBalance)}</td>
                    <td className="p-3 text-slate-700 font-bold whitespace-nowrap">₱ {money(r.totalAmount)}</td>
                    <td className="p-3">
                      <span
                        className={`text-xs font-extrabold px-3 py-1 rounded-full ${
                          r.status === "paid"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : r.status === "mixed"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {r.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-slate-600">{r.lastActivityAt || "—"}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => onSelectBill(r.manageBillId)}
                        className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800 transition"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
