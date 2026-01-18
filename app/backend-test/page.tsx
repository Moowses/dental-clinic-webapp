"use client";

import { useAuth } from "@/lib/hooks/useAuth";
import Link from "next/link";
import { useActionState, useEffect, useState, useCallback } from "react";
import { createEmployeeAction } from "@/app/actions/admin-actions";
import { getDentistListAction } from "@/app/actions/dentist-actions";
import { updatePatientRecordAction, resendVerificationEmailAction } from "@/app/actions/auth-actions";
import {
  bookAppointmentAction,
  getAvailabilityAction,
  getClinicScheduleAction,
  getDentistScheduleAction,
  updateAppointmentStatusAction,
  assignDentistAction,
  recordPaymentAction,
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
import {
  getPatientListAction,
  submitPatientRegistrationAction,
} from "../actions/patient-actions";

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
    <span
      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${cls}`}
    >
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

  const reg = record?.registration;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl space-y-3">
        <h3 className="text-lg font-bold border-b pb-2">Patient Details</h3>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="text-sm space-y-1">
            <p>
              <strong>Name:</strong> {displayName}
            </p>
            <p>
              <strong>Phone:</strong> {reg?.contact_information?.mobile_no}
            </p>
            <p>
              <strong>Address:</strong>{" "}
              {reg?.contact_information?.home_address || "N/A"}
            </p>
            <p>
              <strong>Allergies:</strong>{" "}
              {reg?.medical_history?.allergies?.others || "None"}
            </p>
            <p>
              <strong>Conditions:</strong>{" "}
              {reg?.medical_history?.conditions_checklist?.join(", ") || "None"}
            </p>
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
                      : setSelectedProcs(
                          selectedProcs.filter((id) => id !== p.id)
                        )
                  }
                />
                {p.name} (${p.basePrice})
              </label>
            ))}
          </div>
          <div className="border rounded p-2 text-xs space-y-1">
            <p className="font-bold">Inventory</p>
            {tools?.inventory.map((i) => (
              <div
                key={i.id}
                className="flex justify-between items-center py-1 border-b last:border-0"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{i.name}</span>
                  <span className="text-[9px] text-gray-400 uppercase">
                    {i.category} | Stock: {i.stock}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      setUsedInv({
                        ...usedInv,
                        [i.id]: Math.max(0, (usedInv[i.id] || 0) - 1),
                      })
                    }
                    className="px-1.5 py-0.5 bg-gray-100 rounded hover:bg-gray-200"
                  >
                    -
                  </button>
                  <span className="w-4 text-center font-bold">
                    {usedInv[i.id] || 0}
                  </span>
                  <button
                    onClick={() =>
                      setUsedInv({
                        ...usedInv,
                        [i.id]: (usedInv[i.id] || 0) + 1,
                      })
                    }
                    className="px-1.5 py-0.5 bg-gray-100 rounded hover:bg-gray-200"
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

function PaymentModal({
  appointment,
  onClose,
  onComplete,
}: {
  appointment: Appointment;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [method, setMethod] = useState("cash");
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    await recordPaymentAction(appointment.id, method);
    onComplete();
    onClose();
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl space-y-4">
        <h3 className="text-lg font-bold border-b pb-2 text-gray-900">
          Process Payment
        </h3>

        <div className="bg-gray-50 p-3 rounded border text-xs space-y-2 text-gray-800">
          <p className="font-bold text-sm border-b pb-1 text-gray-900">
            Bill Details
          </p>

          <div className="space-y-1">
            <p className="font-bold text-gray-500 text-[10px] uppercase">
              Procedures
            </p>
            {appointment.treatment?.procedures.map((p, idx) => (
              <div key={idx} className="flex justify-between">
                <span>{p.name}</span>
                <span className="font-medium">${p.price}</span>
              </div>
            ))}
          </div>

          {(appointment.treatment?.inventoryUsed?.length ?? 0) > 0 && (
            <div className="space-y-1 pt-2 border-t border-gray-200">
              <p className="font-bold text-gray-500 text-[10px] uppercase">
                Materials Used
              </p>
              {appointment.treatment?.inventoryUsed.map((i, idx) => (
                <div key={idx} className="flex justify-between text-gray-500">
                  <span>{i.name}</span>
                  <span>x{i.quantity}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between border-t border-gray-300 pt-2 mt-2 text-base font-bold text-gray-900">
            <span>Total Bill</span>
            <span>${appointment.treatment?.totalBill || 0}</span>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500">
            Payment Method
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full p-2 border rounded text-sm text-gray-900"
          >
            <option value="cash">Cash</option>
            <option value="card">Credit Card</option>
            <option value="insurance">Insurance</option>
          </select>
        </div>

        <button
          disabled={loading}
          onClick={handlePayment}
          className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700"
        >
          {loading ? "Processing..." : "Confirm Payment"}
        </button>
        <button
          onClick={onClose}
          className="w-full text-xs text-gray-500 hover:text-gray-700"
        >
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
  const { user } = useAuth();
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ success: boolean; message?: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([getPatientRecord(patientId), getUserProfile(patientId)]).then(
      ([recordRes, profileRes]) => {
        if (recordRes.success) setRecord(recordRes.data || null);
        if (profileRes.success && profileRes.data)
          setDisplayName(profileRes.data.displayName || "");
        setLoading(false);
      }
    );
  }, [patientId]);

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);

    // Construct the nested structure for the new schema
    const structuredData: any = {
      personal_information: {
        name: {
          first_name: data.firstName || "",
          last_name: data.lastName || "",
          middle_initial: data.middleInitial || ""
        },
        nickname: data.nickname || "",
        birthdate: data.dateOfBirth || "",
        sex: data.sex || "male",
        religion: data.religion || "",
        nationality: data.nationality || "",
        effective_date: new Date().toISOString().split('T')[0]
      },
      contact_information: {
        home_address: data.address || "",
        home_no: data.homeNo || "",
        mobile_no: data.phoneNumber || "",
        office_no: data.officeNo || "",
        fax_no: data.faxNo || "",
        email_address: data.emailAddress || record?.registration?.contact_information?.email_address || ""
      },
      employment_information: {
        occupation: data.occupation || ""
      },
      minor_details: {
        is_minor: data.isMinor === "on",
        parent_guardian_name: data.guardianName || "",
        parent_guardian_occupation: data.guardianOccupation || ""
      },
      dental_history: {
        previous_dentist: data.previousDentist || "",
        last_dental_visit: data.lastDentalVisit || ""
      },
      referral_details: {
        referred_by: data.referredBy || "",
        reason_for_consultation: data.consultationReason || ""
      },
      medical_history: {
        physician: {
          name: data.physicianName || "",
          specialty: data.physicianSpecialty || "",
          office_address: data.physicianOffice || "",
          office_number: data.physicianNumber || ""
        },
        vitals: {
          blood_type: data.bloodType || "",
          blood_pressure: data.bloodPressure || "",
          bleeding_time: data.bleedingTime || ""
        },
        general_health_screening: {
          in_good_health: data.inGoodHealth === "on",
          under_medical_condition: {
            status: data.underMedicalCondition === "on",
            condition_description: data.conditionDesc || ""
          },
          serious_illness_or_surgery: {
            status: data.seriousIllness === "on",
            details: data.illnessDetails || ""
          },
          hospitalized: {
            status: data.hospitalized === "on",
            when_and_why: data.hospitalizedDetails || ""
          },
          taking_medication: {
            status: data.takingMeds === "on",
            medication_list: data.medicationList || ""
          },
          uses_tobacco: data.usesTobacco === "on",
          uses_alcohol_or_drugs: data.usesDrugs === "on"
        },
        allergies: {
          local_anesthetic: data.allergyAnaesthetic === "on",
          penicillin_antibiotics: data.allergyPenicillin === "on",
          sulfa_drugs: data.allergySulfa === "on",
          aspirin: data.allergyAspirin === "on",
          latex: data.allergyLatex === "on",
          others: data.allergyOthers || ""
        },
        women_only: {
          is_pregnant: data.isPregnant === "on",
          is_nursing: data.isNursing === "on",
          taking_birth_control: data.birthControl === "on"
        },
        conditions_checklist: (data.conditions as string)?.split(",").map(s => s.trim()).filter(Boolean) || []
      },
      authorization: record?.registration?.authorization || { signature_present: false }
    };

    const res = await submitPatientRegistrationAction(patientId, structuredData);
    setIsSaving(false);
    if (res.success) {
      setStatus({ success: true });
      if (onClose) setTimeout(onClose, 1000);
    } else {
      setStatus({ success: false, message: res.error });
    }
  };

  if (loading) return <div>Loading record...</div>;

  const reg = record?.registration;

  return (
    <form onSubmit={handleUpdate} className="space-y-3 max-h-[60vh] overflow-y-auto p-1">
      <input type="hidden" name="targetUid" value={patientId} />
      
      {/* Name Section */}
      <div className="grid grid-cols-4 gap-2">
        <input name="firstName" defaultValue={reg?.personal_information?.name?.first_name || displayName.split(" ")[0]} className="col-span-2 w-full p-2 border rounded text-sm" placeholder="First Name" required />
        <input name="middleInitial" defaultValue={reg?.personal_information?.name?.middle_initial} className="w-full p-2 border rounded text-sm" placeholder="M.I." />
        <input name="lastName" defaultValue={reg?.personal_information?.name?.last_name || displayName.split(" ").slice(1).join(" ")} className="w-full p-2 border rounded text-sm" placeholder="Last Name" required />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input name="phoneNumber" defaultValue={reg?.contact_information?.mobile_no} className="w-full p-2 border rounded text-sm" placeholder="Mobile No." />
        <input name="homeNo" defaultValue={reg?.contact_information?.home_no} className="w-full p-2 border rounded text-sm" placeholder="Home No." />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input name="officeNo" defaultValue={reg?.contact_information?.office_no} className="w-full p-2 border rounded text-sm" placeholder="Office No." />
        <input name="faxNo" defaultValue={reg?.contact_information?.fax_no} className="w-full p-2 border rounded text-sm" placeholder="Fax No." />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input name="occupation" defaultValue={reg?.employment_information?.occupation} className="w-full p-2 border rounded text-sm" placeholder="Occupation" />
        <input name="nationality" defaultValue={reg?.personal_information?.nationality} className="w-full p-2 border rounded text-sm" placeholder="Nationality" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <input name="dateOfBirth" type="date" defaultValue={reg?.personal_information?.birthdate} className="w-full p-2 border rounded text-sm" />
        <select name="sex" defaultValue={reg?.personal_information?.sex || "male"} className="w-full p-2 border rounded text-sm">
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
        <input name="religion" defaultValue={reg?.personal_information?.religion} className="w-full p-2 border rounded text-sm" placeholder="Religion" />
      </div>

      <input name="address" defaultValue={reg?.contact_information?.home_address} className="w-full p-2 border rounded text-sm" placeholder="Home Address" />

      {/* Guardian & Dental */}
      <div className="bg-gray-50 p-2 rounded border border-gray-200 space-y-2">
        <p className="text-xs font-bold text-gray-500 uppercase">Guardian & Dental</p>
        <div className="flex items-center gap-2">
          <input type="checkbox" name="isMinor" defaultChecked={reg?.minor_details?.is_minor} />
          <label className="text-xs">Is Minor</label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input name="guardianName" defaultValue={reg?.minor_details?.parent_guardian_name} className="w-full p-1 border rounded text-xs" placeholder="Guardian Name" />
          <input name="guardianOccupation" defaultValue={reg?.minor_details?.parent_guardian_occupation} className="w-full p-1 border rounded text-xs" placeholder="Guardian Job" />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <input name="previousDentist" defaultValue={reg?.dental_history?.previous_dentist} className="w-full p-1 border rounded text-xs" placeholder="Prev Dentist" />
          <input name="lastDentalVisit" defaultValue={reg?.dental_history?.last_dental_visit} className="w-full p-1 border rounded text-xs" placeholder="Last Visit" />
        </div>
      </div>

      {/* Clinical Info */}
      <div className="bg-red-50 p-2 rounded border border-red-100 space-y-2">
        <p className="text-xs font-bold text-red-800 uppercase">Medical History</p>
        
        {/* Physician */}
        <div className="grid grid-cols-2 gap-2">
          <input name="physicianName" defaultValue={reg?.medical_history?.physician?.name} className="w-full p-1 border rounded text-xs" placeholder="Physician Name" />
          <input name="physicianNumber" defaultValue={reg?.medical_history?.physician?.office_number} className="w-full p-1 border rounded text-xs" placeholder="Physician No." />
        </div>

        {/* Vitals */}
        <div className="grid grid-cols-3 gap-2">
          <input name="bloodType" defaultValue={reg?.medical_history?.vitals?.blood_type} className="w-full p-1 border rounded text-xs" placeholder="Blood Type" />
          <input name="bloodPressure" defaultValue={reg?.medical_history?.vitals?.blood_pressure} className="w-full p-1 border rounded text-xs" placeholder="BP" />
          <input name="bleedingTime" defaultValue={reg?.medical_history?.vitals?.bleeding_time} className="w-full p-1 border rounded text-xs" placeholder="Bleeding Time" />
        </div>

        {/* Screening Toggles */}
        <div className="grid grid-cols-2 gap-1 text-xs">
          <label className="flex gap-1"><input type="checkbox" name="inGoodHealth" defaultChecked={reg?.medical_history?.general_health_screening?.in_good_health || false} /> Good Health?</label>
          <div className="flex flex-col gap-1">
             <label className="flex gap-1"><input type="checkbox" name="underMedicalCondition" defaultChecked={reg?.medical_history?.general_health_screening?.under_medical_condition?.status || false} /> Under Treatment</label>
             <input name="conditionDesc" defaultValue={reg?.medical_history?.general_health_screening?.under_medical_condition?.condition_description} className="w-full p-1 border rounded text-[10px]" placeholder="Condition..." />
          </div>
          <div className="flex flex-col gap-1">
             <label className="flex gap-1"><input type="checkbox" name="seriousIllness" defaultChecked={reg?.medical_history?.general_health_screening?.serious_illness_or_surgery?.status || false} /> Serious Illness</label>
             <input name="illnessDetails" defaultValue={reg?.medical_history?.general_health_screening?.serious_illness_or_surgery?.details} className="w-full p-1 border rounded text-[10px]" placeholder="Details..." />
          </div>
          <div className="flex flex-col gap-1">
             <label className="flex gap-1"><input type="checkbox" name="hospitalized" defaultChecked={reg?.medical_history?.general_health_screening?.hospitalized?.status || false} /> Hospitalized</label>
             <input name="hospitalizedDetails" defaultValue={reg?.medical_history?.general_health_screening?.hospitalized?.when_and_why} className="w-full p-1 border rounded text-[10px]" placeholder="Why..." />
          </div>
          <div className="flex flex-col gap-1">
             <label className="flex gap-1"><input type="checkbox" name="takingMeds" defaultChecked={reg?.medical_history?.general_health_screening?.taking_medication?.status || false} /> Taking Meds</label>
             <input name="medicationList" defaultValue={reg?.medical_history?.general_health_screening?.taking_medication?.medication_list} className="w-full p-1 border rounded text-[10px]" placeholder="List..." />
          </div>
          <label className="flex gap-1"><input type="checkbox" name="usesTobacco" defaultChecked={reg?.medical_history?.general_health_screening?.uses_tobacco || false} /> Smoker</label>
          <label className="flex gap-1"><input type="checkbox" name="usesDrugs" defaultChecked={reg?.medical_history?.general_health_screening?.uses_alcohol_or_drugs || false} /> Alcohol/Drugs</label>
        </div>

        {/* Women Only */}
        <div className="bg-pink-50 p-2 rounded border border-pink-100">
          <p className="font-bold text-[10px] text-pink-500 mb-1">Women Only</p>
          <div className="flex gap-2 text-xs flex-wrap">
            <label className="flex gap-1"><input type="checkbox" name="isPregnant" defaultChecked={reg?.medical_history?.women_only?.is_pregnant || false} /> Pregnant</label>
            <label className="flex gap-1"><input type="checkbox" name="isNursing" defaultChecked={reg?.medical_history?.women_only?.is_nursing || false} /> Nursing</label>
            <label className="flex gap-1"><input type="checkbox" name="birthControl" defaultChecked={reg?.medical_history?.women_only?.taking_birth_control || false} /> Birth Control</label>
          </div>
        </div>

        <input name="allergyOthers" defaultValue={reg?.medical_history?.allergies?.others} className="w-full p-1 border rounded text-xs" placeholder="Allergies (Text)" />
        <textarea name="conditions" defaultValue={reg?.medical_history?.conditions_checklist?.join(", ")} className="w-full p-1 border rounded text-xs h-10" placeholder="Conditions (comma separated)" />
      </div>

      <button disabled={isSaving} className={`w-full text-white py-2 rounded font-bold ${isSaving ? 'bg-gray-400' : 'bg-green-700'}`}>
        {isSaving ? "Saving..." : "Save Patient Record"}
      </button>
      
      {status && (
        <p className={`text-center text-xs ${status.success ? 'text-green-600' : 'text-red-600'}`}>
          {status.success ? "Update Successful" : status.message}
        </p>
      )}
      
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
        <h3 className="text-lg font-bold border-b pb-2">
          Finalize Patient Record
        </h3>
        <PatientEditForm patientId={patientId} onClose={onClose} />
      </div>
    </div>
  );
}

// --- VERIFICATION TEST SECTION ---

function VerificationTestSection() {
  const { user } = useAuth();
  const [status, setStatus] = useState<{ loading: boolean; message: string | null }>({
    loading: false,
    message: null,
  });

  const handleResend = async () => {
    setStatus({ loading: true, message: "Sending..." });
    const res = await resendVerificationEmailAction();
    if (res.success) {
      setStatus({ loading: false, message: "✅ Verification email sent! Check your inbox." });
    } else {
      setStatus({ loading: false, message: "❌ Error: " + res.error });
    }
  };

  if (!user) return null;

  return (
    <div className="mb-6 p-4 bg-amber-900 text-white rounded-xl shadow-lg border border-amber-500/30">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-amber-200 uppercase tracking-widest text-xs">
          Email Verification Status
        </h3>
        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${user.emailVerified ? 'bg-green-500 text-white' : 'bg-red-500 text-white animate-pulse'}`}>
          {user.emailVerified ? "Verified" : "Unverified"}
        </span>
      </div>
      
      {!user.emailVerified && (
        <div className="space-y-3">
          <p className="text-[10px] text-amber-100 opacity-80 leading-relaxed">
            Your email is not verified. You can trigger a new verification link using the button below. 
            Firebase will send a magic link to <strong>{user.email}</strong>.
          </p>
          <button 
            onClick={handleResend}
            disabled={status.loading}
            className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-amber-800 text-white py-2 rounded font-bold text-xs transition"
          >
            {status.loading ? "Processing..." : "Resend Verification Email"}
          </button>
        </div>
      )}

      {status.message && (
        <p className="mt-2 text-[10px] text-center font-mono font-bold italic">
          {status.message}
        </p>
      )}
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

  if (loading)
    return <div className="text-sm text-gray-500">Loading history...</div>;

  return (
    <div className={`${styles.cardGray} space-y-4`}>
      <h3 className={styles.cardTitle}>My Appointment History</h3>
      {appointments.length === 0 ? (
        <p className="text-sm text-gray-500 italic">
          No appointments booked yet.
        </p>
      ) : (
        <div className="space-y-3">
          {appointments.map((app) => (
            <div
              key={app.id}
              className="flex justify-between items-center p-3 border rounded bg-gray-50"
            >
              <div>
                <p className="font-bold text-sm text-gray-800">
                  {app.serviceType}
                </p>
                <p className="text-xs text-gray-600">
                  {app.date} @ {app.time}
                </p>
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
  const [availability, setAvailability] = useState<CalendarAvailability | null>(
    null
  );
  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
    if (selectedDate) {
      getAvailabilityAction(selectedDate).then((data) => setAvailability(data));
    }
  }, [selectedDate]);

  return (
    <div className={`${styles.cardBlue} space-y-4`}>
      <h3 className={`${styles.cardTitle} text-blue-900`}>
        Book an Appointment
      </h3>
      <form action={formAction} className="space-y-3">
        {!user?.displayName && (
          <input
            name="displayName"
            placeholder="Your Name"
            required
            className="w-full p-2 border rounded text-sm"
          />
        )}
        <select
          name="serviceType"
          required
          className="w-full p-2 border rounded text-sm"
        >
          <option value="">Select Service</option>
          <option value="General Checkup">General Checkup</option>
          <option value="Cleaning">Cleaning</option>
          <option value="Emergency">Emergency</option>
        </select>
        <input
          name="date"
          type="date"
          required
          className="w-full p-2 border rounded text-sm"
          onChange={(e) => setSelectedDate(e.target.value)}
        />
        {availability?.isHoliday && (
          <p className="text-xs font-bold text-red-600 italic">
            Clinic Closed: {availability.holidayReason}
          </p>
        )}
        <select
          name="time"
          required
          className="w-full p-2 border rounded text-sm"
          disabled={availability?.isHoliday}
        >
          <option value="">Select Time</option>
          {[
            "08:00",
            "09:00",
            "10:00",
            "11:00",
            "13:00",
            "14:00",
            "15:00",
            "16:00",
          ].map((t) => (
            <option
              key={t}
              value={t}
              disabled={availability?.takenSlots.includes(t)}
            >
              {t} {availability?.takenSlots.includes(t) ? "(Booked)" : ""}
            </option>
          ))}
        </select>
        <button
          disabled={isPending || availability?.isHoliday}
          className="w-full bg-blue-700 text-white py-2 rounded font-bold hover:bg-blue-800 disabled:opacity-50"
        >
          {isPending ? "Processing..." : "Book Now"}
        </button>
        {state.success && (
          <p className="text-green-600 text-sm font-bold text-center">
            Success!
          </p>
        )}
        {state.error && (
          <p className="text-red-600 text-sm font-bold text-center">
            {state.error}
          </p>
        )}
      </form>
    </div>
  );
}

function PatientSection({
  externalTargetUid,
  setExternalTargetUid,
}: {
  externalTargetUid?: string;
  setExternalTargetUid?: (uid: string) => void;
}) {
  const { user, role } = useAuth();
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{
    success: boolean;
    message?: string;
  } | null>(null);

  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [localTargetUid, setLocalTargetUid] = useState<string>("");
  const targetUid =
    externalTargetUid !== undefined ? externalTargetUid : localTargetUid;
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
      Promise.all([
        getPatientRecord(uidToFetch),
        getUserProfile(uidToFetch),
      ]).then(([recordRes, profileRes]) => {
        if (recordRes.success) setRecord(recordRes.data || null);
        if (profileRes.success && profileRes.data)
          setDisplayName(profileRes.data.displayName || "");
        setLoading(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, targetUid, status?.success]);

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!targetUid && !user?.uid) return;

    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);

    // Construct the nested structure for the new schema
    const structuredData: any = {
      personal_information: {
        name: {
          first_name: data.firstName || "",
          last_name: data.lastName || "",
          middle_initial: data.middleInitial || ""
        },
        nickname: data.nickname || "",
        birthdate: data.birthdate || "",
        sex: data.sex || "",
        religion: data.religion || "",
        nationality: data.nationality || "",
        effective_date: new Date().toISOString().split('T')[0]
      },
      contact_information: {
        home_address: data.address || "",
        home_no: data.homeNo || "",
        mobile_no: data.mobileNo || "",
        office_no: data.officeNo || "",
        fax_no: data.faxNo || "",
        email_address: record?.registration?.contact_information?.email_address || user?.email || ""
      },
      employment_information: {
        occupation: data.occupation || ""
      },
      minor_details: {
        is_minor: data.isMinor === "on",
        parent_guardian_name: data.guardianName || "",
        parent_guardian_occupation: data.guardianOccupation || ""
      },
      dental_history: {
        previous_dentist: data.previousDentist || "",
        last_dental_visit: data.lastDentalVisit || ""
      },
      referral_details: {
        referred_by: data.referredBy || "",
        reason_for_consultation: data.consultationReason || ""
      },
      medical_history: {
        physician: {
          name: data.physicianName || "",
          specialty: data.physicianSpecialty || "",
          office_address: data.physicianOffice || "",
          office_number: data.physicianNumber || ""
        },
        vitals: {
          blood_type: data.bloodType || "",
          blood_pressure: data.bloodPressure || "",
          bleeding_time: data.bleedingTime || ""
        },
        general_health_screening: {
          in_good_health: data.inGoodHealth === "on",
          under_medical_condition: {
            status: data.underMedicalCondition === "on",
            condition_description: data.conditionDesc || ""
          },
          serious_illness_or_surgery: {
            status: data.seriousIllness === "on",
            details: data.illnessDetails || ""
          },
          hospitalized: {
            status: data.hospitalized === "on",
            when_and_why: data.hospitalizedDetails || ""
          },
          taking_medication: {
            status: data.takingMeds === "on",
            medication_list: data.medicationList || ""
          },
          uses_tobacco: data.usesTobacco === "on",
          uses_alcohol_or_drugs: data.usesDrugs === "on"
        },
        allergies: {
          local_anesthetic: data.allergyAnaesthetic === "on",
          penicillin_antibiotics: data.allergyPenicillin === "on",
          sulfa_drugs: data.allergySulfa === "on",
          aspirin: data.allergyAspirin === "on",
          latex: data.allergyLatex === "on",
          others: data.allergyOthers || ""
        },
        women_only: {
          is_pregnant: data.isPregnant === "on",
          is_nursing: data.isNursing === "on",
          taking_birth_control: data.birthControl === "on"
        },
        conditions_checklist: (data.conditions as string)?.split(",").map(s => s.trim()).filter(Boolean) || []
      }
    };

    const res = await submitPatientRegistrationAction(
      targetUid || user!.uid,
      structuredData
    );
    setIsSaving(false);
    setStatus({ success: res.success, message: res.error });
  };

  const selectPatient = (u: UserProfile) => {
    setTargetUid(u.uid);
    setSearchQuery(u.email);
    setShowDropdown(false);
  };

  if (loading && !targetUid) return <div>Loading...</div>;

  const reg = record?.registration;

  return (
    <div className={`${styles.cardGreen} space-y-4`}>
      <h3 className={`${styles.cardTitle} text-green-900`}>
        Patient Record {isStaff && "(Staff View)"}
      </h3>
      {isStaff && (
        <div className="relative">
          <input
            className="w-full border p-2 text-sm rounded shadow-sm"
            placeholder="Search Patients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowDropdown(true)}
          />
          {showDropdown && searchResults.length > 0 && (
            <ul className="absolute z-10 w-full bg-white border rounded shadow-lg max-h-40 overflow-y-auto mt-1">
              {searchResults.map((u) => (
                <li
                  key={u.uid}
                  className="p-2 hover:bg-green-50 cursor-pointer text-sm border-b last:border-0"
                  onClick={() => selectPatient(u)}
                >
                  {u.displayName || u.email}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <form onSubmit={handleUpdate} className="space-y-4">
        <input
          type="hidden"
          name="targetUid"
          value={targetUid || user?.uid || ""}
        />
        
        <div className="bg-white p-3 rounded border space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b pb-1">Personal Information</p>
          <div className="grid grid-cols-4 gap-2">
            <input name="firstName" defaultValue={reg?.personal_information?.name?.first_name || displayName.split(" ")[0]} className="col-span-2 w-full p-2 border rounded text-sm" placeholder="First Name" required />
            <input name="middleInitial" defaultValue={reg?.personal_information?.name?.middle_initial} className="w-full p-2 border rounded text-sm" placeholder="M.I." />
            <input name="lastName" defaultValue={reg?.personal_information?.name?.last_name || displayName.split(" ").slice(1).join(" ")} className="w-full p-2 border rounded text-sm" placeholder="Last Name" required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input name="nickname" defaultValue={reg?.personal_information?.nickname} className="w-full p-2 border rounded text-sm" placeholder="Nickname" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input name="birthdate" type="date" defaultValue={reg?.personal_information?.birthdate} className="w-full p-2 border rounded text-sm" />
            <select name="sex" className="w-full p-2 border rounded text-sm" defaultValue={reg?.personal_information?.sex || ""}>
              <option value="">Sex</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            <input name="nationality" defaultValue={reg?.personal_information?.nationality} className="w-full p-2 border rounded text-sm" placeholder="Nationality" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input name="religion" defaultValue={reg?.personal_information?.religion} className="w-full p-2 border rounded text-sm" placeholder="Religion" />
            <input name="occupation" defaultValue={reg?.employment_information?.occupation} className="w-full p-2 border rounded text-sm" placeholder="Occupation" />
          </div>
        </div>

        <div className="bg-white p-3 rounded border space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b pb-1">Contact Details</p>
          <input name="address" defaultValue={reg?.contact_information?.home_address} className="w-full p-2 border rounded text-sm" placeholder="Home Address" />
          <div className="grid grid-cols-2 gap-2">
            <input name="mobileNo" defaultValue={reg?.contact_information?.mobile_no} className="w-full p-2 border rounded text-sm" placeholder="Mobile No." />
            <input name="homeNo" defaultValue={reg?.contact_information?.home_no} className="w-full p-2 border rounded text-sm" placeholder="Home No." />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input name="officeNo" defaultValue={reg?.contact_information?.office_no} className="w-full p-2 border rounded text-sm" placeholder="Office No." />
            <input name="faxNo" defaultValue={reg?.contact_information?.fax_no} className="w-full p-2 border rounded text-sm" placeholder="Fax No." />
          </div>
        </div>

        {/* --- GUARDIAN & DENTAL --- */}
        <div className="bg-white p-3 rounded border space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b pb-1">Guardian & Dental History</p>
          <div className="flex items-center gap-2 mb-2">
            <input type="checkbox" name="isMinor" defaultChecked={reg?.minor_details?.is_minor} />
            <label className="text-sm font-medium">Patient is a Minor</label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input name="guardianName" defaultValue={reg?.minor_details?.parent_guardian_name} className="w-full p-2 border rounded text-sm" placeholder="Guardian Name" />
            <input name="guardianOccupation" defaultValue={reg?.minor_details?.parent_guardian_occupation} className="w-full p-2 border rounded text-sm" placeholder="Guardian Occupation" />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t">
            <input name="previousDentist" defaultValue={reg?.dental_history?.previous_dentist} className="w-full p-2 border rounded text-sm" placeholder="Previous Dentist" />
            <input name="lastDentalVisit" defaultValue={reg?.dental_history?.last_dental_visit} className="w-full p-2 border rounded text-sm" placeholder="Last Visit (Date/Note)" />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
             <input name="referredBy" defaultValue={reg?.referral_details?.referred_by} className="w-full p-2 border rounded text-sm" placeholder="Referred By" />
             <input name="consultationReason" defaultValue={reg?.referral_details?.reason_for_consultation} className="w-full p-2 border rounded text-sm" placeholder="Reason for Consultation" />
          </div>
        </div>

        {/* --- MEDICAL HISTORY --- */}
        {isStaff && (
          <div className="bg-red-50 p-3 rounded border border-red-100 space-y-3">
            <p className="text-xs font-bold text-red-800 uppercase tracking-wide border-b border-red-200 pb-1">Medical History (Clinical)</p>
            
            {/* Physician */}
            <div className="grid grid-cols-2 gap-2">
              <input name="physicianName" defaultValue={reg?.medical_history?.physician?.name} className="w-full p-2 border rounded text-sm" placeholder="Physician Name" />
              <input name="physicianSpecialty" defaultValue={reg?.medical_history?.physician?.specialty} className="w-full p-2 border rounded text-sm" placeholder="Specialty" />
              <input name="physicianOffice" defaultValue={reg?.medical_history?.physician?.office_address} className="w-full p-2 border rounded text-sm" placeholder="Office Address" />
              <input name="physicianNumber" defaultValue={reg?.medical_history?.physician?.office_number} className="w-full p-2 border rounded text-sm" placeholder="Office No." />
            </div>

            {/* Health Screening Questions */}
            <div className="space-y-2 text-sm bg-white p-2 rounded">
              <p className="font-bold text-xs text-gray-500">General Screening</p>
              <label className="flex gap-2"><input type="checkbox" name="inGoodHealth" defaultChecked={reg?.medical_history?.general_health_screening?.in_good_health || false} /> In good health?</label>
              
              <div className="border-t pt-1">
                <label className="flex gap-2"><input type="checkbox" name="underMedicalCondition" defaultChecked={reg?.medical_history?.general_health_screening?.under_medical_condition?.status || false} /> Under medical treatment?</label>
                <input name="conditionDesc" defaultValue={reg?.medical_history?.general_health_screening?.under_medical_condition?.condition_description} className="w-full p-1 border rounded text-xs mt-1" placeholder="Condition details..." />
              </div>

              <div className="border-t pt-1">
                <label className="flex gap-2"><input type="checkbox" name="seriousIllness" defaultChecked={reg?.medical_history?.general_health_screening?.serious_illness_or_surgery?.status || false} /> Serious illness/surgery?</label>
                <input name="illnessDetails" defaultValue={reg?.medical_history?.general_health_screening?.serious_illness_or_surgery?.details} className="w-full p-1 border rounded text-xs mt-1" placeholder="Details..." />
              </div>

              <div className="border-t pt-1">
                <label className="flex gap-2"><input type="checkbox" name="hospitalized" defaultChecked={reg?.medical_history?.general_health_screening?.hospitalized?.status || false} /> Hospitalized recently?</label>
                <input name="hospitalizedDetails" defaultValue={reg?.medical_history?.general_health_screening?.hospitalized?.when_and_why} className="w-full p-1 border rounded text-xs mt-1" placeholder="When and why..." />
              </div>

              <div className="border-t pt-1">
                <label className="flex gap-2"><input type="checkbox" name="takingMeds" defaultChecked={reg?.medical_history?.general_health_screening?.taking_medication?.status || false} /> Taking medication?</label>
                <textarea name="medicationList" defaultValue={reg?.medical_history?.general_health_screening?.taking_medication?.medication_list} className="w-full p-1 border rounded text-xs mt-1 h-10" placeholder="List medications..." />
              </div>

              <div className="flex gap-4 border-t pt-1">
                <label className="flex gap-2"><input type="checkbox" name="usesTobacco" defaultChecked={reg?.medical_history?.general_health_screening?.uses_tobacco || false} /> Uses Tobacco</label>
                <label className="flex gap-2"><input type="checkbox" name="usesDrugs" defaultChecked={reg?.medical_history?.general_health_screening?.uses_alcohol_or_drugs || false} /> Alcohol/Drugs</label>
              </div>
            </div>

            {/* Allergies */}
            <div className="bg-white p-2 rounded">
              <p className="font-bold text-xs text-gray-500 mb-1">Allergies</p>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <label className="flex gap-1"><input type="checkbox" name="allergyAnaesthetic" defaultChecked={reg?.medical_history?.allergies?.local_anesthetic} /> Local Anaesthetic</label>
                <label className="flex gap-1"><input type="checkbox" name="allergyPenicillin" defaultChecked={reg?.medical_history?.allergies?.penicillin_antibiotics} /> Penicillin</label>
                <label className="flex gap-1"><input type="checkbox" name="allergySulfa" defaultChecked={reg?.medical_history?.allergies?.sulfa_drugs} /> Sulfa Drugs</label>
                <label className="flex gap-1"><input type="checkbox" name="allergyAspirin" defaultChecked={reg?.medical_history?.allergies?.aspirin} /> Aspirin</label>
                <label className="flex gap-1"><input type="checkbox" name="allergyLatex" defaultChecked={reg?.medical_history?.allergies?.latex} /> Latex</label>
              </div>
              <input name="allergyOthers" defaultValue={reg?.medical_history?.allergies?.others} className="w-full p-1 border rounded text-xs mt-1" placeholder="Other allergies..." />
            </div>

            {/* Vitals */}
            <div className="grid grid-cols-3 gap-2">
              <input name="bloodType" defaultValue={reg?.medical_history?.vitals?.blood_type} className="w-full p-2 border rounded text-sm" placeholder="Blood Type" />
              <input name="bloodPressure" defaultValue={reg?.medical_history?.vitals?.blood_pressure} className="w-full p-2 border rounded text-sm" placeholder="BP" />
              <input name="bleedingTime" defaultValue={reg?.medical_history?.vitals?.bleeding_time} className="w-full p-2 border rounded text-sm" placeholder="Bleeding Time" />
            </div>

            {/* Women Only */}
            <div className="bg-pink-50 p-2 rounded border border-pink-100">
              <p className="font-bold text-xs text-pink-500 mb-1">For Women Only</p>
              <div className="flex gap-4 text-xs">
                <label className="flex gap-1"><input type="checkbox" name="isPregnant" defaultChecked={reg?.medical_history?.women_only?.is_pregnant || false} /> Pregnant</label>
                <label className="flex gap-1"><input type="checkbox" name="isNursing" defaultChecked={reg?.medical_history?.women_only?.is_nursing || false} /> Nursing</label>
                <label className="flex gap-1"><input type="checkbox" name="birthControl" defaultChecked={reg?.medical_history?.women_only?.taking_birth_control || false} /> Birth Control</label>
              </div>
            </div>

            <textarea
              name="conditions"
              placeholder="Conditions Checklist (comma separated for now)"
              className="w-full p-2 border rounded text-sm h-12"
              defaultValue={reg?.medical_history?.conditions_checklist?.join(", ")}
            />
          </div>
        )}

        <button
          disabled={isSaving}
          className={`w-full text-white py-3 rounded font-bold transition shadow-sm ${isSaving ? 'bg-gray-400' : 'bg-green-700 hover:bg-green-800'}`}
        >
          {isSaving ? "Saving Comprehensive Record..." : "Update Full Record"}
        </button>
        {status && (
          <p className={`text-center text-[10px] font-bold mt-1 ${status.success ? 'text-green-600' : 'text-red-600'}`}>
            {status.success ? "Record Saved Successfully!" : status.message}
          </p>
        )}
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
  const [billingId, setBillingId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    getClinicScheduleAction(date).then((res) => {
      if (res.success && res.data) setSchedule(res.data);
      setLoading(false);
    });
  }, [date]);

  useEffect(() => {
    refresh();
    getDentistListAction().then((res) => {
      if (res.success && res.data) setDentists(res.data as any);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  return (
    <div className={`${styles.cardPurple} space-y-4`}>
      <div className="flex justify-between items-center">
        <h3 className={`${styles.cardTitle} text-purple-900`}>
          Clinic Schedule
        </h3>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="text-sm p-1 border rounded"
        />
      </div>
      {loading ? (
        <p>...</p>
      ) : (
        schedule.map((app) => (
          <div
            key={app.id}
            className="p-3 bg-white rounded border space-y-2 text-sm shadow-sm"
          >
            <div className="flex justify-between items-center">
              <span>
                <strong>{app.time}</strong> - {app.patientName}
              </span>
              <div className="flex gap-2">
                {app.status === "completed" &&
                  (app.paymentStatus === "paid" ? (
                    <span className="text-xs font-bold text-green-600 border border-green-200 bg-green-50 px-2 py-1 rounded">
                      PAID
                    </span>
                  ) : (
                    <button
                      onClick={() => setBillingId(app.id)}
                      className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold hover:bg-blue-200"
                    >
                      Bill: ${app.treatment?.totalBill || 0}
                    </button>
                  ))}

                <button
                  onClick={() =>
                    app.isProfileComplete
                      ? setViewingId(app.patientId)
                      : setEditingId(app.patientId)
                  }
                  className={`text-xs px-2 py-1 rounded font-bold ${
                    app.isProfileComplete
                      ? "bg-purple-100"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {app.isProfileComplete ? "View" : "⚠️ Complete"}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={app.status}
                onChange={(e) =>
                  updateAppointmentStatusAction(
                    app.id,
                    e.target.value as AppointmentStatus
                  ).then(refresh)
                }
                className="text-[10px] p-1 border rounded flex-1 uppercase font-bold"
              >
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select
                value={app.dentistId || ""}
                onChange={(e) =>
                  assignDentistAction(app.id, e.target.value).then(refresh)
                }
                className="text-[10px] p-1 border rounded flex-1"
              >
                <option value="">Assign Dentist</option>
                {dentists.map((d) => (
                  <option key={d.uid} value={d.uid}>
                    {d.displayName || d.email}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))
      )}
      {viewingId && (
        <PatientDetailsModal
          patientId={viewingId}
          onClose={() => setViewingId(null)}
        />
      )}
      {editingId && (
        <PatientEditModal
          patientId={editingId}
          onClose={() => {
            setEditingId(null);
            refresh();
          }}
        />
      )}
      {billingId && (
        <PaymentModal
          appointment={schedule.find((a) => a.id === billingId)!}
          onClose={() => setBillingId(null)}
          onComplete={refresh}
        />
      )}
    </div>
  );
}

function ProceduresSection() {
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
    <div className={`${styles.cardOrange} space-y-4`}>
      <h3 className={`${styles.cardTitle} text-orange-900`}>
        Procedures (Admin)
      </h3>
      <div className="max-h-32 overflow-y-auto border rounded bg-white p-2 text-xs space-y-1">
        {procedures.map((p) => (
          <div key={p.id} className="flex justify-between border-b pb-1">
            <span>
              {p.code} - {p.name}
            </span>
            <span className="font-bold">${p.basePrice}</span>
          </div>
        ))}
      </div>
      <form action={formAction} className="space-y-2">
        <div className="flex gap-2">
          <input
            name="code"
            placeholder="Code"
            className="w-1/3 p-2 text-sm border rounded"
            required
          />
          <input
            name="name"
            placeholder="Name"
            className="w-2/3 p-2 text-sm border rounded"
            required
          />
        </div>
        <input
          name="basePrice"
          type="number"
          placeholder="Price"
          className="w-full p-2 text-sm border rounded"
          required
        />
        <button
          disabled={isPending}
          className="w-full bg-orange-700 text-white py-2 rounded font-bold"
        >
          Add
        </button>
      </form>
    </div>
  );
}

function InventorySection() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [state, formAction, isPending] = useActionState(
    addInventoryItemAction,
    { success: false }
  );
  const refresh = useCallback(() => {
    getInventory().then((res) => {
      if (res.success) setInventory(res.data || []);
    });
  }, []);
  useEffect(() => {
    refresh();
  }, [state.success, refresh]);
  return (
    <div className={`${styles.cardTeal} space-y-4`}>
      <h3 className={`${styles.cardTitle} text-teal-900`}>Inventory (Staff)</h3>
      <div className="max-h-32 overflow-y-auto border rounded bg-white p-2 text-xs space-y-1">
        {inventory.map((item) => (
          <div
            key={item.id}
            className="flex justify-between items-center py-2 border-b last:border-0"
          >
            <div>
              <div className="font-bold text-teal-900">{item.name}</div>
              <div className="text-[10px] text-gray-500 uppercase flex gap-2">
                <span>{item.category}</span>
                <span>•</span>
                <span>
                  Stock: {item.stock} {item.unit}
                </span>
                <span>•</span>
                <span>Min: {item.minThreshold}</span>
              </div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => adjustStockAction(item.id, -1).then(refresh)}
                className="px-2 bg-red-50 text-red-700 rounded hover:bg-red-100"
              >
                -
              </button>
              <button
                onClick={() => adjustStockAction(item.id, 1).then(refresh)}
                className="px-2 bg-green-50 text-green-700 rounded hover:bg-green-100"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>
      <form action={formAction} className="space-y-2 border-t pt-2 mt-2">
        <input
          name="name"
          placeholder="Item Name"
          className="w-full p-2 text-sm border rounded"
          required
        />
        <div className="flex gap-2">
          <input
            name="stock"
            type="number"
            placeholder="Qty"
            className="w-1/2 p-2 text-sm border rounded"
            required
          />
          <input
            name="unit"
            placeholder="Unit"
            className="w-1/2 p-2 text-sm border rounded"
            required
          />
        </div>
        <div className="flex gap-2">
          <select name="category" className="w-1/2 p-2 text-sm border rounded">
            <option value="consumable">Consumable</option>
            <option value="material">Material</option>
            <option value="instrument">Instrument</option>
            <option value="medication">Medication</option>
          </select>
          <input
            name="minThreshold"
            type="number"
            placeholder="Min"
            className="w-1/2 p-2 text-sm border rounded"
            required
          />
        </div>
        <input
          name="costPerUnit"
          type="number"
          placeholder="Cost"
          className="w-full p-2 text-sm border rounded"
          required
        />
        <button
          disabled={isPending}
          className="w-full bg-teal-700 text-white py-2 rounded font-bold text-sm"
        >
          Add Item
        </button>
      </form>
    </div>
  );
}

function DentistScheduleSection() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [schedule, setSchedule] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTreatment, setActiveTreatment] = useState<Appointment | null>(
    null
  );
  const refresh = useCallback(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    getDentistScheduleAction(date).then((res) => {
      if (res.success && res.data)
        setSchedule((res.data as Appointment[]) || []);
      setLoading(false);
    });
  }, [date]);
  useEffect(() => {
    refresh();
  }, [date, refresh]);
  return (
    <div className={`${styles.cardPink} space-y-4`}>
      <div className="flex justify-between items-center">
        <h3 className={`${styles.cardTitle} text-pink-900`}>
          My Assigned Patients
        </h3>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="text-sm p-1 border rounded"
        />
      </div>
      {loading ? (
        <p>...</p>
      ) : schedule.length === 0 ? (
        <p className="text-xs italic text-gray-500 text-center py-4">
          No patients today.
        </p>
      ) : (
        schedule.map((app) => (
          <div
            key={app.id}
            className="p-3 bg-white rounded border flex justify-between items-center text-sm shadow-sm"
          >
            <div>
              <p>
                <strong>{app.time}</strong> - {app.serviceType}
              </p>
              <p className="text-[10px] uppercase font-bold text-gray-400">
                {app.status}
              </p>
            </div>
            {app.status !== "completed" && (
              <button
                onClick={() => setActiveTreatment(app)}
                className="bg-pink-600 text-white px-3 py-1 rounded font-bold text-xs hover:bg-pink-700 transition"
              >
                Treat
              </button>
            )}
          </div>
        ))
      )}
      {activeTreatment && (
        <TreatmentModal
          appointment={activeTreatment}
          onClose={() => setActiveTreatment(null)}
          onComplete={refresh}
        />
      )}
    </div>
  );
}

function CreateEmployeeForm() {
  const { user } = useAuth();
  const [token, setToken] = useState("");
  const [state, formAction, isPending] = useActionState(createEmployeeAction, {
    success: false,
  });
  useEffect(() => {
    if (user) user.getIdToken().then(setToken);
  }, [user]);
  return (
    <div className={`${styles.cardIndigo} space-y-3`}>
      <h3 className={`${styles.cardTitle} text-indigo-900`}>Staff HR</h3>
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="idToken" value={token} />
        <input
          name="displayName"
          placeholder="Name"
          required
          className="w-full rounded border p-2 text-sm"
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="w-full rounded border p-2 text-sm"
        />
        <input
          name="password"
          type="password"
          placeholder="Pass"
          required
          className="w-full rounded border p-2 text-sm"
        />
        <select name="role" className="w-full rounded border p-2 text-sm">
          <option value="dentist">Dentist</option>
          <option value="front-desk">Front Desk</option>
        </select>
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded bg-indigo-700 py-2 text-sm font-bold text-white hover:bg-indigo-800"
        >
          Create Staff
        </button>
        {state.success && (
          <p className="text-green-600 text-xs text-center font-bold">
            Account Created!
          </p>
        )}
        {state.error && (
          <p className="text-red-600 text-xs text-center font-bold">
            {state.error}
          </p>
        )}
      </form>
    </div>
  );
}

// --- MAIN PAGE ---

function PatientDirectorySection() {
  const [patients, setPatients] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPatientListAction().then((res) => {
      if (res.success && res.data) setPatients(res.data);
      setLoading(false);
    });
  }, []);

  return (
    <div className={`${styles.cardGray} space-y-4`}>
      <h3 className={styles.cardTitle}>Patient Directory (Staff Only)</h3>
      {loading ? (
        <p className="text-xs">Loading directory...</p>
      ) : patients.length === 0 ? (
        <p className="text-xs italic text-gray-500">No patients found.</p>
      ) : (
        <div className="max-h-60 overflow-y-auto border rounded bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-2">Name</th>
                <th className="p-2">Email</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr
                  key={p.uid}
                  className="border-b last:border-0 hover:bg-gray-50"
                >
                  <td className="p-2 font-bold">{p.displayName || "N/A"}</td>
                  <td className="p-2 text-gray-600">{p.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function BackendTestPage() {
  const { user, role, loading, logout } = useAuth();
  if (loading)
    return (
      <div className="p-20 text-center text-gray-500 font-bold animate-pulse">
        Initializing Lab Environment...
      </div>
    );
  if (!user)
    return (
      <div className="flex flex-col items-center py-40 gap-6">
        <h2 className="text-3xl font-black italic tracking-tighter text-gray-900 uppercase">
          Backend Test Lab
        </h2>
        <p className="text-gray-500 -mt-4 font-medium">
          Please sign in to access technical tools.
        </p>
        <div className="flex gap-4">
          <Link
            href="/backend-test/auth/signin"
            className="px-10 py-3 bg-white border border-gray-200 shadow-sm rounded-xl font-bold hover:bg-gray-50 transition"
          >
            Sign In
          </Link>
          <Link
            href="/backend-test/auth/signup"
            className="px-10 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition"
          >
            Client Sign Up
          </Link>
        </div>
      </div>
    );

  const isStaff = role && role !== "client";

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-black">
            DC
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">
              Active Session
            </p>
            <p className="font-extrabold text-gray-900">
              {user.email}{" "}
              <span className="text-blue-600 ml-1">
                [{role?.toUpperCase()}]
              </span>
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-black text-xs hover:bg-red-100 transition uppercase tracking-wider"
        >
          Sign Out
        </button>
      </div>

      <VerificationTestSection />

      <div className={styles.grid}>
        {/* User Sections */}
        <div className={styles.column}>
          <BookingSection />
          <HistorySection />
        </div>

        {/* Clinical / Staff Sections */}
        <div className={styles.column}>
          <PatientSection />
          {isStaff && <PatientDirectorySection />}
          {isStaff && <InventorySection />}
        </div>

        {/* Dashboard Sections */}
        <div className={styles.column}>
          {isStaff && <ClinicScheduleSection />}
          {role === "dentist" && <DentistScheduleSection />}
          {role === "admin" && (
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
