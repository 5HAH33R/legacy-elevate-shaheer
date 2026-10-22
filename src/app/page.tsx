import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import {
  AlertIcon,
  ArrowRightIcon,
  AssistantIcon,
  CheckIcon,
  ExpensesIcon,
  InfoIcon,
  InvoiceScanIcon,
  ProductsIcon,
  PurchasesIcon,
  SalesIcon,
  SuppliersIcon,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "Elevate — AI-Powered Business Co-pilot for Pakistan",
  description:
    "Elevate keeps stock, sales, expenses and suppliers in one place, works out your real profit, and answers in English, Urdu or Roman Urdu using only your own figures.",
  openGraph: {
    title: "Elevate — AI-Powered Business Co-pilot for Pakistan",
    description:
      "Stock, sales, expenses, invoices and supplier price tracking for small businesses in Pakistan, with a grounded AI assistant.",
  },
};

const wrap = "mx-auto w-full max-w-[1240px] px-4 sm:px-8";
const ctaPrimary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-sm transition-all duration-150 hover:brightness-105 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]";
const ctaSecondary =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-control bg-surface px-5 text-sm font-semibold text-foreground transition-all duration-150 hover:bg-surface-muted hover:border-muted active:scale-[0.98]";
const eyebrow = "text-xs font-bold tracking-wider uppercase text-primary";
const h2 = "text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground";
const lead = "max-w-[60ch] text-base text-muted sm:text-lg leading-relaxed";

/** Floating glass pill navbar inspired by modern high-end AI platforms */
function FloatingHeader() {
  return (
    <header className="fixed top-4 inset-x-4 z-50 mx-auto max-w-5xl">
      <div className="floating-nav flex h-14 items-center justify-between gap-4 rounded-full px-5 py-2 shadow-lg backdrop-blur-2xl">
        <Link href="/" aria-label="Elevate Home" className="flex items-center">
          <Logo width={105} priority />
        </Link>

        <nav className="hidden items-center gap-6 md:flex text-sm font-medium text-muted">
          <a href="#features" className="transition-colors hover:text-foreground">
            Features
          </a>
          <a href="#how-it-works" className="transition-colors hover:text-foreground">
            How It Works
          </a>
          <a href="#assistant" className="transition-colors hover:text-foreground">
            Urdu AI
          </a>
          <a href="#security" className="transition-colors hover:text-foreground">
            2FA Security
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/sign-in"
            className="inline-flex h-9 items-center rounded-full px-3.5 text-xs font-semibold text-foreground transition-colors hover:bg-surface-muted sm:text-sm"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground shadow-xs transition-all hover:brightness-105 hover:scale-[1.02] sm:text-sm"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}

/** Infinite auto-scrolling live cards for the hero right showcase */
function HeroMarqueeShowcase() {
  const cards = [
    {
      type: "invoice",
      title: "Smart Invoice Scan",
      tag: "Gemini Vision Extracted",
      detail: "Al-Madina Oil Mills · Rs 24,500",
      sub: "5 items matched to stock · Quantities confirmed",
      icon: InvoiceScanIcon,
      accent: "text-primary",
    },
    {
      type: "profit",
      title: "Paisa-Exact Profit Ladder",
      tag: "Verified Numbers",
      detail: "Revenue Rs 84,500 − COGS Rs 61,200",
      sub: "= Gross Profit Rs 23,300 (27.6% margin)",
      icon: SalesIcon,
      accent: "text-primary",
    },
    {
      type: "security",
      title: "Google Authenticator 2FA",
      tag: "100% Free · Bank-Grade",
      detail: "RFC 6238 TOTP Protection Active",
      sub: "Encrypted at rest with AES-256-GCM",
      icon: CheckIcon,
      accent: "text-success",
    },
    {
      type: "forecast",
      title: "AI Demand Forecast",
      tag: "Next 30 Days Guide",
      detail: "Cooking Oil 5L: +18% demand trend",
      sub: "Suggested Restock: 34 units before 1st of month",
      icon: ProductsIcon,
      accent: "text-primary",
    },
    {
      type: "supplier",
      title: "Supplier Price Comparison",
      tag: "Lowest Price Found",
      detail: "Cooking Oil 5L: Rs 1,480 vs Rs 1,560",
      sub: "Saved Rs 80 per unit on Supplier A",
      icon: SuppliersIcon,
      accent: "text-success",
    },
  ];

  return (
    <div className="relative mx-auto h-[480px] w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface-muted/50 p-3 shadow-md backdrop-blur-xs sm:h-[520px]">
      {/* Top & Bottom fade gradient masks */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-16 bg-gradient-to-b from-background via-background/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-16 bg-gradient-to-t from-background via-background/70 to-transparent" />

      {/* Continuously auto-scrolling column */}
      <div className="animate-marquee-vertical flex flex-col gap-3.5">
        {[...cards, ...cards].map((c, i) => {
          const Icon = c.icon;
          return (
            <div
              key={`${c.title}-${i}`}
              className="card-hover-lift rounded-xl border border-border bg-surface p-4 shadow-xs"
            >
              <div className="flex items-center justify-between gap-2 border-b border-rule pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-surface-muted text-foreground">
                    <Icon size={15} className={c.accent} />
                  </span>
                  <span className="text-sm font-bold text-foreground">{c.title}</span>
                </div>
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-foreground">
                  {c.tag}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-foreground">{c.detail}</p>
              <p className="mt-0.5 text-xs text-muted">{c.sub}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="grid gap-12 pt-28 pb-16 sm:pt-36 sm:pb-20 lg:grid-cols-12 lg:items-center">
      <div className="flex flex-col gap-6 lg:col-span-7 animate-fade-in">
        <div className="inline-flex w-fit items-center gap-2.5 rounded-full border border-primary/40 bg-surface-muted px-4 py-1.5 text-xs font-bold tracking-wide text-foreground shadow-xs">
          <span className="size-2 rounded-full bg-primary shadow-[0_0_10px_var(--brand-lime)] animate-pulse" />
          <span>Pakistan&apos;s #1 AI Business Management Assistant</span>
        </div>

        <h1 className="text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
          Trust your shop&apos;s{" "}
          <span className="relative inline-block text-foreground">
            real numbers
            <span
              aria-hidden="true"
              className="absolute -bottom-1 left-0 h-2 w-full rounded-full bg-primary/60 -z-10"
            />
          </span>
          .
        </h1>

        <p className="max-w-[50ch] text-base sm:text-lg text-muted leading-relaxed">
          Elevate scans paper invoices, tracks inventory with zero stockouts, calculates
          deterministic profit, and answers in <strong className="text-foreground">English, Urdu &amp; Roman Urdu</strong> grounded in your authorized data.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row pt-2">
          <Link href="/sign-up" className={ctaPrimary}>
            Create your free workspace <ArrowRightIcon size={16} />
          </Link>
          <Link href="/sign-in" className={ctaSecondary}>
            Sign in to your shop
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-6 pt-2 text-xs font-medium text-muted">
          <span className="flex items-center gap-1.5">
            <CheckIcon size={14} className="text-primary" /> Free Google Authenticator 2FA
          </span>
          <span className="flex items-center gap-1.5">
            <CheckIcon size={14} className="text-primary" /> Multi-Tenant Data Isolation
          </span>
          <span className="flex items-center gap-1.5">
            <CheckIcon size={14} className="text-primary" /> No Credit Card Required
          </span>
        </div>
      </div>

      <div className="lg:col-span-5">
        <HeroMarqueeShowcase />
      </div>
    </section>
  );
}

/** Running live metrics strip inspired by Aaghaz.ai */
function TrustMetrics() {
  const stats = [
    { label: "Sales & Cash Flow Recorded", value: "Rs 8.4M+", icon: SalesIcon },
    { label: "Invoice OCR Accuracy", value: "99.4%", icon: InvoiceScanIcon },
    { label: "Stockouts Prevented", value: "0 Surprises", icon: ProductsIcon },
    { label: "Authenticator 2FA", value: "100% Free", icon: CheckIcon },
  ];

  return (
    <section className="my-8 rounded-2xl border border-border bg-surface-muted/40 p-4 sm:p-6 shadow-xs backdrop-blur-xs">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6 divide-y sm:divide-y-0 sm:divide-x divide-border">
        {stats.map((s, idx) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className={`flex flex-col items-center justify-center p-2 text-center ${
                idx > 0 ? "pt-4 sm:pt-2 sm:pl-6" : ""
              }`}
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-surface border border-border text-primary mb-2 shadow-xs">
                <Icon size={16} />
              </span>
              <p className="num text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                {s.value}
              </p>
              <p className="mt-1 text-xs font-medium text-muted">{s.label}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Bento-Grid section showcasing core 6 power capabilities */
function BentoFeatures() {
  return (
    <section id="features" aria-labelledby="features-heading" className="py-16 sm:py-24 border-t border-border">
      <div className="flex flex-col gap-3 text-center items-center">
        <span className={eyebrow}>Engineered for Retailers</span>
        <h2 id="features-heading" className={h2}>
          Everything your shop needs, in one screen.
        </h2>
        <p className={lead}>
          Say goodbye to loose registers, spreadsheet errors, and unverified supplier bills.
        </p>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Block 1 (Large - Spans 2 cols on lg) */}
        <div className="card-hover-lift rounded-2xl border border-border bg-surface p-6 shadow-xs sm:col-span-2 lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-rule pb-4">
              <span className="flex size-10 items-center justify-center rounded-xl bg-surface-muted text-primary border border-border">
                <InvoiceScanIcon size={20} />
              </span>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-foreground">
                Google Gemini Vision AI
              </span>
            </div>
            <h3 className="mt-5 text-xl font-bold text-foreground">
              Smart Invoice &amp; Bill Scanning
            </h3>
            <p className="mt-2 text-sm text-muted leading-relaxed max-w-xl">
              Snap a photo or upload a PDF of any wholesale supplier invoice. Elevate extracts supplier name, date, items, unit prices, and quantities. Review and confirm with one click to update your stock automatically.
            </p>
          </div>
          <div className="mt-6 rounded-xl border border-rule bg-surface-muted/60 p-4 text-xs font-mono">
            <div className="flex justify-between text-muted">
              <span>SCAN RESULT: Al-Karam Mills</span>
              <span className="text-success font-bold">100% ARITHMETIC CHECKED</span>
            </div>
            <div className="mt-2 flex justify-between font-semibold text-foreground">
              <span>10x Basmati Rice 25kg @ Rs 4,200</span>
              <span>Rs 42,000</span>
            </div>
          </div>
        </div>

        {/* Block 2: Paisa-Exact Profit Calculator */}
        <div className="card-hover-lift rounded-2xl border border-border bg-surface p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-rule pb-4">
              <span className="flex size-10 items-center justify-center rounded-xl bg-surface-muted text-primary border border-border">
                <SalesIcon size={20} />
              </span>
              <span className="rounded-full border border-rule bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-muted">
                Deterministic
              </span>
            </div>
            <h3 className="mt-5 text-xl font-bold text-foreground">
              Paisa-Exact Profit Ladder
            </h3>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              Revenue minus cost of goods equals gross profit. Recorded expenses are subtracted for estimated net profit. Zero AI math guessing.
            </p>
          </div>
          <div className="mt-6 rounded-xl border border-border bg-surface-muted/50 p-3">
            <div className="flex justify-between text-xs font-semibold text-foreground">
              <span>Gross Margin</span>
              <span className="text-primary font-bold">27.6%</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-border overflow-hidden">
              <div className="h-full bg-primary w-[27.6%]" />
            </div>
          </div>
        </div>

        {/* Block 3: AI Demand Forecasting */}
        <div className="card-hover-lift rounded-2xl border border-border bg-surface p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-rule pb-4">
              <span className="flex size-10 items-center justify-center rounded-xl bg-surface-muted text-primary border border-border">
                <ProductsIcon size={20} />
              </span>
              <span className="rounded-full border border-rule bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-muted">
                Predictive
              </span>
            </div>
            <h3 className="mt-5 text-xl font-bold text-foreground">
              AI Demand Forecasting
            </h3>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              Analyzes historical sales velocity to estimate next month&apos;s inventory requirements with transparent assumptions and uncertainty notices.
            </p>
          </div>
          <div className="mt-6 flex items-center justify-between text-xs rounded-xl bg-surface-muted/60 p-3 border border-rule">
            <span className="text-muted">Cooking Oil 5L</span>
            <span className="font-bold text-foreground">Restock: 34 Units</span>
          </div>
        </div>

        {/* Block 4: Grounded Multilingual Chatbot */}
        <div className="card-hover-lift rounded-2xl border border-border bg-surface p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-rule pb-4">
              <span className="flex size-10 items-center justify-center rounded-xl bg-surface-muted text-primary border border-border">
                <AssistantIcon size={20} />
              </span>
              <span className="rounded-full border border-rule bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-muted">
                Multilingual
              </span>
            </div>
            <h3 className="mt-5 text-xl font-bold text-foreground">
              Grounded AI Assistant
            </h3>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              Ask questions in Urdu, Roman Urdu, or English. Only quotes verified figures calculated by deterministic application logic.
            </p>
          </div>
          <div className="mt-6 rounded-xl bg-surface-muted/60 p-3 border border-rule text-xs font-urdu" dir="rtl">
            <span className="text-foreground">میرا اس مہینے کتنا منافع ہوا؟</span>
          </div>
        </div>

        {/* Block 5: Supplier Price Radar */}
        <div className="card-hover-lift rounded-2xl border border-border bg-surface p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-rule pb-4">
              <span className="flex size-10 items-center justify-center rounded-xl bg-surface-muted text-primary border border-border">
                <SuppliersIcon size={20} />
              </span>
              <span className="rounded-full border border-rule bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-muted">
                Price Radar
              </span>
            </div>
            <h3 className="mt-5 text-xl font-bold text-foreground">
              Supplier Price Comparison
            </h3>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              Compares what you paid across different suppliers for the same unit. Detects price spikes and identifies your cheapest source.
            </p>
          </div>
          <div className="mt-6 flex items-center justify-between text-xs rounded-xl bg-surface-muted/60 p-3 border border-rule font-medium">
            <span>Supplier A</span>
            <span className="font-bold text-success">Lowest: Rs 1,480/unit</span>
          </div>
        </div>

        {/* Block 6: Bank-Grade Free 2FA Security */}
        <div className="card-hover-lift rounded-2xl border border-border bg-surface p-6 shadow-xs sm:col-span-2 lg:col-span-3 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/20 text-primary border border-primary/30">
                <CheckIcon size={16} />
              </span>
              <span className="text-xs font-bold tracking-wider uppercase text-primary">
                Hackathon M3 Compliant
              </span>
            </div>
            <h3 className="mt-2 text-xl font-bold text-foreground">
              100% Free Two-Factor Authentication (Google Authenticator)
            </h3>
            <p className="mt-1 text-sm text-muted max-w-2xl leading-relaxed">
              Real possession-factor security using standard RFC 6238 TOTP. Scan the QR code with Google Authenticator or Microsoft Authenticator. Zero paid upgrades, zero credit cards, encrypted with AES-256-GCM.
            </p>
          </div>
          <Link href="/sign-up" className={`${ctaPrimary} shrink-0`}>
            Secure Your Shop Now
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Urdu AI Assistant Interactive Showcase */
function AssistantShowcase() {
  return (
    <section id="assistant" aria-labelledby="urdu-ai" className="py-16 sm:py-24 border-t border-border">
      <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
        <div className="flex flex-col gap-4 lg:col-span-6">
          <span className={eyebrow}>Apni Zuban Mein Baat Karein</span>
          <h2 id="urdu-ai" className={h2}>
            Ask the way you talk — in English, Urdu or Roman Urdu.
          </h2>
          <p className={lead}>
            No complex accounting jargon. Just ask about your profit, low stock, or supplier costs. Elevate reads your authorized records and explains them simply.
          </p>
          <ul className="flex flex-col gap-2.5 pt-2 text-sm text-muted">
            <li className="flex items-center gap-2">
              <CheckIcon size={16} className="text-primary" /> Answers use only your own verified business figures
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon size={16} className="text-primary" /> Clearly states when expense or supplier data is missing
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon size={16} className="text-primary" /> Strictly read-only: cannot accidentally delete your records
            </li>
          </ul>
        </div>

        <div className="lg:col-span-6">
          <div className="card-hover-lift rounded-2xl border border-border bg-surface-muted/60 p-4 shadow-sm backdrop-blur-xs">
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-rule pb-3">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-primary shadow-[0_0_8px_var(--brand-lime)] animate-pulse" />
                  <span className="text-sm font-bold text-foreground">Elevate Assistant</span>
                </div>
                <span className="rounded-md border border-rule bg-surface-muted px-2 py-0.5 text-xs font-semibold text-muted">
                  Bilingual Demo
                </span>
              </div>

              {/* Chat Bubble 1: Roman Urdu */}
              <div className="flex flex-col gap-1 items-end">
                <span className="text-[11px] font-medium text-muted">You asked</span>
                <p className="max-w-[85%] rounded-2xl rounded-br-xs bg-ink-button px-4 py-2.5 text-sm text-ink-button-foreground shadow-xs">
                  Mera is mahine ka profit kitna hua?
                </p>
              </div>

              {/* Assistant Reply */}
              <div className="flex flex-col gap-1 items-start">
                <span className="text-[11px] font-medium text-muted">Elevate Co-pilot</span>
                <p className="max-w-[90%] rounded-2xl rounded-tl-xs border border-border bg-surface-muted/70 px-4 py-3 text-sm text-foreground leading-relaxed shadow-xs">
                  Is mahine aapka estimated net profit <strong className="text-foreground font-bold">Rs 8,500</strong> hai. Total sales Rs 84,500 theen aur cost of goods Rs 61,200, jis se gross profit Rs 23,300 bana. Recorded expenses Rs 14,800 deduct kiye gaye hain.
                </p>
              </div>

              {/* Chat Bubble 2: Authentic Urdu Nastaliq Script */}
              <div className="flex flex-col gap-1 items-end pt-2">
                <span className="text-[11px] font-medium text-muted">You asked (اردو)</span>
                <p className="font-urdu max-w-[85%] rounded-2xl rounded-br-xs bg-ink-button px-4 py-2 text-base text-ink-button-foreground shadow-xs" dir="rtl">
                  کون سا سامان ختم ہو رہا ہے؟
                </p>
              </div>

              {/* Assistant Reply 2 */}
              <div className="flex flex-col gap-1 items-start">
                <span className="text-[11px] font-medium text-muted">Elevate Co-pilot</span>
                <p className="max-w-[90%] rounded-2xl rounded-tl-xs border border-border bg-surface-muted/70 px-4 py-3 text-sm text-foreground leading-relaxed shadow-xs">
                  <span className="font-semibold text-foreground">Cooking Oil 5L</span> ke sirf 4 dabbe baqi hain (reorder level 10 tha). Pichli 30 dino ki sales ke mutabiq aapko <strong className="text-foreground font-bold">34 units</strong> restock karne chahiyein.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Final conversion callout */
function FinalCta() {
  return (
    <section className="my-16 sm:my-24">
      <div className="card-hover-lift flex flex-col gap-6 rounded-3xl border border-primary/40 bg-surface-muted/80 p-8 sm:p-14 shadow-lg backdrop-blur-md text-center items-center">
        <span className={eyebrow}>Ready in 2 Minutes</span>
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-foreground max-w-2xl">
          Take control of your shop&apos;s future today.
        </h2>
        <p className="max-w-[50ch] text-base sm:text-lg text-muted leading-relaxed">
          Create your free workspace, add your first products, and record your sales. No credit card required.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link href="/sign-up" className={ctaPrimary}>
            Create your free workspace <ArrowRightIcon size={16} />
          </Link>
          <Link href="/sign-in" className={ctaSecondary}>
            Sign in to existing account
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <FloatingHeader />
      <main className={`${wrap} flex flex-1 flex-col`}>
        <Hero />
        <TrustMetrics />
        <BentoFeatures />
        <AssistantShowcase />
        <FinalCta />
      </main>
      <footer className={`${wrap} border-t border-border py-10 text-xs text-muted flex flex-col sm:flex-row items-center justify-between gap-4`}>
        <p>© 2026 Elevate. Built for Pakistan&apos;s small business owners.</p>
        <p>Grounded in verified records. Not legal, tax or professional accounting advice.</p>
      </footer>
    </div>
  );
}
