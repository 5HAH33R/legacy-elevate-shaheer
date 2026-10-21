"use client";

import { MoonIcon, SunIcon } from "@/components/icons";
import { THEME_STORAGE_KEY, type ThemePreference } from "./theme-script";

function currentTheme(): ThemePreference {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === "light" || explicit === "dark") return explicit;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Light/dark switch. The icon and label for the active theme are chosen by
 * CSS (.only-light / .only-dark), so server and client markup always match.
 * `variant="row"` is the full-width sidebar row; "icon" is a compact button.
 */
export function ThemeToggle({ variant = "icon" }: { variant?: "icon" | "row" }) {
  function toggle() {
    const next: ThemePreference = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable (private mode); the theme still applies for this visit.
    }
  }

  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={toggle}
        className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm text-muted transition hover:bg-active hover:text-foreground"
      >
        <span className="only-light"><MoonIcon /></span>
        <span className="only-dark"><SunIcon /></span>
        <span className="only-light">Dark theme</span>
        <span className="only-dark">Light theme</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between light and dark theme"
      title="Switch theme"
      className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-surface text-muted transition hover:text-foreground"
    >
      <span className="only-light"><MoonIcon /></span>
      <span className="only-dark"><SunIcon /></span>
    </button>
  );
}
