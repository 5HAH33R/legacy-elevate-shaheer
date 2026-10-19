import "server-only";

/** Firestore Timestamp → ISO string for client-safe serialization. */
export function toIso(value: unknown): string | null {
  if (value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

/** Defensive number read for Firestore data written by this app. */
export function toNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Defensive string read; null when missing or empty. */
export function toNullableString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}
