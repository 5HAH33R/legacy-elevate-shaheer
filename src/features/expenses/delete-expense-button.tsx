"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Deletes a mis-entered expense after confirmation. */
export function DeleteExpenseButton({
  businessId,
  expenseId,
}: {
  businessId: string;
  expenseId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function onDelete() {
    if (!window.confirm("Delete this expense? This cannot be undone.")) return;
    setError(false);
    setPending(true);
    try {
      const response = await fetch(
        `/api/businesses/${businessId}/expenses/${expenseId}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("delete failed");
      router.refresh();
    } catch {
      setError(true);
      setPending(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
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
