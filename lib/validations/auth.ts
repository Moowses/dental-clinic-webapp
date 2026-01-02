import { z } from "zod";

export const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
});

export const signUpSchema = z
  .object({
    email: z.email(),
    password: z.string().min(6),
    confirmPassword: z.string().min(6),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const resetPasswordSchema = z.object({
  email: z.email(),
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(2, "Name must be at least 2 characters"),
  photoURL: z.string().url().optional().or(z.literal("")),
});

export const createEmployeeSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
  displayName: z.string().min(2),
  role: z.enum(["admin", "front-desk", "dentist"]),
});
