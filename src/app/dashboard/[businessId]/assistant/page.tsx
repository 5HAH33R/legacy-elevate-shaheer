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
import { PageHeader, PageSkeleton } from "@/features/workspace/page-header";
import { AssistantChat } from "@/features/assistant/assistant-chat";
import { DeleteConversationButton } from "@/features/assistant/delete-conversation-button";
import { PlusIcon } from "@/components/icons";
import { panelClass, secondaryButtonClass } from "@/features/auth/ui";

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
  await requirePageBusiness(businessId);
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
      <PageHeader
        title="AI assistant"
        description="Ask about your sales, profit and stock in English, Urdu or Roman Urdu. Answers use only this business's records and the same figures as your Overview. The assistant cannot change any record."
        actions={
          selected ? (
            <Link href={base} className={secondaryButtonClass}>
              <PlusIcon />
              New conversation
            </Link>
          ) : null
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <section aria-labelledby="conversations-heading" className={`${panelClass} lg:sticky lg:top-8`}>
          <div className="flex items-baseline justify-between gap-2 px-4 pt-4 pb-2">
            <h2 id="conversations-heading" className="text-sm font-semibold">
              Saved conversations
            </h2>
            {conversations.length > 0 ? (
              <span className="num text-xs text-muted">{conversations.length}</span>
            ) : null}
          </div>
          {conversations.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted">
              Nothing saved yet. Every question and answer is saved here automatically.
            </p>
          ) : (
            <ul className="flex max-h-[60vh] flex-col gap-0.5 overflow-y-auto px-2 pb-2">
              {conversations.map((c) => {
                const active = c.conversationId === selected?.conversationId;
                return (
                  <li
                    key={c.conversationId}
                    className={`group rounded-lg px-2.5 py-2 text-sm ${active ? "bg-active" : "hover:bg-surface-muted"}`}
                  >
                    <Link
                      href={`${base}?c=${c.conversationId}`}
                      aria-current={active ? "page" : undefined}
                      className="block truncate font-medium"
                      dir="auto"
                    >
                      {c.title}
                    </Link>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="num text-xs text-muted">
                        {c.messageCount / 2} question{c.messageCount === 2 ? "" : "s"} · {c.updatedAt.slice(0, 10)}
                      </span>
                      <DeleteConversationButton
                        businessId={businessId}
                        conversationId={c.conversationId}
                        redirectTo={active ? base : null}
                      />
                    </div>
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
    <Suspense fallback={<PageSkeleton />}>
      <AssistantContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
