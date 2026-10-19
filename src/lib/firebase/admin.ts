import "server-only";

import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getServerEnv } from "@/lib/env/server";

/**
 * Privileged server-side Firebase access.
 *
 * The Admin SDK bypasses Firestore and Storage security rules. Every caller
 * must verify the user's identity and business ownership itself before
 * reading or writing business data (AGENTS.md section 8).
 *
 * Initialization is lazy so builds and tests do not need credentials.
 */
export function getAdminApp(): App {
  if (getApps().length > 0) return getApp();

  const env = getServerEnv();
  return initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY,
    }),
    storageBucket: env.FIREBASE_STORAGE_BUCKET,
  });
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}
