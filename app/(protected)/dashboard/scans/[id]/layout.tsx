import { Suspense } from "react";

import {
  ScanDetailFrame,
  ScanNotFound,
} from "@/features/scans/detail/scan-detail-frame";
import { ScanDetailSkeleton } from "@/features/scans/detail/scan-detail-skeletons";

import { getScanFromParams } from "./scan-detail-data";
import { ScanDetailProvider } from "./scan-detail-context";

async function ScanDetailLayoutContent({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const scan = await getScanFromParams(params);

  if (!scan) {
    return (
      <main className="bg-background text-foreground">
        <div className="mx-auto w-full max-w-[1500px] px-4 py-5 lg:px-6">
          <ScanNotFound />
        </div>
      </main>
    );
  }

  return (
    <ScanDetailProvider scan={scan}>
      <ScanDetailFrame scan={scan}>{children}</ScanDetailFrame>
    </ScanDetailProvider>
  );
}

export default function ScanDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<ScanDetailSkeleton />}>
      <ScanDetailLayoutContent params={params}>
        {children}
      </ScanDetailLayoutContent>
    </Suspense>
  );
}
