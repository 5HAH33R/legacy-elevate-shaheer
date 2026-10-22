"use client";

import { useState, type FormEvent } from "react";
import { AlertIcon, AssistantIcon, InfoIcon } from "@/components/icons";
import { errorTextClass, fieldClass, inputClass, labelClass, panelPadClass, primaryActionClass, secondaryButtonClass } from "@/features/auth/ui";

const KINDS = [
  { value: "promo-copy", label: "Promotional messages" },
  { value: "seasonal-plan", label: "Seasonal campaign plan" },
  { value: "retention-ideas", label: "Customer retention ideas" },
];
const LANGUAGES = [
  { value: "english", label: "English" },
  { value: "roman-urdu", label: "Roman Urdu" },
  { value: "urdu", label: "اردو (Urdu)" },
];

/** Marketing suggestions form. Output is plain text for the owner to copy; nothing is sent or posted. */
export function MarketingForm({ businessId, configured }: { businessId: string; configured: boolean }) {
  const [kind, setKind] = useState("promo-copy");
  const [language, setLanguage] = useState("roman-urdu");
  const [goal, setGoal] = useState("");
  const [budget, setBudget] = useState("");
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch(`/api/businesses/${businessId}/marketing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, language, goal, ...(budget.trim() ? { budget } : {}) }),
      });
      const data = (await res.json().catch(() => null)) as { text?: string; error?: string } | null;
      if (!res.ok || !data?.text) throw new Error(data?.error ?? "Could not generate suggestions.");
      setText(data.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate suggestions.");
    } finally {
      setPending(false);
    }
  }

  async function copy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setError("Could not copy. Select the text and copy it manually.");
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <form onSubmit={onSubmit} noValidate className={`${panelPadClass} flex flex-col gap-4`}>
        {!configured ? (
          <p role="status" className="flex gap-2 rounded-lg border border-warning-border bg-warning-bg px-3 py-2.5 text-sm text-warning">
            <InfoIcon className="mt-0.5 shrink-0" />
            The AI assistant is not configured yet. Add an AI API key to the server settings.
          </p>
        ) : null}
        <div className={fieldClass}>
          <label htmlFor="m-kind" className={labelClass}>What do you need?</label>
          <select id="m-kind" value={kind} onChange={(e) => setKind(e.target.value)} className={inputClass}>
            {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>
        <div className={fieldClass}>
          <label htmlFor="m-goal" className={labelClass}>Your goal</label>
          <textarea id="m-goal" rows={3} maxLength={300} dir="auto" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Sell more before Eid, bring back old customers" className={`${inputClass} h-auto resize-none py-2.5`} />
        </div>
        <div className={fieldClass}>
          <label htmlFor="m-budget" className={labelClass}>Budget (optional)</label>
          <input id="m-budget" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="5000" className={inputClass} />
        </div>
        <div className={fieldClass}>
          <label htmlFor="m-lang" className={labelClass}>Language</label>
          <select id="m-lang" value={language} onChange={(e) => setLanguage(e.target.value)} className={inputClass}>
            {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
        <button type="submit" disabled={!configured || pending || goal.trim().length < 3} className={`${primaryActionClass} h-10 disabled:cursor-not-allowed disabled:opacity-60`}>
          <AssistantIcon />
          {pending ? "Writing…" : "Get suggestions"}
        </button>
        {error ? (
          <p role="alert" className={`${errorTextClass} flex items-center gap-2`}>
            <AlertIcon className="shrink-0" />
            {error}
          </p>
        ) : null}
      </form>

      <section aria-labelledby="m-result" className={`${panelPadClass} min-h-48`}>
        <div className="flex items-center justify-between gap-2">
          <h2 id="m-result" className="text-base font-semibold">Suggestions</h2>
          {text ? <button type="button" onClick={copy} className={secondaryButtonClass}>{copied ? "Copied" : "Copy"}</button> : null}
        </div>
        {pending ? (
          <p role="status" className="mt-3 text-sm text-muted">Writing suggestions from your sales records…</p>
        ) : text ? (
          <p dir="auto" className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
        ) : (
          <p className="mt-3 text-sm text-muted">Describe your goal and press Get suggestions. Your top sellers of the last 30 days, business type and currency are used as context.</p>
        )}
      </section>
    </div>
  );
}
