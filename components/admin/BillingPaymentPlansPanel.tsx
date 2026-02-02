"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  createItemPaymentPlanWithDownpaymentAction,
  getBillingByPatientAction,
  getBillingDetailsAction,
  payInstallmentAction,
  recordBillingPaymentAction,
} from "@/app/actions/billing-actions";

type InstallmentStatus = "pending" | "paid" | "cancelled" | "overdue";

type BillingInstallment = {
  id: string;
  termIndex?: number;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  status: InstallmentStatus;
  paidAt?: any;
  description?: string;
};

type BillingItem = {
  id: string;
  name: string;
  toothNumber?: string;
  price: number;
  status?: string; // unpaid | paid | plan | partial (depending on your logic)
};

type BillingTxn = {
  id: string;
  amount: number;
  method?: string;
  date: any;
  note?: string;
  appliedTo?: Array<{ itemId: string; amount: number; installmentId?: string }>;
};

type BillingRecord = {
  id: string;
  appointmentId: string;
  patientId?: string;
  createdAt?: any;
  updatedAt?: any;
  items?: BillingItem[];
  transactions?: BillingTxn[];
  totalAmount?: number;
  remainingBalance?: number;
  status?: string;

  paymentPlan?: {
    type?: string;
    installments?: BillingInstallment[];
  };
};

function money(n: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(n || 0));
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

function fmtDateTime(input: any) {
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

function fmtDateOnly(input: any) {
  if (!input) return "—";
  if (typeof input === "string" && input.includes("-")) {
    const d = new Date(input);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
    }
    return input;
  }
  const d = toDate(input);
  if (!d) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function computeTotals(bill: BillingRecord | null) {
  const items = Array.isArray(bill?.items) ? (bill!.items as BillingItem[]) : [];
  const total = items.reduce((s, it) => s + Number(it.price || 0), 0);

  const dbRemaining =
    bill && typeof bill.remainingBalance === "number" ? Number(bill.remainingBalance) : null;

  const computedRemaining = items.reduce((s, it) => {
    const st = String(it.status || "unpaid").toLowerCase();
    const remaining =
      st === "paid" || st === "void" || st === "waived" ? 0 : Number(it.price || 0);
    return s + remaining;
  }, 0);

  const remaining = dbRemaining !== null ? dbRemaining : computedRemaining;
  const paid = Math.max(0, total - remaining);

  const status =
    remaining <= 0 ? ("paid" as const) : paid > 0 ? ("partial" as const) : ("unpaid" as const);

  return { total, remaining, paid, status };
}

function statusChip(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "paid") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s === "partial") return "border-blue-200 bg-blue-50 text-blue-700";
  if (s === "unpaid") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

//  (unpaid/plan/partial)
function summarizeAllProcedures(items?: BillingItem[]) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return "—";
  const names = list.map((x) => x.name).filter(Boolean);
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
}

function summarizeOpenProcedures(items?: BillingItem[]) {
  const list = Array.isArray(items) ? items : [];
  const open = list.filter((x) => {
    const s = String(x.status || "unpaid").toLowerCase();
    return s === "unpaid" || s === "plan" || s === "partial";
  });

  if (!open.length) return "None";

  // plan first then unpaid then partial
  open.sort((a, b) => {
    const sa = String(a.status || "").toLowerCase();
    const sb = String(b.status || "").toLowerCase();
    const rank = (s: string) => (s === "plan" ? 0 : s === "unpaid" ? 1 : 2);
    return rank(sa) - rank(sb);
  });

  const names = open.map((x) => x.name).filter(Boolean);
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
}

// NOTE: Some deployments run over plain HTTP (non-secure context). In that case,
// `window.crypto.randomUUID` may be unavailable and will throw "crypto.randomUUID is not a function".
// We polyfill it on the client to keep the billing UI working.
function fallbackRandomUUID(): string {
  // RFC4122-ish v4 UUID (good enough for UI/client ids)
  // eslint-disable-next-line no-bitwise
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}


type ConfirmState =
  | null
  | {
      kind: "payment";
      appointmentId: string;
      amount: number;
      method: string;
      note?: string;
      itemIds?: string[];
      label: string;
    }
  | {
      kind: "installment";
      appointmentId: string;
      installmentId: string;
      method: string;
      amount: number;
      label: string;
    }
  | {
      kind: "createPlan";
      appointmentId: string;
      itemId: string;
      terms: number;
      description: string;
      downpaymentAmount?: number;
      downpaymentMethod?: string;
      label: string;
    };

export default function BillingPaymentPlansPanel({
  billingId,
  onClose,
  onUpdated,
}: {
  billingId: string;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const initialPatientId = billingId.startsWith("pid:") ? billingId.slice(4) : "";
  const initialAppointmentId = billingId.startsWith("pid:") ? "" : billingId;

  const [patientId, setPatientId] = useState<string>(initialPatientId);
  const [activeAppointmentId, setActiveAppointmentId] = useState<string>(initialAppointmentId);
  const [patientBills, setPatientBills] = useState<BillingRecord[]>([]);
  const [bill, setBill] = useState<BillingRecord | null>(null);

  const [loadingBills, setLoadingBills] = useState(false);
  const [loadingBill, setLoadingBill] = useState(false);
  const [busy, setBusy] = useState(false);

  const [err, setErr] = useState<string | null>(null);

  const [method, setMethod] = useState<string>("cash");
  const [note, setNote] = useState<string>("");

  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [payAmount, setPayAmount] = useState<string>("");

  const [planItemId, setPlanItemId] = useState<string>("");
  const [planTerms, setPlanTerms] = useState<string>("");

  const [confirm, setConfirm] = useState<ConfirmState>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);


  // Polyfill crypto.randomUUID on HTTP deployments (non-secure context)
  useEffect(() => {
    try {
      const c: any = (globalThis as any).crypto;
      if (c && typeof c.randomUUID !== "function") {
        c.randomUUID = fallbackRandomUUID;
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const pid = billingId.startsWith("pid:") ? billingId.slice(4) : "";
    const appt = billingId.startsWith("pid:") ? "" : billingId;

    setPatientId(pid);
    setActiveAppointmentId(appt);
    setPatientBills([]);
    setBill(null);
    setSelectedItemIds([]);
    setPayAmount("");
    setPlanItemId("");
    setPlanTerms("");
    setErr(null);
    setConfirm(null);
  }, [billingId]);

  function rankStatus(s: string) {
    const st = (s || "").toLowerCase();
    // unpaid first, then partial, then paid
    if (st === "unpaid") return 0;
    if (st === "partial") return 1;
    if (st === "paid") return 2;
    return 3;
  }

  async function loadPatientBills(pid: string) {
    setLoadingBills(true);
    setErr(null);
    try {
      const res = await getBillingByPatientAction(pid, "all");
      if (!res?.success) throw new Error(res?.error || "Failed to load patient bills.");
      const list = Array.isArray(res.data) ? (res.data as BillingRecord[]) : [];

      // ✅ ensure the UI promise "unpaid/partial first" is true
      const sorted = [...list].sort((a, b) => {
        const ta = computeTotals(a).status;
        const tb = computeTotals(b).status;
        const ra = rankStatus(ta);
        const rb = rankStatus(tb);
        if (ra !== rb) return ra - rb;

        const da = toDate(a.updatedAt)?.getTime() ?? 0;
        const db = toDate(b.updatedAt)?.getTime() ?? 0;
        return db - da; // most recent first within the same group
      });

      setPatientBills(sorted);
    } catch (e: any) {
      setErr(e?.message || "Failed to load bills.");
      setPatientBills([]);
    } finally {
      setLoadingBills(false);
    }
  }

  async function loadBill(appointmentId: string) {
    if (!appointmentId) return;
    setLoadingBill(true);
    setErr(null);
    try {
      const res = await getBillingDetailsAction(appointmentId);
      if (!res?.success) throw new Error(res?.error || "Failed to load billing details.");
      setBill(res.data || null);
    } catch (e: any) {
      setErr(e?.message || "Failed to load bill.");
      setBill(null);
    } finally {
      setLoadingBill(false);
    }
  }

  useEffect(() => {
    if (patientId) loadPatientBills(patientId);
  }, [patientId]);

  useEffect(() => {
    if (activeAppointmentId) loadBill(activeAppointmentId);
  }, [activeAppointmentId]);

  const items = useMemo(() => {
    const list = Array.isArray(bill?.items) ? (bill!.items as BillingItem[]) : [];
    return list;
  }, [bill]);

  const totals = useMemo(() => computeTotals(bill), [bill]);

  const selectedRemainingTotal = useMemo(() => {
    if (!bill) return 0;
    const map = new Map(items.map((i) => [i.id, i]));
    let sum = 0;
    for (const id of selectedItemIds) {
      const it = map.get(id);
      if (!it) continue;
      const st = String(it.status || "unpaid").toLowerCase();
      if (st === "paid" || st === "void" || st === "waived") continue;
      sum += Number(it.price || 0);
    }
    return Number(sum.toFixed(2));
  }, [bill, items, selectedItemIds]);

  function openConfirmPayment(fullBalance: boolean) {
    if (!bill) return;
    setErr(null);

    const amount = Number(payAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      setErr("Please enter a valid payment amount.");
      return;
    }

    if (fullBalance) {
      if (Math.abs(amount - totals.remaining) > 0.01) {
        setErr("Amount must match the full remaining balance.");
        return;
      }
    }

    if (!fullBalance && selectedItemIds.length) {
      if (Math.abs(amount - selectedRemainingTotal) > 0.01) {
        setErr("Amount must match the selected items remaining balance.");
        return;
      }
    }

    const label = fullBalance
      ? `Pay full remaining balance`
      : selectedItemIds.length
      ? `Pay selected items (${selectedItemIds.length})`
      : `Record partial payment`;

    setConfirm({
      kind: "payment",
      appointmentId: bill.appointmentId,
      amount,
      method,
      note: note || undefined,
      itemIds: fullBalance ? [] : selectedItemIds,
      label,
    });
  }

  function openConfirmInstallment(inst: BillingInstallment) {
    if (!bill) return;
    if (inst.status === "paid") return;

    setConfirm({
      kind: "installment",
      appointmentId: bill.appointmentId,
      installmentId: inst.id,
      method,
      amount: Number(inst.amount || 0),
      label: inst.description || `Installment`,
    });
  }

  function openConfirmCreatePlan() {
    if (!bill) return;
    setErr(null);

    const item = items.find((x) => x.id === planItemId);
    if (!item) {
      setErr("Please select an item to create a plan.");
      return;
    }

    const terms = Number(planTerms || 0);
    if (!Number.isFinite(terms) || terms < 1 || terms > 36) {
      setErr("Terms must be between 1 and 36.");
      return;
    }

    const description = `${item.name}${item.toothNumber ? ` (${item.toothNumber})` : ""}`;
    setConfirm({
      kind: "createPlan",
      appointmentId: bill.appointmentId,
      itemId: item.id,
      terms,
      description,
      downpaymentAmount: 0,
      downpaymentMethod: method,
      label: `Create installment plan (${terms} term${terms > 1 ? "s" : ""})`,
    });
  }

  async function executeConfirm() {
    if (!confirm) return;
    setBusy(true);
    setErr(null);

    try {
      if (confirm.kind === "payment") {
        const res = await recordBillingPaymentAction({
          appointmentId: confirm.appointmentId,
          amount: confirm.amount,
          method: confirm.method,
          note: confirm.note,
          itemIds: Array.isArray(confirm.itemIds) ? confirm.itemIds : [],
        });
        if (!res?.success) throw new Error(res?.error || "Payment failed.");
      }

      if (confirm.kind === "installment") {
        const res = await payInstallmentAction(
          confirm.appointmentId,
          confirm.installmentId,
          confirm.method
        );
        if (!res?.success) throw new Error(res?.error || "Failed to pay installment.");
      }

      if (confirm.kind === "createPlan") {
        const dp = Number((confirm as any).downpaymentAmount || 0);
        const dpMethod = String((confirm as any).downpaymentMethod || method);

        const res = await createItemPaymentPlanWithDownpaymentAction({
          appointmentId: confirm.appointmentId,
          itemId: confirm.itemId,
          terms: confirm.terms,
          description: confirm.description,
          downpaymentAmount: dp,
          downpaymentMethod: dpMethod,
        });
        if (!res?.success) throw new Error(res?.error || "Failed to create plan.");
      }

      setConfirm(null);
      setPayAmount("");
      setNote("");
      setSelectedItemIds([]);
      setPlanItemId("");
      setPlanTerms("");

      await loadBill(activeAppointmentId);
      if (patientId) await loadPatientBills(patientId);

      onUpdated?.();
    } catch (e: any) {
      setErr(e?.message || "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  const schedule = useMemo(() => {
    const inst = bill?.paymentPlan?.installments;
    return Array.isArray(inst) ? inst : [];
  }, [bill]);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onMouseDown={onClose} />

      <div className="relative z-10 flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          className="w-full max-w-6xl max-h-[88vh] overflow-auto rounded-2xl"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-extrabold text-slate-900 ">Billing Manager</h3>
                <p className="text-sm text-slate-500">
                  Per appointment billing • Pay per item • Installments per procedure
                </p>
              </div>

              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-extrabold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="p-6 space-y-4">
              {err && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {err}
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">Appointments</div>
                    <div className="text-xs text-slate-500 mt-1">
                      Unpaid/partial appointments appear first.
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">
                    Active:{" "}
                    <span className="font-extrabold text-slate-900">
                      {activeAppointmentId || "—"}
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {loadingBills ? (
                    <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
                      Loading…
                    </div>
                  ) : patientBills.length ? (
                    patientBills.map((b) => {
                      const t = computeTotals(b);
                      const active = b.appointmentId === activeAppointmentId;
                      const allProcedures = summarizeAllProcedures(b.items);
                      const openProcedures = summarizeOpenProcedures(b.items);
                      const hasOpen = openProcedures !== "None";

                      return (
                        <button
                          key={b.appointmentId}
                          onClick={() => setActiveAppointmentId(b.appointmentId)}
                          className={[
                            "rounded-2xl border p-4 text-left transition",
                            active
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white hover:bg-slate-50",
                          ].join(" ")}
                        >
                        
                      <div className={`text-[11px] font-extrabold ${active ? "text-white/80" : "text-slate-500"}`}>
                            PROCEDURES
                          </div>

                          <div className={`${active ? "text-white" : "text-slate-900"} mt-1 text-sm font-extrabold`}>
                            {allProcedures}
                          </div>

                          <div className={`mt-1 text-[11px] ${active ? "text-white/80" : "text-slate-500"}`}>
                            Open balance:{" "}
                            <span className={`${active ? "text-white" : hasOpen ? "text-slate-900" : "text-slate-600"} font-extrabold`}>
                              {openProcedures}
                            </span>
                          </div>

                          {/* Keep appt ID for QA/debug */}
                          <div className={`mt-1 text-[11px] ${active ? "text-white/70" : "text-slate-500"}`}>
                            Appt: <span className="font-mono">{b.appointmentId}</span>
                          </div>

                          <div className="mt-2 flex items-end justify-between">
                            <div>
                              <div className={`${active ? "text-white" : "text-slate-900"} text-lg font-extrabold`}>
                              ₱ {money(t.remaining)}{" "}
                              <span className={`${active ? "text-white/80" : "text-slate-500"} text-xs font-bold`}>
                                / ₱ {money(t.total)}
                              </span>
                            </div>

                            <div className={`${active ? "text-white/70" : "text-slate-500"} text-xs`}>
                              Updated: {fmtDateTime(b.updatedAt)}
                            </div>
                            </div>

                            <span
                              className={[
                                "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-extrabold",
                                active
                                  ? "border-white/20 bg-white/10 text-white"
                                  : t.status === "paid"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : t.status === "partial"
                                  ? "border-blue-200 bg-blue-50 text-blue-700"
                                  : "border-amber-200 bg-amber-50 text-amber-700",
                              ].join(" ")}
                            >
                              {t.status.toUpperCase()}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
                      No bills found.
                    </div>
                  )}
                </div>
              </div>

              {loadingBill ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
                  Loading billing…
                </div>
              ) : bill ? (
                <>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-xs text-slate-500 font-bold">APPOINTMENT</div>
                        <div className="text-sm font-extrabold text-slate-900">
                          {bill.appointmentId}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Updated: {fmtDateTime(bill.updatedAt)}
                        </div>
                      </div>

                      <div className="flex items-end justify-between gap-3 md:justify-end">
                        <div className="text-right">
                          <div className="text-xs text-slate-500 font-bold">BALANCE / TOTAL</div>
                          <div className="text-lg font-extrabold text-slate-900">
                            ₱ {money(totals.remaining)}{" "}
                            <span className="text-xs font-bold text-slate-500">
                              / ₱ {money(totals.total)}
                            </span>
                          </div>
                        </div>
                        <span
                          className={[
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-extrabold",
                            statusChip(totals.status),
                          ].join(" ")}
                        >
                          {totals.status.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <div className="text-sm font-extrabold text-slate-900">Record payment</div>
                        <div className="text-xs text-slate-500 mt-1">
                          Select items if you want to pay specific procedures only.
                        </div>

                        <div className="mt-3 flex gap-2">
                          <input
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                            placeholder="Partial amount"
                            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                            type="number"
                            min={0}
                            step={0.01}
                          />
                          <button
                            disabled={busy}
                            onClick={() => openConfirmPayment(false)}
                            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                          >
                            Pay
                          </button>
                        </div>

                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Notes (optional)"
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm min-h-[80px]"
                        />

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <div className="text-xs text-slate-500">
                            Selected items remaining: ₱ {money(selectedRemainingTotal)}
                          </div>
                          <button
                            disabled={busy}
                            onClick={() => openConfirmPayment(true)}
                            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-extrabold hover:bg-slate-800 disabled:opacity-60"
                          >
                            Pay full balance
                          </button>
                        </div>

                        <div className="mt-3">
                          <div className="text-xs text-slate-500 font-bold">Method</div>
                          <select
                            value={method}
                            onChange={(e) => setMethod(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                          >
                            <option value="cash">Cash</option>
                            <option value="gcash">GCash</option>
                            <option value="card">Card</option>
                            <option value="bank">Bank transfer</option>
                          </select>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 p-4">
                        <div className="text-sm font-extrabold text-slate-900">
                          Create installment plan (per item)
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Installments are saved under the appointment billing record.
                        </div>

                        <div className="mt-3">
                          <div className="text-xs text-slate-500 font-bold">Select item</div>
                          <select
                            value={planItemId}
                            onChange={(e) => setPlanItemId(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                          >
                            <option value="">Choose an item…</option>
                            {items.map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.name} — ₱ {money(Number(it.price || 0))}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="mt-3">
                          <div className="text-xs text-slate-500 font-bold">Terms</div>
                          <input
                            value={planTerms}
                            onChange={(e) => setPlanTerms(e.target.value)}
                            placeholder="e.g. 3"
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                            type="number"
                            min={1}
                            max={36}
                            step={1}
                          />
                        </div>

                        <button
                          disabled={busy}
                          onClick={openConfirmCreatePlan}
                          className="mt-4 w-full px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-extrabold hover:bg-slate-800 disabled:opacity-60"
                        >
                          Create plan
                        </button>

                        <div className="mt-2 text-xs text-slate-500">
                          Schedule (amounts + due dates) will be generated and stored on the billing record.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <div className="text-sm font-extrabold text-slate-900">Items</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Each procedure can be paid in full, partially, or by installments.
                      </div>
                    </div>

                    <div className="p-4 overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-slate-500">
                            <th className="py-2 pr-4">Select</th>
                            <th className="py-2 pr-4">Item</th>
                            <th className="py-2 pr-4">Price</th>
                            <th className="py-2 pr-4">Type</th>
                            <th className="py-2 pr-4">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {items.map((it) => {
                            const st = String(it.status || "unpaid").toLowerCase();
                            const disabled = st === "paid" || st === "void" || st === "waived";
                            const checked = selectedItemIds.includes(it.id);
                            return (
                              <tr key={it.id}>
                                <td className="py-3 pr-4">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={disabled}
                                    onChange={(e) => {
                                      const on = e.target.checked;
                                      setSelectedItemIds((prev) =>
                                        on ? [...prev, it.id] : prev.filter((x) => x !== it.id)
                                      );
                                    }}
                                  />
                                </td>
                                <td className="py-3 pr-4">
                                  <div className="font-extrabold text-slate-900">{it.name}</div>
                                  {it.toothNumber ? (
                                    <div className="text-xs text-slate-500">Tooth: {it.toothNumber}</div>
                                  ) : null}
                                </td>
                                <td className="py-3 pr-4">₱ {money(Number(it.price || 0))}</td>
                                <td className="py-3 pr-4">
                                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-extrabold text-slate-700">
                                    {st === "plan" ? "INSTALLMENTS" : "FULL"}
                                  </span>
                                </td>
                                <td className="py-3 pr-4">
                                  <span
                                    className={[
                                      "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-extrabold",
                                      st === "paid"
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                        : st === "plan"
                                        ? "border-blue-200 bg-blue-50 text-blue-700"
                                        : "border-amber-200 bg-amber-50 text-amber-700",
                                    ].join(" ")}
                                  >
                                    {(st || "unpaid").toUpperCase()}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <div className="text-sm font-extrabold text-slate-900">Installment schedule</div>
                      <div className="text-xs text-slate-500 mt-1">
                        This is stored at appointment level (paymentPlan.installments).
                      </div>
                    </div>

                    <div className="p-4 space-y-2">
                      {!schedule.length ? (
                        <div className="text-sm text-slate-600">No installment plan found.</div>
                      ) : (
                        schedule.map((inst) => (
                          <div
                            key={inst.id}
                            className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3"
                          >
                            <div>
                              <div className="text-sm font-extrabold text-slate-900">
                                {inst.description || "Installment"}
                              </div>
                              <div className="text-xs text-slate-500 mt-1">
                                Due: {fmtDateOnly(inst.dueDate)} •{" "}
                                {inst.status === "paid"
                                  ? `Paid: ${fmtDateTime(inst.paidAt)}`
                                  : "Pending"}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="text-sm font-extrabold text-slate-900">
                                ₱ {money(Number(inst.amount || 0))}
                              </div>
                              <button
                                disabled={busy || inst.status === "paid"}
                                onClick={() => openConfirmInstallment(inst)}
                                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                              >
                                {inst.status === "paid" ? "Paid" : "Pay"}
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <div className="text-sm font-extrabold text-slate-900">Transactions</div>
                      <div className="text-xs text-slate-500 mt-1">Audit trail for payments recorded.</div>
                    </div>

                    <div className="p-4">
                      {!Array.isArray(bill.transactions) || !bill.transactions.length ? (
                        <div className="text-sm text-slate-600">No transactions yet.</div>
                      ) : (
                        <div className="space-y-2">
                          {bill.transactions.map((tx) => (
                            <div
                              key={tx.id}
                              className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
                            >
                              <div>
                                <div className="text-sm font-extrabold text-slate-900">
                                  ₱ {money(Number(tx.amount || 0))}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                  {tx.method ? `${String(tx.method).toUpperCase()} • ` : ""}
                                  {fmtDateTime(tx.date)}
                                </div>
                                {tx.note ? (
                                  <div className="text-xs text-slate-600 mt-1">{tx.note}</div>
                                ) : null}
                              </div>

                              {Array.isArray(tx.appliedTo) && tx.appliedTo.length ? (
                                <div className="text-xs text-slate-600 sm:text-right">
                                  <div className="font-extrabold text-slate-700">Applied to</div>
                                  <div className="mt-1 space-y-1">
                                    {tx.appliedTo.slice(0, 3).map((a, idx) => (
                                      <div key={`${tx.id}-${idx}`} className="font-mono">
                                        {a.itemId}: ₱ {money(Number(a.amount || 0))}
                                        {a.installmentId
                                          ? ` (inst ${a.installmentId.slice(0, 6)}…)`
                                          : ""}
                                      </div>
                                    ))}
                                    {tx.appliedTo.length > 3 ? (
                                      <div className="text-slate-500">
                                        +{tx.appliedTo.length - 3} more
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs text-slate-500 sm:text-right italic">
                                  No breakdown
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {confirm ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onMouseDown={() => (busy ? null : setConfirm(null))}
          />
          <div
            className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100">
              <div className="text-lg font-extrabold text-slate-900">Confirm action</div>
              <div className="text-sm text-slate-500 mt-1">
                Are you sure you want to save this update?
              </div>
            </div>

            <div className="p-6 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-extrabold text-slate-900">{confirm.label}</div>

                {confirm.kind === "createPlan" ? (
                  <div className="mt-3 space-y-3">
                    <div>
                      <div className="text-xs font-bold text-slate-600">Optional downpayment</div>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={String((confirm as any).downpaymentAmount ?? 0)}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const num = raw === "" ? 0 : Number(raw);
                          setConfirm((prev) =>
                            prev && prev.kind === "createPlan"
                              ? {
                                  ...prev,
                                  downpaymentAmount: Number.isFinite(num) && num >= 0 ? num : 0,
                                }
                              : prev
                          );
                        }}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        placeholder="0"
                      />
                      <div className="mt-1 text-xs text-slate-500">
                        If set, this will be recorded as a payment and deducted before splitting the remaining
                        balance.
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-slate-600">Downpayment method</div>
                      <select
                        value={String((confirm as any).downpaymentMethod || method)}
                        onChange={(e) => {
                          const val = e.target.value;
                          setConfirm((prev) =>
                            prev && prev.kind === "createPlan"
                              ? { ...prev, downpaymentMethod: val }
                              : prev
                          );
                        }}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        <option value="cash">Cash</option>
                        <option value="gcash">GCash</option>
                        <option value="card">Card</option>
                        <option value="bank">Bank transfer</option>
                      </select>
                    </div>
                  </div>
                ) : null}

                {"amount" in confirm ? (
                  <div className="mt-2 text-sm text-slate-700">
                    Amount:{" "}
                    <span className="font-extrabold text-slate-900">
                      ₱ {money(Number(confirm.amount || 0))}
                    </span>
                  </div>
                ) : null}

                {"method" in confirm ? (
                  <div className="mt-1 text-sm text-slate-700">
                    Method:{" "}
                    <span className="font-extrabold text-slate-900">
                      {String((confirm as any).method || "").toUpperCase()}
                    </span>
                  </div>
                ) : null}

                {"note" in confirm && (confirm as any).note ? (
                  <div className="mt-2 text-sm text-slate-700">
                    Notes: <span className="text-slate-900">{(confirm as any).note}</span>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  disabled={busy}
                  onClick={() => setConfirm(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  disabled={busy}
                  onClick={executeConfirm}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-extrabold hover:bg-slate-800 disabled:opacity-60"
                >
                  {busy ? "Saving…" : "Yes, save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
