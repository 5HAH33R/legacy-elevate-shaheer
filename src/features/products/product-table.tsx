"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, minorToDecimalString } from "@/lib/money";
import { errorTextClass, inputClass } from "@/features/auth/ui";

export type ProductRow = {
  productId: string;
  name: string;
  sku: string | null;
  quantity: number;
  unitCost: number;
  sellingPrice: number;
  reorderLevel: number | null;
};

const cellClass = "px-4 py-3 text-left align-top";
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
  const [quantity, setQuantity] = useState(String(product.quantity));
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
            quantity: Number(quantity),
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
    <tr className="border-t border-border bg-surface-muted">
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
              Stock
              <input type="number" min={0} step={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} required className={editInputClass} />
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
              <button type="submit" disabled={pending} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60">
                {pending ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={onDone} className="rounded-lg border border-border px-3 py-2 text-xs font-medium">
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
      <p className="rounded-2xl border border-border bg-surface-muted p-6 text-sm text-muted">
        No products yet. Add your first product above to start tracking stock.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th className={cellClass}>Name</th>
            <th className={cellClass}>SKU</th>
            <th className={cellClass}>Stock</th>
            <th className={cellClass}>Unit cost</th>
            <th className={cellClass}>Price</th>
            <th className={cellClass}>Alert at</th>
            <th className={cellClass}>
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
              <tr key={product.productId} className="border-t border-border">
                <td className={`${cellClass} font-medium`}>{product.name}</td>
                <td className={`${cellClass} text-muted`}>{product.sku ?? "—"}</td>
                <td className={cellClass}>
                  {product.quantity}
                  {isLow(product) ? (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-warning px-2 py-0.5 text-xs font-medium text-warning">
                      <span aria-hidden="true">⚠</span> Low stock
                    </span>
                  ) : null}
                </td>
                <td className={cellClass}>{formatMoney(product.unitCost, currency)}</td>
                <td className={cellClass}>{formatMoney(product.sellingPrice, currency)}</td>
                <td className={`${cellClass} text-muted`}>
                  {product.reorderLevel ?? "—"}
                </td>
                <td className={cellClass}>
                  <button
                    type="button"
                    onClick={() => setEditingId(product.productId)}
                    className="text-xs font-medium underline underline-offset-4 hover:text-muted"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
