"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ScanSection = {
  id: string;
  label: string;
  href: string;
};

type ScanDetailNavProps = {
  sections: ScanSection[];
};

export function ScanDetailNav({ sections }: ScanDetailNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto p-2" aria-label="Scan sections">
      {sections.map((section) => {
        const active = pathname === section.href;

        return (
          <Button
            key={section.id}
            asChild
            size="sm"
            variant={active ? "default" : "ghost"}
            className={cn("rounded-md", !active && "text-zinc-600")}
          >
            <Link href={section.href} aria-current={active ? "page" : undefined}>
              {section.label}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
