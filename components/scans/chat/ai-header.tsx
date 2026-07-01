"use client";

import { Crosshair, FileText, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SheetClose } from "@/components/ui/sheet";
import type { Scan } from "@/lib/types";

// The contextual header: who's answering (prominent product mark) and the scan
// target + source file it's reasoning about.
export function AIHeader({ scan }: { scan: Scan }) {
  return (
    <div className="border-b">
      <div className="flex items-center gap-2 px-4 pt-3">
        <Crosshair className="size-6 text-emerald-600 dark:text-emerald-400" />
        <span className="text-2xl font-bold tracking-tight text-foreground">AttackMap AI</span>
        <SheetClose asChild>
          <Button
            variant="outline"
            size="icon-sm"
            className="-mr-1 ml-auto text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </Button>
        </SheetClose>
      </div>

      <div className="px-4 pt-3 pb-3">
        <h2 className="truncate text-lg font-semibold text-foreground">{scan.target}</h2>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <FileText className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="truncate">{scan.filename}</span>
        </p>
      </div>
    </div>
  );
}
