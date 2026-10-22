"use client";

import { Suspense, useState, type ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { CloseIcon, MenuIcon } from "@/components/icons";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { BusinessNav } from "./business-nav";

/**
 * The nav reads the URL (usePathname/useParams), which cacheComponents only
 * allows inside Suspense; the fallback keeps the nav's height so nothing shifts.
 */
function Nav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Suspense
      fallback={
        <div aria-hidden="true" className="flex flex-col gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-9 rounded-lg bg-active/50" />
          ))}
        </div>
      }
    >
      <BusinessNav onNavigate={onNavigate} />
    </Suspense>
  );
}

function SidebarFooter() {
  return (
    <div className="flex flex-col gap-0.5 border-t border-border pt-3">
      <ThemeToggle variant="row" />
      <SignOutButton variant="row" />
    </div>
  );
}

/**
 * Shell for one business workspace. Desktop: a 248px sidebar on the page
 * ground (logo, business scope, sections, theme and sign-out). Below 1024px
 * the sidebar folds into a 56px top bar with a full-screen menu.
 */
export function AppShell({ scope, children }: { scope: ReactNode; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  return (
    <div className="flex min-h-full flex-1 flex-col lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-5 overflow-y-auto border-r border-border bg-sidebar px-3 py-5 lg:flex">
        <Link href="/dashboard" aria-label="Elevate — all businesses" className="px-2.5">
          <Logo width={112} priority />
        </Link>
        {scope}
        <Nav />
        <div className="mt-auto">
          <SidebarFooter />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-background px-4 lg:hidden">
        <Link href="/dashboard" aria-label="Elevate — all businesses">
          <Logo width={96} priority />
        </Link>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-expanded={menuOpen}
          aria-controls="workspace-menu"
          className="inline-flex size-10 items-center justify-center rounded-lg border border-border text-foreground"
        >
          <MenuIcon size={18} />
          <span className="sr-only">Open menu</span>
        </button>
      </header>

      <div
        id="workspace-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        hidden={!menuOpen}
        className="fixed inset-0 z-40 flex-col gap-5 overflow-y-auto bg-background px-4 py-3 data-[open=true]:flex lg:hidden"
        data-open={menuOpen}
      >
        <div className="flex h-10 items-center justify-between">
          <Logo width={96} />
          <button
            type="button"
            onClick={close}
            className="inline-flex size-10 items-center justify-center rounded-lg border border-border"
          >
            <CloseIcon size={18} />
            <span className="sr-only">Close menu</span>
          </button>
        </div>
        {scope}
        <Nav onNavigate={close} />
        <SidebarFooter />
      </div>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pt-6 pb-16 sm:px-8 lg:pt-8">
        {children}
      </main>
    </div>
  );
}

/** Business name and scope at the top of the sidebar, with the way back to all businesses. */
export function BusinessScope({
  name,
  detail,
}: {
  name: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <p className="truncate text-sm font-semibold" title={name}>
        {name}
      </p>
      <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted">
        <span className="truncate">{detail}</span>
        <Link href="/dashboard" className="shrink-0 font-medium text-foreground hover:underline">
          Switch
        </Link>
      </div>
    </div>
  );
}
