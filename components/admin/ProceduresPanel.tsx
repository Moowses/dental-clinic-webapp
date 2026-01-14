"use client";

import React, { useEffect, useState } from "react";
import { useActionState } from "react";

import { createProcedureAction } from "@/app/actions/clinic-actions";
import { getAllProcedures } from "@/lib/services/clinic-service";
import type { DentalProcedure } from "@/lib/types/clinic";

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

export default function ProceduresPanel() {
  const [procedures, setProcedures] = useState<DentalProcedure[]>([]);
  const [state, formAction, isPending] = useActionState(createProcedureAction, {
    success: false,
  });

  useEffect(() => {
    getAllProcedures().then((res) => {
      if (res.success) setProcedures(res.data || []);
    });
  }, [state.success]);

  return (
    <Card title="Procedures" subtitle="Admin • Manage clinic services and pricing">
      <div className="space-y-4">
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {procedures.length === 0 ? (
              <div className="p-4 text-sm text-slate-500 italic">
                No procedures yet. Add your first procedure below.
              </div>
            ) : (
              procedures.map((p) => (
                <div key={p.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-extrabold text-slate-900 truncate">
                      {p.code} — {p.name}
                    </p>
                    <p className="text-xs text-slate-500">ID: {p.id}</p>
                  </div>
                  <div className="font-extrabold text-slate-900">${p.basePrice}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <form action={formAction} className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input name="code" placeholder="Code" className={inputBase} required />
            <input name="name" placeholder="Procedure name" className={`${inputBase} md:col-span-2`} required />
          </div>

          <input
            name="basePrice"
            type="number"
            placeholder="Base price"
            className={inputBase}
            required
          />

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl bg-teal-700 text-white py-2.5 font-extrabold hover:bg-teal-800 disabled:opacity-60"
          >
            {isPending ? "Adding..." : "Add Procedure"}
          </button>

          {state.success ? (
            <p className="text-emerald-700 text-xs font-extrabold text-center">
              Procedure added successfully.
            </p>
          ) : null}

          {state.error ? (
            <p className="text-red-700 text-xs font-extrabold text-center">{state.error}</p>
          ) : null}
        </form>
      </div>
    </Card>
  );
}
