import type { ReactNode } from "react";

/**
 * Title row for a workspace screen: a noun h1, one grey line about the data,
 * and the screen's real actions on the right.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Small context line above the title, e.g. a back link. */
  eyebrow?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1.5 text-sm text-muted">{eyebrow}</div> : null}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Loading state: the final layout with grey bars at their real size, no shimmer. */
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-48 rounded-md bg-surface-muted" />
        <div className="h-4 w-80 max-w-full rounded-md bg-surface-muted" />
      </div>
      <div className="h-28 rounded-xl border border-border bg-surface" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="h-72 rounded-xl border border-border bg-surface" />
        <div className="h-72 rounded-xl border border-border bg-surface" />
      </div>
    </div>
  );
}
