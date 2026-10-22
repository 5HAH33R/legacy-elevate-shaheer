import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { generateTotpSecret, otpauthUri, verifyTotp } from "@/lib/totp";
import { ApiError } from "./errors";

/**
 * In-app TOTP (RFC 6238). All MFA state lives on users/{uid} and is only ever
 * read or written for the verified session uid. The secret is encrypted at
 * rest and never returned after setup.
 */

const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const TEMP_TOKEN_MS = 5 * 60 * 1000;

function masterKey(): Buffer {
  const raw = process.env.MFA_ENCRYPTION_KEY;
  if (!raw || raw.length < 16) {
    throw new ApiError(503, "Two-step verification is not configured on the server.");
  }
  return createHash("sha256").update(raw).digest();
}

function subKey(purpose: string): Buffer {
  return createHmac("sha256", masterKey()).update(purpose).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", subKey("enc"), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptSecret(blob: string): string {
  const buf = Buffer.from(blob, "base64");
  const decipher = createDecipheriv("aes-256-gcm", subKey("enc"), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

/** Short-lived HMAC-signed token proving the password step passed for uid. */
export function signTempToken(uid: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ uid, exp: now + TEMP_TOKEN_MS })).toString("base64url");
  const sig = createHmac("sha256", subKey("temp")).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyTempToken(token: string, now = Date.now()): string {
  const [payload, sig] = token.split(".");
  const fail = () => new ApiError(401, "This sign-in expired. Go back and sign in again.");
  if (!payload || !sig) throw fail();
  const expected = createHmac("sha256", subKey("temp")).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw fail();
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { uid?: string; exp?: number };
    if (!data.uid || typeof data.exp !== "number" || data.exp < now) throw fail();
    return data.uid;
  } catch {
    throw fail();
  }
}

const userRef = (uid: string) => getAdminDb().collection("users").doc(uid);

export async function isMfaEnabled(uid: string): Promise<boolean> {
  const snap = await userRef(uid).get();
  return snap.exists && snap.get("mfaEnabled") === true;
}

type Field = "mfaSecret" | "mfaPendingSecret";

/**
 * Verify a code against one stored secret with lockout and replay protection.
 * Returns the matched step; throws ApiError on failure or lockout.
 */
async function consumeCode(uid: string, field: Field, code: string, now = Date.now()): Promise<number> {
  const db = getAdminDb();
  const ref = userRef(uid);
  const outcome = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const enc = snap.get(field) as string | undefined;
    if (!enc) return { kind: "none" as const };
    const lockedUntil = (snap.get("mfaLockedUntil") as number | undefined) ?? 0;
    if (lockedUntil > now) return { kind: "locked" as const };
    const lastStep = (snap.get("mfaLastStep") as number | undefined) ?? -1;
    const step = verifyTotp(decryptSecret(enc), code, now, lastStep);
    if (step === null) {
      const attempts = ((snap.get("mfaFailedAttempts") as number | undefined) ?? 0) + 1;
      if (attempts >= MAX_ATTEMPTS) {
        tx.update(ref, { mfaFailedAttempts: 0, mfaLockedUntil: now + LOCK_MS });
      } else {
        tx.update(ref, { mfaFailedAttempts: attempts });
      }
      return { kind: "bad" as const };
    }
    tx.update(ref, { mfaFailedAttempts: 0, mfaLockedUntil: 0, mfaLastStep: step });
    return { kind: "ok" as const, step };
  });
  if (outcome.kind === "ok") return outcome.step;
  if (outcome.kind === "locked") {
    throw new ApiError(429, "Too many wrong codes. Try again in 15 minutes.");
  }
  if (outcome.kind === "none") throw new ApiError(400, "Two-step verification is not set up.");
  throw new ApiError(401, "That code is not correct. Check the app and try again.");
}

export async function startSetup(uid: string, email: string) {
  if (await isMfaEnabled(uid)) throw new ApiError(409, "2FA is already enabled.");
  const secret = generateTotpSecret();
  const enc = encryptSecret(secret);
  await userRef(uid).set({ mfaPendingSecret: enc, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { secret, uri: otpauthUri(email, secret) };
}

export async function confirmSetup(uid: string, code: string) {
  await consumeCode(uid, "mfaPendingSecret", code);
  const snap = await userRef(uid).get();
  await userRef(uid).update({
    mfaEnabled: true,
    mfaSecret: snap.get("mfaPendingSecret"),
    mfaPendingSecret: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function verifySignInCode(uid: string, code: string) {
  await consumeCode(uid, "mfaSecret", code);
}

export async function disableMfa(uid: string, code: string) {
  await consumeCode(uid, "mfaSecret", code);
  await userRef(uid).update({
    mfaEnabled: false,
    mfaSecret: FieldValue.delete(),
    mfaPendingSecret: FieldValue.delete(),
    mfaLastStep: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}
