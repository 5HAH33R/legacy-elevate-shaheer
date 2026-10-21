import { formatMoney, MINOR_UNITS_PER_MAJOR } from "@/lib/money";
import type { Trend, TrendBucket } from "@/lib/reports";
import { panelClass, panelTitleClass } from "@/features/auth/ui";

/** Round step (1, 2, 2.5, 5 × 10ⁿ) giving about four gridlines above the max. */
function niceTicks(maxMajor: number): number[] {
  const rough = maxMajor / 4;
  // Whole currency units only: no "0.25" ticks on small totals.
  const pow = Math.max(1, 10 ** Math.floor(Math.log10(rough)));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * pow).find((s) => s >= rough) ?? 10 * pow;
  const top = Math.floor(maxMajor / step) * step + step; // the top tick is always above the max
  const ticks: number[] = [];
  for (let t = 0; t <= top + step / 2; t += step) ticks.push(Math.round(t * 100) / 100);
  return ticks;
}

function compact(n: number): string {
  const trim = (v: number) => String(Number(v.toFixed(1)));
  if (n >= 1_000_000) return `${trim(n / 1_000_000)}M`;
  if (n >= 1_000) return `${trim(n / 1_000)}k`;
  return trim(n);
}

function bucketLabel(b: TrendBucket, granularity: "day" | "week"): string {
  const d = new Date(`${b.from}T00:00:00Z`);
  const day = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return granularity === "day" ? day : `w/c ${day}`;
}

/** At most six evenly spaced x labels, always including the first and last. */
function labelIndexes(n: number): number[] {
  if (n <= 6) return [...Array(n).keys()];
  const step = Math.ceil((n - 1) / 5);
  const out: number[] = [];
  for (let i = 0; i < n - 1; i += step) out.push(i);
  if (n - 1 - out[out.length - 1] < step / 2) out.pop();
  out.push(n - 1);
  return out;
}

/**
 * Revenue per day (or week) as square-topped columns in the data hue, with a
 * y scale on round steps and the full figures (with expenses) in a table
 * behind "View as table". HTML columns rather than a scaled SVG, so labels
 * stay legible at phone width.
 */
export function TrendTable({ trend, currency }: { trend: Trend; currency: string }) {
  const unit = trend.kind === "ok" && trend.granularity === "week" ? "week" : "day";

  return (
    <section aria-labelledby="trend-heading" className={`${panelClass} flex flex-col p-5 sm:p-6`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="trend-heading" className={panelTitleClass}>
          Revenue per {unit}
        </h2>
        <span className="text-xs text-muted">{currency}</span>
      </div>

      {trend.kind === "not-enough-data" ? (
        <div className="mt-4 flex flex-1 flex-col justify-end">
          <div className="flex h-40 items-end border-b-2 border-control">
            <p className="mb-auto text-sm text-muted">{trend.reason}</p>
          </div>
        </div>
      ) : (
        <TrendChart trend={trend} currency={currency} />
      )}
    </section>
  );
}

function TrendChart({ trend, currency }: { trend: Extract<Trend, { kind: "ok" }>; currency: string }) {
  const buckets = trend.buckets;
  const maxRevenue = Math.max(...buckets.map((b) => b.revenue));
  const ticks = niceTicks(Math.max(maxRevenue / MINOR_UNITS_PER_MAJOR, 1));
  const topMinor = ticks[ticks.length - 1] * MINOR_UNITS_PER_MAJOR;
  const labels = labelIndexes(buckets.length);
  const totalRevenue = buckets.reduce((sum, b) => sum + b.revenue, 0);
  const best = buckets.reduce((a, b) => (b.revenue > a.revenue ? b : a), buckets[0]);

  return (
    <>
      <p className="mt-1 text-sm text-muted">
        Best {trend.granularity}: <span className="font-medium text-foreground">{bucketLabel(best, trend.granularity)}</span>{" "}
        at <span className="num font-medium text-foreground">{formatMoney(best.revenue, currency)}</span>
      </p>

      <div
        role="img"
        aria-label={`Revenue per ${trend.granularity}, ${buckets.length} ${trend.granularity}s, total ${formatMoney(totalRevenue, currency)}. Highest ${formatMoney(best.revenue, currency)} on ${bucketLabel(best, trend.granularity)}.`}
        className="mt-5"
      >
        <div className="relative h-48 pl-11">
          {ticks.map((t) => (
            <div
              key={t}
              className={`absolute right-0 left-11 ${t === 0 ? "border-t-2 border-control" : "border-t border-rule"}`}
              style={{ bottom: `${(t / ticks[ticks.length - 1]) * 100}%` }}
            >
              <span className="num absolute -left-11 w-9 -translate-y-1/2 text-right text-[11px] text-muted">
                {compact(t)}
              </span>
            </div>
          ))}
          <div className="absolute inset-y-0 right-0 left-11 flex items-end gap-[3px]">
            {buckets.map((b) => (
              <div
                key={b.from}
                className="group relative flex h-full flex-1 items-end"
                title={`${b.from === b.to ? b.from : `${b.from} – ${b.to}`}: ${formatMoney(b.revenue, currency)} · ${b.saleCount} sale${b.saleCount === 1 ? "" : "s"}`}
              >
                {b.revenue > 0 ? (
                  <div
                    className="w-full rounded-t-[3px] bg-chart transition group-hover:opacity-80"
                    style={{ height: `${(b.revenue / topMinor) * 100}%` }}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <div className="relative mt-2 ml-11 h-4 text-[11px] text-muted">
          {labels.map((i) => {
            const left = ((i + 0.5) / buckets.length) * 100;
            const align = i === 0 ? "translate-x-0" : i === buckets.length - 1 ? "-translate-x-full" : "-translate-x-1/2";
            const pos = i === 0 ? { left: 0 } : i === buckets.length - 1 ? { left: "100%" } : { left: `${left}%` };
            return (
              <span key={i} className={`absolute whitespace-nowrap ${align}`} style={pos}>
                {bucketLabel(buckets[i], trend.granularity)}
              </span>
            );
          })}
        </div>
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-muted hover:text-foreground">View as table (with expenses)</summary>
        <div className="mt-3 max-h-72 overflow-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Revenue and expenses per {trend.granularity}</caption>
            <thead>
              <tr className="text-xs text-muted">
                <th scope="col" className="py-2 pr-3 text-left font-normal">{trend.granularity === "day" ? "Day" : "Week"}</th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">Sales</th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">Revenue</th>
                <th scope="col" className="py-2 text-right font-normal">Expenses</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => (
                <tr key={b.from} className="border-t border-rule">
                  <th scope="row" className="py-2 pr-3 text-left font-normal whitespace-nowrap">
                    {b.from === b.to ? b.from : `${b.from} – ${b.to}`}
                  </th>
                  <td className="py-2 pr-3 text-right text-muted">{b.saleCount}</td>
                  <td className="py-2 pr-3 text-right">{formatMoney(b.revenue, currency)}</td>
                  <td className="py-2 text-right text-muted">{formatMoney(b.expenses, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
