"use client";

import { UserButton } from "@clerk/nextjs";
import { ArrowRightLeft, BookOpen, FileUp, Library } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Brand } from "@/components/app-shell/brand";
import { ThemeToggle } from "@/components/app-shell/theme-toggle";
import { cn } from "@/lib/utils";

const links = [
  { href: "/scans", label: "Scans", icon: Library },
  { href: "/upload", label: "New scan", icon: FileUp },
  { href: "/compare", label: "Compare", icon: ArrowRightLeft },
];

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="app-header sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-2 px-4 lg:px-6">
        <Brand href="/scans" compact />
        <nav
          className="flex min-w-0 flex-1 items-center justify-center gap-0.5 sm:gap-1"
          aria-label="Application navigation"
        >
          {links.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/scans"
                ? pathname === href || pathname.startsWith("/scans/")
                : pathname === href;

            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/30 sm:px-3",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span className="hidden md:inline">{label}</span>
              </Link>
            );
          })}
          <Link
            href="/docs"
            aria-label="Documentation"
            className="flex items-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 sm:px-3"
          >
            <BookOpen className="size-4" />
            <span className="hidden md:inline">Docs</span>
          </Link>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <UserButton />
        </div>
      </div>
    </header>
  );
}
