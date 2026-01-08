"use client";

import { useAuth } from "@/lib/hooks/useAuth";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { createEmployeeAction } from "@/app/actions/admin-actions";
import { 
  updatePatientRecordAction 
} from "@/app/actions/auth-actions";
import {
  bookAppointmentAction, 
  getAvailabilityAction,
  CalendarAvailability
} from "@/app/actions/appointment-actions";
import { getPatientRecord } from "@/lib/services/patient-service";
import { getUserAppointments } from "@/lib/services/appointment-service";
import { searchPatients } from "@/lib/services/user-service";
import { PatientRecord } from "@/lib/types/patient";
import { Appointment } from "@/lib/types/appointment";
import { UserProfile } from "@/lib/types/user";

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

  if (loading) return <div>Loading history...</div>;

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold text-gray-900">My Appointment History</h3>
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
              <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${
                app.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
              }`}>
                {app.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BookingSection() {
  const { user } = useAuth();
  const [state, formAction, isPending] = useActionState(bookAppointmentAction, { success: false });
  const [availability, setAvailability] = useState<CalendarAvailability | null>(null);
  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
    if (selectedDate) {
      getAvailabilityAction(selectedDate).then((data) => setAvailability(data));
    }
  }, [selectedDate]);

  return (
    <div className="space-y-4 rounded-lg border border-blue-100 bg-blue-50 p-6">
      <h3 className="text-lg font-bold text-blue-900">Book an Appointment</h3>
      
      <form action={formAction} className="space-y-3">
        {!user?.displayName && (
          <input name="displayName" placeholder="Your Full Name" required className="w-full p-2 border rounded text-sm" />
        )}
        
        <select name="serviceType" required className="w-full p-2 border rounded text-sm">
          <option value="">Select Service</option>
          <option value="General Checkup">General Checkup</option>
          <option value="Cleaning">Cleaning</option>
          <option value="Tooth Extraction">Tooth Extraction</option>
          <option value="Emergency">Emergency Case</option>
        </select>

        <input 
          name="date" 
          type="date" 
          required 
          className="w-full p-2 border rounded text-sm" 
          onChange={(e) => setSelectedDate(e.target.value)}
        />

        {availability?.isHoliday && (
          <p className="text-xs font-bold text-red-600">Clinic is closed: {availability.holidayReason}</p>
        )}

        <select name="time" required className="w-full p-2 border rounded text-sm" disabled={availability?.isHoliday}>
          <option value="">Select Time</option>
          {["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"].map(t => (
            <option key={t} value={t} disabled={availability?.takenSlots.includes(t)}>
              {t} {availability?.takenSlots.includes(t) ? "(Booked)" : ""}
            </option>
          ))}
        </select>

        <textarea name="notes" placeholder="Additional notes..." className="w-full p-2 border rounded text-sm h-20" />

        <button disabled={isPending || availability?.isHoliday} className="w-full bg-blue-700 text-white py-2 rounded font-bold hover:bg-blue-800 disabled:opacity-50">
          {isPending ? "Booking..." : "Submit Booking Request"}
        </button>

        {state.success && <p className="text-green-600 text-sm font-bold text-center">Appointment requested!</p>}
        {state.error && <p className="text-red-600 text-sm font-bold text-center">{state.error}</p>}
      </form>
    </div>
  );
}

function PatientSection() {
  const { user, role } = useAuth();
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [state, formAction, isPending] = useActionState(updatePatientRecordAction, { success: false });
  
  // Search / Combobox State
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [targetUid, setTargetUid] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const isStaff = role && role !== "client";

  // Debounced Search Effect
  useEffect(() => {
    if (!isStaff || !searchQuery) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const res = await searchPatients(searchQuery);
      if (res.success) setSearchResults(res.data || []);
      setIsSearching(false);
      setShowDropdown(true);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery, isStaff]);

  // Load record when user OR targetUid changes
  useEffect(() => {
    const uidToFetch = targetUid || user?.uid;
    if (uidToFetch) {
      setLoading(true);
      getPatientRecord(uidToFetch).then((res) => {
        if (res.success) setRecord(res.data || null);
        setLoading(false);
      });
    }
  }, [user, targetUid, state.success]);

  const selectPatient = (u: UserProfile) => {
    setTargetUid(u.uid);
    setSearchQuery(u.email); // Set input to selected email
    setShowDropdown(false); // Hide list
  };

  if (loading && !targetUid) return <div>Loading record...</div>;

  return (
    <div className="space-y-4 rounded-lg border border-green-100 bg-green-50 p-6">
      <h3 className="text-lg font-bold text-green-900">Patient Record: {isStaff ? "Staff View" : "My Profile"}</h3>
      
      {isStaff && (
        <div className="relative mb-6">
          <label className="block text-xs font-bold text-gray-500 mb-1">Search Patient</label>
          <div className="relative">
            <input 
              className="w-full border p-2 text-sm rounded shadow-sm focus:ring-2 focus:ring-green-500 outline-none" 
              placeholder="Type name or email..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowDropdown(true)}
            />
            {isSearching && (
              <div className="absolute right-3 top-2.5">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-500 border-t-transparent"></div>
              </div>
            )}
          </div>

          {showDropdown && searchResults.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto">
              {searchResults.map(u => (
                <li key={u.uid} 
                    className="cursor-pointer p-2 hover:bg-green-50 text-sm border-b last:border-0"
                    onClick={() => selectPatient(u)}>
                  <div className="font-bold">{u.displayName || "Unknown Name"}</div>
                  <div className="text-xs text-gray-500">{u.email}</div>
                </li>
              ))}
            </ul>
          )}
          
          {targetUid && targetUid !== user?.uid && (
             <p className="text-xs text-green-700 mt-1 font-semibold">
               ✏️ Editing: {searchResults.find(u => u.uid === targetUid)?.displayName || targetUid}
             </p>
          )}
        </div>
      )}

      {record && (
        <div className="text-sm space-y-1 mb-4">
          <p><strong>Phone:</strong> {record.phoneNumber}</p>
          <p><strong>Status:</strong> {record.isProfileComplete ? "✅ Complete" : "⚠️ Incomplete"}</p>
        </div>
      )}
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="targetUid" value={targetUid || user?.uid || ""} />
        <label className="block text-xs font-bold text-green-800">Phone Number</label>
        <input name="phoneNumber" placeholder="Phone Number" className="w-full p-2 border rounded text-sm" defaultValue={record?.phoneNumber} />
        
        {isStaff && (
          <div className="pt-2 border-t mt-2 space-y-2">
            <p className="text-xs font-bold text-red-800 italic">Staff Only Details</p>
            <input name="dateOfBirth" type="date" className="w-full p-2 border rounded text-sm" defaultValue={record?.dateOfBirth} />
            <select name="gender" className="w-full p-2 border rounded text-sm" defaultValue={record?.gender || "male"}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
            <input name="address" placeholder="Address" className="w-full p-2 border rounded text-sm" defaultValue={record?.address} />
            <input name="emergencyContact" placeholder="Emergency Contact" className="w-full p-2 border rounded text-sm" defaultValue={record?.emergencyContact} />
            <p className="text-xs font-bold text-green-800 mt-2">Medical History</p>
            <input name="allergies" placeholder="Allergies (comma separated)" className="w-full p-2 border rounded text-sm" defaultValue={record?.medicalHistory?.allergies?.join(", ")} />
            <input name="conditions" placeholder="Conditions (comma separated)" className="w-full p-2 border rounded text-sm" defaultValue={record?.medicalHistory?.conditions?.join(", ")} />
            <textarea name="medications" placeholder="Medications" className="w-full p-2 border rounded text-sm h-16" defaultValue={record?.medicalHistory?.medications} />
          </div>
        )}

        <button disabled={isPending} className="w-full bg-green-700 text-white py-2 rounded font-bold hover:bg-green-800">
          {isPending ? "Updating..." : "Save Record"}
        </button>
      </form>
    </div>
  );
}

function CreateEmployeeForm() {
  const { user } = useAuth();
  const [token, setToken] = useState("");
  const [state, formAction, isPending] = useActionState(createEmployeeAction, { success: false });

  useEffect(() => { if (user) user.getIdToken().then(setToken); }, [user]);

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-6">
      <h3 className="mb-4 text-lg font-bold text-indigo-900">Admin: Add Employee</h3>
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="idToken" value={token} />
        <input name="displayName" placeholder="Name" required className="w-full rounded border p-2 text-sm" />
        <input name="email" type="email" placeholder="Email" required className="w-full rounded border p-2 text-sm" />
        <input name="password" type="password" placeholder="Password" required className="w-full rounded border p-2 text-sm" />
        <select name="role" className="w-full rounded border p-2 text-sm">
          <option value="dentist">Dentist</option>
          <option value="front-desk">Front Desk</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" disabled={isPending} className="w-full rounded bg-indigo-700 py-2 text-sm font-bold text-white hover:bg-indigo-800">
          {isPending ? "Creating..." : "Create Account"}
        </button>
        {state.success && <p className="text-green-600 text-xs">Success!</p>}
        {state.error && <p className="text-red-600 text-xs">{state.error}</p>}
      </form>
    </div>
  );
}

export default function BackendTestPage() {
  const { user, role, loading, logout } = useAuth();

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  if (!user) {
    return (
      <div className="flex flex-col items-center py-20 gap-4">
        <h2 className="text-2xl font-bold">Backend Test Lab</h2>
        <div className="flex gap-4">
          <Link href="/backend-test/auth/signin" className="px-6 py-2 bg-gray-200 rounded">Sign In</Link>
          <Link href="/backend-test/auth/signup" className="px-6 py-2 bg-blue-600 text-white rounded">Sign Up</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
        <div>
          <p className="text-sm text-gray-500">Logged in as</p>
          <p className="font-bold">{user.email} ({role})</p>
        </div>
        <button onClick={logout} className="text-red-600 font-bold hover:underline text-sm">Sign Out</button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <BookingSection />
        <HistorySection />
        <PatientSection />
        {role === 'admin' && <CreateEmployeeForm />}
      </div>
    </div>
  );
}