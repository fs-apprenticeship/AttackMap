import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ScansEmptyStateProps = {
  onResetFilters: () => void;
};

export function ScansEmptyState({ onResetFilters }: ScansEmptyStateProps) {
  return (
    <Card className="rounded-md border-dashed bg-white py-0 shadow-sm">
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        <div className="flex size-10 items-center justify-center rounded-md bg-zinc-950 text-white">
          <SlidersHorizontal className="size-5" />
        </div>
        <p className="text-sm font-medium">No scans match these filters</p>
        <p className="max-w-sm text-sm text-zinc-500">
          Adjust the search, risk filter, or sort order to widen the list.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-1 rounded-md bg-white"
          onClick={onResetFilters}
        >
          Clear filters
        </Button>
      </CardContent>
    </Card>
  );
}
