import { z } from "zod";

export const PaymentMethodEnum = z.enum(["cash", "card", "insurance", "bank_transfer", "other"]);
export const PaymentStatusEnum = z.enum(["unpaid", "partial", "paid", "overdue", "refunded"]);
export const PlanTypeEnum = z.enum(["full", "installments"]);

export const installmentSchema = z.object({
  id: z.string().uuid().optional(), // Auto-generated if missing
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD required"),
  amount: z.number().positive("Installment amount must be positive"),
  status: z.enum(["pending", "paid", "overdue", "cancelled"]).default("pending"),
  paidAt: z.string().optional(), // ISO String
});

export const transactionSchema = z.object({
  id: z.string().uuid().optional(),
  amount: z.number().positive(),
  method: PaymentMethodEnum,
  date: z.string().optional(), // ISO String (server sets this if missing)
  note: z.string().optional(),
  recordedBy: z.string().optional(), // Staff UID
});

export const billingItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number().min(0),
  status: z.enum(["unpaid", "plan", "paid"]).default("unpaid"),
});

export const billingRecordSchema = z.object({
  appointmentId: z.string().min(1),
  patientId: z.string().min(1),
  
  // Financials
  totalAmount: z.number().min(0),
  remainingBalance: z.number().min(0),
  status: PaymentStatusEnum.default("unpaid"),

  // Line Items
  items: z.array(billingItemSchema).default([]),

  // Strategy
  paymentPlan: z.object({
    type: PlanTypeEnum.default("full"),
    installments: z.array(installmentSchema).default([]),
  }).default({ type: "full", installments: [] }),

  // History
  transactions: z.array(transactionSchema).default([]),
});

export type BillingRecordData = z.infer<typeof billingRecordSchema>;
