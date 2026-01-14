"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useActionState } from "react";

import { addInventoryItemAction, adjustStockAction } from "@/app/actions/inventory-actions";
import { getInventory } from "@/lib/services/inventory-service";

import type { InventoryItem } from "@/lib/types/inventory";

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h3 className="text-lg font-extrabold text-slate-900">{title}</h3>
        {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

const inputBase =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-300";

export default function InventoryPanel() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [state, formAction, isPending] = useActionState(addInventoryItemAction, {
    success: false,
  });

  const refresh = useCallback(() => {
    getInventory().then((res) => {
      if (res.success) setInventory(res.data || []);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [state.success, refresh]);

  return (
    <Card title="Inventory" subtitle="Track consumables and adjust stock">
      <div className="space-y-3">
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
          <div className="divide-y divide-slate-100">
            {inventory.length === 0 ? (
              <div className="p-4 text-sm text-slate-500 italic">No inventory items yet.</div>
            ) : (
              inventory.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-extrabold text-slate-900 truncate">{item.name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Stock: <span className="font-extrabold text-slate-900">{item.stock}</span> •
                      Unit: {item.unit}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => adjustStockAction(item.id, -1).then(refresh)}
                      className="px-4 py-2 rounded-xl border border-slate-200 bg-white font-extrabold hover:bg-slate-50"
                    >
                      -
                    </button>
                    <button
                      onClick={() => adjustStockAction(item.id, 1).then(refresh)}
                      className="px-4 py-2 rounded-xl bg-slate-900 text-white font-extrabold hover:bg-black"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <form action={formAction} className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input name="name" placeholder="Item Name" className={inputBase} required />
            <input name="unit" placeholder="Unit (pcs, box, ml...)" className={inputBase} required />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input name="stock" type="number" placeholder="Qty" className={inputBase} required />
            <select name="category" className={inputBase}>
              <option value="consumable">Consumable</option>
              <option value="material">Material</option>
            </select>
            <input name="minThreshold" type="number" placeholder="Min Threshold" className={inputBase} required />
          </div>

          <input name="costPerUnit" type="number" placeholder="Cost per unit" className={inputBase} required />

          <button
            disabled={isPending}
            className="w-full rounded-xl bg-teal-700 text-white py-2.5 font-extrabold hover:bg-teal-800 disabled:opacity-60"
          >
            {isPending ? "Adding..." : "Add Item"}
          </button>
        </form>
      </div>
    </Card>
  );
}
