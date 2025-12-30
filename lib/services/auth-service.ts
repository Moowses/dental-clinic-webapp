import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../firebase/firebase";
import { signInSchema, signUpSchema } from "../validations/auth";
import { z } from "zod";

export async function signIn(credentials: z.infer<typeof signInSchema>) {
  try {
    const { email, password } = signInSchema.parse(credentials);
    await signInWithEmailAndPassword(auth, email, password);
    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred" };
  }
}

export async function signUp(credentials: z.infer<typeof signUpSchema>) {
  try {
    const { email, password } = signUpSchema.parse(credentials);
    await createUserWithEmailAndPassword(auth, email, password);
    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred" };
  }
}
