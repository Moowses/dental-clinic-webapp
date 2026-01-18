import {
  signIn,
  signUp,
  performPasswordReset,
  updateUserProfile,
  sendVerificationEmail,
} from "@/lib/services/auth-service";
import { updatePatientRecord } from "@/lib/services/patient-service";
import { updateDentistProfile } from "@/lib/services/dentist-service";
import { getUserProfile, updateUserDocument } from "@/lib/services/user-service";
import {
  signInSchema,
  signUpSchema,
  resetPasswordSchema,
  patientRecordSchema,
  dentistProfileSchema,
} from "@/lib/validations/auth";
import { actionWrapper, ActionState } from "@/lib/utils";

export type AuthState = ActionState;

export async function signInAction(
  prevState: AuthState,
  data: FormData
): Promise<AuthState> {
  return actionWrapper(signInSchema, signIn, data);
}

export async function signUpAction(
  prevState: AuthState,
  data: FormData
): Promise<AuthState> {
  return actionWrapper(signUpSchema, signUp, data);
}

export async function resendVerificationEmailAction(): Promise<ActionState> {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };
  
  return await sendVerificationEmail(auth.currentUser);
}

export async function resetPasswordAction(
  prevState: AuthState,
  data: FormData
): Promise<AuthState> {
  return actionWrapper(resetPasswordSchema, performPasswordReset, data);
}

export async function updatePatientRecordAction(prevState: AuthState, data: FormData): Promise<AuthState> {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  // 1. Determine if the caller is Staff
  const profile = await getUserProfile(auth.currentUser.uid);
  const isStaff = profile.success && profile.data && profile.data.role !== "client";

  // 2. Determine Target UID
  let targetUid = auth.currentUser.uid;
  const requestedUid = data.get("targetUid") as string;
  
  if (requestedUid && isStaff) {
    targetUid = requestedUid;
  }

  // 2. Manual Parsing for Nested Data (Medical History)
  const rawData = Object.fromEntries(data);
  const allergies = (rawData.allergies as string)?.split(",").map(s => s.trim()).filter(Boolean) || [];
  const conditions = (rawData.conditions as string)?.split(",").map(s => s.trim()).filter(Boolean) || [];
  
  // Handle Display Name Update
  if (rawData.displayName) {
    const newName = rawData.displayName as string;
    // 1. Update Firestore (Always)
    await updateUserDocument(targetUid, { displayName: newName });
    
    // 2. Update Auth Profile (Only if editing self, because Client SDK cannot edit others)
    if (!isStaff && auth.currentUser.uid === targetUid) {
      await updateUserProfile(auth.currentUser, { displayName: newName });
    }
  }

  const structuredData = {
    ...rawData,
    medicalHistory: {
      allergies,
      conditions,
      medications: (rawData.medications as string) || null,
      notes: (rawData.notes as string) || null
    }
  };

  const parsed = patientRecordSchema.safeParse(structuredData);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0].message,
    };
  }

  // 3. Pass isStaff flag to the service
  return await updatePatientRecord(targetUid, parsed.data, !!isStaff);
}



export async function updateDentistProfileAction(
  prevState: AuthState,
  data: FormData
): Promise<AuthState> {
  const { auth } = await import("@/lib/firebase/firebase");
  if (!auth.currentUser) return { success: false, error: "Not authenticated" };

  return actionWrapper(
    dentistProfileSchema,
    async (parsedData) => {
      return await updateDentistProfile(auth.currentUser!.uid, parsedData);
    },
    data
  );
}
