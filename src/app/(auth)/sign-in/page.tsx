import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/auth-shell";
import { SignInForm } from "@/features/auth/sign-in-form";
import { redirectIfSignedIn } from "@/server/page-guards";

export const metadata: Metadata = { title: "Sign in — Elevate" };

/** Dynamic auth check; must stay behind Suspense with cacheComponents. */
async function AlreadySignedIn() {
  await redirectIfSignedIn();
  return null;
}

export default function SignInPage() {
  return (
    <AuthShell title="Sign in" description="Access your business workspace.">
      <Suspense fallback={null}>
        <AlreadySignedIn />
      </Suspense>
      <SignInForm />
    </AuthShell>
  );
}
