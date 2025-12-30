"use server";

import { signIn, signUp } from "@/lib/services/auth-service";
import { signInSchema, signUpSchema } from "@/lib/validations/auth";
import { z } from "zod";

export async function signInAction(prevState: any, data: FormData) {
  const formData = Object.fromEntries(data);
  const parsed = signInSchema.safeParse(formData);

  if (!parsed.success) {
    return {
      success: false,
      error: z.prettifyError(parsed.error),
    };
  }

  return await signIn(parsed.data);
}

export async function signUpAction(prevState: any, data: FormData) {
  const formData = Object.fromEntries(data);
  const parsed = signUpSchema.safeParse(formData);

  if (!parsed.success) {
    return {
      success: false,
      error: z.prettifyError(parsed.error),
    };
  }

  return await signUp(parsed.data);
}
