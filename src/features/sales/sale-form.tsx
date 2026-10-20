"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { todayInTimeZone } from "@/lib/dates";
import { minorToDecimalString } from "@/lib/money";
import {
  errorTextClass,
  fieldClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  successTextClass,
} from "@/features/auth/ui";

export type SaleProduct = {
  productId: string;
  name: string;
  sellingPrice: number;
  quantity: number;
};

type ItemRow = { productId: string; quantity: string; unitPrice: string };

const emptyRow = (): ItemRow => ({ productId: "", quantity: "1", unitPrice: "" });

/**
 * Record-sale form. The saleId is generated once per form fill and reused on
 * retries, so a double-submit or network retry can never deduct stock twice.
 */
export function SaleForm({
  businessId,
  currency,
  timezone,
  products,
}: {
  businessId: string;
  currency: string;
  timezone: string;
  products: SaleProduct[];
}) {
  const router = useRouter();
  const saleIdRef = useRef<string>(crypto.randomUUID());
  const [date, setDate] = useState(() => todayInTimeZone(timezone));
  const [items, setItems] = useState<ItemRow[]>([emptyRow()]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  if (products.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-surface-muted p-6 text-sm text-muted">
        Add products first — sales are recorded against your stock.{" "}
        <Link
          href={`/dashboard/${businessId}/products`}
          className="font-medium text-foreground underline underline-offset-4"
        >
          Go to products
        </Link>
      </p>
    );
  }

  function updateRow(index: number, patch: Partial<ItemRow>) {
    setItems((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function onProductSelect(index: number, productId: string) {
    const product = products.find((p) => p.productId === productId);
    updateRow(index, {
      productId,
      // Prefill the recorded selling price; the owner can adjust it.
      unitPrice: product ? minorToDecimalString(product.sellingPrice) : "",
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    if (items.some((row) => row.productId === "")) {
      setError("Choose a product for every row.");
      return;
    }
    setPending(true);
    try {
      const response = await fetch(`/api/businesses/${businessId}/sales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: saleIdRef.current,
          date,
          items: items.map((row) => ({
            productId: row.productId,
            quantity: Number(row.quantity),
            ...(row.unitPrice.trim() !== ""
              ? { unitPrice: row.unitPrice.trim() }
              : {}),
          })),
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? "Could not record the sale.");
      }
      // Reset for the next sale — with a fresh idempotency id.
      saleIdRef.current = crypto.randomUUID();
      setItems([emptyRow()]);
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record the sale.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6"
    >
      <h2 className="text-base font-semibold">Record a sale</h2>

      <div className={`${fieldClass} max-w-48`}>
        <label htmlFor="sale-date" className={labelClass}>
          Date
        </label>
        <input
          id="sale-date"
          type="date"
          required
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-3">
        {items.map((row, index) => (
          <div key={index} className="flex flex-wrap items-end gap-3">
            <div className={fieldClass}>
              <label htmlFor={`sale-product-${index}`} className={labelClass}>
                Product
              </label>
              <select
                id={`sale-product-${index}`}
                value={row.productId}
                onChange={(event) => onProductSelect(index, event.target.value)}
                className={`${inputClass} w-52`}
                required
              >
                <option value="" disabled>
                  Choose a product
                </option>
                {products.map((product) => (
                  <option key={product.productId} value={product.productId}>
                    {product.name} ({product.quantity} in stock)
                  </option>
                ))}
              </select>
            </div>
            <div className={fieldClass}>
              <label htmlFor={`sale-qty-${index}`} className={labelClass}>
                Qty
              </label>
              <input
                id={`sale-qty-${index}`}
                type="number"
                min={1}
                step={1}
                required
                value={row.quantity}
                onChange={(event) =>
                  updateRow(index, { quantity: event.target.value })
                }
                className={`${inputClass} w-24`}
              />
            </div>
            <div className={fieldClass}>
              <label htmlFor={`sale-price-${index}`} className={labelClass}>
                Unit price ({currency})
              </label>
              <input
                id={`sale-price-${index}`}
                type="text"
                inputMode="decimal"
                required
                value={row.unitPrice}
                onChange={(event) =>
                  updateRow(index, { unitPrice: event.target.value })
                }
                className={`${inputClass} w-32`}
              />
            </div>
            {items.length > 1 ? (
              <button
                type="button"
                onClick={() =>
                  setItems((rows) => rows.filter((_, i) => i !== index))
                }
                className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted hover:text-foreground"
              >
                Remove
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setItems((rows) => [...rows, emptyRow()])}
          className="text-sm font-medium underline underline-offset-4 hover:text-muted"
        >
          + Add another item
        </button>
      </div>

      {error ? (
        <p role="alert" className={errorTextClass}>
          {error}
        </p>
      ) : null}
      {success ? (
        <p role="status" className={successTextClass}>
          Sale recorded and stock updated.
        </p>
      ) : null}

      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Recording…" : "Record sale"}
      </button>
    </form>
  );
}
