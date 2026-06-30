import { Suspense } from "react";

import {
  ScanDetailFrame,
  ScanNotFound,
} from "@/components/scans/scan-detail-frame";

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
      <main className="min-h-[calc(100vh-4rem)] bg-zinc-100 text-zinc-950">
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
    <Suspense
      fallback={<p className="p-6 text-sm text-zinc-500">Loading...</p>}
    >
      <ScanDetailLayoutContent params={params}>
        {children}
      </ScanDetailLayoutContent>
    </Suspense>
  );
}
