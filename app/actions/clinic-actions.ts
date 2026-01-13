import { ActionState } from "@/lib/utils";
import { procedureSchema } from "@/lib/validations/clinic";
import {
  createProcedure,
  updateProcedure,
  deleteProcedure,
} from "@/lib/services/clinic-service";
import { getUserProfile } from "@/lib/services/user-service";
import { DentalProcedure } from "@/lib/types/clinic";

export async function createProcedureAction(
  prevState: ActionState,
  data: FormData
): Promise<ActionState> {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  // Admin Check
  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || profile.data?.role !== "admin") {
    return { success: false, error: "Unauthorized: Admin access required" };
  }

  // Handle number conversion
  const rawData = Object.fromEntries(data);
  const formattedData: Partial<DentalProcedure> = {
    ...rawData,
    basePrice: Number(rawData.basePrice),
  };

  // Only set isActive if provided, otherwise let Zod handle the default(true)
  if (rawData.isActive !== undefined) {
    formattedData.isActive = rawData.isActive === "true" || rawData.isActive === "on";
  }

  const parsed = procedureSchema.safeParse(formattedData);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  return await createProcedure(parsed.data);
}

export async function updateProcedureAction(
  procedureId: string,
  data: FormData
): Promise<ActionState> {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || profile.data?.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  const rawData = Object.fromEntries(data);
  const formattedData: Partial<DentalProcedure> = {
    ...rawData,
    basePrice: Number(rawData.basePrice),
  };

  if (rawData.isActive !== undefined) {
    formattedData.isActive = rawData.isActive === "true" || rawData.isActive === "on";
  }

  const parsed = procedureSchema.safeParse(formattedData);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  return await updateProcedure(procedureId, parsed.data);
}

export async function deleteProcedureAction(
  procedureId: string
): Promise<ActionState> {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || profile.data?.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  return await deleteProcedure(procedureId);
}
// mossaisagay
