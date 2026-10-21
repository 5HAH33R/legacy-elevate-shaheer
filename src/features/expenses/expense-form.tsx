"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { todayInTimeZone } from "@/lib/dates";
import {
  errorTextClass,
  fieldClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  successTextClass,
} from "@/features/auth/ui";

const COMMON_CATEGORIES = [
  "Rent",
  "Utilities",
  "Salaries",
  "Transport",
  "Marketing",
  "Supplies",
  "Other",
];

/** Record-expense form. Amount is sent as a decimal string. */
export function ExpenseForm({
  businessId,
  currency,
  timezone,
}: {
  businessId: string;
  currency: string;
  timezone: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(() => todayInTimeZone(timezone));
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setPending(true);
    try {
      const response = await fetch(`/api/businesses/${businessId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          category: category.trim(),
          ...(description.trim() !== ""
            ? { description: description.trim() }
            : {}),
          amount: amount.trim(),
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? "Could not record the expense.");
      }
      setCategory("");
      setDescription("");
      setAmount("");
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not record the expense.",
      );
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
      <h2 className="text-base font-semibold">Record an expense</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={fieldClass}>
          <label htmlFor="expense-date" className={labelClass}>
            Date
          </label>
          <input
            id="expense-date"
            type="date"
            required
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className={inputClass}
          />
        </div>
        <div className={fieldClass}>
          <label htmlFor="expense-category" className={labelClass}>
            Category
          </label>
          <input
            id="expense-category"
            type="text"
            required
            maxLength={60}
            list="expense-categories"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className={inputClass}
            placeholder="Rent, utilities…"
          />
          <datalist id="expense-categories">
            {COMMON_CATEGORIES.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </div>
        <div className={fieldClass}>
          <label htmlFor="expense-amount" className={labelClass}>
            Amount ({currency})
          </label>
          <input
            id="expense-amount"
            type="text"
            required
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className={inputClass}
            placeholder="5000.00"
          />
        </div>
        <div className={fieldClass}>
          <label htmlFor="expense-description" className={labelClass}>
            Description <span className="text-muted">(optional)</span>
          </label>
          <input
            id="expense-description"
            type="text"
            maxLength={240}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={inputClass}
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
          Expense recorded.
        </p>
      ) : null}

      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Recording…" : "Record expense"}
      </button>
    </form>
  );
}
