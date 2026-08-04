"use client";

import { getServicesForScan } from "@/lib/scans/metrics";
import { ServiceInventoryTable } from "@/features/scans/detail/service-inventory-table";
import { useScanDetail } from "../scan-detail-context";

export default function ServicesPage() {
  const scan = useScanDetail();

  return <ServiceInventoryTable services={getServicesForScan(scan)} />;
}
