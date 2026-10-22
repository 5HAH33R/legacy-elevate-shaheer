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
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between animate-fade-in">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1 text-xs font-medium text-muted tracking-wide uppercase">{eyebrow}</div> : null}
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-muted leading-relaxed">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div> : null}
    </header>
  );
}

/** Loading state: the final layout with smooth pulsating skeleton bars. */
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-6 animate-pulse">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-48 rounded-md bg-surface-muted" />
        <div className="h-4 w-80 max-w-full rounded-md bg-surface-muted/70" />
      </div>
      <div className="h-28 rounded-xl border border-border bg-surface-muted/40" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="h-72 rounded-xl border border-border bg-surface-muted/40" />
        <div className="h-72 rounded-xl border border-border bg-surface-muted/40" />
      </div>
    </div>
  );
}
