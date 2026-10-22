"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertIcon, CheckIcon } from "@/components/icons";
import { suggestMatch, type ExtractedInvoice } from "@/lib/invoices";
import { formatMoney, minorToDecimalString, multiplyMoney, parseMoney, sumMoney } from "@/lib/money";
import {
  errorTextClass,
  inputClass,
  labelClass,
  panelClass,
  panelTitleClass,
  primaryActionClass,
  secondaryButtonClass,
} from "@/features/auth/ui";

type Option = { id: string; name: string };
type Line = {
  key: number;
  keep: boolean;
  description: string;
  productId: string;
  quantity: string;
  unit: string;
  unitCost: string;
};

function money(value: string): number | null {
  if (value.trim() === "") return null;
  try {
    const v = parseMoney(value);
    return v >= 0 ? v : null;
  } catch {
    return null;
  }
}

function wholeNumber(value: string): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

/**
 * Owner review of what the AI read (SPEC 5.1): pick the supplier, check the
 * date, match each line to a product, fix quantities and costs, or skip a
 * line. Confirming records one purchase; nothing is saved before that.
 */
export function InvoiceReviewForm({
  businessId,
  invoiceId,
  currency,
  extracted,
  suppliers,
  products,
}: {
  businessId: string;
  invoiceId: string;
  currency: string;
  extracted: ExtractedInvoice;
  suppliers: Option[];
  products: Option[];
}) {
  const router = useRouter();
  const suggestedSupplier = extracted.supplierName ? suggestMatch(extracted.supplierName, suppliers) : null;
  const [supplierMode, setSupplierMode] = useState<"existing" | "new">(
    suggestedSupplier || !extracted.supplierName ? "existing" : "new",
  );
  const [supplierId, setSupplierId] = useState(suggestedSupplier?.id ?? "");
  const [newSupplierName, setNewSupplierName] = useState(extracted.supplierName ?? "");
  const [date, setDate] = useState(extracted.invoiceDate ?? "");
  const [lines, setLines] = useState<Line[]>(() =>
    extracted.lines.map((l, i) => ({
      key: i,
      keep: true,
      description: l.description,
      productId: (l.description && suggestMatch(l.description, products)?.id) || "",
      quantity: l.quantity !== null && Number.isInteger(l.quantity) ? String(l.quantity) : "",
      unit: l.unit || "pcs",
      unitCost: l.unitPrice !== null ? minorToDecimalString(l.unitPrice) : "",
    })),
  );
  // Stable across retries, so a double submit can never add stock twice.
  const [purchaseId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"confirm" | "discard" | null>(null);

  const kept = lines.filter((l) => l.keep);
  const computed = useMemo(() => {
    const totals = kept.map((l) => {
      const q = wholeNumber(l.quantity);
      const c = money(l.unitCost);
      return q !== null && c !== null ? multiplyMoney(c, q) : null;
    });
    return totals.every((t): t is number => t !== null) ? sumMoney(totals) : null;
  }, [kept]);
  const printed = extracted.subtotal ?? extracted.total;

  function update(key: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function onConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (kept.length === 0) return setError("Keep at least one line, or discard this invoice.");
    if (!date) return setError("Enter the invoice date.");
    if (supplierMode === "existing" && !supplierId) return setError("Choose the supplier, or add a new one.");
    if (supplierMode === "new" && !newSupplierName.trim()) return setError("Enter the new supplier's name.");
    for (const [i, l] of kept.entries()) {
      if (!l.productId) return setError(`Line ${i + 1} (${l.description || "item"}): choose a product, or skip the line.`);
      if (wholeNumber(l.quantity) === null) return setError(`Line ${i + 1}: quantity must be a whole number of at least 1.`);
      if (money(l.unitCost) === null) return setError(`Line ${i + 1}: enter a unit cost like 1250 or 1250.50.`);
    }
    const ids = kept.map((l) => l.productId);
    if (new Set(ids).size !== ids.length) {
      return setError("Two kept lines use the same product. Combine them into one line or skip one.");
    }

    setPending("confirm");
    try {
      const response = await fetch(`/api/businesses/${businessId}/invoices/${invoiceId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseId,
          ...(supplierMode === "existing" ? { supplierId } : { newSupplierName: newSupplierName.trim() }),
          date,
          items: kept.map((l) => ({
            productId: l.productId,
            quantity: Number(l.quantity),
            unit: l.unit.trim() || "pcs",
            unitCost: l.unitCost.trim(),
          })),
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Could not record this invoice.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record this invoice.");
      setPending(null);
    }
  }

  async function onDiscard() {
    if (!window.confirm("Discard this scan? Nothing will be recorded.")) return;
    setError(null);
    setPending("discard");
    try {
      const response = await fetch(`/api/businesses/${businessId}/invoices/${invoiceId}`, { method: "DELETE" });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Could not discard.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not discard.");
      setPending(null);
    }
  }

  return (
    <form onSubmit={onConfirm} noValidate className="flex flex-col gap-6">
      <section aria-labelledby="supplier-heading" className={`${panelClass} grid gap-5 p-5 sm:grid-cols-2 sm:p-6`}>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <h2 id="supplier-heading" className={panelTitleClass}>Supplier and date</h2>
          {extracted.supplierName ? (
            <p className="text-sm text-muted">
              Read from the invoice: <span className="font-medium text-foreground">{extracted.supplierName}</span>
              {extracted.invoiceNumber ? <> · invoice {extracted.invoiceNumber}</> : null}
            </p>
          ) : null}
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className={labelClass}>Supplier</legend>
          <div className="mt-1.5 flex gap-1 rounded-lg border border-border bg-surface-muted p-1 text-sm">
            {(["existing", "new"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSupplierMode(m)}
                aria-pressed={supplierMode === m}
                className={`h-8 flex-1 rounded-md px-3 ${supplierMode === m ? "bg-surface font-medium shadow-[0_0_0_1px_var(--border)]" : "text-muted"}`}
              >
                {m === "existing" ? "Existing supplier" : "New supplier"}
              </button>
            ))}
          </div>
          {supplierMode === "existing" ? (
            <select
              aria-label="Existing supplier"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className={inputClass}
            >
              <option value="">Choose a supplier…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          ) : (
            <input
              aria-label="New supplier name"
              value={newSupplierName}
              maxLength={120}
              onChange={(e) => setNewSupplierName(e.target.value)}
              className={inputClass}
              placeholder="Supplier name"
            />
          )}
          {suggestedSupplier && supplierMode === "existing" && supplierId === suggestedSupplier.id ? (
            <p className="text-xs text-muted">Matched to your saved supplier by name. Change it if wrong.</p>
          ) : null}
        </fieldset>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="invoice-date" className={labelClass}>Invoice date</label>
          <input id="invoice-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          {!extracted.invoiceDate ? <p className="text-xs text-warning">The date could not be read. Enter it from the invoice.</p> : null}
        </div>
      </section>

      <section aria-labelledby="lines-heading" className={`${panelClass} overflow-hidden`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5 pb-3 sm:px-6">
          <h2 id="lines-heading" className={panelTitleClass}>
            Items <span className="num ml-1 text-sm font-normal text-muted">{kept.length} of {lines.length} kept</span>
          </h2>
          <Link href={`/dashboard/${businessId}/products`} target="_blank" className="text-sm font-medium hover:underline">
            Add a missing product ↗
          </Link>
        </div>
        {lines.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted sm:px-6">No item lines were read. Discard this scan and try a clearer photo.</p>
        ) : (
          <ol className="flex flex-col">
            {lines.map((l, i) => {
              const q = wholeNumber(l.quantity);
              const c = money(l.unitCost);
              return (
                <li key={l.key} className={`border-t border-rule px-5 py-4 sm:px-6 ${l.keep ? "" : "bg-surface-muted/60"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className={`text-sm ${l.keep ? "font-medium" : "text-muted line-through"}`}>
                      <span className="num mr-2 text-muted">{i + 1}.</span>
                      {l.description || "Unnamed item"}
                    </p>
                    <label className="flex shrink-0 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={l.keep}
                        onChange={(e) => update(l.key, { keep: e.target.checked })}
                        className="size-4 accent-[var(--chart)]"
                      />
                      Keep
                    </label>
                  </div>
                  {l.keep ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
                      <div className="flex flex-col gap-1">
                        <label htmlFor={`p-${l.key}`} className="text-xs font-medium">Your product</label>
                        <select
                          id={`p-${l.key}`}
                          value={l.productId}
                          onChange={(e) => update(l.key, { productId: e.target.value })}
                          className={inputClass}
                        >
                          <option value="">Choose a product…</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label htmlFor={`q-${l.key}`} className="text-xs font-medium">Quantity</label>
                        <input
                          id={`q-${l.key}`}
                          inputMode="numeric"
                          value={l.quantity}
                          onChange={(e) => update(l.key, { quantity: e.target.value })}
                          aria-invalid={l.quantity !== "" && q === null ? true : undefined}
                          className={inputClass}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label htmlFor={`u-${l.key}`} className="text-xs font-medium">Unit</label>
                        <input
                          id={`u-${l.key}`}
                          value={l.unit}
                          maxLength={20}
                          onChange={(e) => update(l.key, { unit: e.target.value })}
                          className={inputClass}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label htmlFor={`c-${l.key}`} className="text-xs font-medium">Unit cost ({currency})</label>
                        <input
                          id={`c-${l.key}`}
                          inputMode="decimal"
                          value={l.unitCost}
                          onChange={(e) => update(l.key, { unitCost: e.target.value })}
                          aria-invalid={l.unitCost !== "" && c === null ? true : undefined}
                          className={inputClass}
                        />
                      </div>
                      <p className="num text-xs text-muted sm:col-span-4">
                        {q !== null && c !== null ? <>Line total {formatMoney(multiplyMoney(c, q), currency)}</> : "Line total —"}
                        {extracted.lines[i]?.lineTotal != null ? (
                          <> · printed {formatMoney(extracted.lines[i].lineTotal!, currency)}</>
                        ) : null}
                      </p>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-muted px-5 py-4 text-sm sm:px-6">
          <span className="text-muted">Purchase total from kept lines</span>
          <span className="num flex items-center gap-3">
            <span className="text-lg font-semibold">{computed !== null ? formatMoney(computed, currency) : "—"}</span>
            {computed !== null && printed !== null ? (
              Math.abs(computed - printed) <= 100 ? (
                <span className="inline-flex flex-none items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-xs font-medium text-success">
                  <CheckIcon size={12} /> Matches invoice
                </span>
              ) : (
                <span className="inline-flex flex-none items-center gap-1 rounded-full border border-warning-border bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning">
                  <AlertIcon size={12} /> Invoice says {formatMoney(printed, currency)}
                </span>
              )
            ) : null}
          </span>
        </div>
      </section>

      {error ? (
        <p role="alert" className={`${errorTextClass} flex items-center gap-2`}>
          <AlertIcon className="shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onDiscard} disabled={pending !== null} className={`${secondaryButtonClass} h-10 text-danger`}>
          {pending === "discard" ? "Discarding…" : "Discard scan"}
        </button>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <button type="submit" disabled={pending !== null} className={`${primaryActionClass} h-10 disabled:cursor-not-allowed disabled:opacity-60`}>
            {pending === "confirm" ? "Recording…" : "Confirm and record purchase"}
          </button>
          <p className="text-xs text-muted">Adds the kept items to stock and updates their unit cost.</p>
        </div>
      </div>
    </form>
  );
}
