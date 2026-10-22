"use client";

import { useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertIcon, SalesIcon } from "@/components/icons";
import { INVOICE_MIME_TYPES, MAX_INVOICE_BYTES } from "@/lib/invoices";
import { errorTextClass, panelClass, primaryActionClass } from "@/features/auth/ui";

const ACCEPT = ".jpg,.jpeg,.png,.webp,.pdf";

/**
 * Upload one invoice photo or PDF. The server reads it with the AI and
 * opens the review screen; nothing is recorded until the owner confirms.
 */
export function InvoiceUpload({
  businessId,
  configured,
  invoiceType = "purchase",
}: {
  businessId: string;
  configured: boolean;
  invoiceType?: "purchase" | "sale";
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function choose(next: File | null) {
    setError(null);
    if (!next) return setFile(null);
    if (!(INVOICE_MIME_TYPES as readonly string[]).includes(next.type)) {
      setFile(null);
      return setError("Upload a JPG, PNG or WebP photo, or a PDF.");
    }
    if (next.size > MAX_INVOICE_BYTES) {
      setFile(null);
      return setError(`This file is ${(next.size / 1024 / 1024).toFixed(1)} MB. Upload a file under ${MAX_INVOICE_BYTES / 1024 / 1024} MB.`);
    }
    setFile(next);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    choose(event.dataTransfer.files?.[0] ?? null);
  }

  async function upload() {
    if (!file) return;
    setError(null);
    setPending(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("invoiceType", invoiceType);
      const response = await fetch(`/api/businesses/${businessId}/invoices`, { method: "POST", body });
      const data = (await response.json().catch(() => null)) as { invoice?: { invoiceId: string }; error?: string } | null;
      if (!response.ok || !data?.invoice) throw new Error(data?.error ?? "Could not read this invoice. Please try again.");
      router.push(`/dashboard/${businessId}/invoices/${data.invoice.invoiceId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read this invoice. Please try again.");
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="upload-heading" className={`${panelClass} flex flex-col gap-4 p-5 sm:p-6`}>
      <div>
        <h2 id="upload-heading" className="text-base font-semibold tracking-tight">Scan an invoice</h2>
        <p className="mt-1 text-sm text-muted">
          Take a clear photo of a supplier bill or upload its PDF. Elevate reads it with AI, then you check every
          line before anything is saved.
        </p>
      </div>

      {!configured ? (
        <p role="status" className="flex gap-2 rounded-lg border border-warning-border bg-warning-bg px-3 py-2.5 text-sm text-warning">
          <AlertIcon className="mt-0.5 shrink-0" />
          Invoice reading needs the AI service, which is not configured yet. You can still record purchases by hand.
        </p>
      ) : null}

      <label
        htmlFor="invoice-file"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center transition ${
          dragging ? "border-focus-ring bg-surface-muted" : "border-control hover:bg-surface-muted"
        } ${!configured || pending ? "pointer-events-none opacity-60" : ""}`}
      >
        <SalesIcon size={22} className="text-muted" />
        {file ? (
          <span className="text-sm">
            <span className="font-medium">{file.name}</span>{" "}
            <span className="num text-muted">({(file.size / 1024).toFixed(0)} KB)</span>
          </span>
        ) : (
          <span className="text-sm">
            <span className="font-medium">Choose a file</span> <span className="text-muted">or drop it here</span>
          </span>
        )}
        <span className="text-xs text-muted">JPG, PNG, WebP or PDF · up to {MAX_INVOICE_BYTES / 1024 / 1024} MB · one invoice per file</span>
        <input
          id="invoice-file"
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={!configured || pending}
          onChange={(e) => choose(e.target.files?.[0] ?? null)}
        />
      </label>

      {error ? (
        <p role="alert" className={`${errorTextClass} flex items-center gap-2`}>
          <AlertIcon className="shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={upload}
          disabled={!file || pending || !configured}
          className={`${primaryActionClass} h-10 disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {pending ? "Reading invoice…" : "Read invoice"}
        </button>
        {pending ? (
          <p role="status" className="flex items-center gap-2 text-sm text-muted">
            <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-chart" />
            This can take up to 30 seconds.
          </p>
        ) : (
          <p className="text-xs text-muted">The file is sent to the AI service to read it and is not stored by Elevate.</p>
        )}
      </div>
    </section>
  );
}
