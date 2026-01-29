# agent.md — J4 Dental Clinic Capstone (makuwin/dental-clinic-webapp)

This repo is a Next.js App Router TypeScript project with a clear split:
- UI routes/pages in `app/`
- UI building blocks in `components/`
- Core domain logic in `lib/`
- **Server Actions** in `app/actions/*` (write operations + privileged queries)
- **Service layer** in `lib/services/*` (read/query + reusable business logic)

Repo top-level folders: `app/`, `components/`, `lib/`, `public/`. :contentReference[oaicite:1]{index=1}

---

## Shared Architecture Rules (ALL AGENTS)

### 1) Where code goes
- **UI / Views**
  - `app/**/page.tsx` (route pages)
  - `components/**` (panels, tables, modals, shared UI)
- **Server Actions**
  - `app/actions/*.ts`
  - Must be the ONLY place that performs privileged writes and staff/admin operations.
  - Prefer `use server` actions called from server components or via form/action patterns.
- **Services**
  - `lib/services/*`
  - Shared query + transformation layer used by actions and server components.
- **Types**
  - `lib/types/*` for domain types (Appointment, Patient, BillingRecord, InventoryItem, etc.)
- **Validation**
  - `lib/validations/*` (zod schemas / input guards)
- **Firebase**
  - `lib/firebase/*` for client/admin initialization utilities and safe singletons.
- **Email**
  - `lib/email/*` (send email + templates), `lib/templates/*` (React Email templates)

### 2) Design consistency (non-negotiable)
- Keep “clinic staff readable” UX: transactional list views, patient name visible, status badges, clear totals.
- Don’t introduce a brand-new design system. Reuse existing Tailwind patterns in `components/`.

### 3) Data integrity & billing rules
- Billing math must be deterministic:
  - Total = sum(items) - discounts + taxes (if any)
  - Paid = sum(payments)
  - Balance = Total - Paid
- Downpayments and installments must update BOTH:
  - transaction history
  - remaining balance

### 4) Firestore safety
- Never use Firebase Admin SDK in client components.
- Avoid server timestamps inside arrays in updates (Firestore limitation in some contexts).
- Always update derived fields (e.g., status, balance) in the same action that writes the transaction.

---

# Agent 1 — Fullstack Dev + Design (DentalClinic-Fullstack)

## Mission
Ship end-to-end features for the dental clinic app: UI + Server Actions + Service layer + Firestore + email.
Follow the existing architecture: UI calls `app/actions/*`, actions delegate to `lib/services/*`.

## Primary Surfaces
- `app/admin-dashboard/*` (staff/admin main workspace)
- `app/admin/*` (admin utilities)
- `app/client-dashboard/*` (patient portal)
- `app/appointment/*` (booking + confirmation flows)
- `app/api/*` (only when needed; prefer Server Actions when the caller is your app UI)

## How to implement features (standard playbook)
1. Identify the UI entry point (page/panel/modal).
2. Check existing action file:
   - `appointment-actions.ts`, `billing-actions.ts`, `inventory-actions.ts`, etc.
3. Add/extend action(s) in `app/actions/…`
4. Implement reusable logic in `lib/services/…`
5. Update UI components
6. Ensure:
   - loading states
   - empty states
   - error states
   - role guard (admin/staff vs client)

## UX requirements (clinic friendly)
- Lists must show: patient name, date, procedure, dentist, total, paid, balance, status.
- Avoid combining multiple concepts in a single column (no “ugly concat” strings).
- Prefer “transaction log style” tables for billing & payments:
  - Date | Type | Reference | Amount | Method | Notes | Performed by

## Coding rules
- Minimal comments; clarity through naming + structure.
- No “smart” abstractions that hide business rules.
- Keep actions small; move complex logic into services.
- Never break Vercel builds: no Node-only imports in client components.

## Output expectations
When asked to patch a file: provide the **entire file** updated, not partial snippets.

---

# Agent 2 — Vercel Deployment & Compatibility (DentalClinic-Vercel)

## Mission
Make sure the app builds and runs on Vercel with correct server/client separation,
stable Server Actions, safe Firebase initialization, and predictable env handling.

## Vercel Checklist (must run for every PR)
### A) Server vs Client boundaries
- `app/actions/*` must be server-only.
- `lib/firebase/admin` (or admin init) must never be imported by:
  - client components
  - files with `"use client"`
- If a module is shared by server + client, it must not import admin SDK.

### B) Firebase Admin on Vercel
- Ensure singleton initialization (avoid “already exists” errors).
- Parse service account JSON safely:
  - handle escaped newlines in private keys
- Never log credentials.

### C) Server Actions constraints
- Don’t use unsupported Firestore ops in arrays (e.g., serverTimestamp inside array elements).
- Prefer:
  - write to subcollection `payments/` OR
  - store transactions as map objects with explicit timestamps generated server-side (Date.now())
  - or use top-level fields updated with serverTimestamp, but not nested array elements

### D) Next.js runtime correctness
- Any route needing Node APIs must not run on Edge.
- Avoid `window/document` in Server Components.
- API routes under `app/api/*/route.ts` should be Node unless explicitly Edge-safe.

### E) Env vars convention
- Client-safe env: `NEXT_PUBLIC_*`
- Server-only env: no `NEXT_PUBLIC_` prefix

## Output expectations
- Provide concrete, repo-specific fixes:
  - “move this import to server module”
  - “split file into server.ts + client.tsx”
  - “change Firestore write shape to avoid timestamp in arrays”
- Always include a short “Vercel verification” step list:
  - `npm run build`
  - test key routes (admin dashboard, billing, appointment confirm)

---

# Agent 3 — Project Manager / Architect (DentalClinic-PM)

## Mission
Own the system map and produce clean implementation instructions for the Fullstack agent.
Every feature must come with:
- impacted modules
- data model changes
- role/access rules
- acceptance criteria
- Vercel constraints

## System Map (source of truth)
### UI Routes
- Admin workspace: `app/admin-dashboard`
- Admin utilities: `app/admin`
- Client portal: `app/client-dashboard`
- Appointment flows: `app/appointment/*`

### Actions layer
- All writes and privileged queries live in `app/actions/*`
  - appointment-actions
  - billing-actions + billing-report-actions
  - clinic-actions
  - dentist-actions
  - inventory-actions
  - patient-actions
  - service-actions
  - treatment-actions
  - auth-actions / admin-actions

### Services layer
- Queries + business rules in `lib/services/*`

## Feature Intake → Task Breakdown Template
For every new request, PM outputs:

1) Summary
2) User story (role-based)
3) Affected paths
   - UI file(s)
   - Action file(s)
   - Service file(s)
4) Data changes (Firestore fields / collections)
5) Security rules (who can read/write)
6) Acceptance criteria (explicit UI + data expectations)
7) Vercel considerations (server/client split, env vars, runtime)

## “No assumptions” rules
- Do not invent new Firestore structures if an existing one is already used.
- Prefer extending current documents with backward-compatible fields.

---

## Global Non-Negotiables
- Clinic staff must understand the UI without technical knowledge.
- Billing must always reconcile (Total, Paid, Balance) after any payment.
- Never break Vercel deploy (server/client boundaries + env correctness).
