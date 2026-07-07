"use client";

import { getHostsForScan } from "@/lib/scans/metrics";
import { HostInventoryTable } from "@/features/scans/detail/host-inventory-table";
import { useScanDetail } from "../scan-detail-context";

export default function HostsPage() {
  const scan = useScanDetail();

  return <HostInventoryTable hosts={getHostsForScan(scan)} />;
}
