import { formatMoney } from "@/lib/money";
import type { Trend } from "@/lib/reports";

export function TrendTable({ trend, currency }: { trend: Trend; currency: string }) {
  return (
    <section aria-labelledby="trend-heading" className="rounded-2xl border border-border bg-surface p-5">
      <h2 id="trend-heading" className="text-base font-semibold">Trend</h2>
      {trend.kind === "not-enough-data" ? (
        <p className="mt-2 text-sm text-muted"><span aria-hidden="true">ℹ </span>{trend.reason}</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Revenue and expenses per {trend.granularity}
            </caption>
            <thead>
              <tr className="text-xs text-muted">
                <th scope="col" className="px-3 py-2 text-left">{trend.granularity === "day" ? "Day" : "Week"}</th>
                <th scope="col" className="px-3 py-2 text-right">Sales</th>
                <th scope="col" className="px-3 py-2 text-right">Revenue</th>
                <th scope="col" className="px-3 py-2 text-right">Expenses</th>
              </tr>
            </thead>
            <tbody>
              {trend.buckets.map((b) => (
                <tr key={b.from} className="border-t border-border">
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    {b.from === b.to ? b.from : `${b.from} – ${b.to}`}
                  </th>
                  <td className="px-3 py-2 text-right">{b.saleCount}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(b.revenue, currency)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(b.expenses, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
