"use client";

import React, { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useActionState } from "react";

import {
  addInventoryItemAction,
  adjustStockAction,
  updateInventoryItemAction,
  deleteInventoryItemAction,
} from "@/app/actions/inventory-actions";
import { getInventory } from "@/lib/services/inventory-service";

import type { InventoryItem } from "@/lib/types/inventory";

const inputBase =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-300";

function fmtMoney(n: any) {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "₱0.00";
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(v);
}

function Modal({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">{title}</h3>
            {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
          </div>
          <button
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export default function InventoryPanel() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeOnly, setActiveOnly] = useState(true);
  const [q, setQ] = useState("");

  const [pending, startTransition] = useTransition();

  // Add item server action (FormData-based)
  const [addState, addFormAction, addPending] = useActionState(addInventoryItemAction, { success: false });

  // Modals
  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState<InventoryItem | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await getInventory(activeOnly);
    if (res.success) setInventory(res.data || []);
    setLoading(false);
  }, [activeOnly]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // if add succeeded, close modal and refresh
  useEffect(() => {
    if (addState?.success) {
      setOpenAdd(false);
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addState?.success]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return inventory;

    return inventory.filter((it) => {
      return (
        (it.name || "").toLowerCase().includes(needle) ||
        (it.category || "").toLowerCase().includes(needle) ||
        (it.unit || "").toLowerCase().includes(needle)
      );
    });
  }, [inventory, q]);

  async function quickAdjust(itemId: string, amount: number) {
    startTransition(async () => {
      const res = await adjustStockAction(itemId, amount);
      if (!res.success) {
        alert(res.error || "Failed to adjust stock");
        return;
      }
      await refresh();
    });
  }

  async function onDeactivate(item: InventoryItem) {
    const ok = confirm(`Deactivate "${item.name}"? This will hide it from Active inventory.`);
    if (!ok) return;

    startTransition(async () => {
      const res = await deleteInventoryItemAction(item.id);
      if (!res.success) {
        alert(res.error || "Failed to deactivate item");
        return;
      }
      await refresh();
    });
  }

  async function onSubmitEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!openEdit) return;

    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await updateInventoryItemAction(openEdit.id, fd);
      if (!res.success) {
        alert(res.error || "Failed to update item");
        return;
      }
      setOpenEdit(null);
      await refresh();
    });
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900">Inventory</h3>
          <p className="text-sm text-slate-500">Track consumables and adjust stock</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search item, category, unit…"
              className="w-[260px] max-w-full bg-transparent text-sm outline-none"
            />
          </div>

          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="h-4 w-4"
            />
            Active only
          </label>

          <button
            onClick={() => setOpenAdd(true)}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-extrabold text-white hover:bg-black disabled:opacity-60"
            disabled={pending || addPending}
          >
            + Add Item
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-left">
              <thead className="bg-slate-50">
                <tr className="text-xs font-extrabold uppercase tracking-wide text-slate-600">
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Min</th>
                  <th className="px-4 py-3">Cost/Unit</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td className="px-4 py-6 text-sm text-slate-600" colSpan={8}>
                      Loading…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-sm text-slate-500 italic" colSpan={8}>
                      No inventory items found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => {
                    const low = Number(item.stock ?? 0) <= Number(item.minThreshold ?? 0);
                    return (
                      <tr key={item.id} className="text-sm text-slate-800">
                        <td className="px-4 py-3">
                          <div className="font-extrabold text-slate-900">{item.name}</div>
                          <div className="text-xs text-slate-500 mt-1">Updated: {item.updatedAt ? "—" : "—"}</div>
                        </td>
                        <td className="px-4 py-3">{item.category || "—"}</td>
                        <td className="px-4 py-3">{item.unit || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={low ? "font-extrabold text-rose-600" : "font-extrabold text-slate-900"}>
                            {Number(item.stock ?? 0)}
                          </span>
                        </td>
                        <td className="px-4 py-3">{Number(item.minThreshold ?? 0)}</td>
                        <td className="px-4 py-3">{fmtMoney(item.costPerUnit)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={[
                              "inline-flex items-center rounded-full px-2 py-1 text-xs font-extrabold",
                              item.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600",
                            ].join(" ")}
                          >
                            {item.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => quickAdjust(item.id, -1)}
                              className="px-3 py-2 rounded-xl border border-slate-200 bg-white font-extrabold hover:bg-slate-50 disabled:opacity-60"
                              disabled={pending}
                              title="Deduct 1"
                            >
                              −1
                            </button>
                            <button
                              onClick={() => quickAdjust(item.id, 1)}
                              className="px-3 py-2 rounded-xl bg-slate-900 text-white font-extrabold hover:bg-black disabled:opacity-60"
                              disabled={pending}
                              title="Add 1"
                            >
                              +1
                            </button>
                            <button
                              onClick={() => setOpenEdit(item)}
                              className="px-3 py-2 rounded-xl border border-slate-200 bg-white font-extrabold hover:bg-slate-50 disabled:opacity-60"
                              disabled={pending}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => onDeactivate(item)}
                              className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-extrabold hover:bg-rose-100 disabled:opacity-60"
                              disabled={pending}
                            >
                              Deactivate
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-3 text-xs text-slate-500">
            <span>{filtered.length} item(s)</span>
            {pending ? <span>Saving…</span> : <span>&nbsp;</span>}
          </div>
        </div>
      </div>

      {/* ADD MODAL */}
      {openAdd && (
        <Modal
          title="Add Inventory Item"
          subtitle="Add a new supply/consumable to track. Stock can be adjusted anytime."
          onClose={() => setOpenAdd(false)}
        >
          <form action={addFormAction} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-extrabold uppercase tracking-wide text-slate-600">Item name</label>
                <input name="name" placeholder="e.g., Disposable Gloves (Medium)" className={inputBase} required />
              </div>

              <div>
                <label className="text-xs font-extrabold uppercase tracking-wide text-slate-600">Unit</label>
                <input name="unit" placeholder="pcs, box, ml…" className={inputBase} required />
              </div>

              <div>
                <label className="text-xs font-extrabold uppercase tracking-wide text-slate-600">Category</label>
                <select name="category" className={inputBase}>
                  <option value="consumable">Consumable</option>
                  <option value="material">Material</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-extrabold uppercase tracking-wide text-slate-600">Initial stock</label>
                <input name="stock" type="number" min={0} step={1} placeholder="0" className={inputBase} required />
              </div>

              <div>
                <label className="text-xs font-extrabold uppercase tracking-wide text-slate-600">Min threshold</label>
                <input
                  name="minThreshold"
                  type="number"
                  min={0}
                  step={1}
                  placeholder="0"
                  className={inputBase}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-extrabold uppercase tracking-wide text-slate-600">Cost per unit</label>
                <input
                  name="costPerUnit"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  className={inputBase}
                  required
                />
              </div>
            </div>

            {addState?.success === false && addState?.error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 font-bold">
                {addState.error}
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpenAdd(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
                disabled={addPending}
              >
                Cancel
              </button>
              <button
                disabled={addPending}
                className="rounded-xl bg-teal-700 text-white px-4 py-2 text-sm font-extrabold hover:bg-teal-800 disabled:opacity-60"
              >
                {addPending ? "Adding…" : "Add Item"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* EDIT MODAL */}
      {openEdit && (
        <Modal
          title="Edit Inventory Item"
          subtitle="Update details, stock, and status. (Stock can also be changed via +/- on the table.)"
          onClose={() => setOpenEdit(null)}
        >
          <form onSubmit={onSubmitEdit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-extrabold uppercase tracking-wide text-slate-600">Item name</label>
                <input name="name" defaultValue={openEdit.name || ""} className={inputBase} required />
              </div>

              <div>
                <label className="text-xs font-extrabold uppercase tracking-wide text-slate-600">Unit</label>
                <input name="unit" defaultValue={openEdit.unit || ""} className={inputBase} required />
              </div>

              <div>
                <label className="text-xs font-extrabold uppercase tracking-wide text-slate-600">Category</label>
                <select name="category" defaultValue={openEdit.category || "consumable"} className={inputBase}>
                  <option value="consumable">Consumable</option>
                  <option value="material">Material</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-extrabold uppercase tracking-wide text-slate-600">Stock</label>
                <input
                  name="stock"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={String(Number(openEdit.stock ?? 0))}
                  className={inputBase}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-extrabold uppercase tracking-wide text-slate-600">Min threshold</label>
                <input
                  name="minThreshold"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={String(Number(openEdit.minThreshold ?? 0))}
                  className={inputBase}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-extrabold uppercase tracking-wide text-slate-600">Cost per unit</label>
                <input
                  name="costPerUnit"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={String(Number(openEdit.costPerUnit ?? 0))}
                  className={inputBase}
                  required
                />
              </div>

              <label className="flex items-center gap-2 text-sm font-bold text-slate-800 md:col-span-2">
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={openEdit.isActive === true}
                  className="h-4 w-4"
                />
                Active
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpenEdit(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-extrabold hover:bg-black disabled:opacity-60"
                disabled={pending}
              >
                {pending ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
