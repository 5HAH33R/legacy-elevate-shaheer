"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  errorTextClass,
  fieldClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  successTextClass,
} from "@/features/auth/ui";

/** Adjust stock by a signed amount; a reason is required. */
export function StockAdjustForm({
  businessId,
  productId,
}: {
  businessId: string;
  productId: string;
}) {
  const router = useRouter();
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setPending(true);
    try {
      const response = await fetch(
        `/api/businesses/${businessId}/products/${productId}/stock`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quantityDelta: Number(delta),
            reason: reason.trim(),
          }),
        },
      );
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) throw new Error(data?.error ?? "Could not adjust stock.");
      setDelta("");
      setReason("");
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not adjust stock.");
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
      <h2 className="text-base font-semibold">Adjust stock</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={fieldClass}>
          <label htmlFor="stock-delta" className={labelClass}>
            Change (use − to remove)
          </label>
          <input
            id="stock-delta"
            type="number"
            step={1}
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            className={inputClass}
            placeholder="e.g. 10 or -2"
          />
        </div>
        <div className={fieldClass}>
          <label htmlFor="stock-reason" className={labelClass}>
            Reason
          </label>
          <input
            id="stock-reason"
            type="text"
            maxLength={240}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={inputClass}
            placeholder="Stock count, damaged goods…"
          />
        </div>
      </div>
      {error ? (
        <p role="alert" className={errorTextClass}>
          {error}
        </p>
      ) : null}
      {success ? (
        <p role="status" className={successTextClass}>
          Stock adjusted.
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Saving…" : "Adjust stock"}
      </button>
    </form>
  );
}
