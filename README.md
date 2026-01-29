# Dental Clinic Web App

Modern dental clinic website and management app built with Next.js. It includes a public marketing site, client booking flow, staff/admin dashboards, and automated appointment emails.

## Features

- Public landing page with service listings pulled from Firestore.
- Client dashboard for booking and managing appointments.
- Staff/admin dashboard for procedures, patients, inventory, and billing.
- Chatbot API for FAQs and guided booking.
- Email confirmations with calendar (.ics) attachments via Resend.

## Tech Stack

- Next.js App Router, React, TypeScript
- Firebase Auth + Firestore (client + admin SDK)
- Tailwind CSS
- Resend + React Email

## Project Structure

- `app/` - App Router pages and API routes
- `app/api/clinic-bot` - FAQ + booking chatbot endpoint
- `app/client-dashboard` - client portal
- `app/admin` and `app/admin-dashboard` - staff/admin experiences
- `app/appointment/confirm/[id]` - appointment confirmation page
- `lib/` - shared services, types, and validations
- `components/` - UI components

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- Firebase project (Auth + Firestore enabled)
- Resend account for email delivery (optional but recommended)

### Install

```bash
npm install
```

### Environment Variables

Create a `.env.local` file in the project root.

```bash
NEXT_PUBLIC_FIREBASE_API_KEY="your_public_api_key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your_project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your_project_id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your_project.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your_sender_id"
NEXT_PUBLIC_FIREBASE_APP_ID="your_app_id"

# Single-line JSON string. Escape newlines in the private key with \n
FIREBASE_SERVICE_ACCOUNT_JSON="{\"type\":\"service_account\",...}"

# Used for email confirmations
RESEND_API_KEY="re_..."
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Run the Dev Server

```bash
npm run dev
```

Open `http://localhost:3000`.

## Scripts

- `npm run dev` - start dev server
- `npm run build` - create production build
- `npm run start` - run production server
- `npm run lint` - lint

## Deployment Notes

- Set the same environment variables in your hosting provider.
- `NEXT_PUBLIC_APP_URL` should point to your deployed domain.
- Keep `FIREBASE_SERVICE_ACCOUNT_JSON` secret and never commit it.

## Security

- Do not commit `.env.local` or service account JSON.
- Rotate keys if they have ever been exposed.
