import { AlertIcon, CheckIcon } from "@/components/icons";

/** Review status as a pale pill with a word and an icon (never colour alone). */
export function InvoiceStatusPill({ status }: { status: "needs_review" | "confirmed" | "discarded" }) {
  if (status === "confirmed") {
    return (
      <span className="inline-flex flex-none items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-xs font-medium whitespace-nowrap text-success">
        <CheckIcon size={12} /> Recorded
      </span>
    );
  }
  if (status === "discarded") {
    return (
      <span className="inline-flex flex-none rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium whitespace-nowrap text-muted">
        Discarded
      </span>
    );
  }
  return (
    <span className="inline-flex flex-none items-center gap-1 rounded-full border border-warning-border bg-warning-bg px-2 py-0.5 text-xs font-medium whitespace-nowrap text-warning">
      <AlertIcon size={12} /> Needs review
    </span>
  );
}
