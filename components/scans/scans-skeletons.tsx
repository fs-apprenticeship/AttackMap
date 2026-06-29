import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function SkeletonLine({
  className,
  ...props
}: React.ComponentProps<typeof Skeleton>) {
  return (
    <Skeleton className={cn("rounded-md bg-muted", className)} {...props} />
  );
}

function CardSkeleton({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-md border bg-card shadow-sm", className)}>
      {children}
    </div>
  );
}

export function ScansContentSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading scans">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <CardSkeleton key={index}>
            <div className="flex items-center gap-3 p-4">
              <SkeletonLine className="size-9 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonLine className="h-3 w-24" />
                <SkeletonLine className="h-7 w-16" />
              </div>
            </div>
          </CardSkeleton>
        ))}
      </div>

      <CardSkeleton>
        <div className="space-y-3 p-4">
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px]">
            <SkeletonLine className="h-10" />
            <SkeletonLine className="h-10" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonLine key={index} className="h-10" />
            ))}
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            <SkeletonLine className="h-4 w-40" />
            <SkeletonLine className="h-7 w-28" />
          </div>
        </div>
      </CardSkeleton>

      <CardSkeleton className="overflow-hidden">
        <div className="grid grid-cols-[minmax(180px,1.5fr)_minmax(160px,1fr)_110px_140px_120px_120px_150px] border-b bg-muted/40 px-4 py-3">
          {Array.from({ length: 7 }).map((_, index) => (
            <SkeletonLine key={index} className="h-3 w-20" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="grid grid-cols-[minmax(180px,1.5fr)_minmax(160px,1fr)_110px_140px_120px_120px_150px] items-center border-b px-4 py-4 last:border-b-0"
          >
            <SkeletonLine className="h-4 w-40" />
            <SkeletonLine className="h-4 w-36" />
            <SkeletonLine className="h-6 w-16" />
            <div className="flex gap-1.5">
              <SkeletonLine className="h-6 w-10" />
              <SkeletonLine className="h-6 w-10" />
            </div>
            <SkeletonLine className="h-4 w-16" />
            <SkeletonLine className="h-4 w-20" />
            <div className="flex justify-end gap-2">
              <SkeletonLine className="h-7 w-16" />
              <SkeletonLine className="size-7" />
              <SkeletonLine className="size-7" />
            </div>
          </div>
        ))}
      </CardSkeleton>
    </div>
  );
}
