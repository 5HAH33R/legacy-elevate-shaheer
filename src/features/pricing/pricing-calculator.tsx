"use client";

import { useState } from "react";
import { formatMoney, parseMoney, type MinorUnits } from "@/lib/money";
import { calcPriceScenario, formatRatio } from "@/lib/pricing";
import { AlertIcon } from "@/components/icons";
import { inputClass, labelClass, secondaryButtonClass } from "@/features/auth/ui";

const MAX_SCENARIOS = 5;

type Row = { id: number; value: string };

function StatusBadge({ status }: { status: "profit" | "break-even" | "loss" }) {
  const map = {
    profit: { icon: "+", text: "Profit", cls: "bg-success-bg text-success" },
    "break-even": { icon: "=", text: "Break-even", cls: "bg-surface-muted text-muted" },
    loss: { icon: "−", text: "Loss", cls: "bg-danger-bg text-danger" },
  } as const;
  const s = map[status];
  return (
    <span className={`inline-flex flex-none items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${s.cls}`}>
      <span aria-hidden="true">{s.icon}</span>
      {s.text}
    </span>
  );
}

/**
 * Unsaved "what if" pricing scenarios. Nothing leaves the browser and
 * nothing is persisted; all maths is the pure calcPriceScenario().
 */
export function PricingCalculator({
  unitCost,
  currentPrice,
  currency,
}: {
  unitCost: MinorUnits;
  currentPrice: MinorUnits;
  currency: string;
}) {
  const [rows, setRows] = useState<Row[]>([{ id: 1, value: "" }]);
  const [nextId, setNextId] = useState(2);
  const current = calcPriceScenario(currentPrice, unitCost);

  function update(id: number, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, value } : r)));
  }

  return (
    <section aria-labelledby="pricing-heading" className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
      <div>
        <h2 id="pricing-heading" className="text-base font-semibold">Pricing scenarios (not saved)</h2>
        <p className="mt-1 text-sm text-muted">
          Try test selling prices. Results use the cost basis above and are estimates of gross profit per unit only —
          rent, delivery and other expenses are not included. Nothing you type here is saved.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Pricing scenarios</caption>
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              <th scope="col" className="py-2 pr-3 text-left font-normal">Selling price</th>
              <th scope="col" className="px-3 py-2 text-right font-normal">Per unit</th>
              <th scope="col" className="px-3 py-2 text-right font-normal">Margin</th>
              <th scope="col" className="px-3 py-2 text-right font-normal">Markup</th>
              <th scope="col" className="py-2 pl-3 text-right font-normal">Result</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-2.5 pr-3">
                {formatMoney(currentPrice, currency)} <span className="text-xs text-muted">(current)</span>
              </td>
              <td className="px-3 py-2.5 text-right">{formatMoney(current.unitMargin, currency)}</td>
              <td className="px-3 py-2.5 text-right">{formatRatio(current.marginPct)}</td>
              <td className="px-3 py-2.5 text-right">{formatRatio(current.markupPct)}</td>
              <td className="py-2.5 pl-3 text-right"><StatusBadge status={current.status} /></td>
            </tr>
            {rows.map((row, index) => {
              let parsed: MinorUnits | null = null;
              let error: string | null = null;
              if (row.value.trim() !== "") {
                try {
                  parsed = parseMoney(row.value);
                  if (parsed < 0) {
                    parsed = null;
                    error = "Price cannot be negative.";
                  }
                } catch {
                  error = "Enter an amount like 1250 or 1250.50.";
                }
              }
              const result = parsed !== null ? calcPriceScenario(parsed, unitCost) : null;
              const inputId = `scenario-${row.id}`;
              return (
                <tr key={row.id} className="border-t border-rule align-top">
                  <td className="py-2 pr-3">
                    <label htmlFor={inputId} className={`${labelClass} sr-only`}>
                      Test price {index + 1}
                    </label>
                    <input
                      id={inputId}
                      inputMode="decimal"
                      value={row.value}
                      onChange={(e) => update(row.id, e.target.value)}
                      placeholder={`Test price ${index + 1}`}
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? `${inputId}-err` : undefined}
                      className={`${inputClass} min-w-28`}
                    />
                    {error ? (
                      <p id={`${inputId}-err`} role="alert" className="mt-1 text-xs text-danger">
                        <AlertIcon size={12} className="mr-1 inline" />{error}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-right">{result ? formatMoney(result.unitMargin, currency) : "—"}</td>
                  <td className="px-3 py-2.5 text-right">{result ? formatRatio(result.marginPct) : "—"}</td>
                  <td className="px-3 py-2.5 text-right">{result ? formatRatio(result.markupPct) : "—"}</td>
                  <td className="py-2 pt-4 pl-3 text-right">{result ? <StatusBadge status={result.status} /> : <span className="text-muted">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {current.warnings.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm text-warning">
          {current.warnings.map((w) => (
            <li key={w} className="flex gap-2"><AlertIcon className="mt-0.5 shrink-0" />{w}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={rows.length >= MAX_SCENARIOS}
          onClick={() => {
            setRows((prev) => [...prev, { id: nextId, value: "" }]);
            setNextId((n) => n + 1);
          }}
          className={secondaryButtonClass}
        >
          + Add a test price
        </button>
        {rows.length > 1 ? (
          <button
            type="button"
            onClick={() => setRows((prev) => prev.slice(0, -1))}
            className={secondaryButtonClass}
          >
            Remove last
          </button>
        ) : null}
      </div>
      <p className="text-xs text-muted">
        Margin % = (price − cost) ÷ price. Markup % = (price − cost) ÷ cost. Shown as “Not calculable” when the
        divisor is zero.
      </p>
    </section>
  );
}
