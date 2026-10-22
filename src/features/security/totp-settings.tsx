"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  EmailAuthProvider,
  multiFactor,
  onAuthStateChanged,
  reauthenticateWithCredential,
  TotpMultiFactorGenerator,
  type TotpSecret,
  type User,
} from "firebase/auth";
import { getClientAuth } from "@/lib/firebase/client";
import {
  errorTextClass,
  fieldClass,
  inputClass,
  labelClass,
  panelPadClass,
  panelTitleClass,
  primaryActionClass,
  secondaryButtonClass,
  successTextClass,
} from "@/features/auth/ui";

function isRecentLoginError(err: unknown) {
  return (err as { code?: string }).code === "auth/requires-recent-login";
}

export function TotpSettings() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [, bump] = useState(0);
  const [secret, setSecret] = useState<TotpSecret | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [needPassword, setNeedPassword] = useState<null | "start" | "disable">(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(
    () =>
      onAuthStateChanged(getClientAuth(), (u) => {
        setUser(u);
        setReady(true);
      }),
    [],
  );

  const factors = user ? multiFactor(user).enrolledFactors : [];
  const totp = factors.find((f) => f.factorId === TotpMultiFactorGenerator.FACTOR_ID);

  async function start() {
    if (!user) return;
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      const session = await multiFactor(user).getSession();
      setSecret(await TotpMultiFactorGenerator.generateSecret(session));
      setNeedPassword(null);
    } catch (err) {
      if (isRecentLoginError(err)) {
        setNeedPassword("start");
        setError("For your security, enter your password again to continue.");
      } else {
        setError(
          user.emailVerified === false && (err as { code?: string }).code === "auth/unverified-email"
            ? "Verify your email address before turning on 2FA."
            : "Could not start setup. Check that two-step verification is enabled for this project, then try again.",
        );
      }
    }
    setPending(false);
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    if (!user || !secret) return;
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setPending(true);
    try {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code);
      await multiFactor(user).enroll(assertion, "Authenticator app");
      setSecret(null);
      setCode("");
      setMessage("2FA is now enabled. You will be asked for a code each time you sign in.");
      bump((n) => n + 1);
    } catch (err) {
      const c = (err as { code?: string }).code;
      setError(
        c === "auth/invalid-verification-code"
          ? "That code is not correct. Wait for the next code and try again."
          : c === "auth/requires-recent-login"
            ? "Your sign-in is too old. Sign out, sign in again and retry."
            : "Could not turn on 2FA. Please try again.",
      );
    }
    setPending(false);
  }

  async function disable() {
    if (!user || !totp) return;
    setError(null);
    setPending(true);
    try {
      await multiFactor(user).unenroll(totp);
      setMessage("2FA is now disabled.");
      bump((n) => n + 1);
    } catch (err) {
      if (isRecentLoginError(err)) {
        setNeedPassword("disable");
        setError("For your security, enter your password again to continue.");
      } else {
        setError("Could not turn off 2FA. Please try again.");
      }
    }
    setPending(false);
  }

  async function reauth(event: FormEvent) {
    event.preventDefault();
    if (!user?.email || !needPassword) return;
    setPending(true);
    setError(null);
    try {
      await reauthenticateWithCredential(
        user,
        EmailAuthProvider.credential(user.email, password),
      );
      const next = needPassword;
      setPassword("");
      setNeedPassword(null);
      setPending(false);
      if (next === "start") await start();
      else await disable();
      return;
    } catch {
      setError("Password is not correct.");
    }
    setPending(false);
  }

  if (!ready) return <p className="text-sm text-muted">Loading…</p>;
  if (!user) return <p className="text-sm text-muted">Sign in again to manage security.</p>;

  return (
    <section className={`${panelPadClass} flex max-w-xl flex-col gap-4`} aria-labelledby="totp-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="totp-heading" className={panelTitleClass}>
          Authenticator app
        </h2>
        <span className="rounded-md border border-control px-2 py-1 text-xs font-medium">
          {totp ? "✓ 2FA Enabled" : "2FA Disabled"}
        </span>
      </div>

      {needPassword ? (
        <form onSubmit={reauth} className="flex flex-col gap-3">
          <div className={fieldClass}>
            <label htmlFor="reauth-password" className={labelClass}>
              Password
            </label>
            <input
              id="reauth-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          <button type="submit" disabled={pending || !password} className={primaryActionClass}>
            Confirm password
          </button>
        </form>
      ) : null}

      {secret ? (
        <form onSubmit={confirm} className="flex flex-col gap-3">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>In your authenticator app choose “Add account” → “Enter a setup key”.</li>
            <li>Enter the key below (or open the link on a phone with the app).</li>
            <li>Type the 6-digit code the app shows.</li>
          </ol>
          <p className="text-sm">
            Setup key:{" "}
            <code className="num break-all rounded bg-surface-muted px-1.5 py-0.5 select-all">
              {secret.secretKey}
            </code>
          </p>
          <a
            className="text-sm underline underline-offset-4"
            href={secret.generateQrCodeUrl(user.email ?? "account", "Elevate")}
          >
            Open in authenticator app
          </a>
          <div className={fieldClass}>
            <label htmlFor="enrol-code" className={labelClass}>
              6-digit code
            </label>
            <input
              id="enrol-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className={inputClass}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={primaryActionClass}>
              {pending ? "Checking…" : "Turn on 2FA"}
            </button>
            <button type="button" className={secondaryButtonClass} onClick={() => setSecret(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : !needPassword ? (
        totp ? (
          <button type="button" onClick={disable} disabled={pending} className={`${secondaryButtonClass} self-start`}>
            Disable 2FA
          </button>
        ) : (
          <button type="button" onClick={start} disabled={pending} className={`${primaryActionClass} self-start`}>
            Set up 2FA
          </button>
        )
      ) : null}

      {error ? (
        <p role="alert" className={errorTextClass}>
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className={successTextClass}>
          {message}
        </p>
      ) : null}
    </section>
  );
}
