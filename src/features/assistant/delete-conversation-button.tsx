"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Deletes a saved conversation (chat history only) after confirmation. */
export function DeleteConversationButton({
  businessId,
  conversationId,
  redirectTo,
}: {
  businessId: string;
  conversationId: string;
  /** Where to go after deleting the conversation that is currently open. */
  redirectTo: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function onDelete() {
    if (!window.confirm("Delete this conversation? This cannot be undone.")) return;
    setError(false);
    setPending(true);
    try {
      const response = await fetch(
        `/api/businesses/${businessId}/ai/conversations/${conversationId}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("delete failed");
      if (redirectTo) router.replace(redirectTo);
      router.refresh();
    } catch {
      setError(true);
      setPending(false);
    }
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="text-xs font-medium text-danger underline underline-offset-4 hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-danger">
          Could not delete.
        </span>
      ) : null}
    </span>
  );
}
