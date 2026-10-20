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

const CURRENCIES = ["PKR", "USD", "EUR", "GBP", "AED"] as const;

export function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [currency, setCurrency] = useState<string>("PKR");
  const [timezone, setTimezone] = useState<string>("Asia/Karachi");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          // Omit empty optional fields so server defaults apply.
          ...(businessType.trim() !== ""
            ? { businessType: businessType.trim() }
            : {}),
          currency,
          timezone: timezone.trim() || "Asia/Karachi",
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? "Could not create your business.");
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create your business.",
      );
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className={fieldClass}>
        <label htmlFor="business-name" className={labelClass}>
          Business name
        </label>
        <input
          id="business-name"
          type="text"
          required
          maxLength={120}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={inputClass}
          placeholder="Al-Noor Kiryana Store"
        />
      </div>
      <div className={fieldClass}>
        <label htmlFor="business-type" className={labelClass}>
          Business type <span className="text-muted">(optional)</span>
        </label>
        <input
          id="business-type"
          type="text"
          maxLength={120}
          value={businessType}
          onChange={(event) => setBusinessType(event.target.value)}
          className={inputClass}
          placeholder="Retail, wholesale, services…"
        />
      </div>
      <div className={fieldClass}>
        <label htmlFor="business-currency" className={labelClass}>
          Currency
        </label>
        <select
          id="business-currency"
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
          className={inputClass}
        >
          {CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </div>

      <div className={fieldClass}>
        <label htmlFor="business-timezone" className={labelClass}>
          Time zone
        </label>
        <input
          id="business-timezone"
          type="text"
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          className={inputClass}
          placeholder="Asia/Karachi"
        />
      </div>

      {error ? (
        <p role="alert" className={errorTextClass}>
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Creating workspace…" : "Create workspace"}
      </button>
    </form>
  );
}
