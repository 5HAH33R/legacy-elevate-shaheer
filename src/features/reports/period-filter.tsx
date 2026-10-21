import Link from "next/link";
import { AlertIcon } from "@/components/icons";
import type { Period } from "@/lib/periods";
import { inputClass, labelClass, secondaryButtonClass } from "@/features/auth/ui";

const PRESETS = [
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "last-30-days", label: "Last 30 days" },
] as const;

function readable(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Period switch: presets as a segmented row of plain links, and a custom
 * range as a GET form (works without JS). Validation happens in resolvePeriod().
 */
export function PeriodFilter({
  period,
  error,
  requested,
}: {
  period: Period;
  error: string | null;
  requested: { period?: string; from?: string; to?: string };
}) {
  const customOpen = period.preset === "custom" || requested.period === "custom";

  return (
    <section aria-label="Reporting period" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Period" className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface-muted p-1">
          {PRESETS.map((p) => {
            const active = !error && period.preset === p.value;
            return (
              <Link
                key={p.value}
                href={`?period=${p.value}`}
                aria-current={active ? "page" : undefined}
                className={`h-8 rounded-md px-3 text-sm leading-8 transition ${
                  active ? "bg-surface font-medium text-foreground shadow-[0_0_0_1px_var(--border)]" : "text-muted hover:text-foreground"
                }`}
              >
                {p.label}
              </Link>
            );
          })}
          <span
            className={`h-8 rounded-md px-3 text-sm leading-8 ${
              period.preset === "custom" ? "bg-surface font-medium text-foreground shadow-[0_0_0_1px_var(--border)]" : "text-muted"
            }`}
          >
            Custom
          </span>
        </nav>
        <p className="num text-sm text-muted">
          {readable(period.from)} – {readable(period.to)} · {period.days} {period.days === 1 ? "day" : "days"}
        </p>
      </div>

      <details open={customOpen} className="group text-sm">
        <summary className="w-fit cursor-pointer text-muted hover:text-foreground">Choose dates</summary>
        <form method="get" className="mt-3 flex flex-wrap items-end gap-3">
          <input type="hidden" name="period" value="custom" />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="from" className={labelClass}>From</label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={requested.from ?? (period.preset === "custom" ? period.from : "")}
              className={`${inputClass} w-auto`}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="to" className={labelClass}>To</label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={requested.to ?? (period.preset === "custom" ? period.to : "")}
              className={`${inputClass} w-auto`}
            />
          </div>
          <button type="submit" className={`${secondaryButtonClass} h-10`}>
            Show range
          </button>
        </form>
      </details>

      {error ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-danger">
          <AlertIcon className="shrink-0" />
          {error} Showing this month instead.
        </p>
      ) : null}
    </section>
  );
}
