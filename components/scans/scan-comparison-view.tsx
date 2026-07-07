"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRightLeft,
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
} from "lucide-react";

import { SeverityBadge } from "@/components/dashboard/severity-badge";
import { formatDate } from "@/components/dashboard/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  ChangedService,
  ComparisonFinding,
  ComparisonHost,
  ComparisonService,
  ScanComparison,
} from "@/lib/scans/comparison-schema";
import type { Scan } from "@/lib/types";

type ScanComparisonViewProps = {
  scans: Scan[];
  initialBaseScanId?: string;
  initialComparisonScanId?: string;
};

type CompareResponse =
  | { comparison: ScanComparison; error?: never }
  | { error: string; comparison?: never };

const selectTriggerClass =
  "h-11 w-full rounded-md border-zinc-200 bg-zinc-50 text-left shadow-none hover:bg-white data-[size=default]:h-11";

export function ScanComparisonView({
  scans,
  initialBaseScanId,
  initialComparisonScanId,
}: ScanComparisonViewProps) {
  const sortedScans = useMemo(
    () =>
      [...scans].sort(
        (a, b) => new Date(b.parsedAt).getTime() - new Date(a.parsedAt).getTime(),
      ),
    [scans],
  );
  const fallbackBase = sortedScans[0]?.id ?? "";
  const fallbackComparison =
    sortedScans.find((scan) => scan.id !== fallbackBase)?.id ?? "";
  const [baseScanId, setBaseScanId] = useState(
    scanExists(sortedScans, initialBaseScanId) ? initialBaseScanId! : fallbackBase,
  );
  const [comparisonScanId, setComparisonScanId] = useState(
    scanExists(sortedScans, initialComparisonScanId)
      ? initialComparisonScanId!
      : fallbackComparison,
  );
  const [comparison, setComparison] = useState<ScanComparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  const baseScan = sortedScans.find((scan) => scan.id === baseScanId);
  const comparisonScan = sortedScans.find((scan) => scan.id === comparisonScanId);
  const canCompare = baseScanId.length > 0 && comparisonScanId.length > 0;
  const sameScanSelected = canCompare && baseScanId === comparisonScanId;

  async function handleCompare() {
    setError(null);

    if (sameScanSelected) {
      setError("Choose two different scans to compare.");
      return;
    }

    if (!canCompare) {
      setError("Choose a base scan and a comparison scan.");
      return;
    }

    setIsComparing(true);
    try {
      const response = await fetch("/api/scan/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseScanId, comparisonScanId }),
      });
      const payload = (await response.json()) as CompareResponse;

      if (!response.ok || "error" in payload) {
        setComparison(null);
        setError(payload.error ?? "Unable to compare these scans.");
        return;
      }

      setComparison(payload.comparison);
    } catch {
      setComparison(null);
      setError("Unable to reach the comparison service.");
    } finally {
      setIsComparing(false);
    }
  }

  if (sortedScans.length < 2) {
    return (
      <Card className="rounded-md border-dashed bg-white shadow-sm">
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <div className="flex size-10 items-center justify-center rounded-md bg-zinc-950 text-white">
            <ArrowRightLeft className="size-5" />
          </div>
          <p className="text-sm font-medium">Two scans are needed</p>
          <p className="max-w-sm text-sm text-zinc-500">
            Upload another Nmap XML scan before comparing changes over time.
          </p>
          <Button asChild className="mt-1 rounded-md">
            <Link href="/upload">Upload a scan</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="rounded-md border bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowRightLeft className="size-4 text-zinc-500" />
            Select scans
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-end">
            <ScanSelect
              label="Base scan"
              value={baseScanId}
              scans={sortedScans}
              onValueChange={setBaseScanId}
            />
            <div className="hidden pb-3 text-zinc-400 lg:block">
              <ArrowDown className="size-5 -rotate-90" aria-hidden="true" />
            </div>
            <ScanSelect
              label="Compare against"
              value={comparisonScanId}
              scans={sortedScans}
              onValueChange={setComparisonScanId}
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-zinc-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-zinc-600">
              {baseScan && comparisonScan ? (
                <>
                  Comparing <span className="font-medium text-zinc-800">{baseScan.target}</span>{" "}
                  to{" "}
                  <span className="font-medium text-zinc-800">
                    {comparisonScan.target}
                  </span>
                </>
              ) : (
                "Choose two saved scans."
              )}
            </div>
            <Button
              type="button"
              className="rounded-md"
              disabled={isComparing}
              onClick={handleCompare}
            >
              {isComparing ? <Loader2 className="size-4 animate-spin" /> : null}
              Compare scans
            </Button>
          </div>

          {sameScanSelected ? (
            <InlineNotice tone="warning" message="Choose two different scans." />
          ) : null}
          {error ? <InlineNotice tone="warning" message={error} /> : null}
        </CardContent>
      </Card>

      {comparison ? <ComparisonResults comparison={comparison} /> : null}
    </div>
  );
}

function ScanSelect({
  label,
  value,
  scans,
  onValueChange,
}: {
  label: string;
  value: string;
  scans: Scan[];
  onValueChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={selectTriggerClass}>
          <SelectValue placeholder="Choose a scan" />
        </SelectTrigger>
        <SelectContent>
          {scans.map((scan) => (
            <SelectItem key={scan.id} value={scan.id}>
              {scan.filename} - {scan.target} - {formatDate(scan.parsedAt)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function ComparisonResults({ comparison }: { comparison: ScanComparison }) {
  const totalChanges =
    comparison.newHosts.length +
    comparison.removedHosts.length +
    comparison.newServices.length +
    comparison.removedServices.length +
    comparison.changedServices.length +
    comparison.newFindings.length +
    comparison.resolvedFindings.length;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Risk before" value={comparison.riskBefore} />
        <MetricCard label="Risk after" value={comparison.riskAfter} />
        <MetricCard
          label="Risk delta"
          value={`${comparison.riskDelta > 0 ? "+" : ""}${comparison.riskDelta}`}
          tone={comparison.riskDelta > 0 ? "warning" : comparison.riskDelta < 0 ? "good" : "neutral"}
        />
        <MetricCard label="Total changes" value={totalChanges} />
      </div>

      <Card className="rounded-md border bg-white shadow-sm">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-zinc-700">Highest severity</span>
            <SeverityBadge severity={comparison.highestSeverityBefore} />
            <ArrowDown className="size-4 -rotate-90 text-zinc-400" />
            <SeverityBadge severity={comparison.highestSeverityAfter} />
          </div>
          {comparison.warnings.length > 0 ? (
            <div className="space-y-2">
              {comparison.warnings.map((warning) => (
                <InlineNotice key={warning.code} tone="warning" message={warning.message} />
              ))}
            </div>
          ) : (
            <InlineNotice tone="success" message="The scan scopes look comparable." />
          )}
        </CardContent>
      </Card>

      <HostsSection
        title="Host changes"
        added={comparison.newHosts}
        removed={comparison.removedHosts}
      />
      <ServicesSection
        title="Service changes"
        added={comparison.newServices}
        removed={comparison.removedServices}
        changed={comparison.changedServices}
      />
      <FindingsSection
        title="Finding changes"
        added={comparison.newFindings}
        removed={comparison.resolvedFindings}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  tone?: "neutral" | "good" | "warning";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-700"
      : tone === "warning"
        ? "text-red-700"
        : "text-zinc-950";

  return (
    <div className="rounded-md border bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function HostsSection({
  title,
  added,
  removed,
}: {
  title: string;
  added: ComparisonHost[];
  removed: ComparisonHost[];
}) {
  const rows = [
    ...added.map((host) => ({ type: "new" as const, host })),
    ...removed.map((host) => ({ type: "removed" as const, host })),
  ];

  return (
    <ComparisonSection title={title} emptyMessage="No host additions or removals.">
      {rows.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Change</TableHead>
              <TableHead>Host</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Services</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ type, host }) => (
              <TableRow key={`${type}-${host.id}`}>
                <TableCell>
                  <ChangeBadge type={type} />
                </TableCell>
                <TableCell>
                  <div className="font-medium text-zinc-900">{host.ipAddress}</div>
                  <div className="text-xs text-zinc-500">
                    {host.hostname ?? host.operatingSystem}
                  </div>
                </TableCell>
                <TableCell>{host.role}</TableCell>
                <TableCell className="text-right">{host.serviceCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </ComparisonSection>
  );
}

function ServicesSection({
  title,
  added,
  removed,
  changed,
}: {
  title: string;
  added: ComparisonService[];
  removed: ComparisonService[];
  changed: ChangedService[];
}) {
  const rows = [
    ...added.map((service) => ({ type: "new" as const, service })),
    ...removed.map((service) => ({ type: "removed" as const, service })),
  ];

  return (
    <ComparisonSection title={title} emptyMessage="No service changes.">
      {rows.length > 0 || changed.length > 0 ? (
        <div className="space-y-4">
          {rows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Change</TableHead>
                  <TableHead>Host</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ type, service }) => (
                  <TableRow
                    key={`${type}-${service.hostId}-${service.protocol}-${service.port}`}
                  >
                    <TableCell>
                      <ChangeBadge type={type} />
                    </TableCell>
                    <TableCell>{service.hostLabel}</TableCell>
                    <TableCell>
                      {service.port}/{service.protocol} {service.serviceName}
                      <div className="text-xs text-zinc-500">
                        {formatProduct(service)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <SeverityBadge severity={service.riskLevel} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}

          {changed.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Changed service</TableHead>
                  <TableHead>Before</TableHead>
                  <TableHead>After</TableHead>
                  <TableHead>Fields</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changed.map((service) => (
                  <TableRow
                    key={`${service.hostId}-${service.protocol}-${service.port}`}
                  >
                    <TableCell>
                      <div className="font-medium text-zinc-900">
                        {service.hostLabel}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {service.port}/{service.protocol}
                      </div>
                    </TableCell>
                    <TableCell>{formatServiceSummary(service.before)}</TableCell>
                    <TableCell>{formatServiceSummary(service.after)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {service.changedFields.map((field) => (
                          <Badge
                            key={field}
                            variant="outline"
                            className="rounded-md border-zinc-200 bg-zinc-50"
                          >
                            {field}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </div>
      ) : null}
    </ComparisonSection>
  );
}

function FindingsSection({
  title,
  added,
  removed,
}: {
  title: string;
  added: ComparisonFinding[];
  removed: ComparisonFinding[];
}) {
  const rows = [
    ...added.map((finding) => ({ type: "new" as const, finding })),
    ...removed.map((finding) => ({ type: "resolved" as const, finding })),
  ];

  return (
    <ComparisonSection title={title} emptyMessage="No new or resolved findings.">
      {rows.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Change</TableHead>
              <TableHead>Finding</TableHead>
              <TableHead>Host</TableHead>
              <TableHead>Severity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ type, finding }) => (
              <TableRow key={`${type}-${finding.id}`}>
                <TableCell>
                  <ChangeBadge type={type} />
                </TableCell>
                <TableCell>
                  <div className="max-w-md whitespace-normal font-medium text-zinc-900">
                    {finding.title}
                  </div>
                  <div className="mt-1 max-w-lg whitespace-normal text-xs text-zinc-500">
                    {finding.evidence}
                  </div>
                </TableCell>
                <TableCell>{finding.host ?? finding.hostId ?? "Unknown"}</TableCell>
                <TableCell>
                  <SeverityBadge severity={finding.severity} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </ComparisonSection>
  );
}

function ComparisonSection({
  title,
  emptyMessage,
  children,
}: {
  title: string;
  emptyMessage: string;
  children: ReactNode;
}) {
  const hasChildren = Boolean(children);

  return (
    <Card className="rounded-md border bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {hasChildren ? (
          children
        ) : (
          <div className="rounded-md border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500">
            {emptyMessage}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChangeBadge({ type }: { type: "new" | "removed" | "resolved" }) {
  const className =
    type === "new"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : type === "resolved"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : "border-zinc-200 bg-zinc-50 text-zinc-600";
  const Icon = type === "new" ? Plus : type === "resolved" ? CheckCircle2 : Minus;

  return (
    <Badge variant="outline" className={`rounded-md ${className}`}>
      <Icon className="size-3" />
      {type}
    </Badge>
  );
}

function InlineNotice({
  tone,
  message,
}: {
  tone: "success" | "warning";
  message: string;
}) {
  const Icon = tone === "success" ? CheckCircle2 : AlertTriangle;
  const className =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <div className={`flex items-start gap-2 rounded-md border p-3 text-sm ${className}`}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function scanExists(scans: Scan[], id?: string) {
  return Boolean(id && scans.some((scan) => scan.id === id));
}

function formatProduct(service: ComparisonService) {
  return [service.product, service.version].filter(Boolean).join(" ") || "No product details";
}

function formatServiceSummary(service: ComparisonService) {
  return `${service.serviceName} (${formatProduct(service)}, ${service.riskLevel})`;
}
