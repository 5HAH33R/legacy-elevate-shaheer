import { AlertIcon, InfoIcon } from "@/components/icons";
import { formatMoney } from "@/lib/money";
import { formatRatio } from "@/lib/pricing";
import type { PeriodSummary } from "@/lib/reports";

type Step = {
  op: "−" | "=" | null;
  label: string;
  value: string;
  hint: string;
  lead?: boolean;
  negative?: boolean;
};

/**
 * The profit ladder: revenue − cost of goods = gross profit − recorded
 * expenses = estimated net profit, read left to right as one sum. Every value
 * comes from summarizePeriod(); nothing is computed here.
 */
export function SummaryCards({ summary, currency }: { summary: PeriodSummary; currency: string }) {
  const m = (v: number) => formatMoney(v, currency);
  const steps: Step[] = [
    {
      op: null,
      label: "Revenue",
      value: m(summary.revenue),
      hint: `${summary.saleCount} sale${summary.saleCount === 1 ? "" : "s"}`,
    },
    { op: "−", label: "Cost of goods sold", value: m(summary.cogs), hint: "Unit cost saved on each sale" },
    {
      op: "=",
      label: "Gross profit",
      value: m(summary.grossProfit),
      hint: `${formatRatio(summary.grossMargin)} gross margin`,
      negative: summary.grossProfit < 0,
    },
    {
      op: "−",
      label: "Recorded expenses",
      value: m(summary.expenses),
      hint: `${summary.expenseCount} expense${summary.expenseCount === 1 ? "" : "s"}, voided excluded`,
    },
    {
      op: "=",
      label: "Estimated net profit",
      value: m(summary.estimatedNetProfit),
      hint: "Only deducts expenses you recorded",
      lead: true,
      negative: summary.estimatedNetProfit < 0,
    },
  ];

  return (
    <section aria-labelledby="ladder-heading" className="flex flex-col gap-3 animate-fade-in">
      <h2 id="ladder-heading" className="sr-only">
        Profit for the period
      </h2>
      {/* gap-px over a border-coloured ground draws the hairlines at every width. */}
      <ol className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.25fr)] shadow-xs">
        {steps.map((s) => (
          <li
            key={s.label}
            className={`relative px-5 py-4 transition-colors duration-150 hover:bg-active/40 lg:py-5 ${
              s.lead
                ? "bg-surface-muted border-t-2 sm:border-t-0 sm:border-l-2 border-primary/60 sm:col-span-2 lg:col-span-1"
                : "bg-surface"
            }`}
          >
            {s.op ? (
              <span
                aria-hidden="true"
                className="absolute top-1/2 -left-3 z-10 hidden size-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-sm font-medium text-muted shadow-xs lg:flex"
              >
                {s.op}
              </span>
            ) : null}
            <p className="flex items-center gap-1.5 text-sm font-medium text-muted">
              {s.lead ? (
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full bg-primary shadow-[0_0_8px_var(--brand-lime)] animate-pulse"
                />
              ) : null}
              {s.op ? <span className="sr-only">{s.op === "−" ? "minus" : "equals"} </span> : null}
              {s.label}
            </p>
            <p
              className={`num mt-1.5 font-bold tracking-tight ${
                s.lead ? "text-[28px] leading-9 text-foreground" : "text-xl leading-8 text-foreground"
              } ${s.negative ? "text-danger" : ""}`}
            >
              {s.value}
            </p>
            <p className="mt-1 text-xs text-muted leading-relaxed">{s.hint}</p>
          </li>
        ))}
      </ol>

      {summary.warnings.length > 0 ? (
        <ul
          aria-label="Data notes"
          className="flex flex-col gap-1.5 rounded-xl border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning"
        >
          {summary.warnings.map((w) => (
            <li key={w.code} className="flex gap-2">
              <AlertIcon className="mt-0.5 shrink-0" />
              <span>{w.message}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-xs text-muted">
          <InfoIcon className="shrink-0" />
          No data gaps found. Net profit is still an estimate: it only deducts the expenses you recorded.
        </p>
      )}
    </section>
  );
}
