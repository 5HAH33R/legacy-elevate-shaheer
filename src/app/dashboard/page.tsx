import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { listBusinessesForUser, type Business } from "@/server/businesses";
import { requirePageUser } from "@/server/page-guards";
import { ArrowRightIcon } from "@/components/icons";
import { WorkspaceHeader } from "@/features/workspace/workspace-header";
import { PageHeader, PageSkeleton } from "@/features/workspace/page-header";

export const metadata: Metadata = { title: "Your businesses — Elevate" };

function BusinessCard({ business }: { business: Business }) {
  return (
    <li>
      <Link
        href={`/dashboard/${business.businessId}`}
        className="group flex h-full flex-col rounded-xl border border-border bg-surface p-5 transition hover:border-control"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold">{business.name}</h2>
          <ArrowRightIcon className="mt-0.5 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-foreground" />
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted">Type</dt>
            <dd className="mt-0.5 truncate">{business.businessType ?? <span className="text-muted">—</span>}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Currency</dt>
            <dd className="mt-0.5">{business.currency}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Since</dt>
            <dd className="num mt-0.5">{business.createdAt ? business.createdAt.slice(0, 10) : "—"}</dd>
          </div>
        </dl>
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
      <PageHeader
        title="Your businesses"
        description={`Signed in${user.name ? ` as ${user.name}` : ""}. Each workspace is private to your account.`}
      />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {businesses.map((business) => (
          <BusinessCard key={business.businessId} business={business} />
        ))}
      </ul>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <>
      <WorkspaceHeader />
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pt-8 pb-16 sm:px-8">
        <Suspense fallback={<PageSkeleton />}>
          <DashboardContent />
        </Suspense>
      </main>
    </>
  );
}
