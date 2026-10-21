import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageBusiness, requirePageUser } from "@/server/page-guards";
import {
  getConversationForOwner,
  listConversationsForOwner,
  type Conversation,
} from "@/server/ai/conversations";
import { ApiError } from "@/server/errors";
import { getAiConfig } from "@/lib/env/server";
import { WorkspaceHeader } from "@/features/workspace/workspace-header";
import { BusinessNav } from "@/features/workspace/business-nav";
import { AssistantChat } from "@/features/assistant/assistant-chat";
import { DeleteConversationButton } from "@/features/assistant/delete-conversation-button";

export const metadata: Metadata = { title: "Assistant — Elevate" };

type Params = Promise<{ businessId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function AssistantContent({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { businessId } = await params;
  const query = await searchParams;
  // requireUser → requireBusinessOwner (404 for foreign ids) before any data call.
  const business = await requirePageBusiness(businessId);
  const user = await requirePageUser(`/dashboard/${businessId}/assistant`);
  const selectedId = Array.isArray(query.c) ? query.c[0] : query.c;

  let selected: Conversation | null = null;
  if (selectedId) {
    try {
      selected = await getConversationForOwner(businessId, user.uid, selectedId);
    } catch (error) {
      if (error instanceof ApiError) notFound();
      throw error;
    }
  }
  const conversations = await listConversationsForOwner(businessId, user.uid);
  const base = `/dashboard/${businessId}/assistant`;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">
          {business.name} — Assistant
        </h1>
        <p className="mt-1 text-sm text-muted">
          Ask about your sales, profit and stock in English, Urdu or Roman Urdu.
          Answers use only this business&apos;s records and the figures shown on
          your dashboard. The assistant cannot change any record.
        </p>
      </section>

      <BusinessNav businessId={businessId} />

      <section
        aria-labelledby="conversations-heading"
        className="rounded-2xl border border-border bg-surface p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="conversations-heading" className="text-base font-semibold">
            Saved conversations
          </h2>
          <Link
            href={base}
            className="rounded-full border border-border px-3 py-1.5 text-sm font-medium hover:text-foreground"
          >
            + New conversation
          </Link>
        </div>
        {conversations.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No saved conversations yet. Your questions and answers are saved
            here automatically.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1">
            {conversations.map((c) => {
              const active = c.conversationId === selected?.conversationId;
              return (
                <li
                  key={c.conversationId}
                  className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${active ? "bg-surface-muted" : ""}`}
                >
                  <Link
                    href={`${base}?c=${c.conversationId}`}
                    aria-current={active ? "page" : undefined}
                    className="min-w-0 flex-1 truncate font-medium hover:underline"
                    dir="auto"
                  >
                    {c.title}
                  </Link>
                  <span className="shrink-0 text-xs text-muted">
                    {c.messageCount / 2} Q · {c.updatedAt.slice(0, 10)}
                  </span>
                  <DeleteConversationButton
                    businessId={businessId}
                    conversationId={c.conversationId}
                    redirectTo={active ? base : null}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AssistantChat
        key={selected?.conversationId ?? "new"}
        businessId={businessId}
        initialConversation={selected}
        configured={getAiConfig() !== null}
      />
    </div>
  );
}

export default function AssistantPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  return (
    <>
      <WorkspaceHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
          <AssistantContent params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}
