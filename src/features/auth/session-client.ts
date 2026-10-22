/** Browser helpers that talk to the server session route. */

type ErrorBody = { error?: string } | null;

/** Returns null when signed in, or a temp token when a 2FA code is needed. */
export async function createServerSession(idToken: string): Promise<{ mfaTempToken: string } | null> {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  const data = (await response.json().catch(() => null)) as
    | (ErrorBody & { mfaRequired?: boolean; tempToken?: string })
    | null;
  if (!response.ok) {
    throw new Error(data?.error ?? "Your sign-in could not be verified. Please try again.");
  }
  if (data?.mfaRequired && data.tempToken) return { mfaTempToken: data.tempToken };
  return null;
}

export async function verifySignInMfa(tempToken: string, idToken: string, code: string): Promise<void> {
  const response = await fetch("/api/auth/2fa/verify-signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tempToken, idToken, code }),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as ErrorBody;
    throw new Error(data?.error ?? "We could not verify the code. Please try again.");
  }
}

/** Best-effort: the client also signs out of Firebase Auth locally. */
export async function destroyServerSession(): Promise<void> {
  await fetch("/api/auth/session", { method: "DELETE" }).catch(() => {
    // Offline sign-out: the cookie expires on its own; local state is cleared.
  });
}
