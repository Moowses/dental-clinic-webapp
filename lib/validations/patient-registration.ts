import { z } from "zod";

// --- REUSABLE HELPERS ---
const optionalString = z.string().optional().or(z.literal(""));
const nullableBoolean = z.boolean().nullable().optional();

// --- SUB-SCHEMAS ---

const personalInfoSchema = z.object({
  name: z.object({
    first_name: z.string().min(1, "First Name is required"),
    last_name: z.string().min(1, "Last Name is required"),
    middle_initial: optionalString,
  }),
  nickname: optionalString,
  birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  age: z.number().nullable().optional(),
  sex: optionalString,
  religion: optionalString,
  nationality: optionalString,
  effective_date: z.string().optional(),
});

const contactInfoSchema = z.object({
  home_address: z.string().min(1, "Home address is required"),
  home_no: optionalString,
  mobile_no: z.string().min(1, "Mobile number is required"),
  email_address: z.string().email().optional().or(z.literal("")),
  office_no: optionalString,
  fax_no: optionalString,
});

const medicalHistorySchema = z.object({
  physician: z.object({
    name: optionalString,
    specialty: optionalString,
    office_address: optionalString,
    office_number: optionalString,
  }),
  general_health_screening: z.object({
    in_good_health: nullableBoolean,
    under_medical_condition: z.object({
      status: nullableBoolean,
      condition_description: optionalString,
    }),
    serious_illness_or_surgery: z.object({
      status: nullableBoolean,
      details: optionalString,
    }),
    hospitalized: z.object({
      status: nullableBoolean,
      when_and_why: optionalString,
    }),
    taking_medication: z.object({
      status: nullableBoolean,
      medication_list: optionalString,
    }),
    uses_tobacco: nullableBoolean,
    uses_alcohol_or_drugs: nullableBoolean,
  }),
  allergies: z.object({
    local_anesthetic: z.boolean().default(false),
    penicillin_antibiotics: z.boolean().default(false),
    sulfa_drugs: z.boolean().default(false),
    aspirin: z.boolean().default(false),
    latex: z.boolean().default(false),
    others: optionalString,
  }),
  vitals: z.object({
    bleeding_time: optionalString,
    blood_type: optionalString,
    blood_pressure: optionalString,
  }),
  women_only: z.object({
    is_pregnant: nullableBoolean,
    is_nursing: nullableBoolean,
    taking_birth_control: nullableBoolean,
  }),
  conditions_checklist: z.array(z.string()).default([]),
});

// --- MAIN SCHEMA ---
export const patientRegistrationSchema = z.object({
  personal_information: personalInfoSchema,
  contact_information: contactInfoSchema,
  employment_information: z.object({ occupation: optionalString }).default({ occupation: "" }),
  minor_details: z.object({
    is_minor: z.boolean().default(false),
    parent_guardian_name: optionalString,
    parent_guardian_occupation: optionalString,
  }).default({ is_minor: false, parent_guardian_name: "", parent_guardian_occupation: "" }),
  referral_details: z.object({
    referred_by: optionalString,
    reason_for_consultation: optionalString,
  }).default({ referred_by: "", reason_for_consultation: "" }),
  dental_history: z.object({
    previous_dentist: optionalString,
    last_dental_visit: optionalString,
  }).default({ previous_dentist: "", last_dental_visit: "" }),
  medical_history: medicalHistorySchema,
  authorization: z.object({
    signature_present: z.boolean().default(false),
    date_signed: z.string().optional(),
  }).default({ signature_present: false, date_signed: "" }),
});

// Infer TypeScript Type
export type PatientRegistrationData = z.infer<typeof patientRegistrationSchema>;
