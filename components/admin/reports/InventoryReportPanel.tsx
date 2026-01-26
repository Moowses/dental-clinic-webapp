"use client";

import { useEffect, useState, useTransition } from "react";
import ReportShell from "./ReportShell";

// TODO: update import to your actual action
import { getInventoryReport } from "@/app/actions/inventory-actions";

type InventoryRow = {
  id: string;
  name: string;
  sku?: string;
  category?: string;
  qtyOnHand: number;
  reorderLevel?: number;
  unit?: string;
  updatedAt?: string;
};

type InventoryReportResponse = {
  rows: InventoryRow[];
  summary: {
    totalItems: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
};

export default function InventoryReportPanel() {
  const [data, setData] = useState<InventoryReportResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    setErr(null);

    startTransition(async () => {
      try {
        const res = (await getInventoryReport()) as InventoryReportResponse;
        if (!cancelled) setData(res);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load inventory report.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (err) {
    return (
      <ReportShell
        reportName="Inventory Report"
        subtitle="Current stock overview"
        empty={{ title: "Error loading report", description: err }}
      >
        <div />
      </ReportShell>
    );
  }

  const empty =
    !data || data.rows.length === 0
      ? {
          title: pending ? "Loading report…" : "No inventory items found",
          description: pending ? "Please wait…" : "Add items to inventory to generate this report.",
        }
      : undefined;

  return (
    <ReportShell reportName="Inventory Report" subtitle="Current stock overview" empty={empty}>
      {!data ? null : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Summary label="Total Items" value={data.summary.totalItems} />
            <Summary label="Low Stock" value={data.summary.lowStockCount} />
            <Summary label="Out of Stock" value={data.summary.outOfStockCount} />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-600">
                  <th className="px-4 py-3 font-bold">Item</th>
                  <th className="px-4 py-3 font-bold">Category</th>
                  <th className="px-4 py-3 font-bold">SKU</th>
                  <th className="px-4 py-3 font-bold">On Hand</th>
                  <th className="px-4 py-3 font-bold">Reorder Level</th>
                  <th className="px-4 py-3 font-bold">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const low =
                    typeof r.reorderLevel === "number" && r.qtyOnHand <= r.reorderLevel;
                  const oos = r.qtyOnHand <= 0;

                  return (
                    <tr key={r.id} className="border-t border-slate-200">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {r.name}
                        {(low || oos) && (
                          <span className="ml-2 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700">
                            {oos ? "OUT" : "LOW"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{r.category ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{r.sku ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {r.qtyOnHand} {r.unit ?? ""}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {typeof r.reorderLevel === "number" ? r.reorderLevel : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatDate(r.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </ReportShell>
  );
}

function Summary({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-slate-900">{value}</p>
    </div>
  );
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}
