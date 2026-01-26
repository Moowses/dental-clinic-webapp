"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  createItemPaymentPlanAction,
  getBillingByPatientAction,
  getBillingDetailsAction,
  payInstallmentAction,
  recordBillingPaymentAction,
} from "@/app/actions/billing-actions";

type InstallmentStatus = "pending" | "paid";

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
  status?: string; // legacy: unpaid | paid | plan
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

  // legacy appointment-level plan
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

  // Prefer Firestore's remainingBalance if present
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
      label: string;
    };

export default function BillingPaymentPlansPanel({
  billingId,
  onClose,
  onUpdated,
}: {
  /**
   * Backwards compatible:
   * - if billingId is an appointmentId -> open that appointment bill
   * - if billingId is "pid:<patientId>" -> open patient billing manager
   */
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

  // close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // react to parent changing billingId
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

  const items = useMemo(() => (Array.isArray(bill?.items) ? bill!.items! : []), [bill]);
  const totals = useMemo(() => computeTotals(bill), [bill]);

  const selectedRemainingTotal = useMemo(() => {
    if (!selectedItemIds.length) return 0;
    return items
      .filter((it) => selectedItemIds.includes(it.id))
      .reduce((s, it) => {
        const st = String(it.status || "unpaid").toLowerCase();
        const remaining =
          st === "paid" || st === "void" || st === "waived" ? 0 : Number(it.price || 0);
        return s + remaining;
      }, 0);
  }, [items, selectedItemIds]);

  // auto-fill payAmount when selecting items
  useEffect(() => {
    if (selectedItemIds.length) setPayAmount(String(selectedRemainingTotal || ""));
  }, [selectedItemIds, selectedRemainingTotal]);

  const txSorted = useMemo(() => {
    const t = bill?.transactions || [];
    return [...t].sort((a, b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0));
  }, [bill]);

  function billUpdatedMs(b: BillingRecord) {
    return toDate(b.updatedAt || b.createdAt)?.getTime() || 0;
  }

  function billRemaining(b: BillingRecord) {
    const t = computeTotals(b as any);
    return t.remaining;
  }

  async function loadPatientBills(pid: string) {
    if (!pid) return;
    setLoadingBills(true);
    setErr(null);
    try {
      const res = await getBillingByPatientAction(pid, "all");
      if (!res?.success) throw new Error(res?.error || "Failed to load patient bills.");
      const list = (res.data || []) as BillingRecord[];

      const normalized = list.map((b) => ({
        ...b,
        appointmentId: (b.appointmentId || b.id) as string,
        id: (b.id || b.appointmentId) as string,
      }));

      normalized.sort((a, b) => {
        const aOpen = billRemaining(a) > 0;
        const bOpen = billRemaining(b) > 0;
        if (aOpen !== bOpen) return aOpen ? -1 : 1;
        return billUpdatedMs(b) - billUpdatedMs(a);
      });

      setPatientBills(normalized);

      if (!activeAppointmentId) {
        const firstOpen = normalized.find((x) => billRemaining(x) > 0)?.appointmentId;
        const first = firstOpen || normalized[0]?.appointmentId || "";
        if (first) setActiveAppointmentId(first);
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to load patient bills.");
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
      if (!res?.success || !res.data) throw new Error(res?.error || "Bill not found.");
      const data = res.data as BillingRecord;

      const normalized: BillingRecord = {
        ...data,
        appointmentId: (data.appointmentId || data.id || appointmentId) as string,
        id: (data.id || appointmentId) as string,
      };

      setBill(normalized);

      if (!patientId && normalized.patientId) {
        setPatientId(normalized.patientId);
      }

      setSelectedItemIds([]);
      setPayAmount("");
      setPlanItemId("");
      setPlanTerms("");
    } catch (e: any) {
      setErr(e?.message || "Failed to load bill.");
      setBill(null);
    } finally {
      setLoadingBill(false);
    }
  }

  useEffect(() => {
    if (!patientId) return;
    loadPatientBills(patientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  useEffect(() => {
    if (!activeAppointmentId) return;
    loadBill(activeAppointmentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAppointmentId]);

  function toggleItem(id: string, checked: boolean) {
    setSelectedItemIds((prev) => {
      const set = new Set(prev);
      if (checked) set.add(id);
      else set.delete(id);
      return Array.from(set);
    });
  }

  function openConfirmPayment(fullBalance: boolean) {
    if (!bill) return;
    setErr(null);

    const amount = fullBalance ? totals.remaining : Number(payAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      setErr("Please enter a valid payment amount.");
      return;
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
        // legacy action signature: (appointmentId, installmentId, method)
        const res = await payInstallmentAction(confirm.appointmentId, confirm.installmentId, confirm.method);
        if (!res?.success) throw new Error(res?.error || "Failed to pay installment.");
      }

      if (confirm.kind === "createPlan") {
        const res = await createItemPaymentPlanAction({
          appointmentId: confirm.appointmentId,
          itemId: confirm.itemId,
          terms: confirm.terms,
          description: confirm.description,
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
        <div className="w-full max-w-6xl max-h-[88vh] overflow-auto rounded-2xl" onMouseDown={(e) => e.stopPropagation()}>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-extrabold text-slate-900">Billing Manager</h3>
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
                    <div className="text-xs text-slate-500 mt-1">Unpaid/partial appointments appear first.</div>
                  </div>
                  <div className="text-xs text-slate-500">
                    Active:{" "}
                    <span className="font-mono font-extrabold text-slate-900">
                      {activeAppointmentId || "—"}
                    </span>
                  </div>
                </div>

                {loadingBills ? (
                  <div className="mt-3 text-sm text-slate-500">Loading appointments…</div>
                ) : patientBills.length === 0 ? (
                  <div className="mt-3 text-sm text-slate-500 italic">No bills found for this patient.</div>
                ) : (
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {patientBills.map((b) => {
                      const t = computeTotals(b);
                      const active = b.appointmentId === activeAppointmentId;
                      return (
                        <button
                          key={b.appointmentId}
                          onClick={() => setActiveAppointmentId(b.appointmentId)}
                          className={`text-left rounded-2xl border p-3 transition ${
                            active
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className={`text-[11px] font-extrabold ${active ? "text-white/80" : "text-slate-500"}`}>
                                Appointment ID: <span className="font-mono">{b.appointmentId}</span>
                              </div>
                              <div className={`mt-1 text-xs ${active ? "text-white/70" : "text-slate-500"}`}>
                                Updated: {fmtDateTime(b.updatedAt || b.createdAt)}
                              </div>
                            </div>

                            <div className="shrink-0 text-right">
                              <div className={`text-sm font-extrabold ${active ? "text-white" : "text-slate-900"}`}>
                                ₱ {money(t.remaining)}
                              </div>
                              <div className={`text-[11px] font-bold ${active ? "text-white/70" : "text-slate-500"}`}>
                                / ₱ {money(t.total)}
                              </div>
                              <span
                                className={`mt-2 inline-flex text-[10px] font-extrabold px-2 py-1 rounded-full border ${
                                  active ? "border-white/20 bg-white/10 text-white" : statusChip(t.status)
                                }`}
                              >
                                {t.status.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {loadingBill ? (
                <div className="text-sm text-slate-500">Loading bill…</div>
              ) : !bill ? (
                <div className="text-sm text-slate-500 italic">Select an appointment to view billing.</div>
              ) : (
                <>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-xs font-extrabold text-slate-600 uppercase">Appointment</div>
                        <div className="text-sm font-extrabold text-slate-900 font-mono">{bill.appointmentId}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          Updated: {fmtDateTime(bill.updatedAt || bill.createdAt)}
                        </div>
                      </div>

                      <div className="text-left sm:text-right">
                        <div className="text-xs font-extrabold text-slate-600 uppercase">Balance / Total</div>
                        <div className="text-2xl font-extrabold text-slate-900">
                          ₱ {money(totals.remaining)}
                          <span className="text-sm font-bold text-slate-500"> / ₱ {money(totals.total)}</span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2 sm:justify-end">
                          <select
                            value={method}
                            onChange={(e) => setMethod(e.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                            disabled={busy}
                          >
                            <option value="cash">Cash</option>
                            <option value="card">Card</option>
                            <option value="gcash">GCash</option>
                            <option value="bank">Bank Transfer</option>
                            <option value="insurance">Insurance</option>
                          </select>

                          <button
                            disabled={busy || totals.remaining <= 0}
                            onClick={() => openConfirmPayment(true)}
                            className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-extrabold hover:bg-slate-800 disabled:opacity-60"
                          >
                            Pay full balance
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="text-sm font-extrabold text-slate-900">Record payment</div>
                        <div className="text-xs text-slate-500 mt-1">
                          Select items if you want to pay specific procedures only.
                        </div>

                        <div className="mt-3 flex gap-2">
                          <input
                            type="number"
                            min={1}
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                            placeholder={selectedItemIds.length ? "Selected items amount" : "Partial amount"}
                            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                            disabled={busy}
                          />
                          <button
                            disabled={busy}
                            onClick={() => openConfirmPayment(false)}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                          >
                            Pay
                          </button>
                        </div>

                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Notes (optional)"
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                          rows={2}
                          disabled={busy}
                        />

                        <div className="mt-2 text-[11px] text-slate-500">
                          {selectedItemIds.length ? (
                            <>
                              Selected items remaining: <b>₱ {money(selectedRemainingTotal)}</b>
                            </>
                          ) : (
                            <>No items selected — payment will be applied as a partial payment.</>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="text-sm font-extrabold text-slate-900">Create installment plan (per item)</div>
                        <div className="text-xs text-slate-500 mt-1">
                          Installments are saved under the appointment billing record.
                        </div>

                        <div className="mt-3 grid gap-2">
                          <label className="text-xs font-extrabold text-slate-600">Select item</label>
                          <select
                            value={planItemId}
                            onChange={(e) => setPlanItemId(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                            disabled={busy}
                          >
                            <option value="">Choose an item…</option>
                            {items.map((it) => {
                              const st = String(it.status || "unpaid").toLowerCase();
                              const remaining =
                                st === "paid" || st === "void" || st === "waived" ? 0 : Number(it.price || 0);

                              const label = `${it.name}${it.toothNumber ? ` (${it.toothNumber})` : ""} — ₱ ${money(
                                Number(it.price || 0)
                              )}`;
                              return (
                                <option key={it.id} value={it.id} disabled={remaining <= 0}>
                                  {label}
                                </option>
                              );
                            })}
                          </select>

                          <label className="text-xs font-extrabold text-slate-600 mt-2">Terms</label>
                          <input
                            type="number"
                            min={1}
                            max={36}
                            value={planTerms}
                            onChange={(e) => setPlanTerms(e.target.value)}
                            placeholder="e.g. 3"
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                            disabled={busy}
                          />

                          <button
                            disabled={busy || !planItemId || !planTerms}
                            onClick={openConfirmCreatePlan}
                            className="mt-2 w-full rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-extrabold hover:bg-slate-800 disabled:opacity-60"
                          >
                            Create plan
                          </button>

                          <div className="text-[11px] text-slate-500">
                            Schedule (amounts + due dates) will be generated and stored on the billing record.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                      <div className="text-sm font-extrabold text-slate-900">Items</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Each procedure can be paid in full, partially, or by installments.
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="overflow-x-auto rounded-2xl border border-slate-200">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr className="text-xs font-extrabold text-slate-600">
                              <th className="p-3">Select</th>
                              <th className="p-3">Item</th>
                              <th className="p-3">Price</th>
                              <th className="p-3">Paid</th>
                              <th className="p-3">Remaining</th>
                              <th className="p-3">Type</th>
                              <th className="p-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {items.map((it) => {
                              const st = String(it.status || "unpaid").toLowerCase();
                              const remaining =
                                st === "paid" || st === "void" || st === "waived" ? 0 : Number(it.price || 0);
                              const paidAmt = Math.max(0, Number(it.price || 0) - remaining);

                              const type = st === "plan" ? "installments" : "full";
                              const status = st === "plan" ? "partial" : remaining <= 0 ? "paid" : "unpaid";

                              const canSelect = remaining > 0 && type !== "installments";

                              return (
                                <tr key={it.id} className="text-sm">
                                  <td className="p-3">
                                    <input
                                      type="checkbox"
                                      checked={selectedItemIds.includes(it.id)}
                                      onChange={(e) => toggleItem(it.id, e.target.checked)}
                                      disabled={busy || !canSelect}
                                      title={
                                        canSelect
                                          ? "Select item to pay full remaining amount"
                                          : type === "installments"
                                          ? "Installment items are paid per term"
                                          : remaining <= 0
                                          ? "Already paid"
                                          : "Not selectable"
                                      }
                                    />
                                  </td>
                                  <td className="p-3">
                                    <div className="font-extrabold text-slate-900">{it.name}</div>
                                    {it.toothNumber ? (
                                      <div className="text-xs text-slate-500">{it.toothNumber}</div>
                                    ) : null}
                                  </td>
                                  <td className="p-3 font-extrabold text-slate-900">₱ {money(Number(it.price || 0))}</td>
                                  <td className="p-3 text-slate-700">₱ {money(paidAmt)}</td>
                                  <td className="p-3 text-slate-700">₱ {money(remaining)}</td>
                                  <td className="p-3">
                                    <span className="inline-flex text-[11px] font-extrabold px-2 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-700">
                                      {type === "installments" ? "INSTALLMENTS" : "FULL"}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    <span className={`inline-flex text-[11px] font-extrabold px-2 py-1 rounded-full border ${statusChip(status)}`}>
                                      {String(status).toUpperCase()}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {schedule.length > 0 ? (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="text-sm font-extrabold text-slate-900">Installment schedule</div>
                          <div className="text-xs text-slate-500 mt-1">
                            This is stored at appointment level (paymentPlan.installments).
                          </div>

                          <div className="mt-3 space-y-2">
                            {schedule.map((inst) => {
                              const isPaid = inst.status === "paid";
                              return (
                                <div
                                  key={inst.id}
                                  className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div className="min-w-0">
                                    <div className="text-sm font-extrabold text-slate-900">
                                      {inst.description || "Installment"}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      Due: {fmtDateOnly(inst.dueDate)}{" "}
                                      {isPaid && inst.paidAt ? (
                                        <span className="text-slate-500">• Paid: {fmtDateTime(inst.paidAt)}</span>
                                      ) : null}
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                                    <div className="text-sm font-extrabold text-slate-900">₱ {money(Number(inst.amount || 0))}</div>
                                    <button
                                      disabled={busy || isPaid}
                                      onClick={() => openConfirmInstallment(inst)}
                                      className={`rounded-xl px-4 py-2 text-xs font-extrabold border disabled:opacity-60 ${
                                        isPaid
                                          ? "border-slate-200 bg-white text-slate-400 cursor-not-allowed"
                                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                      }`}
                                    >
                                      {isPaid ? "Paid" : "Pay"}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                      <div className="text-sm font-extrabold text-slate-900">Transactions</div>
                      <div className="text-xs text-slate-500 mt-1">Audit trail for payments recorded.</div>
                    </div>

                    <div className="p-4">
                      {txSorted.length === 0 ? (
                        <div className="text-sm text-slate-500 italic">No transactions yet.</div>
                      ) : (
                        <div className="space-y-2">
                          {txSorted.map((tx) => (
                            <div
                              key={tx.id}
                              className="rounded-2xl border border-slate-200 bg-slate-50 p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div>
                                <div className="text-sm font-extrabold text-slate-900">₱ {money(Number(tx.amount || 0))}</div>
                                <div className="text-xs text-slate-500">
                                  {tx.method ? `${String(tx.method).toUpperCase()} • ` : ""}
                                  {fmtDateTime(tx.date)}
                                </div>
                                {tx.note ? <div className="text-xs text-slate-600 mt-1">{tx.note}</div> : null}
                              </div>

                              {Array.isArray(tx.appliedTo) && tx.appliedTo.length ? (
                                <div className="text-xs text-slate-600 sm:text-right">
                                  <div className="font-extrabold text-slate-700">Applied to</div>
                                  <div className="mt-1 space-y-1">
                                    {tx.appliedTo.slice(0, 3).map((a, idx) => (
                                      <div key={`${tx.id}-${idx}`} className="font-mono">
                                        {a.itemId}: ₱ {money(Number(a.amount || 0))}
                                        {a.installmentId ? ` (inst ${a.installmentId.slice(0, 6)}…)` : ""}
                                      </div>
                                    ))}
                                    {tx.appliedTo.length > 3 ? (
                                      <div className="text-slate-500">+{tx.appliedTo.length - 3} more</div>
                                    ) : null}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs text-slate-500 sm:text-right italic">No breakdown</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {confirm ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onMouseDown={() => (busy ? null : setConfirm(null))} />
          <div
            className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100">
              <div className="text-lg font-extrabold text-slate-900">Confirm action</div>
              <div className="text-sm text-slate-500 mt-1">Are you sure you want to save this update?</div>
            </div>

            <div className="p-6 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-extrabold text-slate-900">{confirm.label}</div>

                {"amount" in confirm ? (
                  <div className="mt-2 text-sm text-slate-700">
                    Amount:{" "}
                    <span className="font-extrabold text-slate-900">₱ {money(Number(confirm.amount || 0))}</span>
                  </div>
                ) : null}

                {"method" in confirm ? (
                  <div className="mt-1 text-sm text-slate-700">
                    Method:{" "}
                    <span className="font-extrabold text-slate-900">
                      {String(confirm.method || "").toUpperCase()}
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
