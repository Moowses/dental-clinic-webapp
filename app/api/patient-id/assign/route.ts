import { adminAuth, adminDb } from "@/lib/firebase/server";
import { Timestamp } from "firebase-admin/firestore";

function formatPatientId(year: number, seq: number) {
  return `${year}-${String(seq).padStart(4, "0")}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = body?.idToken as string | undefined;
    if (!token) {
      return Response.json(
        { success: false, error: "Unauthorized: No token provided" },
        { status: 401 }
      );
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    if (!uid) {
      return Response.json(
        { success: false, error: "Unauthorized: Invalid token" },
        { status: 401 }
      );
    }

    const nowYear = new Date().getFullYear();
    const patientRef = adminDb.collection("patient_records").doc(uid);
    const counterRef = adminDb.collection("counters").doc("patientId");

    const result = await adminDb.runTransaction(async (tx) => {
      const patientSnap = await tx.get(patientRef);
      if (patientSnap.exists) {
        const existing = patientSnap.data()?.patientId;
        if (existing) return { patientId: String(existing), reused: true };
      }

      const counterSnap = await tx.get(counterRef);
      let year = nowYear;
      let seq = 0;

      if (counterSnap.exists) {
        const data = counterSnap.data() || {};
        const storedYear = Number(data?.year || 0);
        const storedSeq = Number(data?.seq || 0);
        if (storedYear === nowYear) {
          year = storedYear;
          seq = Number.isFinite(storedSeq) ? storedSeq : 0;
        }
      }

      const nextSeq = seq + 1;
      const pid = formatPatientId(year, nextSeq);

      tx.set(
        counterRef,
        { year, seq: nextSeq, updatedAt: Timestamp.now() },
        { merge: true }
      );
      tx.set(
        patientRef,
        { uid, patientId: pid, updatedAt: Timestamp.now() },
        { merge: true }
      );

      return { patientId: pid, reused: false };
    });

    return Response.json({ success: true, ...result });
  } catch (error) {
    console.error("Error assigning patient ID:", error);
    return Response.json(
      { success: false, error: "Failed to assign patient ID" },
      { status: 500 }
    );
  }
}
