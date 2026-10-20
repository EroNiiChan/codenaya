"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { tabsListClassName, tabsTriggerClassName } from "@/components/ui/tabs";

import { SETTINGS_NAV } from "../nav";

/** The tab whose route contains the current path (Account has subpages). */
const useActiveHref = () => {
  const pathname = usePathname();
  return SETTINGS_NAV.find(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
  )?.href;
};

/** Sidebar on desktop, scrollable tab-style links below `lg`. */
export const SettingsNav = () => {
  const activeHref = useActiveHref();

  return (
    <>
      <nav aria-label="Settings" className="hidden lg:block w-48 shrink-0">
        <ul className="space-y-1">
          {SETTINGS_NAV.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={href === activeHref ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  href === activeHref
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Page links styled as tabs; `data-state` reuses the tab active style. */}
      <nav
        aria-label="Settings"
        className={cn(tabsListClassName, "w-full justify-start overflow-x-auto lg:hidden")}
      >
        {SETTINGS_NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={href === activeHref ? "page" : undefined}
            data-state={href === activeHref ? "active" : "inactive"}
            className={tabsTriggerClassName}
          >
            <Icon aria-hidden="true" className="hidden sm:block" />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
};
