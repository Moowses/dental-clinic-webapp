"use client";

import { useAuth } from "@/lib/hooks/useAuth";
import Link from "next/link";
import { useActionState, useEffect, useState, useCallback } from "react";
import { createEmployeeAction } from "@/app/actions/admin-actions";
import { getDentistListAction } from "@/app/actions/dentist-actions";
import { updatePatientRecordAction } from "@/app/actions/auth-actions";
import {
  bookAppointmentAction,
  getAvailabilityAction,
  getClinicScheduleAction,
  getDentistScheduleAction,
  updateAppointmentStatusAction,
  assignDentistAction,
  CalendarAvailability,
  AppointmentWithPatient,
} from "@/app/actions/appointment-actions";
import { createProcedureAction } from "@/app/actions/clinic-actions";
import {
  addInventoryItemAction,
  adjustStockAction,
} from "@/app/actions/inventory-actions";
import {
  getTreatmentToolsAction,
  completeTreatmentAction,
} from "@/app/actions/treatment-actions";

import { getPatientRecord } from "@/lib/services/patient-service";
import { getUserAppointments } from "@/lib/services/appointment-service";
import { searchPatients, getUserProfile } from "@/lib/services/user-service";
import { getAllProcedures } from "@/lib/services/clinic-service";
import { getInventory } from "@/lib/services/inventory-service";

import { PatientRecord } from "@/lib/types/patient";
import { Appointment, AppointmentStatus } from "@/lib/types/appointment";
import { UserProfile } from "@/lib/types/user";
import { DentalProcedure } from "@/lib/types/clinic";
import { InventoryItem } from "@/lib/types/inventory";
import styles from "./backend-test.module.css";

// --- HELPERS ---

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cls =
    s === "pending"
      ? "bg-amber-100 text-amber-700"
      : s === "completed"
      ? "bg-blue-100 text-blue-700"
      : s === "cancelled"
      ? "bg-red-100 text-red-700"
      : "bg-green-100 text-green-700";
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${cls}`}>
      {status}
    </span>
  );
}

// --- MODALS ---

function PatientDetailsModal({
  patientId,
  onClose,
}: {
  patientId: string;
  onClose: () => void;
}) {
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getPatientRecord(patientId), getUserProfile(patientId)]).then(
      ([recordRes, profileRes]) => {
        if (recordRes.success) setRecord(recordRes.data || null);
        if (profileRes.success && profileRes.data)
          setDisplayName(profileRes.data.displayName || "");
        setLoading(false);
      }
    );
  }, [patientId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl space-y-3">
        <h3 className="text-lg font-bold border-b pb-2">Patient Details</h3>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="text-sm space-y-1">
            <p><strong>Name:</strong> {displayName}</p>
            <p><strong>Phone:</strong> {record?.phoneNumber}</p>
            <p><strong>Address:</strong> {record?.address || "N/A"}</p>
            <p><strong>Allergies:</strong> {record?.medicalHistory?.allergies?.join(", ") || "None"}</p>
            <p><strong>Conditions:</strong> {record?.medicalHistory?.conditions?.join(", ") || "None"}</p>
          </div>
        )}
        <button
          onClick={onClose}
          className="w-full bg-gray-200 py-2 rounded font-bold"
        >
          Close
        </button>
      </div>
    </div>
  );
}

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
    procedures: DentalProcedure[];
    inventory: InventoryItem[];
  } | null>(null);
  const [selectedProcs, setSelectedProcs] = useState<string[]>([]);
  const [usedInv, setUsedInv] = useState<{ [id: string]: number }>({});
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getTreatmentToolsAction().then((res) => {
      if (res.success && res.data) setTools(res.data);
    });
  }, []);

  const handleSave = async () => {
    if (!tools) return;
    setIsSaving(true);
    const res = await completeTreatmentAction(appointment.id, {
      notes,
      procedures: tools.procedures
        .filter((p) => selectedProcs.includes(p.id))
        .map((p) => ({ id: p.id, name: p.name, price: p.basePrice })),
      inventoryUsed: tools.inventory
        .filter((i) => usedInv[i.id] > 0)
        .map((i) => ({ id: i.id, name: i.name, quantity: usedInv[i.id] })),
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
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold border-b pb-2">
          Record Treatment: {appointment.serviceType}
        </h3>
        <textarea
          placeholder="Clinical Notes..."
          className="w-full border p-2 rounded h-20 text-sm"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-4">
          <div className="border rounded p-2 text-xs space-y-1">
            <p className="font-bold">Procedures</p>
            {tools?.procedures.map((p) => (
              <label key={p.id} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  onChange={(e) =>
                    e.target.checked
                      ? setSelectedProcs([...selectedProcs, p.id])
                      : setSelectedProcs(selectedProcs.filter((id) => id !== p.id))
                  }
                />
                {p.name} (${p.basePrice})
              </label>
            ))}
          </div>
          <div className="border rounded p-2 text-xs space-y-1">
            <p className="font-bold">Inventory</p>
            {tools?.inventory.map((i) => (
              <div key={i.id} className="flex justify-between items-center">
                <span>{i.name}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      setUsedInv({
                        ...usedInv,
                        [i.id]: Math.max(0, (usedInv[i.id] || 0) - 1),
                      })
                    }
                    className="px-1 bg-gray-100 rounded"
                  >
                    -
                  </button>
                  <span>{usedInv[i.id] || 0}</span>
                  <button
                    onClick={() =>
                      setUsedInv({ ...usedInv, [i.id]: (usedInv[i.id] || 0) + 1 })
                    }
                    className="px-1 bg-gray-100 rounded"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-pink-600 text-white py-2 rounded font-bold"
        >
          {isSaving ? "Saving..." : "Finalize Treatment"}
        </button>
        <button onClick={onClose} className="w-full text-xs text-gray-500">
          Cancel
        </button>
      </div>
    </div>
  );
}

function PatientEditForm({
  patientId,
  onClose,
}: {
  patientId: string;
  onClose?: () => void;
}) {
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [state, formAction, isPending] = useActionState(
    updatePatientRecordAction,
    { success: false }
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    Promise.all([getPatientRecord(patientId), getUserProfile(patientId)]).then(
      ([recordRes, profileRes]) => {
        if (recordRes.success) setRecord(recordRes.data || null);
        if (profileRes.success && profileRes.data)
          setDisplayName(profileRes.data.displayName || "");
        setLoading(false);
      }
    );
  }, [patientId, state.success]);

  if (loading) return <div>Loading record...</div>;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="targetUid" value={patientId} />
      <div className="grid grid-cols-2 gap-2">
        <input name="displayName" defaultValue={displayName} className="w-full p-2 border rounded text-sm" placeholder="Full Name" />
        <input name="phoneNumber" defaultValue={record?.phoneNumber} className="w-full p-2 border rounded text-sm" placeholder="Phone" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input name="dateOfBirth" type="date" defaultValue={record?.dateOfBirth} className="w-full p-2 border rounded text-sm" />
        <select name="gender" defaultValue={record?.gender || "male"} className="w-full p-2 border rounded text-sm">
          <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
        </select>
      </div>
      <input name="address" defaultValue={record?.address} className="w-full p-2 border rounded text-sm" placeholder="Address" />
      <div className="grid grid-cols-2 gap-2">
        <input name="allergies" defaultValue={record?.medicalHistory?.allergies?.join(", ")} className="w-full p-2 border rounded text-sm" placeholder="Allergies" />
        <input name="conditions" defaultValue={record?.medicalHistory?.conditions?.join(", ")} className="w-full p-2 border rounded text-sm" placeholder="Conditions" />
      </div>
      <textarea name="medications" defaultValue={record?.medicalHistory?.medications || ""} className="w-full p-2 border rounded text-sm h-12" placeholder="Medications" />
      <button disabled={isPending} className="w-full bg-green-700 text-white py-2 rounded font-bold">
        {isPending ? "Saving..." : "Save Patient Record"}
      </button>
      {state.success && <p className="text-green-600 text-xs text-center">Update Successful</p>}
      {onClose && <button type="button" onClick={onClose} className="w-full text-xs text-gray-500 mt-2">Close</button>}
    </form>
  );
}

function PatientEditModal({
  patientId,
  onClose,
}: {
  patientId: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl space-y-4">
        <h3 className="text-lg font-bold border-b pb-2">Finalize Patient Record</h3>
        <PatientEditForm patientId={patientId} onClose={onClose} />
      </div>
    </div>
  );
}

// --- MAIN SECTIONS ---

function HistorySection() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      getUserAppointments(user.uid).then((res) => {
        if (res.success) setAppointments(res.data || []);
        setLoading(false);
      });
    }
  }, [user]);

  if (loading) return <div className="text-sm text-gray-500">Loading history...</div>;

  return (
    <div className={`${styles.cardGray} space-y-4`}>
      <h3 className={styles.cardTitle}>My Appointment History</h3>
      {appointments.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No appointments booked yet.</p>
      ) : (
        <div className="space-y-3">
          {appointments.map((app) => (
            <div key={app.id} className="flex justify-between items-center p-3 border rounded bg-gray-50">
              <div>
                <p className="font-bold text-sm text-gray-800">{app.serviceType}</p>
                <p className="text-xs text-gray-600">{app.date} @ {app.time}</p>
              </div>
              <StatusBadge status={app.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BookingSection() {
  const { user } = useAuth();
  const [state, formAction, isPending] = useActionState(bookAppointmentAction, {
    success: false,
  });
  const [availability, setAvailability] = useState<CalendarAvailability | null>(null);
  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
    if (selectedDate) {
      getAvailabilityAction(selectedDate).then((data) => setAvailability(data));
    }
  }, [selectedDate]);

  return (
    <div className={`${styles.cardBlue} space-y-4`}>
      <h3 className={`${styles.cardTitle} text-blue-900`}>Book an Appointment</h3>
      <form action={formAction} className="space-y-3">
        {!user?.displayName && (
          <input name="displayName" placeholder="Your Name" required className="w-full p-2 border rounded text-sm" />
        )}
        <select name="serviceType" required className="w-full p-2 border rounded text-sm">
          <option value="">Select Service</option>
          <option value="General Checkup">General Checkup</option>
          <option value="Cleaning">Cleaning</option>
          <option value="Emergency">Emergency</option>
        </select>
        <input name="date" type="date" required className="w-full p-2 border rounded text-sm" onChange={(e) => setSelectedDate(e.target.value)} />
        {availability?.isHoliday && <p className="text-xs font-bold text-red-600 italic">Clinic Closed: {availability.holidayReason}</p>}
        <select name="time" required className="w-full p-2 border rounded text-sm" disabled={availability?.isHoliday}>
          <option value="">Select Time</option>
          {["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"].map(t => (
            <option key={t} value={t} disabled={availability?.takenSlots.includes(t)}>{t} {availability?.takenSlots.includes(t) ? "(Booked)" : ""}</option>
          ))}
        </select>
        <button disabled={isPending || availability?.isHoliday} className="w-full bg-blue-700 text-white py-2 rounded font-bold hover:bg-blue-800 disabled:opacity-50">
          {isPending ? "Processing..." : "Book Now"}
        </button>
        {state.success && <p className="text-green-600 text-sm font-bold text-center">Success!</p>}
        {state.error && <p className="text-red-600 text-sm font-bold text-center">{state.error}</p>}
      </form>
    </div>
  );
}

function PatientSection({ externalTargetUid, setExternalTargetUid }: { externalTargetUid?: string; setExternalTargetUid?: (uid: string) => void }) {
  const { user, role } = useAuth();
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [state, formAction, isPending] = useActionState(updatePatientRecordAction, { success: false });
  
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [localTargetUid, setLocalTargetUid] = useState<string>("");
  const targetUid = externalTargetUid !== undefined ? externalTargetUid : localTargetUid;
  const setTargetUid = setExternalTargetUid || setLocalTargetUid;

  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const isStaff = role && role !== "client";

  useEffect(() => {
    if (!isStaff || !searchQuery) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await searchPatients(searchQuery);
      if (res.success) setSearchResults(res.data || []);
      setShowDropdown(true);
    }, 300); 
    return () => clearTimeout(timer);
  }, [searchQuery, isStaff]);

  useEffect(() => {
    const uidToFetch = targetUid || user?.uid;
    if (uidToFetch) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(true);
      Promise.all([getPatientRecord(uidToFetch), getUserProfile(uidToFetch)]).then(([recordRes, profileRes]) => {
        if (recordRes.success) setRecord(recordRes.data || null);
        if (profileRes.success && profileRes.data) setDisplayName(profileRes.data.displayName || "");
        setLoading(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, targetUid, state.success]);

  const selectPatient = (u: UserProfile) => {
    setTargetUid(u.uid);
    setSearchQuery(u.email);
    setShowDropdown(false);
  };

  if (loading && !targetUid) return <div>Loading...</div>;

  return (
    <div className={`${styles.cardGreen} space-y-4`}>
      <h3 className={`${styles.cardTitle} text-green-900`}>Patient Record {isStaff && "(Staff View)"}</h3>
      {isStaff && (
        <div className="relative">
          <input className="w-full border p-2 text-sm rounded shadow-sm" placeholder="Search Patients..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onFocus={() => setShowDropdown(true)} />
          {showDropdown && searchResults.length > 0 && (
            <ul className="absolute z-10 w-full bg-white border rounded shadow-lg max-h-40 overflow-y-auto mt-1">
              {searchResults.map(u => (
                <li key={u.uid} className="p-2 hover:bg-green-50 cursor-pointer text-sm border-b last:border-0" onClick={() => selectPatient(u)}>
                  {u.displayName || u.email}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="targetUid" value={targetUid || user?.uid || ""} />
        <label className="block text-[10px] uppercase font-bold text-green-800">Display Name</label>
        <input name="displayName" defaultValue={displayName} key={displayName} className="w-full p-2 border rounded text-sm" />
        <label className="block text-[10px] uppercase font-bold text-green-800">Phone</label>
        <input name="phoneNumber" defaultValue={record?.phoneNumber} className="w-full p-2 border rounded text-sm" />
        {isStaff && (
          <div className="pt-2 border-t mt-2 space-y-2">
            <p className="text-[10px] text-red-700 font-bold uppercase italic">Clinical Access</p>
            <input name="dateOfBirth" type="date" defaultValue={record?.dateOfBirth} className="w-full p-2 border rounded text-sm" />
            <select name="gender" className="w-full p-2 border rounded text-sm" defaultValue={record?.gender || "male"}>
              <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
            </select>
            <input name="address" defaultValue={record?.address} className="w-full p-2 border rounded text-sm" placeholder="Address" />
            <input name="emergencyContact" placeholder="Emergency Contact" className="w-full p-2 border rounded text-sm" defaultValue={record?.emergencyContact} />
            <p className="text-xs font-bold text-green-800 mt-2">Medical History</p>
            <input name="allergies" placeholder="Allergies (comma separated)" className="w-full p-2 border rounded text-sm" defaultValue={record?.medicalHistory?.allergies?.join(", ")} />
            <input name="conditions" placeholder="Conditions (comma separated)" className="w-full p-2 border rounded text-sm" defaultValue={record?.medicalHistory?.conditions?.join(", ")} />
            <textarea name="medications" placeholder="Medications" className="w-full p-2 border rounded text-sm h-12" defaultValue={record?.medicalHistory?.medications || ""} />
          </div>
        )}
        <button disabled={isPending} className="w-full bg-green-700 text-white py-2 rounded font-bold hover:bg-green-800">Update</button>
      </form>
    </div>
  );
}

function ClinicScheduleSection() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [schedule, setSchedule] = useState<AppointmentWithPatient[]>([]);
  const [dentists, setDentists] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    getClinicScheduleAction(date).then(res => {
      if (res.success && res.data) setSchedule(res.data);
      setLoading(false);
    });
  }, [date]);

  useEffect(() => {
    refresh();
    getDentistListAction().then(res => { if (res.success && res.data) setDentists(res.data as any); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  return (
    <div className={`${styles.cardPurple} space-y-4`}>
      <div className="flex justify-between items-center">
        <h3 className={`${styles.cardTitle} text-purple-900`}>Clinic Schedule</h3>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-sm p-1 border rounded" />
      </div>
      {loading ? <p>...</p> : schedule.map(app => (
        <div key={app.id} className="p-3 bg-white rounded border space-y-2 text-sm shadow-sm">
          <div className="flex justify-between items-center">
            <span><strong>{app.time}</strong> - {app.patientName}</span>
            <button onClick={() => app.isProfileComplete ? setViewingId(app.patientId) : setEditingId(app.patientId)} 
                    className={`text-xs px-2 py-1 rounded font-bold ${app.isProfileComplete ? 'bg-purple-100' : 'bg-red-100 text-red-700'}`}>
              {app.isProfileComplete ? "View" : "⚠️ Complete"}
            </button>
          </div>
          <div className="flex gap-2">
            <select value={app.status} onChange={(e) => updateAppointmentStatusAction(app.id, e.target.value as AppointmentStatus).then(refresh)} className="text-[10px] p-1 border rounded flex-1 uppercase font-bold">
              <option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
            </select>
            <select value={app.dentistId || ""} onChange={(e) => assignDentistAction(app.id, e.target.value).then(refresh)} className="text-[10px] p-1 border rounded flex-1">
              <option value="">Assign Dentist</option>
              {dentists.map(d => <option key={d.uid} value={d.uid}>{d.displayName || d.email}</option>)}
            </select>
          </div>
        </div>
      ))}
      {viewingId && <PatientDetailsModal patientId={viewingId} onClose={() => setViewingId(null)} />}
      {editingId && <PatientEditModal patientId={editingId} onClose={() => { setEditingId(null); refresh(); }} />}
    </div>
  );
}

function ProceduresSection() {
  const [procedures, setProcedures] = useState<DentalProcedure[]>([]);
  const [state, formAction, isPending] = useActionState(createProcedureAction, { success: false });
  useEffect(() => { getAllProcedures().then(res => { if(res.success) setProcedures(res.data || []); }); }, [state.success]);
  return (
    <div className={`${styles.cardOrange} space-y-4`}>
      <h3 className={`${styles.cardTitle} text-orange-900`}>Procedures (Admin)</h3>
      <div className="max-h-32 overflow-y-auto border rounded bg-white p-2 text-xs space-y-1">
        {procedures.map(p => <div key={p.id} className="flex justify-between border-b pb-1"><span>{p.code} - {p.name}</span><span className="font-bold">${p.basePrice}</span></div>)}
      </div>
      <form action={formAction} className="space-y-2">
        <div className="flex gap-2">
          <input name="code" placeholder="Code" className="w-1/3 p-2 text-sm border rounded" required />
          <input name="name" placeholder="Name" className="w-2/3 p-2 text-sm border rounded" required />
        </div>
        <input name="basePrice" type="number" placeholder="Price" className="w-full p-2 text-sm border rounded" required />
        <button disabled={isPending} className="w-full bg-orange-700 text-white py-2 rounded font-bold">Add</button>
      </form>
    </div>
  );
}

function InventorySection() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [state, formAction, isPending] = useActionState(addInventoryItemAction, { success: false });
  const refresh = useCallback(() => { getInventory().then(res => { if(res.success) setInventory(res.data || []); }); }, []);
  useEffect(() => { refresh(); }, [state.success, refresh]);
  return (
    <div className={`${styles.cardTeal} space-y-4`}>
      <h3 className={`${styles.cardTitle} text-teal-900`}>Inventory (Staff)</h3>
      <div className="max-h-32 overflow-y-auto border rounded bg-white p-2 text-xs space-y-1">
        {inventory.map(item => (
          <div key={item.id} className="flex justify-between items-center py-1 border-b last:border-0">
            <span>{item.name} ({item.stock})</span>
            <div className="flex gap-1">
              <button onClick={() => adjustStockAction(item.id, -1).then(refresh)} className="px-2 bg-red-50 text-red-700 rounded">-</button>
              <button onClick={() => adjustStockAction(item.id, 1).then(refresh)} className="px-2 bg-green-50 text-green-700 rounded">+</button>
            </div>
          </div>
        ))}
      </div>
      <form action={formAction} className="space-y-2 border-t pt-2 mt-2">
        <input name="name" placeholder="Item Name" className="w-full p-2 text-sm border rounded" required />
        <div className="flex gap-2">
          <input name="stock" type="number" placeholder="Qty" className="w-1/2 p-2 text-sm border rounded" required />
          <input name="unit" placeholder="Unit" className="w-1/2 p-2 text-sm border rounded" required />
        </div>
        <div className="flex gap-2">
          <select name="category" className="w-1/2 p-2 text-sm border rounded"><option value="consumable">Consumable</option><option value="material">Material</option></select>
          <input name="minThreshold" type="number" placeholder="Min" className="w-1/2 p-2 text-sm border rounded" required />
        </div>
        <input name="costPerUnit" type="number" placeholder="Cost" className="w-full p-2 text-sm border rounded" required />
        <button disabled={isPending} className="w-full bg-teal-700 text-white py-2 rounded font-bold text-sm">Add Item</button>
      </form>
    </div>
  );
}

function DentistScheduleSection() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [schedule, setSchedule] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTreatment, setActiveTreatment] = useState<Appointment | null>(null);
  const refresh = useCallback(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    getDentistScheduleAction(date).then((res) => { if (res.success && res.data) setSchedule(res.data as Appointment[] || []); setLoading(false); });
  }, [date]);
  useEffect(() => { refresh(); }, [date, refresh]);
  return (
    <div className={`${styles.cardPink} space-y-4`}>
      <div className="flex justify-between items-center">
        <h3 className={`${styles.cardTitle} text-pink-900`}>My Assigned Patients</h3>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-sm p-1 border rounded" />
      </div>
      {loading ? <p>...</p> : schedule.length === 0 ? <p className="text-xs italic text-gray-500 text-center py-4">No patients today.</p> : schedule.map(app => (
        <div key={app.id} className="p-3 bg-white rounded border flex justify-between items-center text-sm shadow-sm">
          <div><p><strong>{app.time}</strong> - {app.serviceType}</p><p className="text-[10px] uppercase font-bold text-gray-400">{app.status}</p></div>
          {app.status !== 'completed' && <button onClick={() => setActiveTreatment(app)} className="bg-pink-600 text-white px-3 py-1 rounded font-bold text-xs hover:bg-pink-700 transition">Treat</button>}
        </div>
      ))}
      {activeTreatment && <TreatmentModal appointment={activeTreatment} onClose={() => setActiveTreatment(null)} onComplete={refresh} />}
    </div>
  );
}

function CreateEmployeeForm() {
  const { user } = useAuth();
  const [token, setToken] = useState("");
  const [state, formAction, isPending] = useActionState(createEmployeeAction, { success: false });
  useEffect(() => { if (user) user.getIdToken().then(setToken); }, [user]);
  return (
    <div className={`${styles.cardIndigo} space-y-3`}>
      <h3 className={`${styles.cardTitle} text-indigo-900`}>Staff HR</h3>
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="idToken" value={token} />
        <input name="displayName" placeholder="Name" required className="w-full rounded border p-2 text-sm" />
        <input name="email" type="email" placeholder="Email" required className="w-full rounded border p-2 text-sm" />
        <input name="password" type="password" placeholder="Pass" required className="w-full rounded border p-2 text-sm" />
        <select name="role" className="w-full rounded border p-2 text-sm">
          <option value="dentist">Dentist</option><option value="front-desk">Front Desk</option>
        </select>
        <button type="submit" disabled={isPending} className="w-full rounded bg-indigo-700 py-2 text-sm font-bold text-white hover:bg-indigo-800">Create Staff</button>
        {state.success && <p className="text-green-600 text-xs text-center font-bold">Account Created!</p>}
        {state.error && <p className="text-red-600 text-xs text-center font-bold">{state.error}</p>}
      </form>
    </div>
  );
}

// --- MAIN PAGE ---

export default function BackendTestPage() {
  const { user, role, loading, logout } = useAuth();
  if (loading) return <div className="p-20 text-center text-gray-500 font-bold animate-pulse">Initializing Lab Environment...</div>;
  if (!user) return (
    <div className="flex flex-col items-center py-40 gap-6">
      <h2 className="text-3xl font-black italic tracking-tighter text-gray-900 uppercase">Backend Test Lab</h2>
      <p className="text-gray-500 -mt-4 font-medium">Please sign in to access technical tools.</p>
      <div className="flex gap-4">
        <Link href="/backend-test/auth/signin" className="px-10 py-3 bg-white border border-gray-200 shadow-sm rounded-xl font-bold hover:bg-gray-50 transition">Sign In</Link>
        <Link href="/backend-test/auth/signup" className="px-10 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition">Client Sign Up</Link>
      </div>
    </div>
  );

  const isStaff = role && role !== "client";

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-black">DC</div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Active Session</p>
            <p className="font-extrabold text-gray-900">{user.email} <span className="text-blue-600 ml-1">[{role?.toUpperCase()}]</span></p>
          </div>
        </div>
        <button onClick={logout} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-black text-xs hover:bg-red-100 transition uppercase tracking-wider">Sign Out</button>
      </div>

      <div className={styles.grid}>
        {/* User Sections */}
        <div className={styles.column}>
          <BookingSection />
          <HistorySection />
        </div>

        {/* Clinical / Staff Sections */}
        <div className={styles.column}>
          <PatientSection />
          {isStaff && <InventorySection />}
        </div>

        {/* Dashboard Sections */}
        <div className={styles.column}>
          {isStaff && <ClinicScheduleSection />}
          {role === 'dentist' && <DentistScheduleSection />}
          {role === 'admin' && (
            <div className={styles.column}>
              <CreateEmployeeForm />
              <ProceduresSection />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}