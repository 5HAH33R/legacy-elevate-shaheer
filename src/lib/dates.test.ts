import { describe, expect, it } from "vitest";
import { isValidTimeZone, todayInTimeZone } from "./dates";

describe("todayInTimeZone", () => {
  it("is still the previous day just before midnight in Karachi", () => {
    // 23:59 PKT on 2025-02-01 = 18:59 UTC
    expect(todayInTimeZone("Asia/Karachi", new Date("2025-02-01T18:59:00Z"))).toBe(
      "2025-02-01",
    );
  });

  it("rolls over exactly at midnight in Karachi (UTC date is still yesterday)", () => {
    // 00:00 PKT on 2025-02-02 = 19:00 UTC on 2025-02-01
    const at = new Date("2025-02-01T19:00:00Z");
    expect(todayInTimeZone("Asia/Karachi", at)).toBe("2025-02-02");
    expect(at.toISOString().slice(0, 10)).toBe("2025-02-01");
  });

  it("returns the Karachi date at 3 AM local", () => {
    expect(todayInTimeZone("Asia/Karachi", new Date("2025-02-01T22:00:00Z"))).toBe(
      "2025-02-02",
    );
  });

  it("defaults to Asia/Karachi and falls back for bad zones", () => {
    const at = new Date("2025-02-01T19:30:00Z");
    expect(todayInTimeZone(undefined, at)).toBe("2025-02-02");
    expect(todayInTimeZone("Not/AZone", at)).toBe("2025-02-02");
  });

  it("validates IANA names", () => {
    expect(isValidTimeZone("Asia/Karachi")).toBe(true);
    expect(isValidTimeZone("Mars/Base")).toBe(false);
  });
});
