import { NextResponse } from "next/server";
import { getAppointmentsByPatientIdAdmin } from "@/lib/services/appointment-service-admin";
import { adminAuth, adminDb } from "@/lib/firebase/server";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const decoded = await adminAuth.verifyIdToken(token);

    const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
    const role = userDoc.data()?.role;

    if (role === "client") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { patientId } = await req.json();

    const res = await getAppointmentsByPatientIdAdmin(patientId);
    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 500 });
    }

    return NextResponse.json({ data: res.data });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
