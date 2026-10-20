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

/** Create a supplier (no supplierId given) or edit one. */
export function SupplierForm({
  businessId,
  supplier,
}: {
  businessId: string;
  supplier?: {
    supplierId: string;
    name: string;
    contact: { phone: string | null; email: string | null; address: string | null; notes: string | null };
  };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    const text = (k: string) => String(f.get(k) ?? "");
    setError(null);
    setSuccess(false);
    setPending(true);
    try {
      const url = supplier
        ? `/api/businesses/${businessId}/suppliers/${supplier.supplierId}`
        : `/api/businesses/${businessId}/suppliers`;
      const response = await fetch(url, {
        method: supplier ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: text("name"),
          contact: {
            phone: text("phone"),
            email: text("email"),
            address: text("address"),
            notes: text("notes"),
          },
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Could not save the supplier.");
      if (!supplier) form.reset();
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the supplier.");
    } finally {
      setPending(false);
    }
  }

  const c = supplier?.contact;
  const fields: [string, string, string | null | undefined][] = [
    ["phone", "Phone", c?.phone],
    ["email", "Email", c?.email],
    ["address", "Address", c?.address],
    ["notes", "Notes", c?.notes],
  ];

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6"
    >
      <h2 className="text-base font-semibold">
        {supplier ? "Edit supplier" : "Add a supplier"}
      </h2>
      <div className={fieldClass}>
        <label htmlFor="sup-name" className={labelClass}>Name</label>
        <input id="sup-name" name="name" required defaultValue={supplier?.name} className={inputClass} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(([key, label, value]) => (
          <div key={key} className={fieldClass}>
            <label htmlFor={`sup-${key}`} className={labelClass}>{label} (optional)</label>
            <input id={`sup-${key}`} name={key} defaultValue={value ?? ""} className={inputClass} />
          </div>
        ))}
      </div>
      {error ? <p role="alert" className={errorTextClass}>{error}</p> : null}
      {success ? <p role="status" className={successTextClass}>Supplier saved.</p> : null}
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Saving…" : "Save supplier"}
      </button>
    </form>
  );
}
