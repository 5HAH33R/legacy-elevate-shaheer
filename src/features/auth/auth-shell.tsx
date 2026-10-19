import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

/** Centered card layout shared by the sign-in, sign-up and reset pages. */
export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-4 py-10">
      <header className="flex items-center justify-between gap-4">
        <Link href="/" aria-label="Elevate home">
          <Logo width={140} priority />
        </Link>
        <ThemeToggle />
      </header>
      <section className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted">{description}</p>
        <div className="mt-6">{children}</div>
      </section>
    </main>
  );
}
