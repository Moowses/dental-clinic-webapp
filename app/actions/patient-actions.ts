import { ActionState } from "@/lib/utils";
import { getAllPatients } from "@/lib/services/user-service";
import { getUserProfile } from "@/lib/services/user-service";

// Staff Action: Fetch all patients for the directory
export async function getPatientListAction(): Promise<{ success: boolean; data?: any[]; error?: string }> {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  // Verify Role
  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || !profile.data || profile.data.role === 'client') {
    return { success: false, error: "Unauthorized: Staff access required" };
  }

  return await getAllPatients(100); // Fetch top 100 for directory
}
