import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

/**
 * Browser-side Firebase, for use from client components only. Only the public
 * web config lives here; it identifies
 * the project but grants no access by itself. Access is enforced by
 * Firebase Auth, security rules and server-side checks.
 *
 * Each NEXT_PUBLIC_* variable must be referenced literally so Next.js can
 * inline it at build time.
 */
function readPublicConfig() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(
      `Firebase web config is incomplete (missing: ${missing.join(", ")}). Copy .env.example to .env.local and fill it in.`,
    );
  }
  return config;
}

export function getFirebaseApp(): FirebaseApp {
  return getApps().length > 0 ? getApp() : initializeApp(readPublicConfig());
}

export function getClientAuth(): Auth {
  return getAuth(getFirebaseApp());
}
