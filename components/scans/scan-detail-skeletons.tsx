import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function SkeletonLine({
  className,
  ...props
}: React.ComponentProps<typeof Skeleton>) {
  return (
    <Skeleton className={cn("rounded-md bg-zinc-100", className)} {...props} />
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
    <div className={cn("rounded-md border bg-white shadow-sm", className)}>
      {children}
    </div>
  );
}

export function ScanDetailSkeleton() {
  return (
    <main
      className="min-h-[calc(100vh-4rem)] bg-zinc-100 text-zinc-950"
      aria-label="Loading scan details"
    >
      <div className="mx-auto w-full max-w-[1500px] px-4 py-5 lg:px-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Skeleton className="h-8 w-24 rounded-md bg-white" />
          <Skeleton className="h-8 w-24 rounded-md bg-white" />
        </div>

        <div className="mb-5 rounded-md border bg-white p-4 shadow-sm">
          <Skeleton className="h-4 w-56 rounded-md" />
          <Skeleton className="mt-2 h-3 w-40 rounded-md" />
          <div className="mt-5 flex gap-2 overflow-hidden">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-7 w-24 rounded-md" />
            ))}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-6">
          <CardSkeleton className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b p-4">
              <SkeletonLine className="h-6 w-40" />
              <SkeletonLine className="h-6 w-32" />
              <SkeletonLine className="h-6 w-32" />
            </div>
            <div className="px-4 pt-4">
              <SkeletonLine className="h-9 w-[34rem] max-w-full" />
            </div>
            <div className="grid grid-cols-1 gap-x-4 gap-y-10 p-4 xl:grid-cols-[minmax(0,7fr)_minmax(300px,3fr)]">
              <div className="order-1 rounded-lg border bg-zinc-50 p-5 xl:col-start-2 xl:row-start-1">
                <SkeletonLine className="mx-auto size-36 rounded-full" />
                <SkeletonLine className="mx-auto mt-4 h-4 w-24" />
                <SkeletonLine className="mx-auto mt-2 h-6 w-20" />
              </div>
              <div className="order-2 rounded-lg border bg-zinc-50 p-5 xl:col-start-2 xl:row-start-2">
                <SkeletonLine className="h-5 w-32" />
                <div className="mt-4 space-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <SkeletonLine className="h-6 w-16" />
                      <SkeletonLine className="h-4 flex-1" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="order-3 rounded-lg border bg-zinc-50 p-5 xl:col-start-1 xl:row-start-1">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <SkeletonLine className="size-6" />
                    <SkeletonLine className="h-4 w-24" />
                  </div>
                  <SkeletonLine className="h-8 w-40" />
                </div>
                <div className="space-y-3">
                  <SkeletonLine className="h-4 w-full" />
                  <SkeletonLine className="h-4 w-11/12" />
                  <SkeletonLine className="h-4 w-10/12" />
                  <SkeletonLine className="h-4 w-8/12" />
                </div>
              </div>
              <div className="order-4 overflow-hidden rounded-lg border bg-zinc-50 xl:col-start-1 xl:row-start-2">
                <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="space-y-2 p-4">
                      <SkeletonLine className="h-3 w-20" />
                      <SkeletonLine className="h-7 w-14" />
                      <SkeletonLine className="h-3 w-24" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardSkeleton>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <CardSkeleton key={index}>
                <div className="flex items-center gap-3 p-4">
                  <SkeletonLine className="size-9" />
                  <div className="space-y-2">
                    <SkeletonLine className="h-4 w-24" />
                    <SkeletonLine className="h-3 w-16" />
                  </div>
                </div>
              </CardSkeleton>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
