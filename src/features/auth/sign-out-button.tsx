"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase/client";
import { SignOutIcon } from "@/components/icons";
import { destroyServerSession } from "./session-client";

/** `variant="row"` is the sidebar row; "button" is a compact header button. */
export function SignOutButton({ variant = "button" }: { variant?: "button" | "row" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSignOut() {
    setPending(true);
    try {
      await signOut(getClientAuth());
    } catch {
      // Still clear the server session and leave the workspace.
    }
    await destroyServerSession();
    router.replace("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onSignOut}
      disabled={pending}
      className={
        variant === "row"
          ? "flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm text-muted transition hover:bg-active hover:text-foreground disabled:opacity-60"
          : "inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground transition hover:bg-surface-muted disabled:opacity-60"
      }
    >
      <SignOutIcon />
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
