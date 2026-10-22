"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertIcon, CheckIcon } from "@/components/icons";
import { suggestMatch, type ExtractedInvoice, type PaymentMethod, PAYMENT_METHODS } from "@/lib/invoices";
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
  isNewProduct?: boolean;
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
 * Owner review of what the AI read:
 * - Purchase: pick or create supplier, verify date, match each line to a product (or add as new product), confirm purchase (+stock).
 * - Sale: verify customer/payment, match lines to products, confirm sale (-stock).
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
  const isSale = extracted.invoiceType === "sale";

  // Products state to support inline "Add as new product"
  const [productList, setProductList] = useState<Option[]>(products);
  const [creatingForIndex, setCreatingForIndex] = useState<number | null>(null);
  const [newProdName, setNewProdName] = useState("");
  const [newProdCost, setNewProdCost] = useState("");
  const [newProdPrice, setNewProdPrice] = useState("");
  const [creatingPending, setCreatingPending] = useState(false);
  const [createProdError, setCreateProdError] = useState<string | null>(null);

  // Supplier state (purchase only)
  const suggestedSupplier = extracted.supplierName ? suggestMatch(extracted.supplierName, suppliers) : null;
  const [supplierMode, setSupplierMode] = useState<"existing" | "new">(
    suggestedSupplier || !extracted.supplierName ? "existing" : "new",
  );
  const [supplierId, setSupplierId] = useState(suggestedSupplier?.id ?? "");
  const [newSupplierName, setNewSupplierName] = useState(extracted.supplierName ?? "");

  // Customer & payment state (sale only)
  const [customerName, setCustomerName] = useState(extracted.customerName ?? "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(extracted.paymentMethod ?? "cash");

  const [date, setDate] = useState(extracted.invoiceDate ?? "");
  const [lines, setLines] = useState<Line[]>(() =>
    extracted.lines.map((l, i) => {
      const matched = l.matchedProductId
        ? products.find((p) => p.id === l.matchedProductId)?.id
        : (l.description && suggestMatch(l.description, products)?.id) || "";
      return {
        key: i,
        keep: true,
        description: l.description,
        productId: matched || "",
        quantity: l.quantity !== null && Number.isInteger(l.quantity) ? String(l.quantity) : "",
        unit: l.unit || "pcs",
        unitCost: l.unitPrice !== null ? minorToDecimalString(l.unitPrice) : "",
        isNewProduct: !matched,
      };
    }),
  );

  // Stable across retries for idempotency
  const [operationId] = useState(() => crypto.randomUUID());
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

  function startInlineCreateProduct(line: Line) {
    setCreatingForIndex(line.key);
    setNewProdName(line.description || "");
    const cost = line.unitCost || "0";
    setNewProdCost(cost);
    // Suggest retail price at 25% markup if not set
    const numericCost = Number(cost);
    setNewProdPrice(numericCost > 0 ? String(Math.round(numericCost * 1.25)) : "0");
    setCreateProdError(null);
  }

  async function onSaveNewProduct(key: number) {
    if (!newProdName.trim()) {
      return setCreateProdError("Enter a product name.");
    }
    setCreatingPending(true);
    setCreateProdError(null);
    try {
      const response = await fetch(`/api/businesses/${businessId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProdName.trim(),
          quantity: 0,
          unitCost: newProdCost.trim() || "0",
          sellingPrice: newProdPrice.trim() || newProdCost.trim() || "0",
        }),
      });
      const data = (await response.json().catch(() => null)) as { product?: { productId: string; name: string }; error?: string } | null;
      if (!response.ok || !data?.product) {
        throw new Error(data?.error ?? "Could not create product.");
      }
      const newOption = { id: data.product.productId, name: data.product.name };
      setProductList((prev) => [...prev, newOption].sort((a, b) => a.name.localeCompare(b.name)));
      update(key, { productId: newOption.id, isNewProduct: false });
      setCreatingForIndex(null);
    } catch (err) {
      setCreateProdError(err instanceof Error ? err.message : "Could not create product.");
    } finally {
      setCreatingPending(false);
    }
  }

  async function onConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (kept.length === 0) return setError("Keep at least one line, or discard this scan.");
    if (!date) return setError("Enter the document date.");

    if (!isSale) {
      if (supplierMode === "existing" && !supplierId) return setError("Choose the supplier, or add a new one.");
      if (supplierMode === "new" && !newSupplierName.trim()) return setError("Enter the new supplier's name.");
    }

    for (const [i, l] of kept.entries()) {
      if (!l.productId) return setError(`Line ${i + 1} (${l.description || "item"}): choose an existing product or click "Add as new product".`);
      if (wholeNumber(l.quantity) === null) return setError(`Line ${i + 1}: quantity must be a whole number of at least 1.`);
      if (money(l.unitCost) === null) return setError(`Line ${i + 1}: enter a valid price.`);
    }
    const ids = kept.map((l) => l.productId);
    if (new Set(ids).size !== ids.length) {
      return setError("Two kept lines use the same product. Combine them into one line or skip one.");
    }

    setPending("confirm");
    try {
      const payload = isSale
        ? {
            invoiceType: "sale",
            saleId: operationId,
            customerName: customerName.trim() || undefined,
            date,
            items: kept.map((l) => ({
              productId: l.productId,
              quantity: Number(l.quantity),
              unit: l.unit.trim() || "pcs",
              unitPrice: l.unitCost.trim(),
            })),
          }
        : {
            invoiceType: "purchase",
            purchaseId: operationId,
            ...(supplierMode === "existing" ? { supplierId } : { newSupplierName: newSupplierName.trim() }),
            date,
            items: kept.map((l) => ({
              productId: l.productId,
              quantity: Number(l.quantity),
              unit: l.unit.trim() || "pcs",
              unitCost: l.unitCost.trim(),
            })),
          };

      const response = await fetch(`/api/businesses/${businessId}/invoices/${invoiceId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Could not record this document.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record this document.");
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
      {/* Header section: Supplier (if purchase) OR Customer/Payment (if sale) */}
      <section aria-labelledby="header-heading" className={`${panelClass} grid gap-5 p-5 sm:grid-cols-2 sm:p-6 shadow-xs`}>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <div className="flex items-center gap-2">
            <span className={`rounded-md px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
              isSale ? "bg-info/10 text-info border border-info/30" : "bg-primary/20 text-foreground border border-primary/40"
            }`}>
              {isSale ? "Sales Receipt" : "Purchase Bill"}
            </span>
            <h2 id="header-heading" className={panelTitleClass}>
              {isSale ? "Customer and sale details" : "Supplier and date"}
            </h2>
          </div>
          <p className="text-sm text-muted">
            {isSale
              ? extracted.customerName
                ? `Customer read: ${extracted.customerName}`
                : "Counter sale slip"
              : extracted.supplierName
                ? `Supplier read: ${extracted.supplierName}`
                : "Supplier bill"}
            {extracted.invoiceNumber ? <> · doc #{extracted.invoiceNumber}</> : null}
          </p>
        </div>

        {isSale ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="customer-name" className={labelClass}>Customer name (optional)</label>
              <input
                id="customer-name"
                value={customerName}
                maxLength={120}
                onChange={(e) => setCustomerName(e.target.value)}
                className={inputClass}
                placeholder="Walk-in customer"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="payment-method" className={labelClass}>Payment method</label>
              <select
                id="payment-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className={inputClass}
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm} value={pm}>
                    {pm === "cash" ? "Cash" : pm === "online" ? "Online / Bank Transfer" : "Store Credit"}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className={labelClass}>Supplier</legend>
            <div className="mt-1 flex gap-1 rounded-lg border border-border bg-surface-muted p-1 text-sm">
              {(["existing", "new"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSupplierMode(m)}
                  aria-pressed={supplierMode === m}
                  className={`h-8 flex-1 rounded-md px-3 text-xs font-semibold ${supplierMode === m ? "bg-surface text-foreground shadow-xs" : "text-muted"}`}
                >
                  {m === "existing" ? "Existing supplier" : "+ New supplier"}
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
                placeholder="Supplier or wholesaler name"
              />
            )}
            {suggestedSupplier && supplierMode === "existing" && supplierId === suggestedSupplier.id ? (
              <p className="text-xs text-muted">Matched to your saved supplier by name.</p>
            ) : null}
          </fieldset>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="invoice-date" className={labelClass}>Document date</label>
          <input id="invoice-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          {!extracted.invoiceDate ? <p className="text-xs text-warning">Date could not be read. Please enter it.</p> : null}
        </div>
      </section>

      {/* Line Items Section with Product Matching & Inline "Add New Product" */}
      <section aria-labelledby="lines-heading" className={`${panelClass} overflow-hidden shadow-xs`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5 pb-3 sm:px-6">
          <h2 id="lines-heading" className={panelTitleClass}>
            Items <span className="num ml-1 text-sm font-normal text-muted">{kept.length} of {lines.length} kept</span>
          </h2>
          <span className="text-xs text-muted">Check each item against your inventory.</span>
        </div>

        {lines.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted sm:px-6">No item lines were read. Discard this scan and try a clearer photo.</p>
        ) : (
          <ol className="flex flex-col">
            {lines.map((l, i) => {
              const q = wholeNumber(l.quantity);
              const c = money(l.unitCost);
              const isInlineOpen = creatingForIndex === l.key;

              return (
                <li key={l.key} className={`border-t border-rule px-5 py-4 sm:px-6 ${l.keep ? "" : "bg-surface-muted/60"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-sm ${l.keep ? "font-semibold" : "text-muted line-through"}`}>
                        <span className="num mr-2 text-muted">{i + 1}.</span>
                        {l.description || "Unnamed item"}
                      </p>
                      {l.isNewProduct && !l.productId && l.keep ? (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-warning-bg px-2 py-0.5 text-[11px] font-medium text-warning">
                          <AlertIcon size={11} /> Unmatched item
                        </span>
                      ) : null}
                    </div>

                    <label className="flex shrink-0 items-center gap-2 text-sm font-medium">
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
                    <div className="mt-3 flex flex-col gap-3">
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
                        {/* Product selection with instant "Add as new product" */}
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <label htmlFor={`p-${l.key}`} className="text-xs font-medium">Your inventory product</label>
                            <button
                              type="button"
                              onClick={() => (isInlineOpen ? setCreatingForIndex(null) : startInlineCreateProduct(l))}
                              className="text-[11px] font-semibold text-primary hover:underline"
                            >
                              {isInlineOpen ? "Cancel" : "+ Add as new"}
                            </button>
                          </div>
                          <select
                            id={`p-${l.key}`}
                            value={l.productId}
                            onChange={(e) => update(l.key, { productId: e.target.value, isNewProduct: false })}
                            className={inputClass}
                          >
                            <option value="">Choose a product…</option>
                            {productList.map((p) => (
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
                          <label htmlFor={`c-${l.key}`} className="text-xs font-medium">
                            {isSale ? `Sale price (${currency})` : `Unit cost (${currency})`}
                          </label>
                          <input
                            id={`c-${l.key}`}
                            inputMode="decimal"
                            value={l.unitCost}
                            onChange={(e) => update(l.key, { unitCost: e.target.value })}
                            aria-invalid={l.unitCost !== "" && c === null ? true : undefined}
                            className={inputClass}
                          />
                        </div>
                      </div>

                      {/* Inline "Add as new product" drawer */}
                      {isInlineOpen ? (
                        <div className="rounded-xl border border-primary/30 bg-surface-muted/80 p-4 shadow-xs animate-fade-in">
                          <p className="text-xs font-bold text-foreground mb-3">Add &ldquo;{l.description}&rdquo; as a new product in your inventory</p>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="flex flex-col gap-1 sm:col-span-1">
                              <label className="text-xs text-muted">Product Name</label>
                              <input
                                value={newProdName}
                                onChange={(e) => setNewProdName(e.target.value)}
                                className={inputClass}
                                placeholder="Product name"
                              />
                            </div>
                            <div className="flex flex-col gap-1 sm:col-span-1">
                              <label className="text-xs text-muted">Cost Price ({currency})</label>
                              <input
                                value={newProdCost}
                                onChange={(e) => setNewProdCost(e.target.value)}
                                className={inputClass}
                                placeholder="0"
                              />
                            </div>
                            <div className="flex flex-col gap-1 sm:col-span-1">
                              <label className="text-xs text-muted">Selling Price ({currency})</label>
                              <input
                                value={newProdPrice}
                                onChange={(e) => setNewProdPrice(e.target.value)}
                                className={inputClass}
                                placeholder="0"
                              />
                            </div>
                          </div>
                          {createProdError ? <p className={`${errorTextClass} text-xs mt-2`}>{createProdError}</p> : null}
                          <div className="mt-3 flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setCreatingForIndex(null)}
                              className={`${secondaryButtonClass} text-xs h-8`}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => onSaveNewProduct(l.key)}
                              disabled={creatingPending}
                              className={`${primaryActionClass} text-xs h-8`}
                            >
                              {creatingPending ? "Saving…" : "Save & match to line"}
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <p className="num text-xs text-muted">
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
          <span className="text-muted">{isSale ? "Sale total from kept lines" : "Purchase total from kept lines"}</span>
          <span className="num flex items-center gap-3">
            <span className="text-lg font-semibold">{computed !== null ? formatMoney(computed, currency) : "—"}</span>
            {computed !== null && printed !== null ? (
              Math.abs(computed - printed) <= 100 ? (
                <span className="inline-flex flex-none items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-xs font-medium text-success">
                  <CheckIcon size={12} /> Matches document
                </span>
              ) : (
                <span className="inline-flex flex-none items-center gap-1 rounded-full border border-warning-border bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning">
                  <AlertIcon size={12} /> Document says {formatMoney(printed, currency)}
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
            {pending === "confirm" ? "Recording…" : isSale ? "Confirm and record sale" : "Confirm and record purchase"}
          </button>
          <p className="text-xs text-muted">
            {isSale
              ? "Deducts the kept items from inventory stock and records your sale."
              : "Adds the kept items to inventory stock and updates their unit cost."}
          </p>
        </div>
      </div>
    </form>
  );
}
