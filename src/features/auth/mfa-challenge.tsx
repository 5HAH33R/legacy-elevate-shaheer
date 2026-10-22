"use client";

import { useState, type FormEvent } from "react";
import {
  getMultiFactorResolver,
  TotpMultiFactorGenerator,
  type MultiFactorError,
  type MultiFactorResolver,
} from "firebase/auth";
import { getClientAuth } from "@/lib/firebase/client";
import {
  errorTextClass,
  fieldClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "./ui";

export function resolverFromError(err: unknown): MultiFactorResolver | null {
  const code = (err as { code?: string } | null)?.code;
  if (code !== "auth/multi-factor-auth-required") return null;
  return getMultiFactorResolver(getClientAuth(), err as MultiFactorError);
}

/** Second step of sign-in: 6-digit code from the authenticator app. */
export function MfaChallenge({
  resolver,
  onVerified,
  onCancel,
}: {
  resolver: MultiFactorResolver;
  onVerified: (idToken: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const hint = resolver.hints.find(
      (h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID,
    );
    if (!hint) {
      setError("This account has no authenticator app set up. Go back and try again.");
      return;
    }
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setPending(true);
    try {
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(
        hint.uid,
        code.trim(),
      );
      const credential = await resolver.resolveSignIn(assertion);
      await onVerified(await credential.user.getIdToken());
    } catch (err) {
      const c = (err as { code?: string }).code;
      if (c === "auth/invalid-verification-code") {
        setError("That code is not correct. Check the app and try again.");
      } else if (c === "auth/code-expired" || c === "auth/multi-factor-auth-required") {
        setError("This sign-in expired. Go back and sign in again.");
      } else {
        setError(
          err instanceof Error && !c ? err.message : "We could not verify the code. Please try again.",
        );
      }
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-muted">
        Two-step verification is on. Open your authenticator app and enter the
        6-digit code for Elevate.
      </p>
      <div className={fieldClass}>
        <label htmlFor="mfa-code" className={labelClass}>
          Authenticator code
        </label>
        <input
          id="mfa-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className={inputClass}
          placeholder="123456"
        />
      </div>
      {error ? (
        <p role="alert" className={errorTextClass}>
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Verifying…" : "Verify and sign in"}
      </button>
      <button type="button" onClick={onCancel} disabled={pending} className={`${secondaryButtonClass} w-full`}>
        Back
      </button>
    </form>
  );
}
