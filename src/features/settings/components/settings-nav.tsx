"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
  const tabsRef = useRef<HTMLElement>(null);
  // Which edges have hidden tabs, so the row fades there (#218).
  const [overflow, setOverflow] = useState({ left: false, right: false });

  const updateOverflow = () => {
    const el = tabsRef.current;
    if (!el) return;
    setOverflow({
      left: el.scrollLeft > 0,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  };

  // At 375px the five tabs overflow, so bring the current one into view (#218).
  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    el.querySelector('[aria-current="page"]')?.scrollIntoView({
      block: "nearest",
      inline: "center",
    });
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeHref]);

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
        ref={tabsRef}
        aria-label="Settings"
        onScroll={updateOverflow}
        className={cn(
          tabsListClassName,
          "w-full justify-start overflow-x-auto lg:hidden",
          overflow.left && "mask-l-from-85%",
          overflow.right && "mask-r-from-85%",
        )}
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
