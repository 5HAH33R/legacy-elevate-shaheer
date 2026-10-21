import { formatMoney } from "@/lib/money";
import { formatRatio } from "@/lib/pricing";
import type { PeriodSummary } from "@/lib/reports";

function Card({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}

export function SummaryCards({ summary, currency }: { summary: PeriodSummary; currency: string }) {
  const m = (v: number) => formatMoney(v, currency);
  return (
    <>
      <section aria-label="Period figures" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card label="Revenue" value={m(summary.revenue)} hint={`${summary.saleCount} sale${summary.saleCount === 1 ? "" : "s"}`} />
        <Card label="Cost of goods sold (COGS)" value={m(summary.cogs)} hint="Unit cost saved on each sale at sale time" />
        <Card label="Gross profit" value={m(summary.grossProfit)} hint="Revenue − COGS" />
        <Card label="Gross margin" value={formatRatio(summary.grossMargin)} hint="Gross profit ÷ revenue" />
        <Card
          label="Recorded expenses"
          value={m(summary.expenses)}
          hint={`${summary.expenseCount} record${summary.expenseCount === 1 ? "" : "s"}; voided excluded`}
        />
        <Card
          label="Estimated net profit (recorded expenses only)"
          value={m(summary.estimatedNetProfit)}
          hint="Gross profit − recorded expenses. An estimate, not complete net profit."
        />
      </section>
      <section aria-label="Data caveats" className="rounded-2xl border border-border bg-surface-muted p-5">
        <h2 className="text-base font-semibold">Data notes</h2>
        {summary.warnings.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            <span aria-hidden="true">ℹ </span>No data gaps detected, but net profit is still an estimate: it only
            deducts expenses you have recorded.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2 text-sm text-warning">
            {summary.warnings.map((w) => (
              <li key={w.code}><span aria-hidden="true">⚠ </span>{w.message}</li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
