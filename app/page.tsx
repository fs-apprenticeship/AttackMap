import {
  ArrowDownUp,
  Brain,
  CheckCircle2,
  CircleDot,
  Clock3,
  FileUp,
  Filter,
  Globe2,
  Network,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
} from "lucide-react";

import domainControllerScan from "@/fixtures/scans/domain-controller.json";
import internalPlatformScan from "@/fixtures/scans/internal-platform.json";
import linuxHostScan from "@/fixtures/scans/linux-host.json";
import scanmePublicHostScan from "@/fixtures/scans/scanme-public-host.json";
import simpleWebServerScan from "@/fixtures/scans/simple-web-server.json";
import webServerScan from "@/fixtures/scans/web-server.json";
import { cn } from "@/lib/utils";

type Severity = "critical" | "high" | "medium" | "low" | "info";

type Service = {
  id: string;
  host_id: string;
  port: number;
  protocol: string;
  service_name: string;
  product: string | null;
  version: string | null;
  risk_level: Severity;
};

type Host = {
  id: string;
  scan_id: string;
  ip_address: string;
  hostname: string | null;
  operating_system: string | null;
  role: string;
  internet_exposed: boolean;
  services: Service[];
};

type Finding = {
  id: string;
  scan_id: string;
  severity: Severity;
  title: string;
  evidence: string;
  remediation: string;
};

type RiskSummary = Pick<
  Finding,
  "severity" | "title" | "evidence" | "remediation"
>;

type Scan = {
  id: string;
  filename: string;
  uploaded_at: string;
  parsed_at: string;
  summary: {
    total_hosts: number;
    open_ports: number;
    risky_services: number;
    findings: number;
  };
  hosts: Host[];
  findings: Finding[];
  ai_summary: {
    executive: string;
    top_risks: RiskSummary[];
    remediation: {
      priority: "now" | "next" | "later";
      title: string;
      description: string;
    }[];
  };
};

const scans = [
  domainControllerScan,
  linuxHostScan,
  scanmePublicHostScan,
  webServerScan,
  internalPlatformScan,
  simpleWebServerScan,
] as unknown as Scan[];

const activeScan = scans[0];
const allHosts = scans.flatMap((scan) =>
  scan.hosts.map((host) => ({ ...host, scanFilename: scan.filename })),
);
const allServices = allHosts.flatMap((host) =>
  host.services.map((service) => ({ ...service, host })),
);
const allFindings = scans.flatMap((scan) => scan.findings);
const exposedAssets = allHosts.filter((host) => host.internet_exposed).length;
const riskyServices = allServices.filter((service) =>
  ["critical", "high"].includes(service.risk_level),
).length;
const highFindings = allFindings.filter((finding) =>
  ["critical", "high"].includes(finding.severity),
).length;

const serviceBreakdown = Object.entries(
  allServices.reduce<Record<string, number>>((counts, service) => {
    const key = service.service_name || "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {}),
)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 7);

const severityOrder: Severity[] = ["critical", "high", "medium", "low", "info"];
const severityCounts = severityOrder.map((severity) => ({
  severity,
  count: allFindings.filter((finding) => finding.severity === severity).length,
}));

const riskScore = Math.min(
  100,
  highFindings * 18 +
    allFindings.filter((finding) => finding.severity === "medium").length * 7 +
    riskyServices * 8 +
    exposedAssets * 10,
);

const maxServiceCount = Math.max(...serviceBreakdown.map(([, count]) => count));

const summaryCards = [
  {
    label: "Hosts",
    value: allHosts.length,
    detail: `${exposedAssets} internet exposed`,
    icon: Server,
    tone: "cyan",
  },
  {
    label: "Open ports",
    value: allServices.length,
    detail: `${riskyServices} high-risk services`,
    icon: Network,
    tone: "amber",
  },
  {
    label: "Findings",
    value: allFindings.length,
    detail: `${highFindings} need priority review`,
    icon: ShieldAlert,
    tone: "rose",
  },
  {
    label: "AI risk score",
    value: riskScore,
    detail: "rule-backed preview",
    icon: Brain,
    tone: "emerald",
  },
];

const severityClass: Record<Severity, string> = {
  critical: "border-red-300 bg-red-50 text-red-700",
  high: "border-red-300 bg-red-50 text-red-700",
  medium: "border-amber-300 bg-amber-50 text-amber-700",
  low: "border-emerald-300 bg-emerald-50 text-emerald-700",
  info: "border-sky-300 bg-sky-50 text-sky-700",
};

const nodeClass: Record<Severity, string> = {
  critical: "border-red-400 bg-red-50 text-red-900",
  high: "border-red-400 bg-red-50 text-red-900",
  medium: "border-amber-300 bg-amber-50 text-amber-900",
  low: "border-emerald-300 bg-emerald-50 text-emerald-900",
  info: "border-sky-300 bg-sky-50 text-sky-900",
};

const priorityClass = {
  now: "bg-red-600 text-white",
  next: "bg-amber-500 text-white",
  later: "bg-zinc-700 text-white",
};

function formatRole(role: string) {
  return role.replaceAll("_", " ");
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: (typeof summaryCards)[number]) {
  const toneClass = {
    cyan: "bg-cyan-50 text-cyan-700 border-cyan-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
  }[tone];

  return (
    <section className="rounded-md border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-950">{value}</p>
        </div>
        <div className={cn("rounded-md border p-2", toneClass)}>
          <Icon className="size-5" />
        </div>
      </div>
      <p className="mt-4 text-sm text-zinc-600">{detail}</p>
    </section>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold uppercase",
        severityClass[severity],
      )}
    >
      {severity}
    </span>
  );
}

export default function Home() {
  const activeHost = activeScan.hosts[0];
  const visibleServices = activeHost.services.slice(0, 10);

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-zinc-100 text-zinc-950">
      <div className="mx-auto flex w-full max-w-[1500px] gap-6 px-4 py-5 lg:px-6">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-20 space-y-5">
            <section className="rounded-md border bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-zinc-500">
                  Scan history
                </p>
                <Clock3 className="size-4 text-zinc-400" />
              </div>
              <div className="mt-3 space-y-2">
                {scans.map((scan, index) => (
                  <button
                    key={scan.id}
                    className={cn(
                      "w-full rounded-md border px-3 py-2 text-left transition hover:border-zinc-300 hover:bg-zinc-50",
                      index === 0
                        ? "border-zinc-950 bg-zinc-950 text-white"
                        : "border-zinc-200 bg-white text-zinc-700",
                    )}
                  >
                    <span className="block truncate text-sm font-medium">
                      {scan.filename}
                    </span>
                    <span
                      className={cn(
                        "mt-1 block text-xs",
                        index === 0 ? "text-zinc-300" : "text-zinc-500",
                      )}
                    >
                      {scan.summary.open_ports} ports · {scan.summary.findings} findings
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-md border border-dashed border-zinc-300 bg-white p-4 shadow-sm">
              <div className="flex size-10 items-center justify-center rounded-md bg-zinc-950 text-white">
                <FileUp className="size-5" />
              </div>
              <h2 className="mt-4 text-sm font-semibold">Upload Nmap XML</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                Parse a scan and add it to this workspace.
              </p>
              <button className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-md bg-zinc-950 px-3 text-sm font-medium text-white transition hover:bg-zinc-800">
                Select file
              </button>
            </section>
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-6">
          <section className="flex flex-col justify-between gap-4 rounded-md border bg-white p-5 shadow-sm xl:flex-row xl:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-zinc-950 px-2 py-1 text-xs font-semibold text-white">
                  <CircleDot className="size-3" />
                  Live dashboard preview
                </span>
                <span className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-600">
                  Parsed {formatDate(activeScan.parsed_at)}
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-normal text-zinc-950 sm:text-3xl">
                Attack surface for {activeScan.filename}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
                {activeScan.ai_summary.executive}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative block min-w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                <input
                  className="h-10 w-full rounded-md border bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                  placeholder="Search hosts, ports, services"
                />
              </label>
              <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md border bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50">
                <Filter className="size-4" />
                Filters
              </button>
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <StatCard key={card.label} {...card} />
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]">
            <section className="rounded-md border bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold">Attack surface graph</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {activeHost.hostname ?? activeHost.ip_address} with exposed services
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
                  <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full bg-red-500" />
                    high
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full bg-amber-500" />
                    medium
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    low
                  </span>
                </div>
              </div>

              <div className="grid min-h-[430px] gap-5 bg-[linear-gradient(to_right,#e4e4e7_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e7_1px,transparent_1px)] bg-[size:28px_28px] p-5 lg:grid-cols-[260px_1fr]">
                <div className="flex items-center">
                  <div className="w-full rounded-md border-2 border-zinc-900 bg-zinc-950 p-4 text-white shadow-sm">
                    <div className="flex items-center justify-between">
                      <Server className="size-6" />
                      <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-medium">
                        {activeHost.operating_system}
                      </span>
                    </div>
                    <p className="mt-5 truncate text-lg font-semibold">
                      {activeHost.hostname ?? activeHost.ip_address}
                    </p>
                    <p className="mt-1 text-sm text-zinc-300">{activeHost.ip_address}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-md bg-white/10 px-2 py-1 text-xs">
                        {formatRole(activeHost.role)}
                      </span>
                      <span className="rounded-md bg-white/10 px-2 py-1 text-xs">
                        {activeHost.services.length} services
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid content-center gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleServices.map((service) => (
                    <div
                      key={service.id}
                      className={cn(
                        "rounded-md border p-3 shadow-sm",
                        nodeClass[service.risk_level],
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <TerminalSquare className="mt-0.5 size-4 shrink-0" />
                        <SeverityBadge severity={service.risk_level} />
                      </div>
                      <p className="mt-3 text-sm font-semibold">
                        {service.port}/{service.protocol}
                      </p>
                      <p className="mt-1 truncate text-sm">{service.service_name}</p>
                      <p className="mt-2 line-clamp-2 text-xs opacity-75">
                        {[service.product, service.version].filter(Boolean).join(" ") ||
                          "No product fingerprint"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-md border bg-white shadow-sm">
              <div className="border-b p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-5 text-emerald-600" />
                  <h2 className="text-base font-semibold">AI summary</h2>
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  Prioritized from parsed scan evidence
                </p>
              </div>
              <div className="space-y-4 p-4">
                {activeScan.ai_summary.top_risks.map((risk) => (
                  <article key={risk.title} className="rounded-md border bg-zinc-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold">{risk.title}</h3>
                      <SeverityBadge severity={risk.severity} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">{risk.evidence}</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-800">
                      {risk.remediation}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <section className="rounded-md border bg-white shadow-sm">
              <div className="flex items-center justify-between border-b p-4">
                <div>
                  <h2 className="text-base font-semibold">Service breakdown</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Top detected services across sample scans
                  </p>
                </div>
                <ArrowDownUp className="size-4 text-zinc-400" />
              </div>
              <div className="space-y-4 p-4">
                {serviceBreakdown.map(([service, count]) => (
                  <div key={service}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium">{service}</span>
                      <span className="text-zinc-500">{count}</span>
                    </div>
                    <div className="h-2 rounded-md bg-zinc-100">
                      <div
                        className="h-2 rounded-md bg-cyan-600"
                        style={{ width: `${(count / maxServiceCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-md border bg-white shadow-sm">
              <div className="border-b p-4">
                <h2 className="text-base font-semibold">Risk distribution</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Findings grouped by severity
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 p-4">
                {severityCounts.map(({ severity, count }) => (
                  <div key={severity} className="rounded-md border bg-zinc-50 p-3">
                    <SeverityBadge severity={severity} />
                    <p className="mt-4 text-2xl font-semibold">{count}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="rounded-md border bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold">Host inventory</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Parsed assets with OS, role, exposure, and service risk
                </p>
              </div>
              <button className="inline-flex h-9 items-center justify-center gap-2 rounded-md border bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50">
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Host</th>
                    <th className="px-4 py-3 font-semibold">OS</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Exposure</th>
                    <th className="px-4 py-3 font-semibold">Services</th>
                    <th className="px-4 py-3 font-semibold">Highest risk</th>
                    <th className="px-4 py-3 font-semibold">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {allHosts.map((host) => {
                    const hostSeverity =
                      severityOrder.find((severity) =>
                        host.services.some(
                          (service) => service.risk_level === severity,
                        ),
                      ) ?? "info";

                    return (
                      <tr key={host.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-zinc-950">
                            {host.hostname ?? host.ip_address}
                          </div>
                          <div className="text-zinc-500">{host.ip_address}</div>
                        </td>
                        <td className="px-4 py-3 text-zinc-700">
                          {host.operating_system ?? "Unknown"}
                        </td>
                        <td className="px-4 py-3 capitalize text-zinc-700">
                          {formatRole(host.role)}
                        </td>
                        <td className="px-4 py-3">
                          {host.internet_exposed ? (
                            <span className="inline-flex items-center gap-1 text-red-700">
                              <Globe2 className="size-4" />
                              internet
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-zinc-600">
                              <ShieldCheck className="size-4" />
                              internal
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-700">
                          {host.services.length}
                        </td>
                        <td className="px-4 py-3">
                          <SeverityBadge severity={hostSeverity} />
                        </td>
                        <td className="px-4 py-3 text-zinc-500">
                          {host.scanFilename}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            {activeScan.ai_summary.remediation.map((item) => (
              <article key={item.title} className="rounded-md border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={cn(
                      "rounded-md px-2 py-1 text-xs font-semibold uppercase",
                      priorityClass[item.priority],
                    )}
                  >
                    {item.priority}
                  </span>
                  <CheckCircle2 className="size-4 text-zinc-400" />
                </div>
                <h3 className="mt-4 text-sm font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {item.description}
                </p>
              </article>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}
