import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Pure RFC 4226 / RFC 6238 TOTP (HMAC-SHA1) using only node:crypto. */

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_STEP_SECONDS = 30;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of text.replace(/=+$/, "").toUpperCase()) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error("Invalid base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** 160-bit random secret, base32 encoded (32 characters). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function otpauthUri(email: string, secret: string): string {
  const label = encodeURIComponent(`Elevate:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=Elevate`;
}

export function hotp(key: Buffer, counter: number, digits = 6): string {
  const msg = Buffer.alloc(8);
  msg.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  msg.writeUInt32BE(counter >>> 0, 4);
  const h = createHmac("sha1", key).update(msg).digest();
  const offset = h[h.length - 1] & 15;
  const bin =
    ((h[offset] & 0x7f) << 24) |
    (h[offset + 1] << 16) |
    (h[offset + 2] << 8) |
    h[offset + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export function totpAt(secret: string, timeMs: number, digits = 6): string {
  const step = Math.floor(timeMs / 1000 / TOTP_STEP_SECONDS);
  return hotp(base32Decode(secret), step, digits);
}

/**
 * Check a code within ±1 step. Returns the matched time step, or null.
 * Steps <= lastUsedStep are rejected (replay protection).
 */
export function verifyTotp(
  secret: string,
  code: string,
  timeMs: number,
  lastUsedStep = -1,
): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const key = base32Decode(secret);
  const current = Math.floor(timeMs / 1000 / TOTP_STEP_SECONDS);
  let matched: number | null = null;
  for (const delta of [-1, 0, 1]) {
    const step = current + delta;
    const expected = Buffer.from(hotp(key, step));
    const ok = timingSafeEqual(expected, Buffer.from(code));
    if (ok && step > lastUsedStep && matched === null) matched = step;
  }
  return matched;
}
