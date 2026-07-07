import { Badge } from "@/components/ui/badge";
import type { Severity } from "@/lib/types";

import { getSeverityBadgeClass } from "@/features/scans/shared/utils";

type SeverityBadgeProps = {
  severity: Severity;
};

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <Badge variant="outline" className={getSeverityBadgeClass(severity)}>
      {severity}
    </Badge>
  );
}
