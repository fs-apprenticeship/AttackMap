"use client";

import { getServiceBreakdown } from "@/components/dashboard/data";
import { ServiceBreakdown } from "@/components/dashboard/service-breakdown";
import { useScanDetail } from "../scan-detail-context";

export default function ServicesPage() {
  const scan = useScanDetail();

  return <ServiceBreakdown services={getServiceBreakdown(scan)} />;
}
