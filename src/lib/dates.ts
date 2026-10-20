export const DEFAULT_TIME_ZONE = "Asia/Karachi";

/** True when `tz` is an IANA zone name this runtime understands. */
export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Calendar date "YYYY-MM-DD" at instant `now` in the given IANA time zone. */
export function todayInTimeZone(
  tz: string = DEFAULT_TIME_ZONE,
  now: Date = new Date(),
): string {
  const zone = isValidTimeZone(tz) ? tz : DEFAULT_TIME_ZONE;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
