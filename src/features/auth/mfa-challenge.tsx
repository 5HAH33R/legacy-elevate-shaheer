"use client";

import { useState, type FormEvent } from "react";
import { verifySignInMfa } from "./session-client";
import {
  errorTextClass,
  fieldClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "./ui";

/** Second step of sign-in: 6-digit code from the authenticator app. */
export function MfaChallenge({
  tempToken,
  idToken,
  onVerified,
  onCancel,
}: {
  tempToken: string;
  idToken: string;
  onVerified: () => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setPending(true);
    try {
      await verifySignInMfa(tempToken, idToken, code.trim());
      onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not verify the code.");
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
