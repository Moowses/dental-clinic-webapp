"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  getBillingDetailsAction,
  createPaymentPlanAction,
  payInstallmentAction,
  getBillingByPatientAction, 
} from "@/app/actions/billing-actions";

import { recordPaymentAction } from "@/app/actions/appointment-actions";

type BillableItem = {
  id: string;
  name: string;
  price: number;
  status: "unpaid" | "paid" | "void" | "waived" | "plan" | string;
};

type AnyBill = {
  id: string; // In your design: doc id == appointmentId (but we still support older)
  appointmentId: string;
  patientId?: string;
  status?: string;
  remainingBalance?: number;
  totalAmount?: number;
  createdAt?: any;
  updatedAt?: any;
  paymentPlan?: any;
  transactions?: Array<{ id: string; amount: number; date: any; method?: string; itemIds?: string[] }>;
  items?: BillableItem[];
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

function computeNumbers(bill: AnyBill | null) {
  if (!bill) return null;

  const list = Array.isArray(bill.items) ? bill.items : [];

  const total = list.length
    ? list.reduce((s, i) => s + Number(i.price || 0), 0)
    : Number(bill.totalAmount || 0);

  const remaining = list.length
    ? list
        .filter((i) => !["paid", "void", "waived"].includes(String(i.status).toLowerCase()))
        .reduce((s, i) => s + Number(i.price || 0), 0)
    : Number(bill.remainingBalance || 0);

  const status = remaining <= 0 ? "paid" : remaining < total ? "partial" : "unpaid";

  return { total, remaining, status } as const;
}

function billTitle(b: AnyBill) {
  const firstItem = Array.isArray(b.items) && b.items.length ? String(b.items[0]?.name || "") : "";
  return firstItem || "Appointment Billing";
}

function billBadge(b: AnyBill) {
  const n = computeNumbers(b);
  if (!n) return "UNPAID";
  if (n.remaining <= 0) return "PAID";
  if (n.remaining < n.total) return "PARTIAL";
  return "UNPAID";
}

function billKey(b: Partial<AnyBill> | null | undefined) {
  // ✅ Appointment-based billing: prefer appointmentId
  return (b?.appointmentId || b?.id || "") as string;
}

export default function BillingPaymentPlansPanel({
  billingId,
  onClose,
  onUpdated,
}: {
  billingId: string; // This should be appointmentId/docId
  onClose: () => void;
  onUpdated?: () => void;
}) {
  // ✅ active bill key inside modal (appointmentId/docId)
  const [activeBillId, setActiveBillId] = useState<string>(billingId);

  const [bill, setBill] = useState<AnyBill | null>(null);

  // ✅ patient bills list for switching (fetched via getBillingByPatientAction)
  const [patientBills, setPatientBills] = useState<AnyBill[]>([]);
  const [patientBillsLoading, setPatientBillsLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [payAmount, setPayAmount] = useState<string>("");
  const [method, setMethod] = useState<string>("cash");
  const [customMonths, setCustomMonths] = useState<string>("");

  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // if parent opens modal with another billingId
  useEffect(() => {
    setActiveBillId(billingId);
  }, [billingId]);

  async function loadBillDetails(id: string) {
    setLoading(true);
    setErr(null);

    try {
      // Important: id should match Firestore doc id (appointmentId)
      const res = await getBillingDetailsAction(id);
      if (!res?.success || !res.data) throw new Error(res?.error || "Bill not found.");

      const data = res.data as AnyBill;

      // ✅ If backend returns bill with missing appointmentId in some cases,
      // set it from id so UI stays consistent.
      const normalized: AnyBill = {
        ...data,
        appointmentId: data.appointmentId || data.id || id,
        id: data.id || id,
      };

      setBill(normalized);
      setSelectedItems([]);
    } catch (e: any) {
      setErr(e?.message || "Failed to fetch billing");
      setBill(null);
      setSelectedItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadPatientBills(patientId: string, keepActiveId?: string) {
    setPatientBillsLoading(true);
    try {
      const res = await getBillingByPatientAction(patientId, "all");
      if (!res?.success) throw new Error(res?.error || "Failed to load patient bills.");

      const list = (res.data || []) as AnyBill[];

      // normalize keys (appointmentId is the truth)
      const normalized = list.map((b) => ({
        ...b,
        appointmentId: b.appointmentId || b.id,
        id: b.id || b.appointmentId,
      })) as AnyBill[];

      // Sort: unpaid/partial first, then newest updated/created
      normalized.sort((a, b) => {
        const na = computeNumbers(a);
        const nb = computeNumbers(b);

        const aOpen = (na?.remaining ?? 0) > 0;
        const bOpen = (nb?.remaining ?? 0) > 0;
        if (aOpen !== bOpen) return aOpen ? -1 : 1;

        const at = toDate(a.updatedAt || a.createdAt)?.getTime() || 0;
        const bt = toDate(b.updatedAt || b.createdAt)?.getTime() || 0;
        return bt - at;
      });

      setPatientBills(normalized);

      // ✅ ensure active bill is present
      const active = keepActiveId || activeBillId;
      if (active && normalized.length) {
        const exists = normalized.some((x) => billKey(x) === active);
        if (!exists) {
          // fallback to first (likely unpaid)
          setActiveBillId(billKey(normalized[0]));
        }
      }
    } catch (e) {
      // Don’t block the modal if this fails
      console.error(e);
      setPatientBills([]);
    } finally {
      setPatientBillsLoading(false);
    }
  }

  // Load active bill whenever it changes
  useEffect(() => {
    if (!activeBillId) return;
    loadBillDetails(activeBillId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBillId]);

  // After bill loads, fetch patient bills (clean server action)
  useEffect(() => {
    if (!bill?.patientId) return;
    loadPatientBills(bill.patientId, billKey(bill));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bill?.patientId]);

  const numbers = useMemo(() => computeNumbers(bill), [bill]);

  const txSorted = useMemo(() => {
    const t = bill?.transactions || [];
    return [...t].sort((a, b) => {
      const da = toDate(a?.date)?.getTime() || 0;
      const db = toDate(b?.date)?.getTime() || 0;
      return db - da;
    });
  }, [bill]);

  const items: BillableItem[] = Array.isArray(bill?.items) ? (bill!.items as BillableItem[]) : [];

  const selectedTotal = useMemo(() => {
    if (!items.length) return 0;
    return items
      .filter((i) => selectedItems.includes(i.id))
      .reduce((s, x) => s + Number(x.price || 0), 0);
  }, [items, selectedItems]);

  useEffect(() => {
    if (selectedItems.length > 0) setPayAmount(String(selectedTotal));
  }, [selectedItems, selectedTotal]);

  async function pay(full: boolean) {
    if (!bill || !numbers) return;

    const amt = full ? numbers.remaining : Number(payAmount);
    if (!amt || amt <= 0) {
      setErr("Enter a valid payment amount.");
      return;
    }

    if (!full && selectedItems.length > 0 && Number(amt) !== Number(selectedTotal)) {
      setErr("Amount must match selected items total.");
      return;
    }

    setBusy(true);
    setErr(null);

    try {
      const res = await recordPaymentAction(
        bill.appointmentId,
        method,
        amt,
        full ? [] : selectedItems
      );
      if (!res?.success) throw new Error(res?.error || "Payment failed.");

      setPayAmount("");

      // refresh current bill + patient list
      await loadBillDetails(activeBillId);
      if (bill.patientId) await loadPatientBills(bill.patientId, activeBillId);

      onUpdated?.();
    } catch (e: any) {
      setErr(e?.message || "Payment failed.");
    } finally {
      setBusy(false);
    }
  }

  async function payOneInstallment(installmentId: string) {
    if (!bill) return;

    setBusy(true);
    setErr(null);

    try {
      const res = await payInstallmentAction(bill.appointmentId, installmentId, method);
      if (!res?.success) throw new Error(res?.error || "Failed to pay installment.");

      await loadBillDetails(activeBillId);
      if (bill.patientId) await loadPatientBills(bill.patientId, activeBillId);

      onUpdated?.();
    } catch (e: any) {
      setErr(e?.message || "Failed to pay installment.");
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
      const res = await createPaymentPlanAction(bill.appointmentId, months, selectedItems);
      if (!res?.success) throw new Error(res?.error || "Failed to create plan.");

      setCustomMonths("");

      await loadBillDetails(activeBillId);
      if (bill.patientId) await loadPatientBills(bill.patientId, activeBillId);

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
        {/* ✅ Patient Bills Switcher (Appointment-based, clear labels) */}
        {patientBillsLoading ? (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Loading patient bills…
          </div>
        ) : patientBills.length > 1 ? (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-slate-900">Patient Bills (by Appointment)</p>
                <p className="text-xs text-slate-500 mt-1">
                  Each record below is linked to an <b>Appointment ID</b>.
                </p>
              </div>
              <div className="text-xs text-slate-500">
                Active Appointment:{" "}
                <span className="font-mono font-extrabold text-slate-900">{activeBillId}</span>
              </div>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {patientBills.map((b) => {
                const key = billKey(b);
                const isActive = key === activeBillId;

                const n = computeNumbers(b);
                const badge = billBadge(b);

                return (
                  <button
                    key={key}
                    onClick={() => setActiveBillId(key)}
                    className={`text-left rounded-2xl border p-3 transition ${
                      isActive
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className={`text-[11px] font-extrabold ${isActive ? "text-white/80" : "text-slate-500"}`}>
                          Appointment ID: <span className="font-mono">{b.appointmentId || b.id}</span>
                        </div>

                        <div className={`mt-1 text-sm font-extrabold truncate ${isActive ? "text-white" : "text-slate-900"}`}>
                          {billTitle(b)}
                        </div>

                        <div className={`mt-1 text-xs ${isActive ? "text-white/70" : "text-slate-500"}`}>
                          Updated: {fmtDate(b.updatedAt || b.createdAt)}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className={`text-sm font-extrabold ${isActive ? "text-white" : "text-slate-900"}`}>
                          ₱ {money(n?.remaining || 0)}
                        </div>
                        <div className={`text-[11px] font-bold ${isActive ? "text-white/70" : "text-slate-500"}`}>
                          / ₱ {money(n?.total || 0)}
                        </div>

                        <span
                          className={`mt-2 inline-flex text-[10px] font-extrabold px-2 py-1 rounded-full border ${
                            isActive
                              ? "border-white/20 bg-white/10 text-white"
                              : badge === "PAID"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : badge === "PARTIAL"
                                  ? "border-blue-200 bg-blue-50 text-blue-700"
                                  : "border-amber-200 bg-amber-50 text-amber-700"
                          }`}
                        >
                          {badge}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="mt-3 text-[11px] text-slate-500">
              Unpaid/partial bills are shown first to reduce confusion.
            </p>
          </div>
        ) : null}

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
            {/* SUMMARY */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-extrabold text-slate-600 uppercase">Status</p>
                <p className="text-xl font-extrabold text-slate-900">
                  {String(numbers.status).toUpperCase()}
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

            {/* BILLABLE ITEMS */}
            {items.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-extrabold text-slate-900">Billable Items</p>
                  <p className="text-xs text-slate-500">
                    Selected total:{" "}
                    <span className="font-mono font-extrabold text-slate-900">
                      ₱ {money(selectedTotal)}
                    </span>
                  </p>
                </div>

                <div className="mt-3 space-y-1">
                  {items.map((item) => {
                    const s = String(item.status || "").toLowerCase();
                    const disabled = ["paid", "void", "waived", "plan"].includes(s);
                    const checked = selectedItems.includes(item.id);

                    return (
                      <label
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={(e) => {
                              setSelectedItems((prev) => {
                                if (e.target.checked) {
                                  return prev.includes(item.id) ? prev : [...prev, item.id];
                                }
                                return prev.filter((x) => x !== item.id);
                              });
                            }}
                          />
                          <div className={disabled ? "opacity-60" : ""}>
                            <div
                              className={`text-sm font-extrabold ${
                                disabled ? "line-through text-slate-500" : "text-slate-900"
                              }`}
                            >
                              {item.name}
                            </div>
                            <div className="text-[10px] font-extrabold uppercase text-slate-500">
                              {String(item.status)}
                            </div>
                          </div>
                        </div>

                        <div className="text-sm font-extrabold text-slate-900 font-mono">
                          ₱ {money(Number(item.price || 0))}
                        </div>
                      </label>
                    );
                  })}
                </div>

                <p className="mt-2 text-[11px] text-slate-500">
                  If no items are selected, the plan will apply to the full remaining balance.
                </p>
              </div>
            )}

            {/* PAYMENTS + PLANS */}
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
                  <p className="text-xs text-slate-500 mt-1">Choose terms or enter a custom month count</p>

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

                  <p className="mt-3 text-[11px] text-slate-500">
                    {selectedItems.length > 0
                      ? `Splitting selected items total: ₱ ${money(selectedTotal)}`
                      : "Splitting full remaining balance."}
                  </p>

                  {installmentSchedule.length > 0 && (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-extrabold text-slate-700 uppercase">Schedule</p>

                      <div className="mt-2 space-y-2">
                        {installmentSchedule.map((i: any, idx: number) => {
                          const s = String(i.status || "").toLowerCase();
                          const isPaid = s === "paid";
                          const canPay = !isPaid && !!i.id;

                          return (
                            <div
                              key={i.id || idx}
                              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"
                            >
                              <div>
                                <div className="text-sm font-extrabold text-slate-900">
                                  Due: {i.dueDate || "—"}
                                </div>

                                <div
                                  className={`mt-1 inline-flex text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                    isPaid
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : "bg-amber-50 text-amber-700 border border-amber-200"
                                  }`}
                                >
                                  {String(i.status || "pending").toUpperCase()}
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="text-sm font-extrabold text-slate-900">
                                  ₱ {money(Number(i.amount || 0))}
                                </div>

                                <button
                                  disabled={busy || !canPay}
                                  onClick={() => payOneInstallment(String(i.id))}
                                  className={`rounded-xl px-4 py-2 text-xs font-extrabold border ${
                                    isPaid
                                      ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                  } disabled:opacity-60`}
                                >
                                  {isPaid ? "Paid" : "Pay"}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TRANSACTIONS */}
            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-3">
                <p className="text-sm font-extrabold text-slate-900">Transaction History</p>
                <p className="text-xs text-slate-500 mt-1">Dates are shown with full timestamp for visibility</p>
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
