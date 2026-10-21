import { formatMoney } from "@/lib/money";
import { formatRatio } from "@/lib/pricing";
import {
  OUTLIER_MIN_LINES,
  OUTLIER_THRESHOLD_BPS,
  type SupplierComparison,
} from "@/lib/supplier-comparison";

function Src({ supplierName, date }: { supplierName: string; date: string }) {
  return <span className="block text-xs text-muted">{supplierName} · {date}</span>;
}

/** Server-rendered comparison table; data from compareSupplierPrices(). */
export function PriceComparison({ comparison, currency }: { comparison: SupplierComparison; currency: string }) {
  const m = (v: number) => formatMoney(v, currency);
  return (
    <section aria-labelledby="compare-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="compare-heading" className="text-base font-semibold">Supplier price comparison</h2>
        <p className="mt-1 text-sm text-muted">
          Based only on your own recorded, non-voided purchases. Elevate does not check current market prices.
        </p>
      </div>
      {comparison.notes.map((n) => (
        <p key={n} className="text-sm text-info"><span aria-hidden="true">ℹ </span>{n}</p>
      ))}
      {comparison.groups.length === 0 ? (
        <p className="text-sm text-muted">No purchases of this product yet — nothing to compare.</p>
      ) : (
        comparison.groups.map((g) => (
          <div key={g.unit} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
            <h3 className="text-sm font-semibold">
              Unit: {g.unit} · {g.lineCount} purchase{g.lineCount === 1 ? "" : "s"} from {g.supplierCount} supplier{g.supplierCount === 1 ? "" : "s"}
            </h3>
            {g.reliability.length > 0 ? (
              <ul className="flex flex-col gap-1 text-sm text-warning">
                {g.reliability.map((r) => <li key={r}><span aria-hidden="true">⚠ </span>{r}</li>)}
              </ul>
            ) : null}
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-muted">Lowest</dt><dd className="font-medium">{m(g.min.unitCost)}<Src {...g.min} /></dd></div>
              <div><dt className="text-muted">Highest</dt><dd className="font-medium">{m(g.max.unitCost)}<Src {...g.max} /></dd></div>
              <div><dt className="text-muted">Average (mean of {g.lineCount})</dt><dd className="font-medium">{m(g.average)}<span className="block text-xs text-muted">Median {m(g.median)}</span></dd></div>
            </dl>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <caption className="sr-only">Latest price per supplier ({g.unit})</caption>
                <thead>
                  <tr className="text-xs text-muted">
                    <th className="px-3 py-2 text-left">Supplier (latest purchase)</th>
                    <th className="px-3 py-2 text-right">Unit cost</th>
                    <th className="px-3 py-2 text-right">vs cheapest</th>
                  </tr>
                </thead>
                <tbody>
                  {g.latestBySupplier.map((s) => (
                    <tr key={s.supplierId} className="border-t border-border">
                      <td className="px-3 py-2">{s.supplierName}<span className="block text-xs text-muted">{s.date}</span></td>
                      <td className="px-3 py-2 text-right">{m(s.unitCost)}</td>
                      <td className="px-3 py-2 text-right">
                        {s.isCheapest ? (
                          <span className="font-medium text-success"><span aria-hidden="true">✓ </span>Cheapest</span>
                        ) : (
                          <>+{m(s.diffVsCheapest)} <span className="text-xs text-muted">({formatRatio(s.diffVsCheapestPct)})</span></>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {g.outliers.length > 0 ? (
              <div className="text-sm">
                <p className="font-medium text-warning"><span aria-hidden="true">⚠ </span>Possible outliers</p>
                <ul className="mt-1 flex flex-col gap-1">
                  {g.outliers.map((o) => (
                    <li key={o.purchaseId}>
                      {m(o.unitCost)} from {o.supplierName} on {o.date} ({formatRatio(o.deviationPct)} vs median)
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ))
      )}
      <p className="text-xs text-muted">
        Outlier rule: a price more than {OUTLIER_THRESHOLD_BPS / 100}% above or below the median of its unit group,
        checked only when there are at least {OUTLIER_MIN_LINES} purchases. Prices in different units are never compared.
      </p>
    </section>
  );
}
