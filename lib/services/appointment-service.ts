import { db } from "../firebase/firebase";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  serverTimestamp, 
  orderBy 
} from "firebase/firestore";
import { Appointment } from "../types/appointment";
import { ClinicOffDay } from "../types/calendar";
import { bookingSchema } from "../validations/appointment";
import { z } from "zod";

const APPOINTMENTS_COLLECTION = "appointments";
const OFF_DAYS_COLLECTION = "clinic_off_days";

export async function createAppointment(uid: string, data: z.infer<typeof bookingSchema>) {
  try {
    // Note: We don't save displayName/phoneNumber here. 
    // Those are handled by the User Service profile update before this function is called.
    
    await addDoc(collection(db, APPOINTMENTS_COLLECTION), {
      patientId: uid,
      serviceType: data.serviceType,
      date: data.date,
      time: data.time,
      notes: data.notes || "",
      status: "pending",
      createdAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error("Error creating appointment:", error);
    return { success: false, error: "Failed to book appointment" };
  }
}

export async function getTakenSlots(date: string) {
  try {
    const q = query(
      collection(db, APPOINTMENTS_COLLECTION),
      where("date", "==", date),
      where("status", "in", ["pending", "confirmed"]) // Don't block for cancelled/completed? Maybe completed counts as taken.
    );
    
    const snap = await getDocs(q);
    const times = snap.docs.map(doc => (doc.data() as Appointment).time);
    
    return { success: true, data: times };
  } catch (error) {
    console.error("Error fetching taken slots:", error);
    return { success: false, error: "Failed to check availability" };
  }
}

export async function getClinicOffDays(startDate: string, endDate: string) {
  try {
    const q = query(
      collection(db, OFF_DAYS_COLLECTION),
      where("date", ">=", startDate),
      where("date", "<=", endDate)
    );
    
    const snap = await getDocs(q);
    const days = snap.docs.map(doc => doc.data() as ClinicOffDay);
    
    return { success: true, data: days };
  } catch (error) {
    console.error("Error fetching off days:", error);
    return { success: false, error: "Failed to fetch calendar info" };
  }
}

export async function getUserAppointments(uid: string) {
  try {
    const q = query(
      collection(db, APPOINTMENTS_COLLECTION),
      where("patientId", "==", uid),
      orderBy("date", "desc"),
      orderBy("time", "desc")
    );
    
    const snap = await getDocs(q);
    const appointments = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Appointment[];
    
    return { success: true, data: appointments };
  } catch (error) {
    console.error("Error fetching user appointments:", error);
    return { success: false, error: "Failed to load history" };
  }
}

export async function getAllAppointments(date?: string) {
  try {
    let q;
    if (date) {
      // Fetch for a specific day (Front-Desk "Daily View")
      q = query(
        collection(db, APPOINTMENTS_COLLECTION),
        where("date", "==", date),
        orderBy("time", "asc")
      );
    } else {
      // Fetch all (sorted by most recent date first)
      // Note: This query might require an index depending on data volume
      q = query(
        collection(db, APPOINTMENTS_COLLECTION),
        orderBy("date", "desc"),
        orderBy("time", "desc")
      );
    }
    
    const snap = await getDocs(q);
    const appointments = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Appointment[];
    
    return { success: true, data: appointments };
  } catch (error) {
    console.error("Error fetching all appointments:", error);
    return { success: false, error: "Failed to load clinic schedule" };
  }
}
