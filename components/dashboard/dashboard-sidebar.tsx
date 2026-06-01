import type { Scan } from "@/lib/types";
import { ScanHistory } from "./scan-history";
import { UploadCard } from "./upload-card";

type DashboardSidebarProps = {
  scans: Scan[];
  activeScanId: string;
  onSelectScan: (scanId: string) => void;
};

export function DashboardSidebar({
  scans,
  activeScanId,
  onSelectScan,
}: DashboardSidebarProps) {
  return (
    <aside className="w-full shrink-0 lg:w-64">
      <div className="space-y-5 lg:sticky lg:top-20">
        <ScanHistory
          scans={scans}
          activeScanId={activeScanId}
          onSelectScan={onSelectScan}
        />
        <UploadCard />
      </div>
    </aside>
  );
}
