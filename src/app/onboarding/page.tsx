import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listBusinessesForUser } from "@/server/businesses";
import { requirePageUser } from "@/server/page-guards";
import { OnboardingForm } from "@/features/onboarding/onboarding-form";
import { WorkspaceHeader } from "@/features/workspace/workspace-header";

export const metadata: Metadata = { title: "Set up your business — Elevate" };

async function OnboardingContent() {
  const user = await requirePageUser("/onboarding");
  // Owners who already have a workspace go straight to the dashboard.
  const businesses = await listBusinessesForUser(user.uid);
  if (businesses.length > 0) redirect("/dashboard");
  return (
    <section className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        Set up your business
      </h1>
      <p className="mt-1 text-sm text-muted">
        This creates your private workspace. Only you can access it.
      </p>
      <div className="mt-6">
        <OnboardingForm />
      </div>
    </section>
  );
}

export default function OnboardingPage() {
  return (
    <>
      <WorkspaceHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8 sm:px-6">
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
          <OnboardingContent />
        </Suspense>
      </main>
    </>
  );
}
