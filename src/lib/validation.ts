import { z } from "zod";
import { parseMoney, type MinorUnits } from "./money";

/**
 * Shared Zod fields for API trust boundaries. Money arrives as a decimal
 * string ("1250.50") and is parsed to integer minor units with parseMoney —
 * never through floating point (AGENTS.md section 9).
 */
export function moneyField(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .transform((value, ctx): MinorUnits => {
      let amount: MinorUnits;
      try {
        amount = parseMoney(value);
      } catch {
        ctx.addIssue({
          code: "custom",
          message: `${label} must be an amount like 1250 or 1250.50.`,
        });
        return z.NEVER;
      }
      if (amount < 0) {
        ctx.addIssue({ code: "custom", message: `${label} cannot be negative.` });
        return z.NEVER;
      }
      return amount;
    });
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Calendar date string "YYYY-MM-DD", refined to reject impossible dates. */
export const dateField = z
  .string()
  .trim()
  .regex(DATE_PATTERN, "Use a date like 2025-01-31.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, "That date does not exist.");

/** Non-negative whole number (stock quantities, thresholds). */
export function countField(label: string) {
  return z
    .number()
    .int(`${label} must be a whole number.`)
    .min(0, `${label} cannot be negative.`)
    .max(1_000_000, `${label} is too large.`);
}
