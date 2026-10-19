# 2FA investigation (Phase 2 — findings only, nothing implemented)

Requirement: 2FA is mandatory for the hackathon, but must not be faked and
must not enable billing without approval (AGENTS.md sections 6 and 10).

## What Firebase actually offers

Firebase Authentication has no multi-factor authentication in its base
("Spark-era") form. All MFA methods — SMS and TOTP — are part of
**Firebase Authentication with Identity Platform**, an upgrade applied per
project in the Firebase console (Authentication → Settings → Multi-factor
authentication).

| Question | Finding |
|---|---|
| Is MFA available on the plain (un-upgraded) Firebase Auth? | **No.** The JS SDK `multiFactor()` APIs only work after upgrading to Identity Platform. |
| Does the upgrade require a billing (Blaze) plan? | **Yes.** Upgrading to Identity Platform requires the project to be on the pay-as-you-go Blaze plan. |
| Does Blaze mean automatic cost? | Not by itself. Blaze keeps the no-cost tiers and only bills beyond them. Email/password auth stays free. But it does attach a billing account, which needs explicit approval per the free-first policy. |
| SMS second factor cost | Billed **per SMS verification** (small no-cost daily allotment, then per-message pricing that varies by country). Pakistani phone numbers are in a higher-priced SMS band. |
| TOTP (authenticator app) second factor cost | **No per-use charge.** Billed only under the Identity Platform monthly-active-user model, whose no-cost allowance (50,000 MAU for password providers) far exceeds hackathon/demo scale. |
| Client SDK support | Both SMS and TOTP enrolment/verification are supported in the modular web SDK (`multiFactor`, `TotpMultiFactorGenerator`, `PhoneMultiFactorGenerator`). |

## Verification status and honesty notes

- I could **not** inspect the actual Firebase project console from the
  repository — no service-account credentials are committed (by design).
  Whether this project is already on Blaze and whether Identity Platform is
  enabled must be confirmed in the console by the project owner:
  Firebase console → Authentication → Settings → **Multi-factor
  authentication**. If that section offers an "Upgrade" button, the project
  is not yet on Identity Platform.
- The pricing points above are from public Firebase/Identity Platform
  documentation and should be re-checked against current pricing pages before
  implementation.

## Recommendation (for a later phase, pending approval)

1. **Use TOTP (authenticator app) MFA as the required second factor.**
   - Real 2FA (something you have), no per-message cost, works for users
     without a Pakistani mobile plan, and the free MAU allowance covers the
     hackathon many times over.
2. Accept the one-time **Blaze upgrade + Identity Platform upgrade** — this is
   the only hard billing-account requirement. It enables no paid usage by
   itself; TOTP MFA at demo scale stays within no-cost limits. This needs
   owner approval before implementation.
3. Implementation shape when approved:
   - Enrolment: signed-in owner opens security settings → `multiFactor(user).enroll()` with a TOTP secret shown as QR code → verify once.
   - Sign-in: email/password throws `auth/multi-factor-auth-required` → resolve with the enrolled TOTP factor → then exchange the ID token for the session cookie as today (no change to server session logic; the verified token proves 2FA completed).
   - Store no second-factor secrets ourselves; Firebase holds them.
4. **Avoid SMS MFA** unless a real user need appears: per-message billing,
   SIM-swap risk, and Pakistan-band SMS pricing make it a worse default.
5. Do **not** count email verification links or "password + email code we
   send ourselves" as 2FA — that would be the fake second factor AGENTS.md
   forbids.

## Decision requested

Approve (or reject) upgrading the Firebase project to Blaze + Identity
Platform so TOTP MFA can be implemented in Phase 3+. No billing was enabled
and no 2FA UI was built in this phase.
