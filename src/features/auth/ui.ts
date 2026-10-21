/** Shared Tailwind classes for forms, panels and buttons. Theme tokens only. */
export const fieldClass = "flex flex-col gap-1.5";
export const labelClass = "text-sm font-medium";
export const inputClass =
  "h-10 w-full rounded-lg border border-control bg-surface px-3 text-sm text-foreground placeholder:text-muted transition focus:border-focus-ring focus:outline-none focus:ring-2 focus:ring-focus-ring/20 disabled:cursor-not-allowed disabled:opacity-60";
/** The one lime action on a screen. */
export const primaryButtonClass =
  "inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-95 active:brightness-90 disabled:cursor-not-allowed disabled:opacity-60";
/** Inline-width variant of the primary action (title rows, toolbars). */
export const primaryActionClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition hover:brightness-95 active:brightness-90";
export const secondaryButtonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-control bg-surface px-3.5 text-sm font-medium text-foreground transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60";
export const errorTextClass = "text-sm text-danger";
export const successTextClass = "text-sm text-success";
export const mutedLinkClass =
  "font-medium text-foreground underline underline-offset-4 hover:text-muted";

/** Panels: a 1px line on the white page, no shadow. */
export const panelClass = "rounded-xl border border-border bg-surface";
export const panelPadClass = "rounded-xl border border-border bg-surface p-5 sm:p-6";
export const panelTitleClass = "text-base font-semibold tracking-tight";
/** Empty state inside a list's frame. */
export const emptyStateClass =
  "rounded-xl border border-dashed border-control px-5 py-6 text-sm text-muted";
