import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TableHead } from "@/components/ui/table";

import type { SortDirection } from "./inventory-table-data";

type SortableTableHeadProps = {
  label: string;
  active: boolean;
  direction: SortDirection;
  onSort: () => void;
  className?: string;
};

export function SortableTableHead({
  label,
  active,
  direction,
  onSort,
  className,
}: SortableTableHeadProps) {
  const Icon = active ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <TableHead
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={`sticky top-0 z-10 bg-muted/95 px-4 py-3 font-semibold backdrop-blur ${className ?? ""}`}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-mx-2 h-8 rounded-sm px-2 text-xs font-semibold uppercase text-muted-foreground hover:bg-transparent hover:text-foreground"
        onClick={onSort}
      >
        {label}
        <Icon className="size-3.5" aria-hidden="true" />
      </Button>
    </TableHead>
  );
}
