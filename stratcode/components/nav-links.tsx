"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const LINKS = [
  { href: "/challenges", label: "Challenges" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/profile", label: "Profile" },
] as const;

export function HeaderShell({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 4);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "app-header sticky top-0 z-40 border-b transition-colors duration-150 ease-out",
        scrolled ? "border-border" : "border-transparent"
      )}
    >
      {children}
    </header>
  );
}

export function NavLinksFallback() {
  return (
    <nav className="flex items-center gap-4 text-sm">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="pressable focus-ring rounded-[10px] py-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function NavLinks({ showFounder }: { showFounder?: boolean }) {
  const pathname = usePathname();
  const links = showFounder
    ? [...LINKS, { href: "/founder", label: "Founder" } as const]
    : LINKS;

  return (
    <nav className="flex items-center gap-4 text-sm">
      {links.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "pressable focus-ring rounded-[10px] py-1 transition-colors",
              active
                ? "font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
