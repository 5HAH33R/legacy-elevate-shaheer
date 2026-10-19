import "server-only";

import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "./auth";
import { requireBusinessOwner, type Business } from "./businesses";
import { ApiError } from "./errors";
import type { SessionUser } from "./session";

/**
 * Page guard for protected routes: redirects signed-out visitors to sign-in.
 * Call from an async server component rendered inside a <Suspense> boundary
 * (cacheComponents requires dynamic data behind Suspense).
 */
export async function requirePageUser(nextPath: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  }
  return user;
}

/** Redirects already-signed-in visitors away from auth pages. */
export async function redirectIfSignedIn(): Promise<void> {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
}

/**
 * Page guard for /dashboard/[businessId] pages: redirects signed-out
 * visitors to sign-in and renders 404 when the business is missing or owned
 * by someone else (so URLs never leak another owner's workspace).
 */
export async function requirePageBusiness(businessId: string): Promise<Business> {
  const user = await requirePageUser(`/dashboard/${businessId}`);
  try {
    return await requireBusinessOwner(user.uid, businessId);
  } catch (error) {
    if (error instanceof ApiError) notFound();
    throw error;
  }
}
