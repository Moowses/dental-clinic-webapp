"use server";

import { adminDb } from "@/lib/firebase/server";
import { verifyAdminToken } from "@/lib/services/admin-service";
import { Timestamp } from "firebase-admin/firestore";

type ResetCounterInput = {
  idToken: string;
  year?: number;
};

export async function resetPatientIdCounterAction(input: ResetCounterInput) {
  try {
    const token = input?.idToken;
    if (!token) {
      return { success: false, error: "Unauthorized: No token provided" };
    }

    const ok = await verifyAdminToken(token);
    if (!ok) {
      return { success: false, error: "Unauthorized: Admin access required" };
    }

    const year = Number(input?.year) || new Date().getFullYear();
    await adminDb
      .collection("counters")
      .doc("patientId")
      .set({ year, seq: 0, updatedAt: Timestamp.now() }, { merge: true });

    return { success: true };
  } catch (error) {
    console.error("Error resetting patient ID counter:", error);
    return { success: false, error: "Failed to reset counter" };
  }
}

type SyncCounterInput = {
  idToken: string;
};

function parsePatientId(pid: string) {
  const match = String(pid).trim().match(/^(\d{4})-(\d{4})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const seq = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(seq)) return null;
  return { year, seq };
}

export async function syncPatientIdCounterAction(input: SyncCounterInput) {
  try {
    const token = input?.idToken;
    if (!token) {
      return { success: false, error: "Unauthorized: No token provided" };
    }

    const ok = await verifyAdminToken(token);
    if (!ok) {
      return { success: false, error: "Unauthorized: Admin access required" };
    }

    const snap = await adminDb
      .collection("patient_records")
      .orderBy("patientId", "desc")
      .limit(1)
      .get();

    let year = new Date().getFullYear();
    let seq = 0;
    if (!snap.empty) {
      const pid = String(snap.docs[0]?.data()?.patientId || "");
      const parsed = parsePatientId(pid);
      if (parsed) {
        year = parsed.year;
        seq = parsed.seq;
      }
    }

    await adminDb
      .collection("counters")
      .doc("patientId")
      .set({ year, seq, updatedAt: Timestamp.now() }, { merge: true });

    return { success: true, year, seq };
  } catch (error) {
    console.error("Error syncing patient ID counter:", error);
    return { success: false, error: "Failed to sync counter" };
  }
}
