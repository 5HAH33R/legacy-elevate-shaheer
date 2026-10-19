/** Browser helpers that talk to the server session route. */

export async function createServerSession(idToken: string): Promise<void> {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      data?.error ?? "Your sign-in could not be verified. Please try again.",
    );
  }
}

/** Best-effort: the client also signs out of Firebase Auth locally. */
export async function destroyServerSession(): Promise<void> {
  await fetch("/api/auth/session", { method: "DELETE" }).catch(() => {
    // Offline sign-out: the cookie expires on its own; local state is cleared.
  });
}
