import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

/** Centered form layout shared by the sign-in, sign-up and reset pages. */
export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-8">
        <Link href="/" aria-label="Elevate home">
          <Logo width={112} priority />
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-8 pb-16 sm:pt-16">
        <section className="w-full max-w-[420px]">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-muted">{description}</p>
          <div className="mt-8 rounded-xl border border-border bg-surface p-6 sm:p-7">{children}</div>
          <p className="mt-6 text-center text-xs text-muted">
            Your records are private to your account.
          </p>
        </section>
      </main>
    </div>
  );
}
