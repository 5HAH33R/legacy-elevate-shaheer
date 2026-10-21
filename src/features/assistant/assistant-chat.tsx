"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/money";
import type { AssistantMessage, Conversation } from "@/server/ai/conversations";
import { errorTextClass, inputClass, labelClass, primaryButtonClass } from "@/features/auth/ui";

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
      <li className="self-end max-w-[85%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground">
        <span className="sr-only">You asked: </span>
        <p dir="auto" className="whitespace-pre-wrap">
          {message.text}
        </p>
      </li>
    );
  }
  return (
    <li className="max-w-[95%] rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm">
      <p className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-muted">
        <span aria-hidden="true">✦</span>
        AI-generated answer — check important numbers on your dashboard
      </p>
      <p dir="auto" className="whitespace-pre-wrap leading-relaxed">
        {message.text}
      </p>
      {message.truncated ? (
        <p className="mt-2 text-xs text-warning">
          <span aria-hidden="true">⚠ </span>This answer was cut short. Ask a narrower question for the rest.
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
    <section aria-labelledby="chat-heading" className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
      <h2 id="chat-heading" className="text-base font-semibold">
        {conversation ? conversation.title : "New conversation"}
      </h2>

      {!configured ? (
        <p role="status" className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm">
          <span aria-hidden="true">ℹ </span>
          The AI assistant is not configured yet. Ask the app administrator to add an AI API key. Your
          dashboard figures are still available on the Summary page.
        </p>
      ) : null}

      {messages.length === 0 ? (
        <div>
          <p className="text-sm text-muted">Try one of these, or ask your own question:</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((q) => (
              <li key={q}>
                <button
                  type="button"
                  onClick={() => setQuestion(q)}
                  className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-surface-muted"
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
        <p role="status" className="text-sm text-muted">
          <span aria-hidden="true">… </span>Checking your records and writing an answer…
        </p>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <label htmlFor="assistant-question" className={labelClass}>
          Your question
        </label>
        <textarea
          id="assistant-question"
          rows={3}
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
          className={inputClass}
          placeholder="Mera is mahine ka profit kitna hua?"
          disabled={!configured || pending}
        />
        {error ? (
          <p role="alert" className={errorTextClass}>
            <span aria-hidden="true">⚠ </span>
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={!configured || pending} className={primaryButtonClass}>
          {pending ? "Thinking…" : "Ask"}
        </button>
        <p className="text-xs text-muted">
          Answers are estimates and suggestions, not professional accounting, tax or legal advice. Only the
          figures needed for an answer are sent to the AI service.
        </p>
      </form>
    </section>
  );
}
