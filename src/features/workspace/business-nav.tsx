"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  AssistantIcon,
  ExpensesIcon,
  OverviewIcon,
  ProductsIcon,
  PurchasesIcon,
  SalesIcon,
  SuppliersIcon,
  InvoiceScanIcon,
} from "@/components/icons";

/**
 * Section navigation for one business workspace (the shell's sidebar and the
 * phone menu). The active section is a neutral pill; colour stays on data.
 */
export function BusinessNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { businessId } = useParams<{ businessId: string }>();
  const base = `/dashboard/${businessId}`;
  const groups = [
    {
      label: null,
      items: [{ href: base, label: "Overview", Icon: OverviewIcon, exact: true }],
    },
    {
      label: "Records",
      items: [
        { href: `${base}/products`, label: "Products & stock", Icon: ProductsIcon, exact: false },
        { href: `${base}/sales`, label: "Sales", Icon: SalesIcon, exact: false },
        { href: `${base}/expenses`, label: "Expenses", Icon: ExpensesIcon, exact: false },
      ],
    },
    {
      label: "Buying",
      items: [
        { href: `${base}/invoices`, label: "Scan invoices", Icon: InvoiceScanIcon, exact: false },
        { href: `${base}/suppliers`, label: "Suppliers", Icon: SuppliersIcon, exact: false },
        { href: `${base}/purchases`, label: "Purchases", Icon: PurchasesIcon, exact: false },
      ],
    },
    {
      label: "Ask",
      items: [
        { href: `${base}/assistant`, label: "AI assistant", Icon: AssistantIcon, exact: false },
        { href: `${base}/forecast`, label: "Forecast", Icon: OverviewIcon, exact: false },
        { href: `${base}/marketing`, label: "Marketing", Icon: SalesIcon, exact: false },
      ],
    },
    {
      label: "Account",
      items: [
        { href: `${base}/security`, label: "Security", Icon: ExpensesIcon, exact: false },
      ],
    },
  ];

  return (
    <nav aria-label="Business sections" className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.label ?? "main"} className="flex flex-col gap-0.5">
          {group.label ? (
            <p className="px-2.5 pb-1 text-xs font-medium text-muted">{group.label}</p>
          ) : null}
          {group.items.map(({ href, label, Icon, exact }) => {
            const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition ${
                  active
                    ? "bg-active font-medium text-foreground"
                    : "text-muted hover:bg-active/60 hover:text-foreground"
                }`}
              >
                <Icon />
                {label}
                {active ? (
                  <span aria-hidden="true" className="ml-auto size-1.5 rounded-full bg-chart" />
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
