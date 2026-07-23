import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import type { MouseEventHandler } from "react";

import { cn } from "@/lib/utils";

export function Brand({
  href = "/",
  compact = false,
  onClick,
}: {
  href?: string;
  compact?: boolean;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-label="AttackMap home"
      className="group flex min-w-0 items-center gap-3 rounded-md outline-none transition-opacity hover:opacity-85 focus-visible:ring-3 focus-visible:ring-ring/30"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-[1.03]">
        <ShieldCheck className="size-5" />
      </div>
      <div className={cn("min-w-0", compact && "hidden lg:block")}>
        <p className="text-sm font-semibold leading-5 text-foreground">
          AttackMap
        </p>
        <p className="hidden text-xs text-muted-foreground sm:block">
          Network scan intelligence
        </p>
      </div>
    </Link>
  );
}
