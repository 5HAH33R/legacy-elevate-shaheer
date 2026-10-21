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
  ProductsIcon,
  SalesIcon,
  SuppliersIcon,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "Elevate: know your shop's real profit",
  description:
    "Elevate keeps stock, sales, expenses and suppliers in one place, works out your profit, and answers in English, Urdu or Roman Urdu using only your own figures.",
  openGraph: {
    title: "Elevate: know your shop's real profit",
    description: "Stock, sales, expenses and suppliers for small businesses in Pakistan, with an assistant that explains your numbers.",
  },
};

const wrap = "mx-auto w-full max-w-[1200px] px-4 sm:px-8";
const ctaPrimary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:brightness-95";
const ctaSecondary =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-control px-5 text-sm font-semibold text-foreground transition hover:bg-surface-muted";
const eyebrow = "text-sm font-medium text-muted";
const h2 = "text-3xl font-semibold tracking-tight sm:text-4xl";
const lead = "max-w-[60ch] text-base text-muted sm:text-lg";

const LADDER: { op: string; label: string; value: string; note: string; strong?: boolean }[] = [
  { op: "", label: "Revenue", value: "Rs 84,500", note: "from your sales" },
  { op: "−", label: "Cost of goods sold", value: "Rs 61,200", note: "unit cost saved on each sale" },
  { op: "=", label: "Gross profit", value: "Rs 23,300", note: "27.6% of revenue" },
  { op: "−", label: "Recorded expenses", value: "Rs 14,800", note: "rent, bills, salaries" },
  { op: "=", label: "Estimated net profit", value: "Rs 8,500", note: "only what you recorded", strong: true },
];

const FLOW = [
  { Icon: ProductsIcon, title: "Add your products", body: "Enter each item with its cost, selling price and a reorder level. Opening stock goes in once." },
  { Icon: SalesIcon, title: "Record sales", body: "Every sale takes the items out of stock and saves the unit cost, so profit stays correct if prices change later." },
  { Icon: ExpensesIcon, title: "Record expenses", body: "Rent, electricity, salaries. Whatever you record is subtracted from gross profit." },
  { Icon: AssistantIcon, title: "See profit, then ask", body: "Open the Overview for the numbers. Or just ask a question in the language you speak." },
];

function Header() {
  return (
    <header className="border-b border-border">
      <div className={`${wrap} flex h-16 items-center justify-between gap-3`}>
        <Logo width={112} priority />
        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <Link href="/sign-in" className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium hover:bg-surface-muted">
            Sign in
          </Link>
          <Link href="/sign-up" className={`${ctaPrimary} hidden sm:inline-flex`}>
            Create your free workspace
          </Link>
        </div>
      </div>
    </header>
  );
}

function OverviewPreview() {
  return (
    <figure className="rounded-2xl border border-border bg-surface-muted p-3 sm:p-4">
      <div className="rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
          <span className="text-sm font-semibold">Overview · This month</span>
          <span className="rounded-md border border-control px-2 py-0.5 text-xs text-muted">Example</span>
        </div>
        <ol className="px-4 py-1 text-sm sm:px-5">
          {LADDER.map((r) => (
            <li key={r.label} className={`flex items-baseline gap-3 border-t border-rule py-3 first:border-t-0 ${r.strong ? "font-semibold" : ""}`}>
              <span aria-hidden="true" className="w-4 shrink-0 text-center text-muted">{r.op}</span>
              <span className="min-w-0 flex-1">
                {r.label}
                <span className="block text-xs font-normal text-muted">{r.note}</span>
              </span>
              <span className="num whitespace-nowrap">{r.value}</span>
            </li>
          ))}
        </ol>
        <div className="border-t border-border px-4 py-3 sm:px-5">
          <p className="flex items-start gap-2 text-sm">
            <AlertIcon size={16} className="mt-0.5 shrink-0 text-warning" />
            <span>
              <span className="font-medium">Low stock: Cooking oil 5L.</span>{" "}
              <span className="text-muted">4 left, reorder level 10.</span>
            </span>
          </p>
        </div>
      </div>
      <figcaption className="px-2 pt-3 text-xs text-muted">
        Example figures, not a real shop. Revenue − cost of goods = gross profit; gross profit − expenses = estimated net profit.
      </figcaption>
    </figure>
  );
}

function Hero() {
  return (
    <section className="grid gap-12 py-14 sm:py-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center">
      <div className="flex flex-col gap-6">
        <p className={eyebrow}>For small shops and businesses in Pakistan</p>
        <h1 className="text-5xl leading-[1.02] font-semibold tracking-tight sm:text-6xl lg:text-7xl">
          Trust your shop&apos;s numbers.
        </h1>
        <p className="max-w-[52ch] text-lg text-muted">
          Elevate keeps your stock, sales, expenses and suppliers in one register, works out your profit, and answers
          your questions in English, Urdu or Roman Urdu.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/sign-up" className={ctaPrimary}>
            Create your free workspace <ArrowRightIcon />
          </Link>
          <Link href="/sign-in" className={ctaSecondary}>Sign in</Link>
        </div>
      </div>
      <OverviewPreview />
    </section>
  );
}

function Flow() {
  return (
    <section aria-labelledby="flow" className="border-t border-border py-16 sm:py-24">
      <p className={eyebrow}>From register to clarity</p>
      <h2 id="flow" className={`${h2} mt-2 max-w-[22ch]`}>Four steps, the same every day.</h2>
      <ol className="mt-10 divide-y divide-border border-y border-border">
        {FLOW.map(({ Icon, title, body }, i) => (
          <li key={title} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 gap-y-1 py-6 md:grid-cols-[3rem_minmax(0,16rem)_minmax(0,1fr)]">
            <span className="num text-sm font-medium text-muted">0{i + 1}</span>
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Icon size={18} className="text-muted" />
              {title}
            </h3>
            <p className="col-start-2 max-w-[58ch] text-muted md:col-start-3">{body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Ladder() {
  return (
    <section aria-labelledby="ladder" className="border-t border-border py-16 sm:py-24">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-4">
          <p className={eyebrow}>The profit ladder</p>
          <h2 id="ladder" className={h2}>Profit, one step at a time.</h2>
          <p className={lead}>
            Elevate never shows a single mystery number. Each step is calculated from your own records, so you can see
            where the money went.
          </p>
          <p className="flex max-w-[60ch] items-start gap-2 rounded-lg border border-warning-border bg-warning-bg p-3 text-sm text-warning">
            <InfoIcon size={16} className="mt-0.5 shrink-0" />
            Net profit is an estimate. It only subtracts the expenses you recorded, so a forgotten bill makes it look better than it is.
          </p>
        </div>
        <dl className="divide-y divide-border rounded-xl border border-border bg-surface">
          {[
            ["Revenue", "The total of your sales in the period you pick."],
            ["Cost of goods sold", "What those items cost you, using the unit cost saved when each sale was made."],
            ["Gross profit", "Revenue minus cost of goods, and the margin as a percentage. Shown as “Not calculable” when there is no revenue."],
            ["Recorded expenses", "Rent, bills and salaries you added. Voided entries are left out."],
            ["Estimated net profit", "Gross profit minus recorded expenses, always labelled as an estimate."],
          ].map(([t, d]) => (
            <div key={t} className="grid gap-1 p-5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
              <dt className="font-semibold">{t}</dt>
              <dd className="text-sm text-muted">{d}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Assistant() {
  const bubble = "max-w-[34rem] rounded-xl border border-border px-4 py-3 text-sm";
  return (
    <section aria-labelledby="ask" className="border-t border-border py-16 sm:py-24">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
        <div className="flex flex-col gap-4">
          <p className={eyebrow}>Ask in your language</p>
          <h2 id="ask" className={h2}>Ask the way you talk.</h2>
          <p className={lead}>
            Type in English, Urdu or Roman Urdu. The assistant explains the figures Elevate has already calculated. It
            does not do the maths itself, and it cannot add, edit or delete any record.
          </p>
          <ul className="flex flex-col gap-2 text-sm">
            {["Answers use only your own business figures", "Says so when data is missing", "Read-only: your records never change"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <CheckIcon size={16} className="text-success" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <figure className="rounded-2xl border border-border bg-surface-muted p-3 sm:p-4">
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold"><AssistantIcon size={16} /> Assistant</span>
              <span className="rounded-md border border-control px-2 py-0.5 text-xs text-muted">Example</span>
            </div>
            <p className={`${bubble} self-end bg-surface-muted`}>Mera profit kitna hua?</p>
            <p className={bubble}>
              Is mahine aapka estimated net profit Rs 8,500 hai. Revenue Rs 84,500 tha, cost of goods Rs 61,200, aur
              recorded expenses Rs 14,800. Yeh sirf aapke likhe hue expenses par based estimate hai.
            </p>
            <p lang="ur" dir="rtl" className={`${bubble} self-end bg-surface-muted text-base leading-8`}>
              کون سا سامان ختم ہو رہا ہے؟
            </p>
            <p className={bubble}>
              Cooking oil 5L: 4 left, below your reorder level of 10. Estimated reorder: 34 units.
            </p>
          </div>
          <figcaption className="px-2 pt-3 text-xs text-muted">
            Example conversation. AI-generated answers: check important numbers.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

function Stock() {
  return (
    <section aria-labelledby="stock" className="border-t border-border py-16 sm:py-24">
      <p className={eyebrow}>Stock and suppliers</p>
      <h2 id="stock" className={`${h2} mt-2 max-w-[24ch]`}>Know what to reorder, and where it&apos;s cheapest.</h2>
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <article className="rounded-xl border border-border bg-surface p-5 sm:p-6">
          <h3 className="flex items-center gap-2 text-lg font-semibold"><ProductsIcon size={18} className="text-muted" /> Low-stock alerts and restock estimates</h3>
          <p className="mt-2 text-sm text-muted">
            Elevate suggests a quantity from your last 30 days of sales: daily sales × 14 days, plus your reorder level,
            minus what you have. With fewer than 3 days of sales it says there is not enough history.
          </p>
          <p className="mt-4 text-xs font-medium text-muted">Example: Cooking oil 5L</p>
          <p className="num mt-1 text-sm">60 sold ÷ 30 × 14 + 10 − 4 = <span className="font-semibold">34 units (estimate)</span></p>
        </article>
        <article className="rounded-xl border border-border bg-surface p-5 sm:p-6">
          <h3 className="flex items-center gap-2 text-lg font-semibold"><SuppliersIcon size={18} className="text-muted" /> Supplier price comparison</h3>
          <p className="mt-2 text-sm text-muted">
            Compares what you actually paid each supplier, with purchase dates. It uses your records only, not market prices.
          </p>
          <p className="mt-4 text-xs font-medium text-muted">Example: Cooking oil 5L, per unit</p>
          <ul className="num mt-1 text-sm">
            {[["Supplier A", "Rs 1,480", "Lowest paid"], ["Supplier B", "Rs 1,525", ""], ["Supplier C", "Rs 1,560", ""]].map(([n, p, tag]) => (
              <li key={n} className="flex items-center justify-between gap-3 border-t border-rule py-2 first:border-t-0">
                <span>{n}</span>
                <span className="flex items-center gap-2">
                  {tag ? <span className="inline-flex items-center gap-1 text-xs text-success"><CheckIcon size={12} />{tag}</span> : null}
                  {p}
                </span>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}

function Trust() {
  const items = [
    ["A private workspace for each owner", "Only the owner who created a business can open it. This is checked on the server for every request, not just hidden in the screen."],
    ["Only what is needed goes to the AI", "A question sends your summary figures to the AI provider. It leaves out emails, phone numbers and internal ids."],
    ["Saved answers are yours to delete", "Conversations are kept in your workspace so you can reread them, and you can delete any of them."],
  ];
  return (
    <section aria-labelledby="trust" className="border-t border-border py-16 sm:py-24">
      <p className={eyebrow}>Trust and privacy</p>
      <h2 id="trust" className={`${h2} mt-2`}>Your books stay yours.</h2>
      <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
        {items.map(([t, b]) => (
          <div key={t} className="bg-surface p-6">
            <h3 className="text-base font-semibold">{t}</h3>
            <p className="mt-2 text-sm text-muted">{b}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section aria-labelledby="start" className="border-t border-border py-16 sm:py-24">
      <div className="flex flex-col gap-6 rounded-2xl bg-surface-muted p-6 sm:p-10">
        <h2 id="start" className={`${h2} max-w-[20ch]`}>Start with today&apos;s sales.</h2>
        <p className={lead}>Create a workspace, add a few products and record your first sale. Your profit ladder fills in as you go.</p>
        <div>
          <Link href="/sign-up" className={ctaPrimary}>
            Create your free workspace <ArrowRightIcon />
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <Header />
      <main className={`${wrap} flex flex-1 flex-col`}>
        <Hero />
        <Flow />
        <Ladder />
        <Assistant />
        <Stock />
        <Trust />
        <FinalCta />
      </main>
      <footer className={`${wrap} py-10 text-sm text-muted`}>
        Elevate supports your decisions. It is not accounting, tax or legal advice. Example figures on this page are
        illustrative.
      </footer>
    </div>
  );
}
