import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, totpAt, verifyTotp } from "./totp";
import { encodeQr } from "./qr";

const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("TOTP RFC 6238 vectors (SHA-1, 8 digits)", () => {
  const vectors: [number, string][] = [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
  ];
  for (const [t, code] of vectors) {
    it(`T=${t}`, () => {
      expect(totpAt(RFC_SECRET, t * 1000, 8)).toBe(code);
    });
  }
});

describe("verifyTotp", () => {
  const now = 1234567890 * 1000;
  const code = totpAt(RFC_SECRET, now);
  it("accepts current and adjacent steps, rejects others", () => {
    expect(verifyTotp(RFC_SECRET, code, now)).toBe(Math.floor(now / 30000));
    expect(verifyTotp(RFC_SECRET, code, now + 30000)).not.toBeNull();
    expect(verifyTotp(RFC_SECRET, code, now + 90000)).toBeNull();
    expect(verifyTotp(RFC_SECRET, "abc123", now)).toBeNull();
  });
  it("rejects replay of an already used step", () => {
    const step = Math.floor(now / 30000);
    expect(verifyTotp(RFC_SECRET, code, now, step)).toBeNull();
  });
  it("base32 round trips", () => {
    expect(base32Decode(base32Encode(Buffer.from("hello"))).toString()).toBe("hello");
  });
});

describe("qr encoder", () => {
  it("produces a square matrix with finder patterns", () => {
    const m = encodeQr("otpauth://totp/Elevate:a@b.co?secret=ABCDEFGHIJKLMNOPQRSTUVWXYZ234567&issuer=Elevate");
    expect(m.length).toBe(m[0].length);
    expect((m.length - 17) % 4).toBe(0);
    expect(m[0].slice(0, 7).every(Boolean)).toBe(true);
    expect(m[3][3]).toBe(true);
  });
});
