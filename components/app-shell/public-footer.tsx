import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export function PublicFooter() {
  return (
    <footer className="border-t bg-card/40">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-foreground" />
          <span>AttackMap · Network scan intelligence</span>
        </div>
        <nav className="flex items-center gap-5" aria-label="Footer navigation">
          <Link className="transition-colors hover:text-foreground" href="/">
            Home
          </Link>
          <Link className="transition-colors hover:text-foreground" href="/docs">
            Documentation
          </Link>
          <Link className="transition-colors hover:text-foreground" href="/scans">
            Open app
          </Link>
        </nav>
      </div>
    </footer>
  );
}
