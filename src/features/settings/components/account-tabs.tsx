"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { tabsListClassName, tabsTriggerClassName } from "@/components/ui/tabs";

import { ACCOUNT_SETTINGS_URL } from "../nav";

// Clerk's own navbar is hidden on the Account page (#144), so its two pages
// are linked here. Billing is left out on purpose: billing ships on Polar (#105).
const ACCOUNT_TABS = [
  { href: ACCOUNT_SETTINGS_URL, label: "Profile" },
  { href: `${ACCOUNT_SETTINGS_URL}/security`, label: "Security" },
];

export const AccountTabs = () => {
  const pathname = usePathname();

  return (
    <nav aria-label="Account" className={tabsListClassName}>
      {ACCOUNT_TABS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            data-state={active ? "active" : "inactive"}
            className={tabsTriggerClassName}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
};
