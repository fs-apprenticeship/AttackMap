import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Scan } from "@/lib/types";
import { ScanDetailNav } from "./scan-detail-nav";

export type ScanSection =
  | "overview"
  | "attack-surface"
  | "findings"
  | "remediation"
  | "services"
  | "hosts";

const sections: {
  id: ScanSection;
  label: string;
  path: (scanId: string) => string;
}[] = [
  {
    id: "overview",
    label: "Overview",
    path: (scanId) => `/scans/${scanId}`,
  },
  {
    id: "attack-surface",
    label: "Attack surface",
    path: (scanId) => `/scans/${scanId}/attack-surface`,
  },
  {
    id: "findings",
    label: "Findings",
    path: (scanId) => `/scans/${scanId}/findings`,
  },
  {
    id: "remediation",
    label: "Remediation",
    path: (scanId) => `/scans/${scanId}/remediation`,
  },
  {
    id: "services",
    label: "Services",
    path: (scanId) => `/scans/${scanId}/services`,
  },
  {
    id: "hosts",
    label: "Hosts",
    path: (scanId) => `/scans/${scanId}/hosts`,
  },
];

export function ScanNotFound() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        <p className="text-sm font-medium">Scan not found</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          This scan doesn&apos;t exist or belongs to another account.
        </p>
        <Button asChild className="mt-1 rounded-md">
          <Link href="/upload">Upload a scan</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function ScanDetailFrame({
  scan,
  children,
}: {
  scan: Scan;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-5 lg:px-6">
        <div className="mb-5 grid gap-3 sm:grid-cols-[auto_auto] sm:justify-between">
          <Button asChild variant="outline" className="bg-background">
            <Link href="/scans">
              <ArrowLeft className="size-4" />
              All scans
            </Link>
          </Button>
          <Button asChild className="rounded-md">
            <Link href="/upload">
              <Plus className="size-4" />
              New scan
            </Link>
          </Button>
        </div>

        <div className="mb-5 overflow-hidden rounded-md border bg-card text-card-foreground shadow-sm">
          <div className="border-b px-4 py-3">
            <p className="truncate text-sm font-semibold text-foreground">
              {scan.filename}
            </p>
          </div>
          <ScanDetailNav
            sections={sections.map((section) => ({
              id: section.id,
              label: section.label,
              href: section.path(scan.id),
            }))}
          />
        </div>

        {children}
      </div>
    </main>
  );
}
