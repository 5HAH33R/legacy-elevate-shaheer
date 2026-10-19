import { FirebaseError } from "firebase/app";

/** Readable messages for the Firebase Auth errors a user can actually hit. */
const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/user-not-found": "Incorrect email or password.",
  "auth/email-already-in-use":
    "An account with this email already exists. Try signing in instead.",
  "auth/weak-password": "Password is too weak. Use at least 6 characters.",
  "auth/invalid-email": "That email address does not look valid.",
  "auth/too-many-requests":
    "Too many attempts. Please wait a moment and try again.",
  "auth/network-request-failed":
    "Network problem. Check your connection and try again.",
  "auth/user-disabled": "This account has been disabled. Contact support.",
};

const FALLBACK = "Something went wrong. Please try again.";

export function readableAuthError(error: unknown): string {
  if (error instanceof FirebaseError) {
    return MESSAGES[error.code] ?? FALLBACK;
  }
  // Surface our own config message (missing .env.local values) verbatim.
  if (error instanceof Error && error.message.includes("Firebase web config")) {
    return error.message;
  }
  if (error instanceof Error && error.message !== "") {
    return error.message;
  }
  return FALLBACK;
}
