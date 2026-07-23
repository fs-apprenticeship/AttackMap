import Link from "next/link";
import { BookOpen } from "lucide-react";

import { Brand } from "@/components/app-shell/brand";
import { HeaderAuth } from "@/components/app-shell/header-auth";
import { ThemeToggle } from "@/components/app-shell/theme-toggle";

export function PublicHeader() {
  return (
    <header className="app-header sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 lg:px-6">
        <Brand />
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <nav className="mr-0.5 flex items-center sm:mr-1" aria-label="Public navigation">
            <Link
              href="/#capabilities"
              className="hidden rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 lg:block"
            >
              Product
            </Link>
            <Link
              href="/#workflow"
              className="hidden rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 md:block"
            >
              How it works
            </Link>
            <Link
              href="/docs"
              aria-label="Documentation"
              className="flex size-8 items-center justify-center rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 sm:h-auto sm:w-auto sm:px-3 sm:py-2"
            >
              <BookOpen className="size-4 sm:hidden" />
              <span className="hidden sm:inline">Docs</span>
            </Link>
          </nav>
          <ThemeToggle />
          <HeaderAuth />
        </div>
      </div>
    </header>
  );
}
