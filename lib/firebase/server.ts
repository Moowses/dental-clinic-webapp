// lib/firebase/server.ts
import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let app: App;

function loadServiceAccount() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!json) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not set.");
  }

  const serviceAccount = JSON.parse(json);

  // Fix newline escaping from env vars
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }

  return serviceAccount;
}

if (!getApps().length) {
  app = initializeApp({
    credential: cert(loadServiceAccount()),
  });
} else {
  app = getApps()[0]!;
}

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
export const adminApp = app;
