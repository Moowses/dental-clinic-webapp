"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  getBillingDetailsAction,
  createPaymentPlanAction,
} from "@/app/actions/billing-actions";
import { recordPaymentAction } from "@/app/actions/appointment-actions";

type AnyBill = {
  id: string;
  appointmentId: string;
  patientId?: string;
  status?: string;
  remainingBalance?: number;
  totalAmount?: number;
  createdAt?: any;
  updatedAt?: any;
  paymentPlan?: any;
  transactions?: Array<{ id: string; amount: number; date: any; method?: string }>;
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

export default function BillingPaymentPlansPanel({
  billingId,
  onClose,
  onUpdated,
}: {
  billingId: string;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const [bill, setBill] = useState<AnyBill | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [payAmount, setPayAmount] = useState<string>("");
  const [method, setMethod] = useState<string>("cash");

  const [customMonths, setCustomMonths] = useState<string>("");

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const res = await getBillingDetailsAction(billingId);
      if (!res?.success || !res.data) throw new Error(res?.error || "Bill not found.");
      setBill(res.data as AnyBill);
    } catch (e: any) {
      setErr(e?.message || "Failed to load bill.");
      setBill(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billingId]);

  const numbers = useMemo(() => (bill ? getBillingNumbers(bill) : null), [bill]);

  const txSorted = useMemo(() => {
    const t = bill?.transactions || [];
    return [...t].sort((a, b) => {
      const da = toDate(a?.date)?.getTime() || 0;
      const db = toDate(b?.date)?.getTime() || 0;
      return db - da;
    });
  }, [bill]);

  async function pay(full: boolean) {
    if (!bill || !numbers) return;

    const amt = full ? numbers.remaining : Number(payAmount);
    if (!amt || amt <= 0) {
      setErr("Enter a valid payment amount.");
      return;
    }

    setBusy(true);
    setErr(null);

    try {
      const res = await recordPaymentAction(bill.appointmentId, method, amt);
      if (!res?.success) throw new Error(res?.error || "Payment failed.");
      setPayAmount("");
      await load();
      onUpdated?.();
    } catch (e: any) {
      setErr(e?.message || "Payment failed.");
    } finally {
      setBusy(false);
    }
  }

  async function createPlan(months: number) {
    if (!bill) return;

    if (!months || months < 1) {
      setErr("Months must be 1 or higher.");
      return;
    }

    setBusy(true);
    setErr(null);

    try {
      const res = await createPaymentPlanAction(bill.appointmentId, months);
      if (!res?.success) throw new Error(res?.error || "Failed to create plan.");
      setCustomMonths("");
      await load();
      onUpdated?.();
    } catch (e: any) {
      setErr(e?.message || "Failed to create plan.");
    } finally {
      setBusy(false);
    }
  }

  const installmentSchedule = useMemo(() => {
    const pp = bill?.paymentPlan || {};
    const inst = pp?.installments;

    if (Array.isArray(inst)) return inst;
    if (Array.isArray(inst?.schedule)) return inst.schedule;
    if (Array.isArray(pp?.schedule)) return pp.schedule;

    return [];
  }, [bill]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900">Billing &amp; Payment Plans</h3>
          <p className="text-sm text-slate-500">Manage payments and installment terms</p>
        </div>

        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-extrabold text-slate-700 hover:bg-slate-50"
        >
          Close
        </button>
      </div>

      <div className="p-6">
        {loading ? (
          <p className="text-sm text-slate-500">Loading bill...</p>
        ) : err ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {err}
          </div>
        ) : !bill || !numbers ? (
          <p className="text-sm text-slate-500 italic">No billing record.</p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-extrabold text-slate-600 uppercase">Status</p>
                <p className="text-xl font-extrabold text-slate-900">
                  {numbers.status.toUpperCase()}
                </p>

                <p className="text-xs text-slate-600 mt-1">
                  Appointment ID: <span className="font-mono">{bill.appointmentId}</span>
                </p>

                <p className="text-xs text-slate-500 mt-1">
                  Updated:{" "}
                  <span className="text-slate-700 font-bold">
                    {fmtDate(bill.updatedAt || bill.createdAt)}
                  </span>
                </p>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-xs font-extrabold text-slate-600 uppercase">Balance / Total</p>
                <p className="text-2xl font-extrabold text-slate-900">
                  ₱ {money(numbers.remaining)}
                  <span className="text-sm font-bold text-slate-500">
                    {" "}
                    / ₱ {money(numbers.total)}
                  </span>
                </p>
              </div>
            </div>

            {numbers.remaining > 0 && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm font-extrabold text-slate-900">Record Payment</p>

                  <div className="mt-3 grid gap-2">
                    <label className="text-xs font-extrabold text-slate-600">Payment Method</label>
                    <select
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="insurance">Insurance</option>
                      <option value="gcash">GCash</option>
                      <option value="bank">Bank Transfer</option>
                    </select>

                    <button
                      disabled={busy}
                      onClick={() => pay(true)}
                      className="mt-2 w-full rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-extrabold hover:bg-slate-800 disabled:opacity-60"
                    >
                      {busy ? "Processing..." : "Pay Full Balance"}
                    </button>

                    <div className="mt-2 flex gap-2">
                      <input
                        type="number"
                        min={1}
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        placeholder="Partial amount"
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                      />
                      <button
                        disabled={busy}
                        onClick={() => pay(false)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Pay
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm font-extrabold text-slate-900">Installment Plan</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Choose terms or enter a custom month count
                  </p>

                  <div className="mt-3 grid gap-2">
                    <div className="flex flex-wrap gap-2">
                      {[2, 3, 4, 6, 9, 12, 18, 24].map((m) => (
                        <button
                          key={m}
                          disabled={busy}
                          onClick={() => createPlan(m)}
                          className="rounded-xl bg-teal-600 text-white px-4 py-2 text-sm font-extrabold hover:bg-teal-700 disabled:opacity-60"
                        >
                          {m} Months
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        value={customMonths}
                        onChange={(e) => setCustomMonths(e.target.value)}
                        placeholder="Custom months (e.g., 5)"
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                      />
                      <button
                        disabled={busy}
                        onClick={() => createPlan(Number(customMonths))}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Create
                      </button>
                    </div>
                  </div>

                  {installmentSchedule.length > 0 && (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-extrabold text-slate-700 uppercase">
                        Schedule
                      </p>

                      <div className="mt-2 space-y-2">
                        {installmentSchedule.map((i: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3"
                          >
                            <div>
                              <div className="text-sm font-extrabold text-slate-900">
                                Due: {i.dueDate || "—"}
                              </div>
                              <div
                                className={`mt-1 inline-flex text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                  String(i.status || "").toLowerCase() === "paid"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                                }`}
                              >
                                {String(i.status || "unpaid").toUpperCase()}
                              </div>
                            </div>
                            <div className="text-sm font-extrabold text-slate-900">
                              ₱ {money(Number(i.amount || 0))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-3">
                <p className="text-sm font-extrabold text-slate-900">Transaction History</p>
                <p className="text-xs text-slate-500 mt-1">
                  Dates are shown with full timestamp for visibility
                </p>
              </div>

              <div className="p-4">
                {txSorted.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No payments yet.</p>
                ) : (
                  <div className="space-y-2">
                    {txSorted.map((t: any) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3"
                      >
                        <div className="text-sm text-slate-700">
                          <div className="font-extrabold text-slate-900">
                            ₱ {money(Number(t.amount || 0))}
                          </div>
                          <div className="text-xs text-slate-600">
                            {fmtDate(t.date)} • {String(t.method || "cash").toUpperCase()}
                          </div>
                        </div>
                        <div className="text-xs font-extrabold text-slate-500">
                          {String(t.id || "").slice(0, 8)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="text-xs text-slate-500">
              Source: Firestore <span className="font-mono">billing_records</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
