import "server-only";
import { adminAuth, adminDb } from "../firebase/server";
import { createEmployeeSchema } from "../validations/auth";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";

export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
    
    if (!userDoc.exists) return false;
    
    const userData = userDoc.data();
    return userData?.role === "admin";
  } catch (error) {
    console.error("Error verifying admin token:", error);
    return false;
  }
}

export async function createEmployeeUser(data: z.infer<typeof createEmployeeSchema>) {
  try {
    const { email, password, displayName, role } = data;

    // 1. Create Authentication User
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName,
    });

    // 2. Create Firestore Document (using Admin SDK)
    await adminDb.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      role,
      displayName,
      createdAt: Timestamp.now(),
    });

    return { success: true, uid: userRecord.uid };
  } catch (error: any) {
    console.error("Error creating employee:", error);
    return { success: false, error: error.message || "Failed to create employee" };
  }
}
