"use client";

import { useState } from "react";
import { AlertIcon, AssistantIcon, CheckIcon } from "@/components/icons";
import { errorTextClass, inputClass, panelClass, panelTitleClass, primaryActionClass } from "@/features/auth/ui";
import type { SavedForecastSnapshot } from "@/server/ai/forecast";

const LANGUAGES = [
  { value: "english", label: "English" },
  { value: "roman-urdu", label: "Roman Urdu (Urdu in English alphabet)" },
  { value: "urdu", label: "اردو (Urdu Script)" },
];

/** On-demand AI explanation and practical action recommendations with Firestore persistence. */
export function ForecastExplain({
  businessId,
  horizon,
  configured,
  savedSnapshots = [],
}: {
  businessId: string;
  horizon: number;
  configured: boolean;
  savedSnapshots?: SavedForecastSnapshot[];
}) {
  const [language, setLanguage] = useState("english");
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<SavedForecastSnapshot | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    setSavedSuccess(false);
    setSelectedSnapshot(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/forecast/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horizon, language }),
      });
      const data = (await res.json().catch(() => null)) as { text?: string; error?: string; snapshotId?: string } | null;
      if (!res.ok || !data?.text) throw new Error(data?.error ?? "Could not explain the forecast.");
      setText(data.text);
      setSavedSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not explain the forecast.");
    } finally {
      setPending(false);
    }
  }

  const isUrdu = language === "urdu" || selectedSnapshot?.aiInsight?.language === "ur";

  return (
    <section aria-labelledby="ai-insights-heading" className={`${panelClass} p-5 sm:p-6 shadow-xs flex flex-col gap-4`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 id="ai-insights-heading" className={panelTitleClass}>
              AI Strategic Insights & Recommendations
            </h3>
            <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              Hosted Model
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            Translates deterministic demand, cash flow, and stock risks into practical business guidance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="explain-lang" className="sr-only">Language</label>
          <select
            id="explain-lang"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className={`${inputClass} w-auto text-xs h-9`}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={run}
            disabled={!configured || pending}
            className={`${primaryActionClass} h-9 px-4 text-xs font-semibold gap-1.5`}
          >
            <AssistantIcon size={14} />
            {pending ? "Analyzing with AI…" : "Generate AI Advice"}
          </button>
        </div>
      </div>

      {!configured ? (
        <p className="text-xs text-muted">
          The AI assistant is not configured yet. The deterministic calculation cards above remain fully functional.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className={`${errorTextClass} flex items-center gap-2 text-xs`}>
          <AlertIcon className="shrink-0" size={14} />
          {error}
        </p>
      ) : null}

      {/* Generated text output */}
      {text ? (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-primary/15 pb-2">
            <span className="text-xs font-bold text-primary flex items-center gap-1.5">
              <AssistantIcon size={14} /> Elevate AI Advisor
            </span>
            {savedSuccess ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">
                <CheckIcon size={11} /> Saved to History
              </span>
            ) : null}
          </div>
          <p
            dir={isUrdu ? "rtl" : "auto"}
            className={`whitespace-pre-wrap text-sm leading-relaxed text-foreground mt-1 ${isUrdu ? "font-serif text-base" : ""}`}
          >
            {text}
          </p>
        </div>
      ) : null}

      {/* Previously Saved Snapshots View */}
      {savedSnapshots.length > 0 ? (
        <div className="mt-3 pt-4 border-t border-border">
          <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2.5">
            Revisit Previous Forecast Snapshots ({savedSnapshots.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {savedSnapshots.slice(0, 5).map((snap) => (
              <button
                key={snap.snapshotId}
                type="button"
                onClick={() => {
                  setSelectedSnapshot(snap);
                  if (snap.aiInsight) setText(snap.aiInsight.text);
                }}
                className={`text-left rounded-lg border px-3 py-2 text-xs transition ${
                  selectedSnapshot?.snapshotId === snap.snapshotId
                    ? "border-primary bg-primary/10 text-foreground font-semibold"
                    : "border-border bg-surface hover:bg-surface-muted text-muted"
                }`}
              >
                <span className="block font-medium text-foreground">{snap.horizon}-Day Snapshot</span>
                <span className="num text-[11px] block">{snap.createdAt.slice(0, 10)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
