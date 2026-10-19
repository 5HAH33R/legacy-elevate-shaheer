"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Section tabs for a single business workspace. */
export function BusinessNav({ businessId }: { businessId: string }) {
  const pathname = usePathname();
  const base = `/dashboard/${businessId}`;
  const tabs = [
    { href: base, label: "Summary" },
    { href: `${base}/products`, label: "Products" },
    { href: `${base}/sales`, label: "Sales" },
    { href: `${base}/expenses`, label: "Expenses" },
  ];

  return (
    <nav aria-label="Business sections" className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
                : "rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted transition hover:text-foreground"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
