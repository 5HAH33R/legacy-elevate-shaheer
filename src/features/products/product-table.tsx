"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney, minorToDecimalString } from "@/lib/money";
import { AlertIcon } from "@/components/icons";
import { emptyStateClass, errorTextClass, inputClass, panelClass } from "@/features/auth/ui";

export type ProductRow = {
  productId: string;
  name: string;
  sku: string | null;
  quantity: number;
  unitCost: number;
  sellingPrice: number;
  reorderLevel: number | null;
};

const cellClass = "px-4 py-3 text-left align-middle";
const numClass = "px-4 py-3 text-right align-middle";
const headClass = "px-4 py-2.5 text-left font-normal";
const numHeadClass = "px-4 py-2.5 text-right font-normal";
const editInputClass = `${inputClass} w-28`;

function isLow(p: ProductRow): boolean {
  return p.reorderLevel !== null && p.quantity <= p.reorderLevel;
}

function EditRow({
  businessId,
  product,
  onDone,
}: {
  businessId: string;
  product: ProductRow;
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(product.name);
  const [sku, setSku] = useState(product.sku ?? "");
  const [unitCost, setUnitCost] = useState(minorToDecimalString(product.unitCost));
  const [sellingPrice, setSellingPrice] = useState(
    minorToDecimalString(product.sellingPrice),
  );
  const [reorderLevel, setReorderLevel] = useState(
    product.reorderLevel !== null ? String(product.reorderLevel) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch(
        `/api/businesses/${businessId}/products/${product.productId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            sku: sku.trim() === "" ? null : sku.trim(),
            unitCost: unitCost.trim(),
            sellingPrice: sellingPrice.trim(),
            reorderLevel: reorderLevel.trim() === "" ? null : Number(reorderLevel),
          }),
        },
      );
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) throw new Error(data?.error ?? "Could not update.");
      router.refresh();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update.");
      setPending(false);
    }
  }

  return (
    <tr className="border-t border-rule bg-surface-muted">
      <td colSpan={7} className="px-4 py-3">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} className={`${inputClass} w-44`} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              SKU
              <input value={sku} onChange={(e) => setSku(e.target.value)} maxLength={60} className={editInputClass} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              Unit cost
              <input inputMode="decimal" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} required className={editInputClass} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              Price
              <input inputMode="decimal" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} required className={editInputClass} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              Alert at
              <input type="number" min={0} step={1} value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} className={editInputClass} />
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={pending} className="h-10 rounded-lg bg-ink-button px-4 text-sm font-semibold text-ink-button-foreground disabled:opacity-60">
                {pending ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={onDone} className="h-10 rounded-lg border border-control bg-surface px-4 text-sm font-medium">
                Cancel
              </button>
            </div>
          </div>
          {error ? <p role="alert" className={errorTextClass}>{error}</p> : null}
        </form>
      </td>
    </tr>
  );
}

/** Inventory table with inline editing and text+icon low-stock flags. */
export function ProductTable({
  businessId,
  currency,
  products,
}: {
  businessId: string;
  currency: string;
  products: ProductRow[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (products.length === 0) {
    return (
      <p className={emptyStateClass}>
        No products yet. Add your first product above to start tracking stock.
      </p>
    );
  }

  return (
    <div className={`${panelClass} overflow-x-auto`}>
      <table className="w-full min-w-[720px] text-sm">
        <caption className="sr-only">Products and stock</caption>
        <thead>
          <tr className="border-b border-border text-xs text-muted">
            <th scope="col" className={`${headClass} w-[34%]`}>Product</th>
            <th scope="col" className={headClass}>SKU</th>
            <th scope="col" className={numHeadClass}>In stock</th>
            <th scope="col" className={numHeadClass}>Unit cost</th>
            <th scope="col" className={numHeadClass}>Price</th>
            <th scope="col" className={numHeadClass}>Alert at</th>
            <th scope="col" className={headClass}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) =>
            editingId === product.productId ? (
              <EditRow
                key={product.productId}
                businessId={businessId}
                product={product}
                onDone={() => setEditingId(null)}
              />
            ) : (
              <tr key={product.productId} className="border-t border-rule transition hover:bg-surface-muted/60">
                <td className={cellClass}>
                  <Link
                    href={`/dashboard/${businessId}/products/${product.productId}`}
                    className="font-medium hover:underline"
                  >
                    {product.name}
                  </Link>
                </td>
                <td className={`${cellClass} text-muted`}>{product.sku ?? "—"}</td>
                <td className={numClass}>
                  {isLow(product) ? (
                    <span className="mr-2 inline-flex flex-none items-center gap-1 rounded-full border border-warning-border bg-warning-bg px-2 py-0.5 text-xs font-medium whitespace-nowrap text-warning">
                      <AlertIcon size={12} /> Low
                    </span>
                  ) : null}
                  <span className="font-medium">{product.quantity}</span>
                </td>
                <td className={`${numClass} text-muted`}>{formatMoney(product.unitCost, currency)}</td>
                <td className={numClass}>{formatMoney(product.sellingPrice, currency)}</td>
                <td className={`${numClass} text-muted`}>
                  {product.reorderLevel ?? "—"}
                </td>
                <td className={`${cellClass} whitespace-nowrap text-right`}>
                  <button
                    type="button"
                    onClick={() => setEditingId(product.productId)}
                    className="text-sm font-medium hover:underline"
                  >
                    Edit
                  </button>
                  <Link
                    href={`/dashboard/${businessId}/products/${product.productId}`}
                    className="ml-4 text-sm font-medium text-muted hover:text-foreground hover:underline"
                  >
                    Stock &amp; pricing
                  </Link>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
