import { AlertIcon, CheckIcon, InfoIcon } from "@/components/icons";
import { panelClass, panelTitleClass } from "@/features/auth/ui";
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
    <section aria-labelledby="compare-heading" className={`${panelClass} flex flex-col gap-4 p-5 sm:p-6`}>
      <div>
        <h2 id="compare-heading" className={panelTitleClass}>Supplier prices</h2>
        <p className="mt-1 text-sm text-muted">
          Based only on your own recorded, non-voided purchases. Elevate does not check current market prices.
        </p>
      </div>
      {comparison.notes.map((n) => (
        <p key={n} className="flex gap-2 text-sm text-muted"><InfoIcon className="mt-0.5 shrink-0" />{n}</p>
      ))}
      {comparison.groups.length === 0 ? (
        <p className="text-sm text-muted">No purchases of this product yet — nothing to compare.</p>
      ) : (
        comparison.groups.map((g) => (
          <div key={g.unit} className="flex flex-col gap-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold">
              Unit: {g.unit} · {g.lineCount} purchase{g.lineCount === 1 ? "" : "s"} from {g.supplierCount} supplier{g.supplierCount === 1 ? "" : "s"}
            </h3>
            {g.reliability.length > 0 ? (
              <ul className="flex flex-col gap-1 text-sm text-warning">
                {g.reliability.map((r) => <li key={r} className="flex gap-2"><AlertIcon className="mt-0.5 shrink-0" />{r}</li>)}
              </ul>
            ) : null}
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div><dt className="text-xs text-muted">Lowest</dt><dd className="num font-medium">{m(g.min.unitCost)}<Src {...g.min} /></dd></div>
              <div><dt className="text-xs text-muted">Highest</dt><dd className="num font-medium">{m(g.max.unitCost)}<Src {...g.max} /></dd></div>
              <div><dt className="text-xs text-muted">Average of {g.lineCount}</dt><dd className="num font-medium">{m(g.average)}<span className="block text-xs text-muted">Median {m(g.median)}</span></dd></div>
            </dl>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Latest price per supplier ({g.unit})</caption>
                <thead>
                  <tr className="border-b border-border text-xs text-muted">
                    <th scope="col" className="py-2 pr-3 text-left font-normal">Supplier, latest price</th>
                    <th scope="col" className="px-3 py-2 text-right font-normal">Unit cost</th>
                    <th scope="col" className="py-2 pl-3 text-right font-normal">vs cheapest</th>
                  </tr>
                </thead>
                <tbody>
                  {g.latestBySupplier.map((s) => (
                    <tr key={s.supplierId} className="border-t border-rule first:border-t-0">
                      <td className="py-2.5 pr-3 font-medium">{s.supplierName}<span className="block text-xs text-muted">{s.date}</span></td>
                      <td className="px-3 py-2.5 text-right">{m(s.unitCost)}</td>
                      <td className="py-2.5 pl-3 text-right">
                        {s.isCheapest ? (
                          <span className="inline-flex flex-none items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-xs font-medium whitespace-nowrap text-success"><CheckIcon size={12} />Cheapest</span>
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
                <p className="flex items-center gap-2 font-medium text-warning"><AlertIcon className="shrink-0" />Possible outliers</p>
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
