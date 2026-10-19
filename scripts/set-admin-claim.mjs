#!/usr/bin/env node
/**
 * Grant or revoke the Platform Administrator role (Firebase custom claim).
 *
 * This is the ONLY way the role can be set — never from the UI or request
 * input (SPEC.md 6.2, AGENTS.md section 8). Admins get no routine access to
 * business data; the claim only gates future platform operations.
 *
 * Usage (Node 20.6+):
 *   node --env-file=.env.local scripts/set-admin-claim.mjs <email-or-uid>
 *   node --env-file=.env.local scripts/set-admin-claim.mjs <email-or-uid> --revoke
 *
 * Required env vars (see .env.example): FIREBASE_PROJECT_ID,
 * FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.
 *
 * The user must sign out and back in for the claim to reach their session.
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const REQUIRED = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
];

function main() {
  const args = process.argv.slice(2);
  const revoke = args.includes("--revoke");
  const identifier = args.find((arg) => !arg.startsWith("--"));

  if (!identifier) {
    console.error(
      "Usage: node --env-file=.env.local scripts/set-admin-claim.mjs <email-or-uid> [--revoke]",
    );
    process.exit(1);
  }

  const missing = REQUIRED.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error(
      `Missing environment variables: ${missing.join(", ")}.\n` +
        "Copy .env.example to .env.local and fill in the service-account values " +
        "(Firebase console > Project settings > Service accounts), then run with --env-file=.env.local.",
    );
    process.exit(1);
  }

  return { identifier, revoke };
}

const { identifier, revoke } = main();

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const auth = getAuth();
const user = identifier.includes("@")
  ? await auth.getUserByEmail(identifier)
  : await auth.getUser(identifier);

const existing = user.customClaims ?? {};
const claims = { ...existing };
if (revoke) {
  delete claims.platformAdmin;
} else {
  claims.platformAdmin = true;
}
await auth.setCustomUserClaims(user.uid, claims);

console.log(
  revoke
    ? `Revoked platformAdmin from ${user.email ?? user.uid}.`
    : `Granted platformAdmin to ${user.email ?? user.uid}.`,
);
console.log("The user must sign out and back in for the change to apply.");
