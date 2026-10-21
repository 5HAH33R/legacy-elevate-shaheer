import { describe, expect, it } from "vitest";
import { buildTrend, summarizePeriod, type ReportSale } from "./reports";

const range = { from: "2025-03-01", to: "2025-03-31" };

function sale(date: string, unitPrice: number, unitCost: number, quantity = 1): ReportSale {
  return {
    date,
    total: unitPrice * quantity,
    items: [{ productId: "p1", name: "Flour", unitPrice, unitCost, quantity }],
  };
}

const codes = (s: ReturnType<typeof summarizePeriod>) => s.warnings.map((w) => w.code);

describe("summarizePeriod", () => {
  it("computes revenue, COGS, gross profit, margin and estimated net profit", () => {
    const s = summarizePeriod(range, [sale("2025-03-02", 1000, 600, 2)], [
      { date: "2025-03-03", amount: 300, voided: false },
    ]);
    expect(s).toMatchObject({ revenue: 2000, cogs: 1200, grossProfit: 800, expenses: 300, estimatedNetProfit: 500 });
    expect(s.grossMargin).toEqual({ kind: "ok", basisPoints: 4000 });
    expect(codes(s)).not.toContain("no-expenses");
  });

  it("zero sales: no NaN, margin not calculable, no-sales warning", () => {
    const s = summarizePeriod(range, [], []);
    expect(s.revenue).toBe(0);
    expect(s.grossMargin.kind).toBe("undefined");
    expect(codes(s)).toEqual(expect.arrayContaining(["no-sales", "no-expenses"]));
    expect(s.looksComplete).toBe(false);
  });

  it("warns about zero-cost items", () => {
    expect(codes(summarizePeriod(range, [sale("2025-03-02", 1000, 0)], []))).toContain("zero-cost");
  });

  it("excludes voided expenses and out-of-period records", () => {
    const s = summarizePeriod(range, [sale("2025-02-28", 1000, 1), sale("2025-03-01", 500, 1)], [
      { date: "2025-03-05", amount: 999, voided: true },
      { date: "2025-03-06", amount: 100, voided: false },
      { date: "2025-04-01", amount: 777, voided: false },
    ]);
    expect(s.expenses).toBe(100);
    expect(s.revenue).toBe(500);
  });

  it("warns on voided purchases in the period only", () => {
    const s = summarizePeriod(range, [], [], [
      { date: "2025-03-10", voided: true },
      { date: "2025-02-10", voided: true },
      { date: "2025-03-11", voided: false },
    ]);
    const w = s.warnings.find((x) => x.code === "voided-purchases");
    expect(w?.message).toMatch(/^1 purchase was voided/);
  });

  it("has no warnings when data looks complete", () => {
    const s = summarizePeriod(range, [sale("2025-03-02", 1000, 600)], [{ date: "2025-03-03", amount: 1, voided: false }]);
    expect(s.warnings).toEqual([]);
    expect(s.looksComplete).toBe(true);
  });
});

describe("buildTrend", () => {
  it("uses daily buckets for ranges up to 31 days", () => {
    const t = buildTrend(range, [sale("2025-03-02", 100, 1), sale("2025-03-09", 200, 1)], []);
    expect(t.kind).toBe("ok");
    if (t.kind === "ok") {
      expect(t.granularity).toBe("day");
      expect(t.buckets).toHaveLength(31);
    }
  });

  it("uses Monday-start weekly buckets for longer ranges, clipped to the range", () => {
    const t = buildTrend({ from: "2025-01-01", to: "2025-03-31" }, [sale("2025-01-02", 100, 1), sale("2025-01-08", 50, 1)], []);
    expect(t.kind).toBe("ok");
    if (t.kind === "ok") {
      expect(t.granularity).toBe("week");
      expect(t.buckets[0]).toMatchObject({ from: "2025-01-01", to: "2025-01-05", revenue: 100 });
      expect(t.buckets[1]).toMatchObject({ from: "2025-01-06", to: "2025-01-12", revenue: 50 });
      expect(t.buckets[t.buckets.length - 1].to).toBe("2025-03-31");
    }
  });

  it("reports not-enough-data with a single active bucket or none", () => {
    const one = buildTrend(range, [sale("2025-03-02", 100, 1), sale("2025-03-02", 50, 1)], []);
    expect(one.kind).toBe("not-enough-data");
    const none = buildTrend(range, [], []);
    expect(none.kind).toBe("not-enough-data");
  });

  it("ignores voided expenses", () => {
    const t = buildTrend(range, [], [
      { date: "2025-03-02", amount: 5, voided: true },
      { date: "2025-03-03", amount: 5, voided: false },
    ]);
    expect(t.kind).toBe("not-enough-data");
  });
});
