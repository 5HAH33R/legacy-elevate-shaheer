import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-12 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Logo width={160} priority />
        <ThemeToggle />
      </header>

      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Your business, organized and understood.
        </h1>
        <p className="text-lg text-muted">
          Elevate helps small business owners in Pakistan manage inventory,
          sales, expenses and suppliers, and ask questions about their business
          in English, Urdu or Roman Urdu.
        </p>
      </section>

      <section className="flex flex-wrap gap-3">
        <Link
          href="/sign-up"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-95"
        >
          Create an account
        </Link>
        <Link
          href="/sign-in"
          className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-surface-muted"
        >
          Sign in
        </Link>
      </section>

      <section
        aria-labelledby="status-heading"
        className="rounded-2xl border border-border bg-surface p-6"
      >
        <h2 id="status-heading" className="text-base font-semibold">
          Project status
        </h2>
        <p className="mt-2 text-muted">
          Phase 2: owner sign-up, sign-in and a private business workspace are
          live. Business records and the AI assistant come in later phases.
        </p>
      </section>
    </main>
  );
}
