"use client";

import { useState } from "react";
import { formatMoney, parseMoney, type MinorUnits } from "@/lib/money";
import { calcPriceScenario, formatRatio } from "@/lib/pricing";
import { inputClass, labelClass } from "@/features/auth/ui";

const MAX_SCENARIOS = 5;

type Row = { id: number; value: string };

function StatusBadge({ status }: { status: "profit" | "break-even" | "loss" }) {
  const map = {
    profit: { icon: "▲", text: "Profit", cls: "text-success" },
    "break-even": { icon: "■", text: "Break-even", cls: "text-muted" },
    loss: { icon: "▼", text: "Loss", cls: "text-danger" },
  } as const;
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${s.cls}`}>
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
    <section aria-labelledby="pricing-heading" className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
      <div>
        <h2 id="pricing-heading" className="text-base font-semibold">Pricing scenarios (not saved)</h2>
        <p className="mt-1 text-sm text-muted">
          Try test selling prices. Results use the cost basis above and are estimates of gross profit per unit only —
          rent, delivery and other expenses are not included. Nothing you type here is saved.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <caption className="sr-only">Pricing scenarios</caption>
          <thead>
            <tr className="text-xs text-muted">
              <th className="px-3 py-2 text-left">Selling price</th>
              <th className="px-3 py-2 text-right">Unit margin</th>
              <th className="px-3 py-2 text-right">Margin %</th>
              <th className="px-3 py-2 text-right">Markup %</th>
              <th className="px-3 py-2 text-left">Result</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border bg-surface-muted">
              <td className="px-3 py-2">
                {formatMoney(currentPrice, currency)} <span className="text-xs text-muted">(current)</span>
              </td>
              <td className="px-3 py-2 text-right">{formatMoney(current.unitMargin, currency)}</td>
              <td className="px-3 py-2 text-right">{formatRatio(current.marginPct)}</td>
              <td className="px-3 py-2 text-right">{formatRatio(current.markupPct)}</td>
              <td className="px-3 py-2"><StatusBadge status={current.status} /></td>
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
                <tr key={row.id} className="border-t border-border align-top">
                  <td className="px-3 py-2">
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
                        <span aria-hidden="true">⚠ </span>{error}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right">{result ? formatMoney(result.unitMargin, currency) : "—"}</td>
                  <td className="px-3 py-2 text-right">{result ? formatRatio(result.marginPct) : "—"}</td>
                  <td className="px-3 py-2 text-right">{result ? formatRatio(result.markupPct) : "—"}</td>
                  <td className="px-3 py-2">{result ? <StatusBadge status={result.status} /> : <span className="text-muted">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {current.warnings.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm text-warning">
          {current.warnings.map((w) => (
            <li key={w}><span aria-hidden="true">⚠ </span>{w}</li>
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
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          + Add scenario
        </button>
        {rows.length > 1 ? (
          <button
            type="button"
            onClick={() => setRows((prev) => prev.slice(0, -1))}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium"
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
