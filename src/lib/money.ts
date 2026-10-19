/**
 * Money helpers. Authoritative amounts are integers in the smallest currency
 * unit (paisa for PKR). Never use floating-point arithmetic on money; only
 * format to a decimal string at the display edge. See AGENTS.md section 9.
 */

/** An integer amount in minor units (e.g. paisa). */
export type MinorUnits = number;

export const MINOR_UNITS_PER_MAJOR = 100;

const AMOUNT_PATTERN = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;

export class InvalidMoneyError extends Error {
  constructor(input: string) {
    super(`Invalid money amount: "${input}"`);
    this.name = "InvalidMoneyError";
  }
}

/**
 * Parses a decimal amount such as "1,250.50" into minor units (125050)
 * without floating-point rounding. Accepts up to two decimal places and
 * optional thousands separators.
 */
export function parseMoney(input: string): MinorUnits {
  const normalized = input.trim().replace(/,/g, "");
  const match = AMOUNT_PATTERN.exec(normalized);
  if (!match) throw new InvalidMoneyError(input);

  const [, sign, whole, fraction = ""] = match;
  const minor =
    Number(whole) * MINOR_UNITS_PER_MAJOR + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor)) throw new InvalidMoneyError(input);

  return sign && minor !== 0 ? -minor : minor;
}

export function assertMinorUnits(value: number): asserts value is MinorUnits {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Money must be a safe integer in minor units, got ${value}`);
  }
}

/** Multiplies a unit price by a whole quantity, staying in integers. */
export function multiplyMoney(unitPrice: MinorUnits, quantity: number): MinorUnits {
  assertMinorUnits(unitPrice);
  if (!Number.isSafeInteger(quantity)) {
    throw new RangeError(`Quantity must be a whole number, got ${quantity}`);
  }
  const result = unitPrice * quantity;
  assertMinorUnits(result);
  return result;
}

export function sumMoney(amounts: readonly MinorUnits[]): MinorUnits {
  let total = 0;
  for (const amount of amounts) {
    assertMinorUnits(amount);
    total += amount;
  }
  assertMinorUnits(total);
  return total;
}

/** Formats minor units as a plain decimal string for form inputs, e.g. 125050 -> "1250.50". */
export function minorToDecimalString(amount: MinorUnits): string {
  assertMinorUnits(amount);
  const negative = amount < 0;
  const absolute = Math.abs(amount);
  const whole = Math.trunc(absolute / MINOR_UNITS_PER_MAJOR);
  const fraction = String(absolute % MINOR_UNITS_PER_MAJOR).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/** Formats minor units for display, e.g. 125050 -> "Rs 1,250.50". */
export function formatMoney(
  amount: MinorUnits,
  currency = "PKR",
  locale = "en-PK",
): string {
  assertMinorUnits(amount);
  const negative = amount < 0;
  const absolute = Math.abs(amount);
  const whole = Math.trunc(absolute / MINOR_UNITS_PER_MAJOR);
  const fraction = absolute % MINOR_UNITS_PER_MAJOR;

  // Format the integer part only, then append the exact fraction, so display
  // never depends on floating-point division.
  const parts = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).formatToParts(whole);
  const fractionText = `.${String(fraction).padStart(2, "0")}`;
  const integerEnd = parts.findLastIndex((part) => part.type === "integer");
  const formatted = parts
    .map((part, index) => (index === integerEnd ? part.value + fractionText : part.value))
    .join("");

  return negative ? `-${formatted}` : formatted;
}
