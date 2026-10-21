import { z } from "zod";
import { dateField } from "./validation";

/**
 * Report periods (SPEC 5.5). All dates are calendar strings "YYYY-MM-DD" in
 * the business time zone (default Asia/Karachi): "today" comes from
 * todayInTimeZone(), and records already store their local date, so period
 * filtering is a plain string comparison with no UTC conversion.
 * Calendar arithmetic below uses UTC Date only as a day counter.
 */

export const PERIOD_PRESETS = ["this-month", "last-month", "last-30-days", "custom"] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export const MAX_CUSTOM_RANGE_DAYS = 366;

export type Period = { preset: PeriodPreset; from: string; to: string; days: number; label: string };

function toUtc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function fromUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** Inclusive number of calendar days from `from` to `to` (1 when equal). */
export function daysInclusive(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000) + 1;
}

export function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function endOfMonth(date: string): string {
  const d = toUtc(startOfMonth(date));
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return fromUtc(d);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(date: string): number {
  return (toUtc(date).getUTCDay() + 6) % 7;
}

const rawSchema = z.object({
  period: z.enum(PERIOD_PRESETS).catch("this-month"),
  from: dateField.optional().catch(undefined),
  to: dateField.optional().catch(undefined),
});

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "" ? undefined : v;
}

export type PeriodResult = { period: Period; error: string | null };

/**
 * Validate searchParams and resolve a period relative to `today` (the local
 * date in the business time zone). Invalid input falls back to this month
 * with an explanatory error instead of throwing.
 */
export function resolvePeriod(
  searchParams: Record<string, string | string[] | undefined>,
  today: string,
): PeriodResult {
  const parsed = rawSchema.parse({
    period: first(searchParams.period),
    from: first(searchParams.from),
    to: first(searchParams.to),
  });
  const make = (preset: PeriodPreset, from: string, to: string, label: string): Period => ({
    preset,
    from,
    to,
    days: daysInclusive(from, to),
    label,
  });
  const thisMonth = make("this-month", startOfMonth(today), today, "This month (to date)");

  switch (parsed.period) {
    case "last-month": {
      const lastDay = addDays(startOfMonth(today), -1);
      return { period: make("last-month", startOfMonth(lastDay), lastDay, "Last month"), error: null };
    }
    case "last-30-days":
      return { period: make("last-30-days", addDays(today, -29), today, "Last 30 days"), error: null };
    case "custom": {
      const { from, to } = parsed;
      if (!from || !to) {
        return { period: thisMonth, error: "Choose both a start and end date for a custom range." };
      }
      if (from > to) {
        return { period: thisMonth, error: "The start date must be on or before the end date." };
      }
      if (daysInclusive(from, to) > MAX_CUSTOM_RANGE_DAYS) {
        return { period: thisMonth, error: `A custom range can be at most ${MAX_CUSTOM_RANGE_DAYS} days.` };
      }
      return { period: make("custom", from, to, "Custom range"), error: null };
    }
    default:
      return { period: thisMonth, error: null };
  }
}

export function inPeriod(date: string, period: { from: string; to: string }): boolean {
  return date >= period.from && date <= period.to;
}
