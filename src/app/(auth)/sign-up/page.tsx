import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/auth-shell";
import { SignUpForm } from "@/features/auth/sign-up-form";
import { redirectIfSignedIn } from "@/server/page-guards";

export const metadata: Metadata = { title: "Create account — Elevate" };

async function AlreadySignedIn() {
  await redirectIfSignedIn();
  return null;
}

export default function SignUpPage() {
  return (
    <AuthShell
      title="Create your account"
      description="One account for you, one secure workspace for your business."
    >
      <Suspense fallback={null}>
        <AlreadySignedIn />
      </Suspense>
      <SignUpForm />
    </AuthShell>
  );
}
