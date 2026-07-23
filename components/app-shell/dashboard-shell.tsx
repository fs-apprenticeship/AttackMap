"use client";

import { UserButton } from "@clerk/nextjs";
import {
  ArrowRightLeft,
  BookOpen,
  FileUp,
  Library,
  Menu,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ComponentProps } from "react";

import { Brand } from "@/components/app-shell/brand";
import { isDashboardNavItemActive } from "@/components/app-shell/dashboard-navigation";
import { ThemeToggle } from "@/components/app-shell/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navigationItems = [
  {
    href: "/dashboard/scans",
    label: "Scans",
    icon: Library,
    matchDescendants: true,
  },
  {
    href: "/dashboard/upload",
    label: "New scan",
    icon: FileUp,
    matchDescendants: false,
  },
  {
    href: "/dashboard/compare",
    label: "Compare",
    icon: ArrowRightLeft,
    matchDescendants: false,
  },
] as const;

function SidebarLink({
  mobile,
  ...props
}: ComponentProps<typeof Link> & { mobile: boolean }) {
  const link = <Link {...props} />;

  return mobile ? <SheetClose asChild>{link}</SheetClose> : link;
}

function DashboardNavigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-col gap-1 px-3 py-4"
      aria-label="Dashboard navigation"
    >
      {navigationItems.map(
        ({ href, label, icon: Icon, matchDescendants }) => {
          const active = isDashboardNavItemActive(
            pathname,
            href,
            matchDescendants,
          );
          return (
            <SidebarLink
              key={href}
              mobile={mobile}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-sidebar-ring/30",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span>{label}</span>
            </SidebarLink>
          );
        },
      )}
    </nav>
  );
}

function DashboardSidebarContent({ mobile = false }: { mobile?: boolean }) {
  const brand = <Brand href="/dashboard/scans" />;

  return (
    <>
      <div className="border-b border-sidebar-border p-4">
        {mobile ? <SheetClose asChild>{brand}</SheetClose> : brand}
      </div>

      <DashboardNavigation mobile={mobile} />

      <div className="mt-auto space-y-3 border-t border-sidebar-border p-3">
        <SidebarLink
          mobile={mobile}
          href="/docs"
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-sidebar-ring/30"
        >
          <BookOpen className="size-4" />
          Documentation
        </SidebarLink>
        <div className="flex items-center justify-between rounded-md border border-sidebar-border bg-sidebar-accent/35 p-2">
          <span className="pl-1 text-xs font-medium text-sidebar-foreground/70">
            Appearance
          </span>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserButton />
          </div>
        </div>
      </div>
    </>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  useEffect(() => {
    const desktopBreakpoint = window.matchMedia("(min-width: 64rem)");
    const closeNavigationOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setMobileNavigationOpen(false);
      }
    };

    desktopBreakpoint.addEventListener("change", closeNavigationOnDesktop);
    return () => {
      desktopBreakpoint.removeEventListener(
        "change",
        closeNavigationOnDesktop,
      );
    };
  }, []);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        <DashboardSidebarContent />
      </aside>

      <Sheet
        open={mobileNavigationOpen}
        onOpenChange={setMobileNavigationOpen}
      >
        <header className="app-header sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur lg:hidden">
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Open dashboard navigation"
              className="shrink-0 bg-background"
            >
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <Brand href="/dashboard/scans" />
        </header>

        <SheetContent
          side="left"
          className="w-72 gap-0 bg-sidebar p-0 text-sidebar-foreground sm:max-w-72 lg:hidden"
          overlayClassName="pointer-events-auto bg-black/40 lg:hidden"
        >
          <SheetTitle className="sr-only">Dashboard navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Navigate between scans, uploads, comparison tools, and
            documentation.
          </SheetDescription>
          <DashboardSidebarContent mobile />
        </SheetContent>
      </Sheet>

      <div className="min-h-[calc(100dvh-3.5rem)] lg:min-h-dvh lg:pl-64">
        {children}
      </div>
    </div>
  );
}
