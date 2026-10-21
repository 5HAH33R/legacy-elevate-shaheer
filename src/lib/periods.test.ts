import { describe, expect, it } from "vitest";
import { MAX_CUSTOM_RANGE_DAYS, resolvePeriod } from "./periods";

describe("resolvePeriod", () => {
  it("defaults to this month to date", () => {
    const r = resolvePeriod({}, "2025-03-15");
    expect(r.error).toBeNull();
    expect(r.period).toMatchObject({ preset: "this-month", from: "2025-03-01", to: "2025-03-15", days: 15 });
  });

  it("last-month covers the whole previous month (Feb 28 / Feb 29)", () => {
    expect(resolvePeriod({ period: "last-month" }, "2025-03-15").period).toMatchObject({
      from: "2025-02-01",
      to: "2025-02-28",
    });
    expect(resolvePeriod({ period: "last-month" }, "2024-03-10").period).toMatchObject({
      from: "2024-02-01",
      to: "2024-02-29",
    });
  });

  it("handles Jan 31 and the Dec→Jan boundary", () => {
    expect(resolvePeriod({}, "2025-01-31").period).toMatchObject({ from: "2025-01-01", to: "2025-01-31", days: 31 });
    expect(resolvePeriod({ period: "last-month" }, "2025-01-05").period).toMatchObject({
      from: "2024-12-01",
      to: "2024-12-31",
    });
  });

  it("last-30-days is 30 inclusive days ending today", () => {
    expect(resolvePeriod({ period: "last-30-days" }, "2025-03-15").period).toMatchObject({
      from: "2025-02-14",
      to: "2025-03-15",
      days: 30,
    });
  });

  it("accepts a valid custom range", () => {
    const r = resolvePeriod({ period: "custom", from: "2025-01-01", to: "2025-01-10" }, "2025-03-15");
    expect(r.error).toBeNull();
    expect(r.period).toMatchObject({ preset: "custom", days: 10 });
  });

  it("rejects missing, reversed and too-long custom ranges with an error and a fallback", () => {
    const missing = resolvePeriod({ period: "custom", from: "2025-01-01" }, "2025-03-15");
    expect(missing.error).toMatch(/both a start and end/);
    expect(missing.period.preset).toBe("this-month");

    const reversed = resolvePeriod({ period: "custom", from: "2025-02-01", to: "2025-01-01" }, "2025-03-15");
    expect(reversed.error).toMatch(/on or before/);

    const long = resolvePeriod({ period: "custom", from: "2024-01-01", to: "2025-01-01" }, "2025-03-15");
    expect(long.error).toContain(String(MAX_CUSTOM_RANGE_DAYS));

    const max = resolvePeriod({ period: "custom", from: "2024-01-01", to: "2024-12-31" }, "2025-03-15");
    expect(max.error).toBeNull();
  });

  it("never throws on garbage params", () => {
    expect(resolvePeriod({ period: "nonsense" }, "2025-03-15").error).toBeNull();
    expect(resolvePeriod({ period: "custom", from: "abc", to: ["x"] }, "2025-03-15").error).not.toBeNull();
    expect(resolvePeriod({ period: ["last-month", "x"] }, "2025-03-15").period.preset).toBe("last-month");
  });
});
