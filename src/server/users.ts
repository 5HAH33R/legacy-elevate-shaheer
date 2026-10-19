import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import type { SessionUser } from "./session";

/**
 * Create users/{uid} on first sign-in and refresh name/email on later ones
 * (SPEC.md 9.1). Server-side only; the client never writes user profiles.
 */
export async function ensureUserRecord(user: SessionUser): Promise<void> {
  const ref = getAdminDb().collection("users").doc(user.uid);
  const snapshot = await ref.get();
  const base = {
    uid: user.uid,
    name: user.name ?? "",
    email: user.email ?? "",
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (!snapshot.exists) {
    await ref.set({ ...base, createdAt: FieldValue.serverTimestamp() });
  } else {
    await ref.update(base);
  }
}
