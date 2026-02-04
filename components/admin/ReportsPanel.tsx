"use client";

import { useMemo, useState } from "react";
import BillingReportPanel from "./reports/BillingReportPanel";
import AppointmentSummaryReportPanel from "./reports/AppointmentSummaryReportPanel";
import InventoryReportPanel from "./reports/InventoryReportPanel";

type ReportTab = "billing" | "appointments" | "inventory";

export default function ReportsPanel() {
  const [tab, setTab] = useState<ReportTab>("appointments");

  const tabs = useMemo(
    () => [
      { id: "appointments" as const, label: "Appointment Summary" },
      { id: "billing" as const, label: "Billing & Collections" },
      { id: "inventory" as const, label: "Inventory" },
    ],
    []
  );

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xl font-extrabold text-slate-900">Reports</p>
            <p className="text-sm text-slate-500">
              Billing, appointments, and inventory summaries.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={[
                  "rounded-full px-4 py-2 text-sm font-semibold transition",
                  tab === t.id
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                ].join(" ")}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === "appointments" && <AppointmentSummaryReportPanel />}
      {tab === "billing" && <BillingReportPanel />}
      {tab === "inventory" && <InventoryReportPanel />}
    </div>
  );
}
