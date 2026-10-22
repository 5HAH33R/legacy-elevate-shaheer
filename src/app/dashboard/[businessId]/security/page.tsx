import { Suspense } from "react";
import type { Metadata } from "next";
import { requirePageBusiness, requirePageUser } from "@/server/page-guards";
import { PageHeader, PageSkeleton } from "@/features/workspace/page-header";
import { TotpSettings } from "@/features/security/totp-settings";

export const metadata: Metadata = { title: "Security — Elevate" };

async function SecurityContent({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  await requirePageBusiness(businessId);
  await requirePageUser(`/dashboard/${businessId}/security`);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Security"
        description="Protect your account with a code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy). It is free."
      />
      <TotpSettings />
    </div>
  );
}

export default function SecurityPage({ params }: { params: Promise<{ businessId: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SecurityContent params={params} />
    </Suspense>
  );
}
