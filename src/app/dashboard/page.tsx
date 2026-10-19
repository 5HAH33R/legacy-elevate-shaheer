import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { listBusinessesForUser, type Business } from "@/server/businesses";
import { requirePageUser } from "@/server/page-guards";
import { WorkspaceHeader } from "@/features/workspace/workspace-header";

export const metadata: Metadata = { title: "Dashboard — Elevate" };

function BusinessCard({ business }: { business: Business }) {
  return (
    <li className="rounded-2xl border border-border bg-surface p-6 transition hover:border-focus-ring">
      <Link href={`/dashboard/${business.businessId}`} className="block">
        <h2 className="text-lg font-semibold">{business.name}</h2>
      <dl className="mt-3 flex flex-col gap-1 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Type</dt>
          <dd>{business.businessType ?? "Not set"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Currency</dt>
          <dd>{business.currency}</dd>
        </div>
        {business.createdAt ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Created</dt>
            <dd>{business.createdAt.slice(0, 10)}</dd>
          </div>
        ) : null}
      </dl>
        <p className="mt-4 text-sm font-medium underline underline-offset-4">
          Open workspace →
        </p>
      </Link>
    </li>
  );
}

async function DashboardContent() {
  const user = await requirePageUser("/dashboard");
  const businesses = await listBusinessesForUser(user.uid);
  if (businesses.length === 0) redirect("/onboarding");

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome{user.name ? `, ${user.name}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted">
          This is your private workspace. Only you can see it.
        </p>
      </section>

      <ul className="grid gap-4 sm:grid-cols-2">
        {businesses.map((business) => (
          <BusinessCard key={business.businessId} business={business} />
        ))}
      </ul>

      <section className="rounded-2xl border border-border bg-surface-muted p-6">
        <h2 className="text-base font-semibold">Your records, your numbers</h2>
        <p className="mt-2 text-sm text-muted">
          Open a business to manage products and stock, record sales and
          expenses, and see totals calculated from your own records. Suppliers,
          invoices and the AI assistant come in later phases.
        </p>
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <>
      <WorkspaceHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
          <DashboardContent />
        </Suspense>
      </main>
    </>
  );
}
