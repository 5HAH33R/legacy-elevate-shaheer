import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/auth-shell";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export const metadata: Metadata = { title: "Reset password — Elevate" };

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      description="We will email you a link to choose a new password."
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
