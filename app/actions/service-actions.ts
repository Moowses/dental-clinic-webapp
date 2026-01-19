import { ActionState, actionWrapper } from "@/lib/utils";
import { serviceSchema } from "@/lib/validations/service";
import { createService, updateService, deleteService, getAllServices } from "@/lib/services/service-service";
import { getUserProfile } from "@/lib/services/user-service";
import { DentalService } from "@/lib/types/service";

export async function getAllServicesAction(): Promise<{ success: boolean; data?: DentalService[]; error?: string }> {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };
  
  // Optional: Check role if this is internal only, but "Services" are usually public info?
  // Let's restrict it to authenticated for now since this is a management API.
  return await getAllServices(false); // Fetch all (including inactive)
}

export async function createServiceAction(prevState: ActionState, data: FormData): Promise<ActionState> {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  // 1. Verify Admin Role
  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || profile.data?.role !== "admin") {
    return { success: false, error: "Unauthorized: Admin access required" };
  }

  // 2. Validate and Execute
  // Manual parsing to handle FormData string-to-number conversion
  const rawData = Object.fromEntries(data);
  const formattedData = {
    ...rawData,
    price: Number(rawData.price),
    durationMinutes: Number(rawData.durationMinutes),
    isActive: rawData.isActive === "true" || rawData.isActive === "on"
  };

  const parsed = serviceSchema.safeParse(formattedData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  return await createService(parsed.data);
}

export async function updateServiceAction(serviceId: string, data: FormData): Promise<ActionState> {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  // 1. Verify Admin Role
  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || profile.data?.role !== "admin") {
    return { success: false, error: "Unauthorized: Admin access required" };
  }

  // 2. Validate and Execute
  // We use a custom wrapper or just parse manually because we need the ID
  const rawData = Object.fromEntries(data);
  // Convert numeric strings to numbers for Zod
  const formattedData = {
    ...rawData,
    price: Number(rawData.price),
    durationMinutes: Number(rawData.durationMinutes),
    isActive: rawData.isActive === "true" || rawData.isActive === "on"
  };

  const parsed = serviceSchema.safeParse(formattedData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  return await updateService(serviceId, parsed.data);
}

export async function deleteServiceAction(serviceId: string): Promise<ActionState> {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || profile.data?.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  return await deleteService(serviceId);
}



export async function toggleServiceStatusAction(serviceId: string, currentStatus: boolean): Promise<ActionState> {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  const profile = await getUserProfile(auth.currentUser.uid);
  if (!profile.success || profile.data?.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  return await updateService(serviceId, { isActive: !currentStatus });
}
