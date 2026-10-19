"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { FirebaseError } from "firebase/app";
import { sendPasswordResetEmail } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase/client";
import { readableAuthError } from "./auth-errors";
import {
  errorTextClass,
  fieldClass,
  inputClass,
  labelClass,
  mutedLinkClass,
  primaryButtonClass,
  successTextClass,
} from "./ui";

const SENT_MESSAGE =
  "If an account exists for this email, a password reset link is on its way.";

export function ResetPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await sendPasswordResetEmail(getClientAuth(), email.trim());
      setSent(true);
    } catch (err) {
      // Do not reveal whether the email is registered.
      if (
        err instanceof FirebaseError &&
        (err.code === "auth/user-not-found" ||
          err.code === "auth/invalid-credential")
      ) {
        setSent(true);
      } else {
        setError(readableAuthError(err));
      }
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className={successTextClass}>
          {SENT_MESSAGE}
        </p>
        <p className="text-center text-sm text-muted">
          <Link href="/sign-in" className={mutedLinkClass}>
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className={fieldClass}>
        <label htmlFor="reset-email" className={labelClass}>
          Email
        </label>
        <input
          id="reset-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={inputClass}
          placeholder="you@example.com"
        />
      </div>

      {error ? (
        <p role="alert" className={errorTextClass}>
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Sending…" : "Send reset link"}
      </button>

      <p className="text-center text-sm text-muted">
        Remembered it?{" "}
        <Link href="/sign-in" className={mutedLinkClass}>
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
