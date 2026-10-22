"use client";

import { useEffect, useState, type FormEvent } from "react";
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
import { QrCode } from "./qr-code";

async function post(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => null)) as Record<string, string> | null;
  if (!res.ok) throw new Error(data?.error ?? "Something went wrong. Please try again.");
  return data ?? {};
}

export function TotpSettings() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    fetch("/api/auth/2fa/setup")
      .then((r) => r.json())
      .then((d: { enabled?: boolean }) => setEnabled(d.enabled === true))
      .catch(() => setError("Could not load 2FA status."));
  }, []);

  async function run(fn: () => Promise<void>) {
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
    setPending(false);
  }

  const start = () =>
    run(async () => {
      const d = await post("/api/auth/2fa/setup");
      setSetup({ secret: d.secret, uri: d.uri });
      setCode("");
    });

  const confirm = (e: FormEvent) => {
    e.preventDefault();
    return run(async () => {
      await post("/api/auth/2fa/verify-setup", { code });
      setSetup(null);
      setCode("");
      setEnabled(true);
      setMessage("2FA is now enabled. You will be asked for a code each time you sign in.");
    });
  };

  const disable = (e: FormEvent) => {
    e.preventDefault();
    return run(async () => {
      await post("/api/auth/2fa/disable", { code });
      setDisabling(false);
      setCode("");
      setEnabled(false);
      setMessage("2FA is now disabled.");
    });
  };

  if (enabled === null && !error) return <p className="text-sm text-muted">Loading…</p>;

  const codeField = (id: string) => (
    <div className={fieldClass}>
      <label htmlFor={id} className={labelClass}>
        6-digit code
      </label>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        className={inputClass}
      />
    </div>
  );

  return (
    <section className={`${panelPadClass} flex max-w-xl flex-col gap-4`} aria-labelledby="totp-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="totp-heading" className={panelTitleClass}>
          Authenticator app
        </h2>
        <span className="rounded-md border border-control px-2 py-1 text-xs font-medium">
          {enabled ? "✓ 2FA Enabled" : "2FA Disabled"}
        </span>
      </div>

      {setup ? (
        <form onSubmit={confirm} className="flex flex-col gap-3">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>Open Google Authenticator, Microsoft Authenticator or Authy and add an account.</li>
            <li>Scan this QR code, or enter the setup key by hand.</li>
            <li>Type the 6-digit code the app shows.</li>
          </ol>
          <QrCode value={setup.uri} label="QR code for your authenticator app" />
          <p className="text-sm">
            Setup key:{" "}
            <code className="num break-all rounded bg-surface-muted px-1.5 py-0.5 select-all">
              {setup.secret}
            </code>
          </p>
          {codeField("enrol-code")}
          <div className="flex gap-2">
            <button type="submit" disabled={pending || code.length !== 6} className={primaryActionClass}>
              {pending ? "Checking…" : "Turn on 2FA"}
            </button>
            <button type="button" className={secondaryButtonClass} onClick={() => setSetup(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : disabling ? (
        <form onSubmit={disable} className="flex flex-col gap-3">
          <p className="text-sm text-muted">Enter a current code to turn 2FA off.</p>
          {codeField("disable-code")}
          <div className="flex gap-2">
            <button type="submit" disabled={pending || code.length !== 6} className={primaryActionClass}>
              Disable 2FA
            </button>
            <button type="button" className={secondaryButtonClass} onClick={() => setDisabling(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : enabled ? (
        <button
          type="button"
          onClick={() => {
            setDisabling(true);
            setCode("");
          }}
          className={`${secondaryButtonClass} self-start`}
        >
          Disable 2FA
        </button>
      ) : (
        <button type="button" onClick={start} disabled={pending} className={`${primaryActionClass} self-start`}>
          Set up 2FA
        </button>
      )}

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
