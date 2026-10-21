import { describe, expect, it } from "vitest";
import { calcPriceScenario, formatRatio, ratioBasisPoints } from "./pricing";

function noNaN(s: ReturnType<typeof calcPriceScenario>) {
  expect(Number.isNaN(s.unitMargin)).toBe(false);
  for (const r of [s.marginPct, s.markupPct]) {
    if (r.kind === "ok") expect(Number.isFinite(r.basisPoints)).toBe(true);
  }
}

describe("calcPriceScenario", () => {
  it("price below cost is a loss", () => {
    const s = calcPriceScenario(1000, 1500);
    expect(s.status).toBe("loss");
    expect(s.unitMargin).toBe(-500);
    expect(s.marginPct).toEqual({ kind: "ok", basisPoints: -5000 });
    expect(s.markupPct).toEqual({ kind: "ok", basisPoints: -3333 });
    noNaN(s);
  });

  it("price equal to cost is break-even", () => {
    const s = calcPriceScenario(1000, 1000);
    expect(s.status).toBe("break-even");
    expect(s.marginPct).toEqual({ kind: "ok", basisPoints: 0 });
  });

  it("cost 0 → markup not calculable, warning", () => {
    const s = calcPriceScenario(1000, 0);
    expect(s.markupPct.kind).toBe("undefined");
    expect(formatRatio(s.markupPct)).toBe("Not calculable");
    expect(s.warnings.length).toBeGreaterThan(0);
    noNaN(s);
  });

  it("price 0 → margin not calculable", () => {
    const s = calcPriceScenario(0, 500);
    expect(s.marginPct.kind).toBe("undefined");
    expect(s.status).toBe("loss");
    expect(s.warnings.join(" ")).toMatch(/zero/);
    noNaN(s);
  });

  it("both zero never produces NaN", () => {
    noNaN(calcPriceScenario(0, 0));
  });

  it("handles large values", () => {
    const s = calcPriceScenario(10_000_000_000, 5_000_000_000);
    expect(s.marginPct).toEqual({ kind: "ok", basisPoints: 5000 });
    noNaN(s);
  });
});

describe("ratio formatting", () => {
  it("rounds half away from zero and formats", () => {
    expect(formatRatio(ratioBasisPoints(1, 3))).toBe("33.33%");
    expect(formatRatio(ratioBasisPoints(-1, 8))).toBe("-12.50%");
    expect(ratioBasisPoints(5, 0).kind).toBe("undefined");
    expect(ratioBasisPoints(5, -1).kind).toBe("undefined");
  });
});
