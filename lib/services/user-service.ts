import { db } from "../firebase/firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { UserProfile, UserRole } from "../types/user";

export async function createUserDocument(uid: string, email: string, role: UserRole = "client") {
  try {
    const userRef = doc(db, "users", uid);
    await setDoc(userRef, {
      uid,
      email,
      role,
      createdAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error creating user document:", error);
    return { success: false, error: "Failed to create user profile" };
  }
}

export async function getUserProfile(uid: string): Promise<{ success: boolean; data?: UserProfile; error?: string }> {
  try {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      return { success: true, data: snap.data() as UserProfile };
    } else {
      return { success: false, error: "User profile not found" };
    }
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return { success: false, error: "Failed to fetch user profile" };
  }
}
