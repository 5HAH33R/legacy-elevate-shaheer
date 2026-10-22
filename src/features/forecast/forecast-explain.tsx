"use client";

import { useState } from "react";
import { AlertIcon, AssistantIcon } from "@/components/icons";
import { errorTextClass, inputClass, secondaryButtonClass } from "@/features/auth/ui";

const LANGUAGES = [
  { value: "english", label: "English" },
  { value: "roman-urdu", label: "Roman Urdu" },
  { value: "urdu", label: "اردو" },
];

/** On-demand AI explanation of the forecast numbers (plain text only). */
export function ForecastExplain({ businessId, horizon, configured }: { businessId: string; horizon: number; configured: boolean }) {
  const [language, setLanguage] = useState("english");
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/forecast/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horizon, language }),
      });
      const data = (await res.json().catch(() => null)) as { text?: string; error?: string } | null;
      if (!res.ok || !data?.text) throw new Error(data?.error ?? "Could not explain the forecast.");
      setText(data.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not explain the forecast.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="explain-lang" className="text-sm font-medium">Explain in</label>
          <select id="explain-lang" value={language} onChange={(e) => setLanguage(e.target.value)} className={`${inputClass} w-44`}>
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={run} disabled={!configured || pending} className={`${secondaryButtonClass} h-10`}>
          <AssistantIcon />
          {pending ? "Writing…" : "Explain with AI"}
        </button>
      </div>
      {!configured ? <p className="text-sm text-muted">The AI assistant is not configured yet. The numbers above still work.</p> : null}
      {error ? (
        <p role="alert" className={`${errorTextClass} flex items-center gap-2`}>
          <AlertIcon className="shrink-0" />
          {error}
        </p>
      ) : null}
      {text ? (
        <div className="rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm">
          <p className="mb-1 text-xs font-medium text-muted">AI-generated — estimates, not guarantees. Check the numbers in the table.</p>
          <p dir="auto" className="whitespace-pre-wrap leading-relaxed">{text}</p>
        </div>
      ) : null}
    </div>
  );
}
