"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/hooks/useAuth";

import PatientRecordsPanel from "@/components/admin/PatientRecordsPanel";
import ClinicSchedulePanel from "@/components/admin/ClinicSchedulePanel";
import InventoryPanel from "@/components/admin/InventoryPanel";
import DentistSchedulePanel from "@/components/admin/DentistSchedulePanel";

import StaffHRPanel from "@/components/admin/StaffHRPanel";
import ProceduresPanel from "@/components/admin/ProceduresPanel";

import UpcomingAppointmentsPanel from "@/components/admin/UpcomingAppointmentsPanel";
import UnassignedAppointmentsPanel from "@/components/admin/UnassignedAppointmentsPanel";

import BillingOverviewPanel from "@/components/admin/BillingOverviewPanel";
import BillingPaymentPlansPanel from "@/components/admin/BillingPaymentPlansPanel";

type TabKey =
  | "dashboard"
  | "appointments"
  | "billing"
  | "patients"
  | "staff"
  | "procedures";

type ApptTab = "calendar" | "upcoming" | "unassigned";

const APPT_SUB_ITEMS = [
  { key: "calendar" as const, label: "Calendar" },
  { key: "upcoming" as const, label: "Upcoming" },
  { key: "unassigned" as const, label: "Unassigned" },
] as const;

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, role, loading, logout } = useAuth();

  const [tab, setTab] = useState<TabKey>("dashboard");
  const [apptTab, setApptTab] = useState<ApptTab>("calendar");
  const [activeBillingId, setActiveBillingId] = useState<string | null>(null);

  // IMPORTANT: forces BillingOverview to refetch after modal updates/close
  const [billingRefreshKey, setBillingRefreshKey] = useState(0);

  const isAdmin = role === "admin";
  const isDentist = role === "dentist";
  const isFrontDesk = role === "front-desk";

  const canSeeAppointments = isAdmin || isFrontDesk;
  const canSeeBilling = isAdmin || isFrontDesk;

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/admin");
  }, [user, loading, router]);

  useEffect(() => {
    if (!loading && user) {
      if (tab === "appointments" && !canSeeAppointments) setTab("dashboard");
      if (tab === "billing" && !canSeeBilling) setTab("dashboard");
    }
  }, [tab, canSeeAppointments, canSeeBilling, loading, user]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-500 font-bold animate-pulse">
        Initializing Admin Dashboard...
      </div>
    );
  }

  if (!user) return null;

  if (role === "client") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <p className="text-xs uppercase tracking-widest font-extrabold text-slate-400">
            Access Denied
          </p>
          <p className="font-extrabold text-slate-900">
            You are signed in as a client.
          </p>
          <div className="flex gap-2">
            <button
              onClick={logout}
              className="flex-1 px-4 py-2 rounded-xl bg-red-50 text-red-700 font-extrabold text-sm hover:bg-red-100"
            >
              Sign Out
            </button>
            <Link
              href="/"
              className="flex-1 px-4 py-2 rounded-xl bg-slate-100 text-slate-900 font-extrabold text-sm text-center hover:bg-slate-200"
            >
              Go Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleAccountSettingsClick = () => {
    alert("Account Settings is not available yet.");
  };

  const goAppointments = (sub: ApptTab) => {
    setTab("appointments");
    setApptTab(sub);
  };

  const goBilling = () => {
    setTab("billing");
    setActiveBillingId(null);
  };

  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          {/* Sidebar */}
          <aside className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 h-fit">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                🦷
              </div>
              <div className="min-w-0">
                <p className="font-extrabold text-slate-900 truncate">
                  Management Portal
                </p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <button
                className={`w-full text-left px-4 py-3 rounded-xl font-extrabold ${
                  tab === "dashboard"
                    ? "bg-slate-900 text-white"
                    : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-900"
                }`}
                onClick={() => setTab("dashboard")}
              >
                Dashboard
              </button>

              {canSeeAppointments && (
                <div>
                  <button
                    className={`w-full text-left px-4 py-3 rounded-xl font-extrabold ${
                      tab === "appointments"
                        ? "bg-slate-900 text-white"
                        : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-900"
                    }`}
                    onClick={() => setTab("appointments")}
                  >
                    Appointments
                  </button>

                  {tab === "appointments" && (
                    <div className="mt-2 space-y-2 pl-2">
                      {APPT_SUB_ITEMS.map((s) => {
                        const active = apptTab === s.key;
                        return (
                          <button
                            key={s.key}
                            className={`w-full text-left px-4 py-2 rounded-xl font-extrabold text-sm ${
                              active
                                ? "bg-slate-100 text-slate-900 border border-slate-200"
                                : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"
                            }`}
                            onClick={() => goAppointments(s.key)}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {canSeeBilling && (
                <button
                  className={`w-full text-left px-4 py-3 rounded-xl font-extrabold ${
                    tab === "billing"
                      ? "bg-slate-900 text-white"
                      : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-900"
                  }`}
                  onClick={goBilling}
                >
                  Billing
                </button>
              )}

              <button
                className={`w-full text-left px-4 py-3 rounded-xl font-extrabold ${
                  tab === "patients"
                    ? "bg-slate-900 text-white"
                    : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-900"
                }`}
                onClick={() => setTab("patients")}
              >
                Patient Records
              </button>

              {isAdmin && (
                <>
                  <button
                    className={`w-full text-left px-4 py-3 rounded-xl font-extrabold ${
                      tab === "staff"
                        ? "bg-slate-900 text-white"
                        : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-900"
                    }`}
                    onClick={() => setTab("staff")}
                  >
                    Management
                  </button>

                  <button
                    className={`w-full text-left px-4 py-3 rounded-xl font-extrabold ${
                      tab === "procedures"
                        ? "bg-slate-900 text-white"
                        : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-900"
                    }`}
                    onClick={() => setTab("procedures")}
                  >
                    Procedures
                  </button>
                </>
              )}

              <button
                className="w-full text-left px-4 py-3 rounded-xl font-extrabold bg-white border border-slate-200 hover:bg-slate-50 text-slate-900"
                onClick={handleAccountSettingsClick}
              >
                Account Settings
              </button>

              <div className="pt-3 mt-3 border-t border-slate-100">
                <button
                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-red-50 font-extrabold text-red-600"
                  onClick={logout}
                >
                  Logout
                </button>
              </div>
            </div>
          </aside>

          {/* Main */}
          <main className="space-y-6">
            {/* Hero (unchanged layout; removed top action button; reduced KPI fonts) */}
            <section className="rounded-2xl overflow-hidden shadow-sm border border-slate-200">
              <div className="bg-gradient-to-r from-[#0f5f73] to-[#1aa4c7] px-6 py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-white/20 border border-white/25 flex items-center justify-center">
                    <span className="text-white font-extrabold text-xl">🏥</span>
                  </div>
                  <div className="text-white">
                    <p className="text-xs font-bold opacity-90">Staff Dashboard</p>
                    <p className="text-2xl font-extrabold leading-tight">
                      {user.displayName || "Staff"}
                    </p>
                    <p className="text-sm opacity-90">{user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="hidden sm:block text-white/90 text-sm font-bold">
                    Role:{" "}
                    <span className="uppercase font-extrabold">{role || "staff"}</span>
                  </div>
                </div>
              </div>

             
            </section>

            {/* Dashboard */}
            {tab === "dashboard" && (
              <div className="space-y-6">
                {(isDentist || isAdmin) && <DentistSchedulePanel />}
                {(isFrontDesk || isAdmin) && <InventoryPanel />}
              </div>
            )}

            {/* Appointments */}
            {tab === "appointments" && canSeeAppointments && (
              <div className="space-y-6">
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-lg font-extrabold text-slate-900">
                        Appointments
                      </p>
                      <p className="text-sm text-slate-500">
                        Calendar, upcoming bookings, and unassigned queue.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {APPT_SUB_ITEMS.map((t) => {
                        const active = apptTab === t.key;
                        return (
                          <button
                            key={t.key}
                            onClick={() => setApptTab(t.key)}
                            className={`px-4 py-2 rounded-xl font-extrabold text-sm transition ${
                              active
                                ? "bg-slate-900 text-white"
                                : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-900"
                            }`}
                          >
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {apptTab === "calendar" && <ClinicSchedulePanel />}
                {apptTab === "upcoming" && <UpcomingAppointmentsPanel />}
                {apptTab === "unassigned" && <UnassignedAppointmentsPanel />}
              </div>
            )}

            {/* Billing */}
          
          {tab === "billing" && canSeeBilling && (
            <div className="space-y-6">
              {/* TOP: Overview */}
              <BillingOverviewPanel
                refreshKey={billingRefreshKey}
                onSelectBill={(id) => {
                  setActiveBillingId(id);
                  setTab("billing");
                }}
              />

              {/* BOTTOM: Details (always visible) */}
              {activeBillingId ? (
                <BillingPaymentPlansPanel
                  billingId={activeBillingId}
                  onClose={() => {
                    setActiveBillingId(null);
                    setBillingRefreshKey((k) => k + 1);
                  }}
                  onUpdated={() => setBillingRefreshKey((k) => k + 1)}
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8">
                  <p className="text-lg font-extrabold text-slate-900">
                    Select a bill to manage payments.
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Choose items to mark as paid or create an installment plan.
                  </p>
                </div>
              )}
            </div>
          )}


            {tab === "patients" && <PatientRecordsPanel />}
            {tab === "staff" && isAdmin && <StaffHRPanel />}
            {tab === "procedures" && isAdmin && <ProceduresPanel />}

            <div className="text-center text-xs text-slate-400 py-6">
              J4 Dental Clinic • Staff Dashboard
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
