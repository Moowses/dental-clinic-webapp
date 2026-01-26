"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { getUserAppointments } from "@/lib/services/appointment-service";
import { getPatientRecord } from "@/lib/services/patient-service";
import { updatePatientRecordAction } from "@/app/actions/auth-actions";
import { cancelAppointmentAction } from "@/app/actions/appointment-actions";

import type { Appointment } from "@/lib/types/appointment";
import type { PatientRecord } from "@/lib/types/patient";

import BookAppointmentModal from "@/components/BookAppointmentModal";
import AppointmentDetailsModal, { type AppointmentModalTab } from "@/components/client/AppointmentDetailsModal";
import AppointmentRowActions from "@/components/client/AppointmentRowActions";
import { getDentistProfileByUid, type DentistProfile } from "@/lib/services/dentist-profile-service";
import TransactionsTable from "@/components/client/TransactionsTable";
import { getUserDisplayNameByUid } from "@/lib/services/user-service";

const BRAND = "#0E4B5A";

function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  const cls =
    s === "pending"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : s === "cancelled"
      ? "bg-red-50 text-red-700 border-red-200"
      : "bg-emerald-50 text-emerald-700 border-emerald-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold uppercase ${cls}`}>
      {status}
    </span>
  );
}

function AppointmentsTable({
  appointments,
  loading,
  onAddAppointment,
  onOpenModal,
  onCancel,
  getCancelDisabledReason,
}: {
  appointments: Appointment[];
  loading: boolean;
  onAddAppointment: () => void;
  onOpenModal: (appt: Appointment, tab: AppointmentModalTab) => void;

  onCancel: (appt: Appointment) => void;
  getCancelDisabledReason: (appt: Appointment) => string | null;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-800">Loading appointment history...</p>
        <div className="mt-4 space-y-3">
          <div className="h-12 rounded-xl bg-slate-100" />
          <div className="h-12 rounded-xl bg-slate-100" />
          <div className="h-12 rounded-xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (!appointments.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-extrabold text-slate-900">My Appointment History</h3>
        <p className="mt-2 text-sm text-slate-600">No appointments booked yet.</p>

        <button
          type="button"
          onClick={onAddAppointment}
          className="mt-5 inline-flex rounded-xl px-5 py-3 text-sm font-semibold text-white hover:opacity-95"
          style={{ backgroundColor: BRAND }}
        >
          Book your first appointment
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900">My Appointment History</h3>
          <p className="mt-1 text-xs text-slate-500">Review your bookings and appointment status.</p>
        </div>

        <button
          type="button"
          onClick={onAddAppointment}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95"
          style={{ backgroundColor: BRAND }}
        >
          <span className="text-lg leading-none">+</span>
          Add Appointment
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold text-slate-600">
            <tr>
              <th className="px-6 py-3">Service</th>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Time</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {appointments.map((appt) => (
              <tr key={(appt as any).id} className="hover:bg-slate-50/60">
                <td className="px-6 py-4">
                  <p className="font-bold text-slate-900">{String((appt as any).serviceType || "")}</p>
                  <p className="text-xs text-slate-500">Ref: {String((appt as any).id || "")}</p>
                </td>

                <td className="px-6 py-4 text-slate-700">{String((appt as any).date || "")}</td>
                <td className="px-6 py-4 text-slate-700">{String((appt as any).time || "")}</td>

                <td className="px-6 py-4">
                  <StatusBadge status={String((appt as any).status || "")} />
                </td>

                <td className="px-6 py-4">
                  <AppointmentRowActions
                    appointment={appt}
                    onView={() => onOpenModal(appt, "details")}
                    onTransactions={() => onOpenModal(appt, "transactions")}
                    onCancel={() => onCancel(appt)}
                    cancelDisabledReason={getCancelDisabledReason(appt)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AccountSettingsForm({
  userDisplayName,
  email,
  record,
}: {
  userDisplayName: string;
  email: string;
  record: PatientRecord | null;
}) {
  const [state, formAction, isPending] = useActionState(updatePatientRecordAction, { success: false });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900">Account Settings</h3>
          <p className="mt-2 text-sm text-slate-600">Keep your contact details updated so the clinic can reach you.</p>
        </div>

        {state.success && (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700 border border-emerald-200">
            Saved
          </span>
        )}
      </div>

      <form action={formAction} className="mt-5 space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-bold text-slate-600">Full Name</label>
            <input
              name="displayName"
              defaultValue={userDisplayName}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
              placeholder="Full name"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600">Email</label>
            <input
              defaultValue={email}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 outline-none"
              disabled
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-bold text-slate-600">Phone Number</label>
            <input
              name="phoneNumber"
              defaultValue={record?.phoneNumber || ""}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
              placeholder="e.g. 09xx xxx xxxx"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600">Date of Birth</label>
            <input
              name="dateOfBirth"
              type="date"
              defaultValue={record?.dateOfBirth || ""}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600">Gender</label>
            <select
              name="gender"
              defaultValue={record?.gender || "male"}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600">Emergency Contact</label>
            <input
              name="emergencyContact"
              defaultValue={record?.emergencyContact || ""}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
              placeholder="Name / Number"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-600">Address</label>
          <input
            name="address"
            defaultValue={record?.address || ""}
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
            placeholder="Full address"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex w-full justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
          style={{ backgroundColor: BRAND }}
        >
          {isPending ? "Saving..." : "Save Changes"}
        </button>

        {state.error && <p className="text-sm font-bold text-red-600">{state.error}</p>}
      </form>
    </div>
  );
}

export default function ClientDashboardPage() {
  const { user, role, loading, logout } = useAuth();

  const [active, setActive] = useState<"dashboard" | "transactions" | "settings">("dashboard");

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [recordLoading, setRecordLoading] = useState(true);

  const [openBooking, setOpenBooking] = useState(false);

  const normalizedRole = (role ?? "").toString().trim().toLowerCase();
  const patientName = useMemo(() => user?.displayName || user?.email?.split("@")[0] || "Patient", [user]);

  // Appointment modal state
  const [openApptModal, setOpenApptModal] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [initialTab, setInitialTab] = useState<AppointmentModalTab>("details");

  // Dentist profile state
const [dentistName, setDentistName] = useState<string | null>(null);
const [dentistLoading, setDentistLoading] = useState(false);
const [dentistNameMap, setDentistNameMap] = useState<Record<string, string>>({});



  
  // prevents loader loops + stale responses
  const reqIdRef = useRef(0);

  const refreshAppointments = useCallback(async () => {
    if (!user?.uid) return;

    const myReq = ++reqIdRef.current;
    setHistoryLoading(true);

    try {
      const res = await getUserAppointments(user.uid);
      if (reqIdRef.current !== myReq) return;
      if (res?.success) setAppointments(res.data || []);
    } catch {
      // keep UI stable
    } finally {
      if (reqIdRef.current === myReq) setHistoryLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    refreshAppointments();
  }, [user?.uid, refreshAppointments]);
// Load dentist names for all appointments
  useEffect(() => {
  let cancelled = false;

  async function load() {
    const ids = Array.from(
      new Set(
        (appointments || [])
          .map((a) => String((a as any).dentistId || "").trim())
          .filter(Boolean)
      )
    );

    if (!ids.length) {
      setDentistNameMap({});
      return;
    }

    const pairs = await Promise.all(
      ids.map(async (id) => {
        const name = await getUserDisplayNameByUid(id);
        return [id, name || "Dentist"] as const;
      })
    );

    if (!cancelled) setDentistNameMap(Object.fromEntries(pairs));
  }

  load();
  return () => {
    cancelled = true;
  };
}, [appointments]);


  useEffect(() => {
    if (!user?.uid) return;

    let cancelled = false;
    setRecordLoading(true);

    getPatientRecord(user.uid)
      .then((res) => {
        if (cancelled) return;
        if (res?.success) setRecord(res.data || null);
      })
      .finally(() => {
        if (!cancelled) setRecordLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  // Resolve dentist profile when selected appointment changes
 useEffect(() => {
  let mounted = true;

  async function run() {
    const dentistId = (selectedAppt as any)?.dentistId as string | undefined;

    if (!dentistId) {
      setDentistName(null);
      setDentistLoading(false);
      return;
    }

    setDentistLoading(true);
    try {
      const name = await getUserDisplayNameByUid(dentistId);
      if (mounted) setDentistName(name);
    } finally {
      if (mounted) setDentistLoading(false);
    }
  }

  run();
  return () => {
    mounted = false;
  };
}, [selectedAppt]);


  function openModal(appt: Appointment, tab: AppointmentModalTab) {
    setSelectedAppt(appt);
    setInitialTab(tab);
    setOpenApptModal(true);
  }

  function getAppointmentDateTimeLocal(appt: Appointment): Date | null {
    const dateStr = String((appt as any).date || "").trim(); // "YYYY-MM-DD"
    const timeStr = String((appt as any).time || "").trim(); // "HH:mm"

    if (!dateStr || !timeStr) return null;

    const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
    const [hh, mm] = timeStr.split(":").map((v) => parseInt(v, 10));

    if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return null;

    return new Date(y, m - 1, d, hh, mm, 0, 0);
  }

  function getCancelDisabledReason(appt: Appointment): string | null {
    const status = String((appt as any).status || "").toLowerCase();
    if (status !== "pending") return "Only pending appointments can be cancelled.";

    const dt = getAppointmentDateTimeLocal(appt);
    if (!dt) return null;

    const now = new Date();
    const diffMs = dt.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffMs < 0) {
      return "This appointment has already started/passed. Please call front desk.";
    }

    if (diffHours <= 3) {
      return "You can’t cancel your appointment 3 hours before your appointment. Please call front desk about this.";
    }

    return null;
  }

  async function handleCancelAppointment(appt: Appointment) {
    const reason = getCancelDisabledReason(appt);
    if (reason) return;

    const id = String((appt as any).id || "");
    if (!id) return;

    try {
      const res = await cancelAppointmentAction(id);
      if (!res?.success) {
        alert(res?.error || "Failed to cancel appointment.");
        return;
      }
      await refreshAppointments();
    } catch (e: any) {
      alert(e?.message || "Failed to cancel appointment.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-sm text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center">
          <h2 className="text-xl font-extrabold text-slate-900">Please sign in</h2>
          <p className="mt-2 text-sm text-slate-600">You need an account to access your dashboard.</p>
          <Link
            href="/"
            className="mt-5 inline-flex w-full justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white hover:opacity-95"
            style={{ backgroundColor: BRAND }}
          >
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  if (normalizedRole && normalizedRole !== "client") {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center">
          <h2 className="text-xl font-extrabold text-slate-900">Access restricted</h2>
          <p className="mt-2 text-sm text-slate-600">
            This dashboard is for patients only. if you administer the clinic, please use the admin link.
          </p>
          <button
            onClick={logout}
            className="mt-5 inline-flex w-full justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white hover:opacity-95"
            style={{ backgroundColor: BRAND }}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 p-5">
              <div className="flex items-center gap-3">
                <div className="relative h-10 w-10">
                  <Image src="/dclogo.png" alt="J4 Dental Clinic" fill className="object-contain" />
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-extrabold text-slate-900">Patient Portal</p>
                  <p className="text-xs text-slate-500">J4 Dental Clinic</p>
                </div>
              </div>
            </div>

            <div className="p-3">
              <button
                onClick={() => setActive("dashboard")}
                className={`w-full rounded-xl px-4 py-3 text-left text-sm font-bold transition ${
                  active === "dashboard" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                Dashboard
              </button>
                <button
                onClick={() => setActive("transactions")}
                className={`mt-2 w-full rounded-xl px-4 py-3 text-left text-sm font-bold transition ${
                  active === "transactions" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                Transactions
              </button>

              <button
                onClick={() => setActive("settings")}
                className={`mt-2 w-full rounded-xl px-4 py-3 text-left text-sm font-bold transition ${
                  active === "settings" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                Account Settings
              </button>

              <div className="my-3 border-t border-slate-100" />

              <button
                onClick={logout}
                className="w-full rounded-xl px-4 py-3 text-left text-sm font-bold text-red-600 hover:bg-red-50"
              >
                Logout
              </button>
            </div>
          </aside>

          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div
                className="p-6"
                style={{
                  background: "linear-gradient(90deg, rgba(14,75,90,1) 0%, rgba(27,166,200,1) 100%)",
                }}
              >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative h-16 w-16 overflow-hidden rounded-2xl bg-white/15 ring-1 ring-white/20">
                      <Image src="/clinic6.jpg" alt={patientName} fill className="object-cover" />
                    </div>

                    <div className="text-white">
                      <p className="text-xs font-bold text-white/85">Patient Dashboard</p>
                      <h1 className="mt-1 text-xl font-extrabold">{patientName}</h1>
                      <p className="mt-1 text-xs text-white/80">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setOpenBooking(true)}
                      className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-slate-100"
                    >
                      Book Appointment
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <p className="text-xs font-bold text-slate-500">Upcoming (Pending)</p>
                    <p className="mt-2 text-2xl font-extrabold text-slate-900">
                      {appointments.filter((a) => String((a as any).status).toLowerCase() === "pending").length}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <p className="text-xs font-bold text-slate-500">Total Bookings</p>
                    <p className="mt-2 text-2xl font-extrabold text-slate-900">{appointments.length}</p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <p className="text-xs font-bold text-slate-500">Role</p>
                    <p className="mt-2 text-sm font-extrabold text-slate-900">{normalizedRole || "client"}</p>
                    <p className="mt-1 text-xs text-slate-500">Active session</p>
                  </div>
                </div>
              </div>
            </div>

            {active === "dashboard" ? (
              <AppointmentsTable
                appointments={appointments}
                loading={historyLoading}
                onAddAppointment={() => setOpenBooking(true)}
                onOpenModal={openModal}
                onCancel={handleCancelAppointment}
                getCancelDisabledReason={getCancelDisabledReason}
              />
            ) : active === "transactions" ? (
              <TransactionsTable
                appointments={appointments}
                dentistNameMap={dentistNameMap}
                onOpenModal={(appt) => openModal(appt, "details")}
              />
            ) : recordLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold text-slate-800">Loading account settings...</p>
                <div className="mt-4 space-y-3">
                  <div className="h-12 rounded-xl bg-slate-100" />
                  <div className="h-12 rounded-xl bg-slate-100" />
                  <div className="h-12 rounded-xl bg-slate-100" />
                </div>
              </div>
            ) : (
              <AccountSettingsForm userDisplayName={patientName} email={user.email || ""} record={record} />
            )}
          </section>
        </div>
      </div>

      <AppointmentDetailsModal
        open={openApptModal}
        onClose={() => setOpenApptModal(false)}
        appointment={selectedAppt}
        dentistProfile={dentistName ? { uid: (selectedAppt as any)?.dentistId || "", displayName: dentistName } : null}
        dentistLoading={dentistLoading}
        brandColor={BRAND}
        initialTab={initialTab}
      />

      <BookAppointmentModal open={openBooking} onClose={() => setOpenBooking(false)} onBooked={refreshAppointments} />
    
    </main>
  );
}
