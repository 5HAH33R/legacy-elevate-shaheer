import { formatMoney } from "@/lib/money";
import type { Purchase } from "@/server/purchases";
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
    return (
      <p className="rounded-2xl border border-border bg-surface-muted p-6 text-sm text-muted">
        No purchases found.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {purchases.map((p) => (
        <li key={p.purchaseId} className="flex flex-col gap-1 rounded-2xl border border-border bg-surface p-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="font-medium">
              {p.date} · {p.supplierName}
              {p.voidedAt ? " (voided)" : ""}
            </span>
            <span className={p.voidedAt ? "font-semibold text-muted line-through" : "font-semibold"}>
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
