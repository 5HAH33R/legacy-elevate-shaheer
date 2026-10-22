import Link from "next/link";
import { formatMoney } from "@/lib/money";
import type { Purchase } from "@/server/purchases";
import { emptyStateClass, panelClass } from "@/features/auth/ui";
import { VoidPurchaseButton } from "./void-purchase-button";

export function PurchaseList({
  purchases,
  currency,
  businessId,
}: {
  purchases: Purchase[];
  currency: string;
  businessId: string;
}) {
  if (purchases.length === 0) {
    return <p className={emptyStateClass}>No purchases found.</p>;
  }
  return (
    <ul className={panelClass}>
      {purchases.map((p) => (
        <li
          key={p.purchaseId}
          className={`flex flex-col gap-1 border-t border-rule px-5 py-3.5 text-sm first:border-t-0 sm:px-6 ${p.voidedAt ? "text-muted" : ""}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {p.supplierName}
                {p.voidedAt ? (
                  <span className="inline-flex flex-none rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted">
                    Voided
                  </span>
                ) : null}
              </p>
              <p className="num text-xs text-muted">
                {p.date}
                {p.sourceDocumentId ? (
                  <>
                    {" · "}
                    <Link
                      href={`/dashboard/${businessId}/invoices/${p.sourceDocumentId}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      From scanned invoice
                    </Link>
                  </>
                ) : null}
              </p>
            </div>
            <span className={`num shrink-0 font-semibold ${p.voidedAt ? "line-through" : ""}`}>
              {formatMoney(p.total, currency)}
            </span>
          </div>
          <p className="text-muted">
            {p.items.map((i) => `${i.quantity} ${i.unit} × ${i.name} @ ${formatMoney(i.unitCost, currency)}`).join(", ")}
          </p>
          {!p.voidedAt ? (
            <div>
              <VoidPurchaseButton businessId={businessId} purchaseId={p.purchaseId} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
