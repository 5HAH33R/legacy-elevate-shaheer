import type { Period } from "@/lib/periods";
import { inputClass, labelClass } from "@/features/auth/ui";

const PRESETS = [
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "last-30-days", label: "Last 30 days" },
  { value: "custom", label: "Custom range" },
] as const;

/** Plain GET form (works without JS); validation happens in resolvePeriod(). */
export function PeriodFilter({
  period,
  error,
  requested,
}: {
  period: Period;
  error: string | null;
  requested: { period?: string; from?: string; to?: string };
}) {
  const selected = error ? requested.period : period.preset;
  return (
    <section aria-labelledby="period-heading" className="rounded-2xl border border-border bg-surface p-5">
      <h2 id="period-heading" className="text-base font-semibold">Reporting period</h2>
      <form method="get" className="mt-3 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="period" className={labelClass}>Period</label>
          <select id="period" name="period" defaultValue={selected ?? "this-month"} className={inputClass}>
            {PRESETS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="from" className={labelClass}>From (custom)</label>
          <input id="from" name="from" type="date" defaultValue={requested.from ?? (period.preset === "custom" ? period.from : "")} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="to" className={labelClass}>To (custom)</label>
          <input id="to" name="to" type="date" defaultValue={requested.to ?? (period.preset === "custom" ? period.to : "")} className={inputClass} />
        </div>
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Apply
        </button>
      </form>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          <span aria-hidden="true">⚠ </span>{error} Showing this month instead.
        </p>
      ) : null}
      <p className="mt-3 text-sm text-muted">
        Showing <strong className="text-foreground">{period.label}</strong>: {period.from} to {period.to} ({period.days}{" "}
        {period.days === 1 ? "day" : "days"}, business time zone).
      </p>
    </section>
  );
}
