import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { SignOutButton } from "@/features/auth/sign-out-button";

/** Top bar for signed-in pages outside a business (business list, onboarding). */
export function WorkspaceHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-8">
        <Link href="/dashboard" aria-label="Elevate — all businesses">
          <Logo width={104} priority />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
