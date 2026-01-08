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

// --- Patient/Client Schemas ---

export const patientRecordSchema = z.object({
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits"),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
  medicalHistory: z.object({
    allergies: z.array(z.string()).default([]),
    conditions: z.array(z.string()).default([]),
    medications: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  }).optional().default({}),
});

// --- Dentist/Employee Schemas ---

const shiftSchema = z.object({
  start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)"),
  end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)"),
  isActive: z.boolean(),
});

export const dentistProfileSchema = z.object({
  bio: z.string().max(500).optional(),
  specialties: z.array(z.string()).min(1, "At least one specialty is required"),
  schedule: z.object({
    monday: shiftSchema.optional(),
    tuesday: shiftSchema.optional(),
    wednesday: shiftSchema.optional(),
    thursday: shiftSchema.optional(),
    friday: shiftSchema.optional(),
    saturday: shiftSchema.optional(),
    sunday: shiftSchema.optional(),
  }),
});
