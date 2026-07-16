import "server-only";
import { after } from "next/server";

import { runReconciliationSweep } from "@/lib/scans/import-jobs";

export function triggerOpportunisticReconcile(): void {
  after(() =>
    runReconciliationSweep().catch((error) => {
      console.error("Opportunistic reconciliation sweep failed:", error);
    }),
  );
}
