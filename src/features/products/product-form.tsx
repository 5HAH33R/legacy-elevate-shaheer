"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  errorTextClass,
  fieldClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/features/auth/ui";

/** Add-product form. Money is sent as decimal strings; the server parses it. */
export function ProductForm({
  businessId,
  currency,
}: {
  businessId: string;
  currency: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [reorderLevel, setReorderLevel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/businesses/${businessId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          ...(sku.trim() !== "" ? { sku: sku.trim() } : {}),
          quantity: Number(quantity),
          unitCost: unitCost.trim(),
          sellingPrice: sellingPrice.trim(),
          ...(reorderLevel.trim() !== ""
            ? { reorderLevel: Number(reorderLevel) }
            : {}),
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? "Could not save the product.");
      }
      setName("");
      setSku("");
      setQuantity("");
      setUnitCost("");
      setSellingPrice("");
      setReorderLevel("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the product.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6"
    >
      <h2 className="text-base font-semibold">Add a product</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={fieldClass}>
          <label htmlFor="product-name" className={labelClass}>
            Name
          </label>
          <input
            id="product-name"
            type="text"
            required
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
            placeholder="Wheat Flour 10kg"
          />
        </div>
        <div className={fieldClass}>
          <label htmlFor="product-sku" className={labelClass}>
            SKU <span className="text-muted">(optional)</span>
          </label>
          <input
            id="product-sku"
            type="text"
            maxLength={60}
            value={sku}
            onChange={(event) => setSku(event.target.value)}
            className={inputClass}
          />
        </div>
        <div className={fieldClass}>
          <label htmlFor="product-quantity" className={labelClass}>
            Stock quantity
          </label>
          <input
            id="product-quantity"
            type="number"
            required
            min={0}
            step={1}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className={inputClass}
            placeholder="0"
          />
        </div>
        <div className={fieldClass}>
          <label htmlFor="product-reorder" className={labelClass}>
            Low-stock alert at <span className="text-muted">(optional)</span>
          </label>
          <input
            id="product-reorder"
            type="number"
            min={0}
            step={1}
            value={reorderLevel}
            onChange={(event) => setReorderLevel(event.target.value)}
            className={inputClass}
            placeholder="e.g. 5"
          />
        </div>
        <div className={fieldClass}>
          <label htmlFor="product-cost" className={labelClass}>
            Unit cost ({currency})
          </label>
          <input
            id="product-cost"
            type="text"
            required
            inputMode="decimal"
            value={unitCost}
            onChange={(event) => setUnitCost(event.target.value)}
            className={inputClass}
            placeholder="900.00"
          />
        </div>
        <div className={fieldClass}>
          <label htmlFor="product-price" className={labelClass}>
            Selling price ({currency})
          </label>
          <input
            id="product-price"
            type="text"
            required
            inputMode="decimal"
            value={sellingPrice}
            onChange={(event) => setSellingPrice(event.target.value)}
            className={inputClass}
            placeholder="1100.00"
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className={errorTextClass}>
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Saving…" : "Save product"}
      </button>
    </form>
  );
}
