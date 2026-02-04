"use client";

import { useEffect, useState, useTransition } from "react";
import ReportShell from "./ReportShell";

import { getInventoryReport } from "@/app/actions/inventory-actions";

type InventoryRow = {
  id: string;
  name: string;
  itemCode?: string;
  category?: string;
  tag?: string;
  qtyOnHand: number;
  reorderLevel?: number;
  unit?: string;
  expirationDate?: string;
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
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<InventoryReportResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onPrint() {
    window.open("/admin-dashboard/reports/print?type=inventory", "_blank", "noopener,noreferrer");
  }

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setErr(null);

    startTransition(async () => {
      try {
        const res = (await getInventoryReport()) as InventoryReportResponse;
        if (!cancelled) setData(res);
      } catch (e: any) {
        console.error("InventoryReportPanel load error:", e);
        if (!cancelled) setErr(e?.message ?? "Failed to load inventory report.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [ready]);

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

  if (!ready) {
    return (
      <ReportShell reportName="Inventory Report" subtitle="Current stock overview">
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-slate-600">Click generate to load the report.</p>
          <button
            onClick={() => setReady(true)}
            className="rounded-full px-5 py-2 text-sm font-extrabold bg-slate-900 text-white hover:bg-slate-800"
          >
            Generate Report
          </button>
        </div>
      </ReportShell>
    );
  }

  const empty =
    !data || data.rows.length === 0
      ? {
          title: pending ? "Loading report..." : "No inventory items found",
          description: pending ? "Please wait..." : "Add items to inventory to generate this report.",
        }
      : undefined;

  return (
    <ReportShell reportName="Inventory Report" subtitle="Current stock overview" empty={empty}>
      {!data ? null : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={onPrint}
              className="rounded-full px-4 py-2 text-sm font-extrabold bg-slate-900 text-white hover:bg-slate-800"
            >
              Print
            </button>
          </div>
          {pending ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              Generating report...
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Summary label="Total Items" value={data.summary.totalItems} />
            <Summary label="Low Stock" value={data.summary.lowStockCount} />
            <Summary label="Out of Stock" value={data.summary.outOfStockCount} />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-600">
                  <th className="px-4 py-3 font-bold">Item ID</th>
                  <th className="px-4 py-3 font-bold">Item Name</th>
                  <th className="px-4 py-3 font-bold">Category</th>
                  <th className="px-4 py-3 font-bold">Stock Qty</th>
                  <th className="px-4 py-3 font-bold">Unit</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Expiry Date</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const low =
                    typeof r.reorderLevel === "number" && r.qtyOnHand <= r.reorderLevel;
                  const oos = r.qtyOnHand <= 0;
                  const status = oos ? "Out of stock" : low ? "Low stock" : "In stock";

                  return (
                    <tr key={r.id} className="border-t border-slate-200">
                      <td className="px-4 py-3 font-semibold text-slate-900">{r.itemCode ?? "--"}</td>
                      <td className="px-4 py-3 text-slate-700">{r.name}</td>
                      <td className="px-4 py-3 text-slate-700">{r.category ?? "--"}</td>
                      <td className="px-4 py-3 text-slate-700">{r.qtyOnHand}</td>
                      <td className="px-4 py-3 text-slate-700">{r.unit ?? "--"}</td>
                      <td className="px-4 py-3 text-slate-700">
                        <span
                          className={[
                            "inline-flex items-center rounded-full px-2 py-1 text-xs font-bold",
                            oos
                              ? "bg-rose-50 text-rose-700"
                              : low
                              ? "bg-amber-50 text-amber-700"
                              : "bg-emerald-50 text-emerald-700",
                          ].join(" ")}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{r.expirationDate ?? "--"}</td>
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
