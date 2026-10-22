"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, type MultiFactorResolver } from "firebase/auth";
import { MfaChallenge, resolverFromError } from "./mfa-challenge";
import { getClientAuth } from "@/lib/firebase/client";
import { readableAuthError } from "./auth-errors";
import { createServerSession } from "./session-client";
import {
  errorTextClass,
  fieldClass,
  inputClass,
  labelClass,
  mutedLinkClass,
  primaryButtonClass,
} from "./ui";

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const credential = await signInWithEmailAndPassword(
        getClientAuth(),
        email.trim(),
        password,
      );
      await finish(await credential.user.getIdToken());
    } catch (err) {
      const mfa = resolverFromError(err);
      if (mfa) {
        setResolver(mfa);
      } else {
        setError(readableAuthError(err));
      }
      setPending(false);
    }
  }

  async function finish(idToken: string) {
    await createServerSession(idToken);
    router.replace("/dashboard");
    router.refresh();
  }

  if (resolver) {
    return (
      <MfaChallenge
        resolver={resolver}
        onVerified={finish}
        onCancel={() => {
          setResolver(null);
          setPassword("");
        }}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className={fieldClass}>
        <label htmlFor="sign-in-email" className={labelClass}>
          Email
        </label>
        <input
          id="sign-in-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={inputClass}
          placeholder="you@example.com"
        />
      </div>
      <div className={fieldClass}>
        <label htmlFor="sign-in-password" className={labelClass}>
          Password
        </label>
        <input
          id="sign-in-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={inputClass}
        />
      </div>

      {error ? (
        <p role="alert" className={errorTextClass}>
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <div className="flex flex-col gap-2 text-center text-sm text-muted">
        <Link href="/reset-password" className={mutedLinkClass}>
          Forgot your password?
        </Link>
        <p>
          New to Elevate?{" "}
          <Link href="/sign-up" className={mutedLinkClass}>
            Create an account
          </Link>
        </p>
      </div>
    </form>
  );
}
