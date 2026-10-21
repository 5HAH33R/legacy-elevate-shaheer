import { assertMinorUnits, type MinorUnits } from "./money";

/**
 * Ratios and per-unit pricing (SPEC 5.4, 8.3). Percentages are integer
 * basis points (1 bp = 0.01%) so nothing here ever produces NaN/Infinity:
 * an invalid denominator returns an explicit "undefined" result with a
 * human-readable reason instead.
 */
export type Ratio =
  | { kind: "ok"; basisPoints: number }
  | { kind: "undefined"; reason: string };

/** Round half away from zero (deterministic for negatives too). */
function roundHalfAway(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

/**
 * numerator / denominator as basis points, rounded half away from zero.
 * Denominator must be a positive amount; zero/negative/non-integer → undefined.
 */
export function ratioBasisPoints(
  numerator: MinorUnits,
  denominator: MinorUnits,
  reasonWhenInvalid = "Not calculable: the base amount is zero or negative.",
): Ratio {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) {
    return { kind: "undefined", reason: "Not calculable: invalid amount." };
  }
  if (denominator <= 0) return { kind: "undefined", reason: reasonWhenInvalid };
  const scaled = numerator * 10_000;
  const bps = Number.isSafeInteger(scaled)
    ? roundHalfAway(scaled / denominator)
    : roundHalfAway((numerator / denominator) * 10_000);
  return { kind: "ok", basisPoints: bps };
}

/** 1234 → "12.34%", -50 → "-0.50%". Integer arithmetic only. */
export function formatBasisPoints(bps: number): string {
  if (!Number.isSafeInteger(bps)) return "—";
  const negative = bps < 0;
  const abs = Math.abs(bps);
  const whole = Math.trunc(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");
  return `${negative ? "-" : ""}${whole.toLocaleString("en-US")}.${fraction}%`;
}

/** Display a Ratio safely: percentage text or the reason it is undefined. */
export function formatRatio(ratio: Ratio): string {
  return ratio.kind === "ok" ? formatBasisPoints(ratio.basisPoints) : "Not calculable";
}

export type PriceScenario = {
  sellingPrice: MinorUnits;
  unitCost: MinorUnits;
  /** sellingPrice − unitCost (gross profit per unit, before any expenses). */
  unitMargin: MinorUnits;
  /** unitMargin / sellingPrice. */
  marginPct: Ratio;
  /** unitMargin / unitCost. */
  markupPct: Ratio;
  status: "profit" | "break-even" | "loss";
  warnings: string[];
};

/**
 * One pricing scenario. Formulas:
 *   unit margin = price − cost
 *   margin %    = (price − cost) / price   (undefined when price ≤ 0)
 *   markup %    = (price − cost) / cost    (undefined when cost ≤ 0)
 * Negative inputs are rejected by the caller's validation; this function
 * still never returns NaN.
 */
export function calcPriceScenario(
  sellingPrice: MinorUnits,
  unitCost: MinorUnits,
): PriceScenario {
  assertMinorUnits(sellingPrice);
  assertMinorUnits(unitCost);
  const unitMargin = sellingPrice - unitCost;
  const warnings: string[] = [];
  if (unitCost <= 0) {
    warnings.push(
      "Unit cost is zero or unknown, so margin is overstated and markup cannot be calculated.",
    );
  }
  if (sellingPrice <= 0) warnings.push("Selling price is zero — margin % is not defined.");
  return {
    sellingPrice,
    unitCost,
    unitMargin,
    marginPct: ratioBasisPoints(
      unitMargin,
      sellingPrice,
      "Not calculable: selling price is zero.",
    ),
    markupPct: ratioBasisPoints(
      unitMargin,
      unitCost,
      "Not calculable: unit cost is zero or unknown.",
    ),
    status: unitMargin > 0 ? "profit" : unitMargin === 0 ? "break-even" : "loss",
    warnings,
  };
}
