import { Suspense, type ReactNode } from "react";
import { requirePageBusiness } from "@/server/page-guards";
import { AppShell, BusinessScope } from "@/features/workspace/app-shell";

/** Ownership-checked business name for the shell (same per-request lookup as the page). */
async function Scope({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const business = await requirePageBusiness(businessId);
  return (
    <BusinessScope
      name={business.name}
      detail={[business.businessType, business.currency].filter(Boolean).join(" · ")}
    />
  );
}

export default function BusinessLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ businessId: string }>;
}) {
  return (
    <AppShell
      scope={
        <Suspense
          fallback={<div className="h-[58px] rounded-lg border border-border bg-surface" />}
        >
          <Scope params={params} />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
