"use client";

import { getHostsForScan } from "@/components/dashboard/data";
import { HostInventoryTable } from "@/components/dashboard/host-inventory-table";
import { useScanDetail } from "../scan-detail-context";

export default function HostsPage() {
  const scan = useScanDetail();

  return <HostInventoryTable hosts={getHostsForScan(scan)} />;
}
