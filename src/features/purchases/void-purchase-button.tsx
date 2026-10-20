"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { errorTextClass } from "@/features/auth/ui";

export function VoidPurchaseButton({
  businessId,
  purchaseId,
}: {
  businessId: string;
  purchaseId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function onVoid() {
    if (!window.confirm("Void this purchase? Stock will be reversed.")) return;
    setError(null);
    const response = await fetch(
      `/api/businesses/${businessId}/purchases/${purchaseId}/void`,
      { method: "POST" },
    );
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Could not void the purchase.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={onVoid}
        className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-muted hover:text-foreground"
      >
        Void
      </button>
      {error ? <p role="alert" className={errorTextClass}>{error}</p> : null}
    </div>
  );
}
