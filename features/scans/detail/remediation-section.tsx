"use client";

import type { Scan } from "@/lib/types";
import { useGenerateRemediation } from "@/features/scans/hooks/use-generate-remediation";

import { RemediationPlanPanel } from "./remediation-plan";

type RemediationSectionProps = {
  scan: Scan;
};

export function RemediationSection({ scan }: RemediationSectionProps) {
  const remediation = useGenerateRemediation(scan);

  return (
    <RemediationPlanPanel
      plan={scan.remediationPlan}
      scan={scan}
      generating={remediation.generating}
      error={remediation.error}
      onGenerate={remediation.generate}
    />
  );
}
