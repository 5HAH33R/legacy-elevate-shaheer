"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
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

export function SignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const credential = await createUserWithEmailAndPassword(
        getClientAuth(),
        email.trim(),
        password,
      );
      if (name.trim() !== "") {
        await updateProfile(credential.user, { displayName: name.trim() });
      }
      // Force a fresh token so it carries the display name we just set.
      const idToken = await credential.user.getIdToken(true);
      await createServerSession(idToken);
      router.replace("/onboarding");
      router.refresh();
    } catch (err) {
      setError(readableAuthError(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className={fieldClass}>
        <label htmlFor="sign-up-name" className={labelClass}>
          Your name
        </label>
        <input
          id="sign-up-name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={inputClass}
          placeholder="Ayesha Khan"
        />
      </div>
      <div className={fieldClass}>
        <label htmlFor="sign-up-email" className={labelClass}>
          Email
        </label>
        <input
          id="sign-up-email"
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
        <label htmlFor="sign-up-password" className={labelClass}>
          Password
        </label>
        <input
          id="sign-up-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={inputClass}
        />
        <p className="text-xs text-muted">At least 6 characters.</p>
      </div>

      {error ? (
        <p role="alert" className={errorTextClass}>
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Creating account…" : "Create account"}
      </button>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/sign-in" className={mutedLinkClass}>
          Sign in
        </Link>
      </p>
    </form>
  );
}
