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
    <Card className="rounded-md border bg-white shadow-sm">
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        <p className="text-sm font-medium">Scan not found</p>
        <p className="max-w-sm text-sm text-zinc-500">
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
    <main className="min-h-[calc(100vh-4rem)] bg-zinc-100 text-zinc-950">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-5 lg:px-6">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Button
            asChild
            variant="outline"
            className="w-fit rounded-md bg-white"
          >
            <Link href="/scans">
              <ArrowLeft className="size-4" />
              All scans
            </Link>
          </Button>
          <Button asChild className="w-fit rounded-md">
            <Link href="/upload">
              <Plus className="size-4" />
              New scan
            </Link>
          </Button>
        </div>

        <div className="mb-5 overflow-hidden rounded-md border bg-white shadow-sm">
          <div className="border-b px-4 py-3">
            <p className="truncate text-sm font-semibold text-zinc-950">
              {scan.target}
            </p>
            <p className="truncate text-xs text-zinc-500">{scan.filename}</p>
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
