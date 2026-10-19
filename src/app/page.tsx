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

      <section
        aria-labelledby="status-heading"
        className="rounded-2xl border border-border bg-surface p-6"
      >
        <h2 id="status-heading" className="text-base font-semibold">
          Project status
        </h2>
        <p className="mt-2 text-muted">
          Foundation setup only. Sign-in, business records and the AI assistant
          are not built yet.
        </p>
      </section>
    </main>
  );
}
