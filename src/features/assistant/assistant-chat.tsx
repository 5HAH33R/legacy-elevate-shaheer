"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/money";
import type { AssistantMessage, Conversation } from "@/server/ai/conversations";
import { AlertIcon, AssistantIcon, InfoIcon } from "@/components/icons";
import { errorTextClass, inputClass, panelClass, primaryActionClass } from "@/features/auth/ui";

const MAX_QUESTION_LENGTH = 1000;

const EXAMPLE_QUESTIONS = [
  "Mera profit kitna hua?",
  "Kon si products ka stock khatam hone wala hai?",
  "Is mahine meri sales kaisi rahi?",
  "Main apni sales kaise barha sakta hoon?",
  "What was my gross profit last month?",
  "اس مہینے میرا منافع کتنا ہوا؟",
];

function FiguresUsed({ message }: { message: AssistantMessage }) {
  const s = message.snapshot;
  if (!s) return null;
  const money = (v: number) => formatMoney(v, s.currency);
  return (
    <details className="mt-2 text-xs text-muted">
      <summary className="cursor-pointer">Figures this answer was based on</summary>
      <ul className="mt-1 flex flex-col gap-1">
        {s.periods.map((p) => (
          <li key={p.label}>
            <strong className="text-foreground">{p.label}</strong> ({p.from} to {p.to}): revenue{" "}
            {money(p.revenue)} · gross profit {money(p.grossProfit)} · recorded expenses {money(p.expenses)} ·
            estimated net profit {money(p.estimatedNetProfit)} · {p.saleCount} sales
          </li>
        ))}
        <li>
          {s.productCount} products, {s.lowStockCount} at or below their low-stock level.
        </li>
      </ul>
    </details>
  );
}

function MessageBubble({ message }: { message: AssistantMessage }) {
  if (message.role === "user") {
    return (
      <li className="max-w-[85%] self-end rounded-xl rounded-br-sm bg-ink-button px-4 py-2.5 text-sm text-ink-button-foreground">
        <span className="sr-only">You asked: </span>
        <p dir="auto" className="whitespace-pre-wrap">
          {message.text}
        </p>
      </li>
    );
  }
  return (
    <li className="max-w-[95%] rounded-xl rounded-bl-sm border border-border bg-surface-muted px-4 py-3 text-sm">
      <p className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-muted">
        <AssistantIcon size={14} className="text-chart" />
        AI-generated — check important numbers on your Overview
      </p>
      <p dir="auto" className="whitespace-pre-wrap leading-relaxed">
        {message.text}
      </p>
      {message.truncated ? (
        <p className="mt-2 text-xs text-warning">
          <AlertIcon size={12} className="mr-1 inline" />This answer was cut short. Ask a narrower question for the rest.
        </p>
      ) : null}
      <FiguresUsed message={message} />
    </li>
  );
}

/**
 * Chat with the grounded business assistant. Answers come from the server
 * (POST /ai/chat), which saves every exchange; the text is rendered as plain
 * text, never as HTML.
 */
export function AssistantChat({
  businessId,
  initialConversation,
  configured,
}: {
  businessId: string;
  initialConversation: Conversation | null;
  configured: boolean;
}) {
  const router = useRouter();
  const [conversation, setConversation] = useState(initialConversation);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const messages = conversation?.messages ?? [];

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = question.trim();
    if (!text) {
      setError("Type a question first.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/businesses/${businessId}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          ...(conversation ? { conversationId: conversation.conversationId } : {}),
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        conversation?: Conversation;
        error?: string;
      } | null;
      if (!response.ok || !data?.conversation) {
        throw new Error(data?.error ?? "The assistant could not answer. Please try again.");
      }
      const isNew = !conversation;
      setConversation(data.conversation);
      setQuestion("");
      if (isNew) {
        router.replace(`/dashboard/${businessId}/assistant?c=${data.conversation.conversationId}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The assistant could not answer. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="chat-heading" className={`${panelClass} flex min-h-[520px] flex-col`}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
        <h2 id="chat-heading" className="truncate text-base font-semibold" dir="auto">
          {conversation ? conversation.title : "New conversation"}
        </h2>
        {conversation ? (
          <span className="num shrink-0 text-xs text-muted">
            {messages.length / 2} of 20 questions
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-4 px-5 py-5 sm:px-6">
        {!configured ? (
          <p role="status" className="flex gap-2 rounded-lg border border-warning-border bg-warning-bg px-3 py-2.5 text-sm text-warning">
            <InfoIcon className="mt-0.5 shrink-0" />
            The AI assistant is not configured yet. Add an AI API key to the server settings. Your figures are
            still on the Overview page.
          </p>
        ) : null}

        {messages.length === 0 ? (
          <div className="my-auto flex flex-col items-start gap-3 py-6">
            <p className="flex items-center gap-2 text-sm font-medium">
              <AssistantIcon className="text-chart" />
              Start with a question about your business
            </p>
            <ul className="flex flex-wrap gap-2">
              {EXAMPLE_QUESTIONS.map((q) => (
                <li key={q}>
                  <button
                    type="button"
                    onClick={() => setQuestion(q)}
                    className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm transition hover:border-control hover:bg-surface-muted"
                    dir="auto"
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ol aria-label="Messages" className="flex flex-col gap-3">
            {messages.map((m) => (
              <MessageBubble key={m.messageId} message={m} />
            ))}
          </ol>
        )}

        {pending ? (
          <p role="status" className="flex items-center gap-2 text-sm text-muted">
            <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-chart" />
            Checking your records and writing an answer…
          </p>
        ) : null}
      </div>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2 border-t border-border px-5 py-4 sm:px-6">
        <label htmlFor="assistant-question" className="sr-only">
          Your question
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id="assistant-question"
            rows={2}
            maxLength={MAX_QUESTION_LENGTH}
            dir="auto"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            className={`${inputClass} h-auto min-h-[64px] resize-none py-2.5`}
            placeholder="Mera is mahine ka profit kitna hua?"
            disabled={!configured || pending}
          />
          <button type="submit" disabled={!configured || pending} className={`${primaryActionClass} h-10 disabled:cursor-not-allowed disabled:opacity-60`}>
            {pending ? "Thinking…" : "Ask"}
          </button>
        </div>
        {error ? (
          <p role="alert" className={`${errorTextClass} flex items-center gap-2`}>
            <AlertIcon className="shrink-0" />
            {error}
          </p>
        ) : null}
        <p className="text-xs text-muted">
          Enter to send, Shift+Enter for a new line. Answers are estimates and suggestions, not accounting, tax or
          legal advice. Only the figures an answer needs are sent to the AI service.
        </p>
      </form>
    </section>
  );
}
