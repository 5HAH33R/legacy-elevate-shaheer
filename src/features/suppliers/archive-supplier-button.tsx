"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { errorTextClass } from "@/features/auth/ui";

export function ArchiveSupplierButton({
  businessId,
  supplierId,
}: {
  businessId: string;
  supplierId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function archive() {
    if (!window.confirm("Archive this supplier? Past purchases are kept.")) return;
    setError(null);
    const response = await fetch(`/api/businesses/${businessId}/suppliers/${supplierId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setError("Could not archive the supplier.");
      return;
    }
    router.push(`/dashboard/${businessId}/suppliers`);
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={archive}
        className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted hover:text-foreground"
      >
        Archive supplier
      </button>
      {error ? <p role="alert" className={errorTextClass}>{error}</p> : null}
    </div>
  );
}
