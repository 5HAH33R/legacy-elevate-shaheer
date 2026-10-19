import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { SignOutButton } from "@/features/auth/sign-out-button";

/** Header for signed-in workspace pages (dashboard, onboarding). */
export function WorkspaceHeader() {
  return (
    <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 pt-6 sm:px-6">
      <Link href="/dashboard" aria-label="Elevate dashboard">
        <Logo width={140} priority />
      </Link>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <SignOutButton />
      </div>
    </header>
  );
}
