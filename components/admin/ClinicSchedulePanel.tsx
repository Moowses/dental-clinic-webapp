"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { getDentistScheduleAction } from "@/app/actions/appointment-actions";
import {
  getTreatmentToolsAction,
  completeTreatmentAction,
} from "@/app/actions/treatment-actions";

import type { Appointment } from "@/lib/types/appointment";
import type { DentalProcedure } from "@/lib/types/clinic";
import type { InventoryItem } from "@/lib/types/inventory";

/* =========================
   Treatment Modal
========================= */

function TreatmentModal({
  appointment,
  onClose,
  onComplete,
}: {
  appointment: Appointment;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [tools, setTools] = useState<{
    procedures: (DentalProcedure & {
      requiredInventory?: { inventoryItemId: string; quantity: number }[];
    })[];
    inventory: InventoryItem[];
  } | null>(null);

  const [procList, setProcList] = useState<
    {
      id: string;
      name: string;
      price: number;
      toothNumber: string;
      isCustom: boolean;
    }[]
  >([]);

  const [usedInv, setUsedInv] = useState<{ [id: string]: number }>({});
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    getTreatmentToolsAction().then((res) => {
      if (res.success && res.data) setTools(res.data as any);
    });
  }, []);

  /* ===== Inventory recompute (KEY FIX) ===== */
  const recomputeInventoryFromProcedures = useCallback(
    (procedures: typeof procList) => {
      if (!tools) return {};

      const nextUsed: { [id: string]: number } = {};

      procedures.forEach((p) => {
        const proc = tools.procedures.find((tp) => tp.id === p.id);
        if (!proc?.requiredInventory) return;

        proc.requiredInventory.forEach((ri) => {
          nextUsed[ri.inventoryItemId] =
            (nextUsed[ri.inventoryItemId] || 0) + ri.quantity;
        });
      });

      return nextUsed;
    },
    [tools],
  );

  const addProcedure = (p: any) => {
    const nextList = [
      ...procList,
      {
        id: p.id,
        name: p.name,
        price: p.basePrice,
        toothNumber: "",
        isCustom: false,
      },
    ];

    setProcList(nextList);
    setUsedInv(recomputeInventoryFromProcedures(nextList));
  };

  const addCustomProcedure = () => {
    setProcList([
      ...procList,
      {
        id: crypto.randomUUID(),
        name: "Custom Procedure",
        price: 0,
        toothNumber: "",
        isCustom: true,
      },
    ]);
  };

  const removeProcedure = (index: number) => {
    const nextList = procList.filter((_, i) => i !== index);
    setProcList(nextList);
    setUsedInv(recomputeInventoryFromProcedures(nextList));
  };

  const updateProcedure = (
    index: number,
    field: "name" | "price" | "toothNumber",
    value: any,
  ) => {
    const next = [...procList];
    next[index] = { ...next[index], [field]: value };
    setProcList(next);
  };

  const estimatedTotal = useMemo(
    () => procList.reduce((sum, p) => sum + Number(p.price || 0), 0),
    [procList],
  );

  const handleSave = async () => {
    setIsSaving(true);
    const res = await completeTreatmentAction(appointment.id, {
      notes,
      procedures: procList.map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        toothNumber: p.toothNumber,
      })),
      inventoryUsed:
        tools?.inventory
          .filter((i) => usedInv[i.id] > 0)
          .map((i) => ({ id: i.id, name: i.name, quantity: usedInv[i.id] })) ||
        [],
    });

    if (res.success) {
      onComplete();
      onClose();
    } else {
      alert(res.error);
    }
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto text-gray-900">
        <h3 className="font-bold border-b pb-2 text-lg">
          Record Treatment — {appointment.serviceType}
        </h3>

        <textarea
          placeholder="Clinical Notes..."
          className="w-full border rounded-lg p-3 h-28 text-sm"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Procedures */}
          <div>
            <div className="flex gap-2 mb-2">
              <select
                className="text-xs p-2 border rounded flex-1"
                onChange={(e) => {
                  const p = tools?.procedures.find(
                    (proc) => proc.id === e.target.value,
                  );
                  if (p) addProcedure(p);
                  e.target.value = "";
                }}
              >
                <option value="">+ Add from Catalog...</option>
                {tools?.procedures.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (${p.basePrice})
                  </option>
                ))}
              </select>
              <button
                onClick={addCustomProcedure}
                className="px-3 text-xs font-bold border rounded"
              >
                + Custom
              </button>
            </div>

            <div className="border rounded-lg bg-gray-50 p-3 space-y-2 min-h-[200px]">
              {procList.map((p, idx) => (
                <div key={p.id} className="bg-white p-3 rounded border">
                  <div className="flex justify-between items-center">
                    <input
                      value={p.name}
                      onChange={(e) =>
                        updateProcedure(idx, "name", e.target.value)
                      }
                      className="font-bold text-sm flex-1"
                    />
                    <button onClick={() => removeProcedure(idx)}>×</button>
                  </div>

                  <div className="flex gap-2 mt-2">
                    <input
                      value={p.toothNumber}
                      onChange={(e) =>
                        updateProcedure(idx, "toothNumber", e.target.value)
                      }
                      placeholder="Tooth #"
                      className="border p-1 text-xs flex-1"
                    />
                    <input
                      type="number"
                      value={p.price}
                      onChange={(e) =>
                        updateProcedure(idx, "price", e.target.value)
                      }
                      className="border p-1 text-xs w-24 text-right"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-2 font-bold">
              Estimated Total: ${estimatedTotal.toLocaleString()}
            </div>
          </div>

          {/* Inventory */}
          <div>
            <p className="text-xs font-bold mb-2">Inventory Used</p>
            {tools?.inventory
              .filter((i) => i.category === "consumable")
              .map((i) => (
                <div
                  key={i.id}
                  className="flex justify-between items-center border p-2 rounded mb-1"
                >
                  <div>
                    <p className="text-sm font-medium">{i.name}</p>
                    <p className="text-xs text-gray-400">
                      Stock: {i.stock}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setUsedInv({
                          ...usedInv,
                          [i.id]: Math.max(0, (usedInv[i.id] || 0) - 1),
                        })
                      }
                    >
                      -
                    </button>
                    <span className="font-bold">{usedInv[i.id] || 0}</span>
                    <button
                      onClick={() =>
                        setUsedInv({
                          ...usedInv,
                          [i.id]: (usedInv[i.id] || 0) + 1,
                        })
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <button
          onClick={() => setConfirmOpen(true)}
          disabled={procList.length === 0}
          className="w-full bg-pink-600 text-white py-2 rounded font-bold"
        >
          Finalize Treatment
        </button>

        <button onClick={onClose} className="w-full text-sm text-gray-500">
          Cancel
        </button>
      </div>

      {/* Confirm Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white p-5 rounded-lg w-full max-w-sm space-y-4">
            <p className="font-bold text-lg">Confirm Treatment</p>
            <p className="text-sm text-gray-600">
              Are you sure you want to finalize this treatment?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmOpen(false)}>Cancel</button>
              <button
                onClick={() => {
                  setConfirmOpen(false);
                  handleSave();
                }}
                className="bg-emerald-700 text-white px-4 py-2 rounded"
              >
                Yes, Finalize
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================
   Dentist Schedule Panel
========================= */

export default function DentistSchedulePanel() {
  const [schedule, setSchedule] = useState<Appointment[]>([]);
  const [active, setActive] = useState<Appointment | null>(null);

  const load = async () => {
    const res = await getDentistScheduleAction(
      new Date().toISOString().split("T")[0],
    );
    if (res.success) setSchedule(res.data as any);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-3">
      {schedule.map((a) => (
        <div key={a.id} className="border p-3 rounded flex justify-between">
          <div>
            <p className="font-bold">
              {a.time} — {a.serviceType}
            </p>
          </div>
          {a.status !== "completed" && (
            <button
              onClick={() => setActive(a)}
              className="bg-teal-700 text-white px-3 rounded"
            >
              Treat
            </button>
          )}
        </div>
      ))}

      {active && (
        <TreatmentModal
          appointment={active}
          onClose={() => setActive(null)}
          onComplete={load}
        />
      )}
    </div>
  );
}
