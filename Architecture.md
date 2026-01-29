
### Design Principles
- **All writes & privileged reads go through Server Actions**
- **UI never talks directly to Firestore for admin/staff operations**
- **Business rules live in `lib/services`, not UI**
- **Firestore schema prioritizes clarity over over-optimization**
- **Clinic staff UX > technical elegance**

---

## 2. Folder Responsibilities

### `app/`
- Route-based UI (Admin, Client, Appointment, API)
- Server Actions (`app/actions/*.ts`)
- Pages are thin; logic lives in actions/services

### `components/`
- Panels, tables, modals, reusable UI blocks
- No direct Firestore access
- Calls Server Actions

### `lib/services/`
- Query logic
- Business rules
- Data aggregation / transformation
- Reused by multiple Server Actions

### `lib/firebase/`
- Firebase client initialization
- Firebase admin initialization (server-only, singleton)

### `lib/types/`
- Domain types (Appointment, BillingRecord, InventoryItem, etc.)

### `lib/validations/`
- Zod schemas / guards for Server Actions

---

## 3. Firebase Data Model (Current State)

> This reflects **how data is stored TODAY**, not a future refactor.

---

### 3.1 Users

**Collection:** `users`  
**Doc ID:** Firebase Auth `uid`

```ts
{
  uid: string
  name: string
  email: string
  role: "admin" | "dentist" | "frontdesk" | "client"
  supportedServiceIds?: string[]   // dentist capability mapping
  createdAt
}
Used by:

auth-actions

admin-actions

dentist-actions

role-based access control

3.2 Patients

Collection: patients

{
  id: string
  fullName: string
  contactNumber?: string
  email?: string
  notes?: string
  userId?: string        // optional (guest vs registered client)
  createdAt
}


Notes:

Not all patients are users

Client dashboard links via userId when present

3.3 Appointments (CORE AGGREGATE)

Collection: appointments

Appointments are the core aggregate root of the system.

{
  id: string
  patientId: string
  dentistId: string
  scheduledAt: Timestamp
  status: "scheduled" | "completed" | "cancelled"

  // 🔹 Treatment is stored HERE
  treatments?: {
    procedures: {
      serviceId: string
      name: string
      price: number
      quantity: number
    }[]
    inventoryUsed?: {
      inventoryItemId: string
      quantityUsed: number
    }[]
    finalizedAt?: Timestamp
  }

  createdAt
  updatedAt
}


Why treatments are embedded:

Treatments are always tied to a single appointment

Simplifies dentist workflow

Avoids cross-collection joins

3.4 Services / Procedures

Collection: services

{
  id: string
  name: string
  price: number
  requiredInventory?: {
    inventoryItemId: string
    quantity: number
  }[]
  isActive: boolean
}


Used by:

service-actions

treatment modal

billing item generation

3.5 Inventory

Collection: inventory

{
  id: string
  name: string
  quantity: number
  unit: string
  lowStockThreshold?: number
  updatedAt
}

Inventory Logs (unchanged)

Collection: inventory_logs

{
  inventoryItemId: string
  quantityUsed: number
  reason: "treatment" | "manual_adjustment"
  referenceId: string      // appointmentId
  createdAt
}

3.6 Billing Records

Collection: billing_records

{
  id: string
  appointmentId: string
  patientId: string

  items: {
    description: string
    quantity: number
    amount: number
  }[]

  // 🔴 Payments are currently stored as an ARRAY FIELD
  payments: {
    amount: number
    method: string
    type: "downpayment" | "installment" | "full"
    createdAt: number      // Date.now(), NOT serverTimestamp
    performedBy: string
  }[]

  totalAmount: number
  paidAmount: number
  balance: number
  status: "unpaid" | "partial" | "paid"

  createdAt
}


⚠️ Known Constraint

Firestore does NOT support serverTimestamp() inside array elements reliably

Payments must use:

Date.now() OR

pre-generated timestamps

Whenever a payment is added:

paidAmount

balance

status
MUST be recalculated in the same Server Action

This is intentional and documented to avoid silent bugs.

4. Server Actions Pattern (MANDATORY)
Rules

All writes go through app/actions/*.ts

UI components NEVER mutate Firestore directly

Actions call lib/services/* for logic

Example:

BillingOverviewPanel (UI)
  → billing-actions.ts
      → billing-services.ts
          → Firestore

Why this matters (Capstone-safe)

Easier debugging

Clear audit trail

Prevents logic duplication

Compatible with Vercel + Firebase Admin

5. Role Access Model
Role	Capabilities
Admin	Full access (users, billing, inventory, reports)
Dentist	Appointments, treatments, inventory usage
Frontdesk	Appointments, patients, billing view
Client	Own appointments, dashboard view

Enforced at:

Server Actions

Firestore rules (defensive)

6. Deployment Constraints (Vercel)

Firebase Admin ONLY in server files

No Node-only APIs in client components

Server Actions preferred over API routes

Payments array avoids serverTimestamp

7. Known Trade-offs (Documented)

Payments stored as array → simpler UI, known timestamp limitations

Treatments embedded → simpler domain model

Inventory logs separate → clean audit trail

These are intentional, not accidental.

8. Future-Safe Notes (Not Implemented Yet)

Payments MAY later be migrated to subcollection

Treatments MAY later be normalized if multi-appointment reuse appears

Until then, this architecture is correct and stable.

End of Architecture.md