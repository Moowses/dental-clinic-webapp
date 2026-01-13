import { ActionState } from "@/lib/utils";
import { getAllDentists, updateDentistServices } from "@/lib/services/dentist-service";
import { getUserProfile } from "@/lib/services/user-service";

export async function getDentistListAction() {
  return await getAllDentists();
}

export async function updateDentistServicesAction(dentistUid: string, serviceIds: string[]): Promise<ActionState> {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  // Permission Check: Admin or the Dentist themselves can update their services
  const callerProfile = await getUserProfile(auth.currentUser.uid);
  if (!callerProfile.success || !callerProfile.data) return { success: false, error: "Profile not found" };

  const canEdit = callerProfile.data.role === "admin" || auth.currentUser.uid === dentistUid;
  if (!canEdit) return { success: false, error: "Unauthorized" };

  return await updateDentistServices(dentistUid, serviceIds);
}
