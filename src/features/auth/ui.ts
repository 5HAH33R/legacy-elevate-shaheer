/** Shared Tailwind classes for forms, panels and buttons. Theme tokens only. */
export const fieldClass = "flex flex-col gap-1.5";
export const labelClass = "text-sm font-medium tracking-tight";
export const inputClass =
  "h-10 w-full rounded-lg border border-control bg-surface px-3 text-sm text-foreground placeholder:text-muted transition-all duration-150 hover:border-muted focus:border-focus-ring focus:outline-none focus:ring-2 focus:ring-focus-ring/25 focus:shadow-xs disabled:cursor-not-allowed disabled:opacity-60";
/** The one lime action on a screen with subtle scale and shadow. */
export const primaryButtonClass =
  "inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-xs transition-all duration-150 hover:brightness-105 hover:shadow-sm hover:scale-[1.01] active:scale-[0.98] active:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100";
/** Inline-width variant of the primary action (title rows, toolbars). */
export const primaryActionClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-xs transition-all duration-150 hover:brightness-105 hover:shadow-sm hover:scale-[1.02] active:scale-[0.98] active:brightness-95";
export const secondaryButtonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-control bg-surface px-3.5 text-sm font-medium text-foreground transition-all duration-150 hover:bg-surface-muted hover:border-muted active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";
export const errorTextClass = "text-sm text-danger font-medium";
export const successTextClass = "text-sm text-success font-medium";
export const mutedLinkClass =
  "font-medium text-foreground underline underline-offset-4 transition-colors hover:text-primary";

/** Panels: a 1px line on the soft ground, smooth card elevation and lift. */
export const panelClass = "rounded-xl border border-border bg-surface shadow-xs transition-colors";
export const panelPadClass = "rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-xs card-hover-lift";
export const panelTitleClass = "text-base font-semibold tracking-tight";
/** Empty state inside a list's frame. */
export const emptyStateClass =
  "rounded-xl border border-dashed border-control px-5 py-6 text-sm text-muted bg-surface-muted/30 text-center";
