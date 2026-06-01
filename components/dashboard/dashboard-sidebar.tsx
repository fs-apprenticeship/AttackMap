import type { Scan } from "@/lib/types";
import { ScanHistory } from "./scan-history";
import { UploadCard } from "./upload-card";

type DashboardSidebarProps = {
  scans: Scan[];
  activeScanId: string;
};

export function DashboardSidebar({
  scans,
  activeScanId,
}: DashboardSidebarProps) {
  return (
    <aside className="hidden w-64 shrink-0 lg:block">
      <div className="sticky top-20 space-y-5">
        <ScanHistory scans={scans} activeScanId={activeScanId} />
        <UploadCard />
      </div>
    </aside>
  );
}
