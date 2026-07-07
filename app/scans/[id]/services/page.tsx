"use client";

import { getServiceBreakdown } from "@/lib/scans/metrics";
import { ServiceBreakdown } from "@/features/scans/detail/service-breakdown";
import { useScanDetail } from "../scan-detail-context";

export default function ServicesPage() {
  const scan = useScanDetail();

  return <ServiceBreakdown services={getServiceBreakdown(scan)} />;
}
