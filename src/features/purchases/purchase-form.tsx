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

type Row = { productId: string; quantity: string; unit: string; unitCost: string };
const emptyRow = (): Row => ({ productId: "", quantity: "1", unit: "pcs", unitCost: "" });

/** Mobile-friendly multi-line purchase form; purchaseId reused on retries. */
export function PurchaseForm({
  businessId,
  currency,
  timezone,
  suppliers,
  products,
}: {
  businessId: string;
  currency: string;
  timezone: string;
  suppliers: { supplierId: string; name: string }[];
  products: { productId: string; name: string; unitCost: number }[];
}) {
  const router = useRouter();
  const idRef = useRef<string>(crypto.randomUUID());
  const [date, setDate] = useState(() => todayInTimeZone(timezone));
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  if (suppliers.length === 0 || products.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-surface-muted p-6 text-sm text-muted">
        Add at least one supplier and one product before recording a purchase.{" "}
        <Link href={`/dashboard/${businessId}/suppliers`} className="font-medium text-foreground underline underline-offset-4">
          Suppliers
        </Link>
      </p>
    );
  }

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    if (!supplierId) return setError("Choose a supplier.");
    if (rows.some((r) => !r.productId || !r.unitCost.trim())) {
      return setError("Choose a product and unit cost for every row.");
    }
    setPending(true);
    try {
      const response = await fetch(`/api/businesses/${businessId}/purchases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseId: idRef.current,
          supplierId,
          date,
          notes: notes || undefined,
          items: rows.map((r) => ({
            productId: r.productId,
            quantity: Number(r.quantity),
            unit: r.unit || "pcs",
            unitCost: r.unitCost.trim(),
          })),
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Could not record the purchase.");
      idRef.current = crypto.randomUUID();
      setRows([emptyRow()]);
      setNotes("");
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record the purchase.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 sm:p-6"
    >
      <h2 className="text-base font-semibold">Record a purchase</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={fieldClass}>
          <label htmlFor="pur-supplier" className={labelClass}>Supplier</label>
          <select id="pur-supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputClass}>
            <option value="" disabled>Choose a supplier</option>
            {suppliers.map((s) => (
              <option key={s.supplierId} value={s.supplierId}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className={fieldClass}>
          <label htmlFor="pur-date" className={labelClass}>Date</label>
          <input id="pur-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </div>
      </div>

      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-2 gap-3 rounded-xl border border-border p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
          <div className={`${fieldClass} col-span-2 sm:col-span-1`}>
            <label htmlFor={`pur-prod-${i}`} className={labelClass}>Product</label>
            <select
              id={`pur-prod-${i}`}
              value={row.productId}
              onChange={(e) => {
                const p = products.find((x) => x.productId === e.target.value);
                update(i, { productId: e.target.value, unitCost: p ? minorToDecimalString(p.unitCost) : "" });
              }}
              className={inputClass}
            >
              <option value="" disabled>Choose a product</option>
              {products.map((p) => (
                <option key={p.productId} value={p.productId}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className={fieldClass}>
            <label htmlFor={`pur-qty-${i}`} className={labelClass}>Qty</label>
            <input id={`pur-qty-${i}`} type="number" min={1} step={1} value={row.quantity} onChange={(e) => update(i, { quantity: e.target.value })} className={inputClass} />
          </div>
          <div className={fieldClass}>
            <label htmlFor={`pur-unit-${i}`} className={labelClass}>Unit</label>
            <input id={`pur-unit-${i}`} value={row.unit} onChange={(e) => update(i, { unit: e.target.value })} className={inputClass} />
          </div>
          <div className={fieldClass}>
            <label htmlFor={`pur-cost-${i}`} className={labelClass}>Unit cost ({currency})</label>
            <input id={`pur-cost-${i}`} inputMode="decimal" value={row.unitCost} onChange={(e) => update(i, { unitCost: e.target.value })} className={inputClass} />
          </div>
          {rows.length > 1 ? (
            <button type="button" onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))} className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted hover:text-foreground">
              Remove
            </button>
          ) : null}
        </div>
      ))}

      <div>
        <button type="button" onClick={() => setRows((rs) => [...rs, emptyRow()])} className="text-sm font-medium underline underline-offset-4 hover:text-muted">
          + Add another item
        </button>
      </div>
      <div className={fieldClass}>
        <label htmlFor="pur-notes" className={labelClass}>Notes (optional)</label>
        <input id="pur-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
      </div>
      <p className="text-xs text-muted">
        The total is calculated on the server. Each product&apos;s cost is updated to this purchase cost.
      </p>
      {error ? <p role="alert" className={errorTextClass}>{error}</p> : null}
      {success ? <p role="status" className={successTextClass}>Purchase recorded and stock increased.</p> : null}
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Recording…" : "Record purchase"}
      </button>
    </form>
  );
}
