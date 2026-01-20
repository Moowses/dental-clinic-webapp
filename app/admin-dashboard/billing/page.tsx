"use client";

import { useState } from "react";
import BillingOverviewPanel from "@/components/admin/BillingOverviewPanel";
import BillingPaymentPlansPanel from "@/components/admin/BillingPaymentPlansPanel";

export default function AdminBillingPage() {
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Billing</h1>
            <p className="mt-1 text-sm text-slate-600">
              Review balances, accept payments, and create installment plans.
            </p>
          </div>

          <a
            href="/admin-dashboard"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
          >
            Back to Dashboard
          </a>
        </div>

        <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
          <BillingOverviewPanel onSelectBill={(id) => setSelectedBillId(id)} />

          {selectedBillId ? (
            <BillingPaymentPlansPanel
              billingId={selectedBillId}
              onClose={() => setSelectedBillId(null)}
              onUpdated={() => {
                // optional: you can add a toast later
              }}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6">
              <p className="text-sm font-semibold text-slate-700">
                Select a bill on the left to view details.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                You can record item payments (e.g. Cleaning) or create plans (e.g. Braces).
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
