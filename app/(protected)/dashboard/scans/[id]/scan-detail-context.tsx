"use client";

import { createContext, useContext } from "react";

import type { Scan } from "@/lib/types";

const ScanDetailContext = createContext<Scan | null>(null);

export function ScanDetailProvider({
  scan,
  children,
}: {
  scan: Scan;
  children: React.ReactNode;
}) {
  return (
    <ScanDetailContext.Provider value={scan}>
      {children}
    </ScanDetailContext.Provider>
  );
}

export function useScanDetail() {
  const scan = useContext(ScanDetailContext);

  if (!scan) {
    throw new Error("useScanDetail must be used inside ScanDetailProvider.");
  }

  return scan;
}
