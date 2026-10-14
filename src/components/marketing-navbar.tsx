"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { motion } from "motion/react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SIGN_IN_URL, SIGN_UP_URL } from "@/features/auth/constants";
import { cn } from "@/lib/utils";

import { UserMenu } from "./user-menu";

const NAV_LINKS = [
  { href: "/showcase", label: "Showcase" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
] as const;

/** A link is active on its own page and on any page below it (`/showcase/[id]`). */
const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

const Brand = () => (
  <Link href="/" className="flex items-center gap-3 group">
    <img
      src="/logo-alt.svg"
      alt="Codenaya"
      className="size-7 dark:invert-0 invert transition-transform duration-300 group-hover:rotate-12"
    />
    <span className="text-lg font-semibold tracking-tight text-foreground">codenaya</span>
  </Link>
);

type MarketingNavbarProps = {
  /**
   * The landing page sets this: the bar is fixed over the hero and stays
   * transparent until the page scrolls. Other pages get a sticky bar that
   * takes up its own space, so content never sits under it.
   */
  overlay?: boolean;
};

/** The one header for every public page: Showcase, Pricing, Docs, plus auth actions. */
export const MarketingNavbar = ({ overlay = false }: MarketingNavbarProps) => {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!overlay) return;
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [overlay]);

  const solid = !overlay || scrolled;

  return (
    <motion.header
      initial={overlay ? { y: -100, opacity: 0 } : false}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "top-0 z-50 transition-[background-color,border-color,box-shadow] duration-500",
        overlay ? "fixed inset-x-0" : "sticky",
        solid
          ? "bg-background/80 backdrop-blur-xl border-b border-border/50"
          : "bg-transparent border-b border-transparent",
        overlay && scrolled && "shadow-sm",
      )}
    >
      <nav
        aria-label="Main"
        className="max-w-7xl mx-auto px-6 md:px-8 h-16 flex items-center justify-between"
      >
        <div className="flex items-center gap-8">
          <Brand />

          <ul className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex h-16 items-center px-3 text-sm font-medium transition-colors outline-none focus-visible:text-foreground",
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                    {active && (
                      <span
                        aria-hidden
                        className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand"
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="hidden md:flex items-center gap-3">
          {isSignedIn === true && (
            <>
              <Button asChild variant="secondary" size="sm">
                <Link href="/">Dashboard</Link>
              </Button>
              <UserMenu avatarClassName="size-7" />
            </>
          )}
          {isSignedIn === false && (
            <>
              <Button
                asChild
                variant="ghost"
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <Link href={SIGN_IN_URL}>Log in</Link>
              </Button>
              <Button
                asChild
                className="text-sm font-medium bg-brand text-brand-foreground hover:bg-brand/90 rounded-full px-5"
              >
                <Link href={SIGN_UP_URL}>Sign Up</Link>
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          {isSignedIn === true && <UserMenu avatarClassName="size-7" />}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Toggle menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full gap-0 sm:max-w-sm">
              <SheetHeader className="h-16 flex-row items-center border-b border-border/50 px-6 py-0">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <SheetDescription className="sr-only">Site navigation</SheetDescription>
                <Brand />
              </SheetHeader>

              <ul className="flex flex-col gap-1 p-4">
                {NAV_LINKS.map(({ href, label }) => {
                  const active = isActive(pathname, href);
                  return (
                    <li key={href}>
                      <SheetClose asChild>
                        <Link
                          href={href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex h-12 items-center rounded-lg border-l-2 px-4 text-base font-medium transition-colors",
                            active
                              ? "border-brand bg-muted text-foreground"
                              : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                          )}
                        >
                          {label}
                        </Link>
                      </SheetClose>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-auto flex flex-col gap-3 border-t border-border/50 p-4">
                {isSignedIn === true && (
                  <SheetClose asChild>
                    <Button asChild variant="secondary" className="h-12 w-full text-base">
                      <Link href="/">Dashboard</Link>
                    </Button>
                  </SheetClose>
                )}
                {isSignedIn === false && (
                  <>
                    <SheetClose asChild>
                      <Button asChild variant="outline" className="h-12 w-full text-base">
                        <Link href={SIGN_IN_URL}>Log in</Link>
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button
                        asChild
                        className="h-12 w-full text-base bg-brand text-brand-foreground hover:bg-brand/90"
                      >
                        <Link href={SIGN_UP_URL}>Sign Up</Link>
                      </Button>
                    </SheetClose>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </motion.header>
  );
};
