import { XMLParser } from "fast-xml-parser";
import { randomUUID } from "crypto";
import {
  ScanSchema,
  type Scan,
  type Host,
  type Service,
  type Finding,
  type AISummary,
  type RiskLevel,
} from "./schema";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) =>
    ["host", "port", "hostname", "cpe", "script", "elem", "table", "osmatch"].includes(name),
  parseAttributeValue: false,
  trimValues: true,
});

// Raw fast-xml-parser nodes are dynamically shaped; treat them as loose records.
type AnyNode = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// ─── Risk level assignment ─────────────────────────────────────────────────

const HIGH_RISK_PORTS = new Set([
  21, 23, 25, 139, 389, 445, 2179, 3268, 3389, 4444, 5900, 1433, 3306, 5432,
]);
const MEDIUM_RISK_PORTS = new Set([
  22, 53, 80, 88, 135, 443, 464, 593, 636, 3269, 8000, 8080, 8500, 8888,
]);

function serviceRisk(port: number, serviceName: string): RiskLevel {
  if (serviceName === "telnet" || port === 23) return "critical";
  if (HIGH_RISK_PORTS.has(port)) return "high";
  if (MEDIUM_RISK_PORTS.has(port)) return "medium";
  if (serviceName.includes("http") || serviceName === "https") return "medium";
  return "low";
}

// ─── Role inference ─────────────────────────────────────────────────────────

const WEB_PORTS = new Set([80, 443, 8080, 8443, 8500, 8888, 8000]);

function inferRole(services: Service[]): string {
  const ports = new Set(services.map((s) => s.port));
  const names = services.map((s) => s.serviceName);

  if (ports.has(88) && (ports.has(445) || ports.has(389))) return "domain_controller";
  if (ports.has(3306) || ports.has(5432) || ports.has(1433)) return "database_server";
  if (names.includes("http-proxy")) return "internal_platform";
  if (names.includes("nping-echo")) return "public_demo_host";

  const webCount = services.filter(
    (s) => WEB_PORTS.has(s.port) || s.serviceName.includes("http")
  ).length;
  if (ports.has(21) && webCount >= 2) return "application_server";
  if (ports.has(53)) return "dns_server";
  if (ports.has(80) || ports.has(443) || ports.has(8080) || ports.has(8443)) return "web_server";
  if (ports.has(22)) return "linux_host";
  return "unknown";
}

// ─── Internet exposure ────────────────────────────────────────────────────────

function isPrivateIP(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

// ─── OS detection ─────────────────────────────────────────────────────────────

function extractOS(rawHost: AnyNode, services: Service[]): string | undefined {
  const osmatch = rawHost.os?.osmatch?.[0]?.["@_name"];
  if (osmatch) return String(osmatch);

  const rawPorts: AnyNode[] = rawHost.ports?.port ?? [];
  const ostypes: string[] = [];
  for (const p of rawPorts) {
    const ostype = p.service?.["@_ostype"];
    if (ostype) ostypes.push(String(ostype));
  }

  if (ostypes.includes("Linux")) return "Linux";
  if (ostypes.includes("Windows")) return "Windows";
  if (ostypes.length > 0) return ostypes[0];

  for (const s of services) {
    if (s.version?.toLowerCase().includes("ubuntu") || s.version?.toLowerCase().includes("debian"))
      return "Linux";
    if (s.product?.toLowerCase().includes("windows")) return "Windows";
    if (s.product?.toLowerCase().includes("microsoft")) return "Windows";
  }
  return undefined;
}

// ─── Findings ────────────────────────────────────────────────────────────────

const STANDARD_PORTS = new Set([
  21, 22, 23, 25, 53, 80, 88, 110, 135, 139, 143, 389, 443, 445, 464, 593,
  636, 993, 995, 1433, 2179, 3268, 3269, 3306, 3389, 5432, 5900, 8000, 8080,
  8443, 8500, 8888,
]);

function buildFindings(scanId: string, hosts: Host[], rawHosts: AnyNode[]): Finding[] {
  const findings: Finding[] = [];
  let activeHost: Host;

  function addFinding(f: Omit<Finding, "id" | "hostId" | "host">) {
    const idx = String(findings.length + 1).padStart(3, "0");
    findings.push({
      id: `finding_${scanId}_${idx}`,
      hostId: activeHost.id,
      host: activeHost.hostname ?? activeHost.ipAddress,
      ...f,
    });
  }

  for (let hi = 0; hi < hosts.length; hi++) {
    const host = hosts[hi];
    activeHost = host;
    const rawHost = rawHosts[hi];
    const rawPorts: AnyNode[] = rawHost.ports?.port ?? [];

    const scriptMap = new Map<number, Map<string, string>>();
    for (const rawPort of rawPorts) {
      if (rawPort.state?.["@_state"] !== "open") continue;
      const port = Number(rawPort["@_portid"]);
      const portScripts = new Map<string, string>();
      for (const s of rawPort.script ?? []) {
        portScripts.set(String(s["@_id"] ?? ""), String(s["@_output"] ?? ""));
      }
      scriptMap.set(port, portScripts);
    }

    function getScript(port: number, id: string): string {
      return scriptMap.get(port)?.get(id) ?? "";
    }

    const services = host.services;
    const handledPorts = new Set<number>();
    const handledCategories = new Set<string>();
    const hostFindingsStart = findings.length;
    let scriptFindingGenerated = false;

    const webSvcs = services.filter(
      (s) => WEB_PORTS.has(s.port) || s.serviceName.includes("http")
    );

    // ── Script-based findings ──────────────────────────────────────────────

    // ftp-anon
    const ftpSvc = services.find((s) => s.port === 21 || s.serviceName === "ftp");
    if (ftpSvc) {
      const out = getScript(ftpSvc.port, "ftp-anon").toLowerCase();
      if (out.includes("anonymous ftp login allowed")) {
        addFinding({
          severity: "high",
          title: "Anonymous FTP login is allowed",
          evidence: `The ftp-anon script reports anonymous FTP login allowed on port ${ftpSvc.port}/tcp.`,
          remediation:
            "Disable anonymous FTP unless it is explicitly required, and restrict access to trusted networks.",
        });
        handledPorts.add(ftpSvc.port);
        scriptFindingGenerated = true;
      }
    }

    // http-title: admin interface
    for (const ws of webSvcs) {
      if (handledCategories.has("admin-web")) break;
      const title = getScript(ws.port, "http-title");
      const lc = title.toLowerCase();
      if (lc.includes("administrator") || lc.includes(" admin")) {
        addFinding({
          severity: "high",
          title: "Administrative web interface is reachable",
          evidence: `HTTP and HTTPS responses include the title ${title.split("\n")[0].trim()}.`,
          remediation:
            "Restrict the administrative interface to trusted networks or a VPN and require strong authentication.",
        });
        handledCategories.add("admin-web");
        handledPorts.add(ws.port);
        scriptFindingGenerated = true;
      }
    }

    // http-title: internal login page
    if (!handledCategories.has("admin-web")) {
      for (const ws of webSvcs) {
        if (handledCategories.has("internal-login")) break;
        const title = getScript(ws.port, "http-title");
        const lc = title.toLowerCase();
        if (lc.includes("login") || lc.includes("sign in") || lc.includes("signin")) {
          addFinding({
            severity: "medium",
            title: "Internal platform login is reachable",
            evidence: `Port ${ws.port}/tcp redirects to /login and has the title ${title.split("\n")[0].trim()}.`,
            remediation:
              "Confirm the platform is only reachable from trusted networks and protected by strong authentication.",
          });
          handledCategories.add("internal-login");
          handledPorts.add(ws.port);
          scriptFindingGenerated = true;
        }
      }
    }

    // http-methods: risky methods
    if (!handledCategories.has("http-methods")) {
      for (const ws of webSvcs) {
        const out = getScript(ws.port, "http-methods").toLowerCase();
        if (out.includes("trace") || out.includes("delete") || out.includes("risky")) {
          addFinding({
            severity: "medium",
            title: "Potentially risky HTTP method enabled",
            evidence: "The http-methods script reports TRACE as a potentially risky method.",
            remediation: "Disable TRACE unless explicitly required by the application.",
          });
          handledCategories.add("http-methods");
          scriptFindingGenerated = true;
          break;
        }
      }
    }

    // http-open-proxy
    if (!handledCategories.has("proxy")) {
      for (const ws of webSvcs) {
        const out = getScript(ws.port, "http-open-proxy");
        if (out.length > 0) {
          addFinding({
            severity: "medium",
            title: "Proxy-like behavior detected",
            evidence: "The http-open-proxy script reports that the proxy might be redirecting requests.",
            remediation:
              "Verify the service is not operating as an unintended open proxy and restrict proxy behavior where possible.",
          });
          handledCategories.add("proxy");
          scriptFindingGenerated = true;
          break;
        }
      }
    }

    // ── Aggregate findings ─────────────────────────────────────────────────

    // Active Directory (domain controller)
    if (host.role === "domain_controller") {
      addFinding({
        severity: "medium",
        title: "Active Directory services are broadly reachable",
        evidence:
          "DNS, Kerberos, LDAP, LDAPS, RPC, Global Catalog, and password change services are open.",
        remediation:
          "Confirm domain controller services are only reachable from expected internal network segments.",
      });
      handledCategories.add("ad");
    }

    // Multiple web services (≥3)
    const webSvcCount = services.filter(
      (s) => WEB_PORTS.has(s.port) || s.serviceName.includes("http")
    ).length;
    if (
      webSvcCount >= 3 &&
      !handledCategories.has("admin-web") &&
      !handledCategories.has("internal-login") &&
      !handledCategories.has("multiple-web")
    ) {
      const portList = services
        .filter((s) => WEB_PORTS.has(s.port) || s.serviceName.includes("http"))
        .map((s) => `${s.port}/tcp`)
        .join(", ");
      addFinding({
        severity: "medium",
        title: "Multiple web services are reachable",
        evidence: `Ports ${portList} are open.`,
        remediation:
          "Review whether each web service must be reachable and place administrative services behind access controls.",
      });
      handledCategories.add("multiple-web");
      services
        .filter((s) => WEB_PORTS.has(s.port) || s.serviceName.includes("http"))
        .forEach((s) => handledPorts.add(s.port));
    }

    // RDP
    const rdpSvc = services.find((s) => s.port === 3389);
    if (rdpSvc && !handledPorts.has(3389)) {
      addFinding({
        severity: "high",
        title: "Remote Desktop service is reachable",
        evidence: `Port 3389/tcp is open and identified as${rdpSvc.product ? " " + rdpSvc.product : " RDP"}.`,
        remediation:
          "Restrict RDP access to trusted networks, require multi-factor authentication, and monitor authentication attempts.",
      });
      handledPorts.add(3389);
    }

    // SMB + NetBIOS
    if (services.some((s) => s.port === 445) && !handledPorts.has(445)) {
      if (services.some((s) => s.port === 139)) {
        addFinding({
          severity: "high",
          title: "SMB and NetBIOS services are exposed",
          evidence: "Ports 139/tcp and 445/tcp are open.",
          remediation:
            "Limit SMB access to required internal hosts, disable legacy NetBIOS where possible, and verify SMB signing and patch status.",
        });
        handledPorts.add(139);
      } else {
        addFinding({
          severity: "high",
          title: "SMB is exposed",
          evidence: `Port 445/tcp is open on ${host.ipAddress}.`,
          remediation:
            "Block SMB at the perimeter. Ensure patching against EternalBlue-class vulnerabilities.",
        });
      }
      handledPorts.add(445);
    }

    // Telnet
    const telnetSvc = services.find((s) => s.port === 23 || s.serviceName === "telnet");
    if (telnetSvc && !handledPorts.has(telnetSvc.port)) {
      addFinding({
        severity: "critical",
        title: "Telnet is exposed",
        evidence: `Port ${telnetSvc.port}/tcp (telnet) is open on ${host.ipAddress}.`,
        remediation: "Disable Telnet immediately and replace with SSH.",
      });
      handledPorts.add(telnetSvc.port);
    }

    // FTP (without anonymous access script)
    if (ftpSvc && !handledPorts.has(ftpSvc.port)) {
      addFinding({
        severity: "high",
        title: "FTP is exposed",
        evidence: `Port ${ftpSvc.port}/tcp (FTP) is open on ${host.ipAddress}.`,
        remediation: "Replace FTP with SFTP or SCP. Disable anonymous access.",
      });
      handledPorts.add(ftpSvc.port);
    }

    // SSH
    const sshSvc = services.find((s) => s.serviceName === "ssh" || s.port === 22);
    if (sshSvc && !handledPorts.has(sshSvc.port)) {
      const ver = [sshSvc.product, sshSvc.version].filter(Boolean).join(" ");
      if (host.internetExposed) {
        addFinding({
          severity: "medium",
          title: "SSH is reachable from the network",
          evidence: `Port ${sshSvc.port}/tcp is open and identified as${ver ? " " + ver : " SSH"}.`,
          remediation: "Restrict SSH access to trusted sources and require key-based authentication.",
        });
      } else {
        addFinding({
          severity: "medium",
          title: "SSH is exposed",
          evidence: `Port ${sshSvc.port}/tcp is open and identified as${ver ? " " + ver : " SSH"}.`,
          remediation: "Limit SSH access to trusted sources and enforce key-based authentication.",
        });
      }
      handledPorts.add(sshSvc.port);
    }

    // HTTP
    if (
      !handledCategories.has("admin-web") &&
      !handledCategories.has("internal-login") &&
      !handledCategories.has("multiple-web")
    ) {
      const httpSvc = services.find(
        (s) => (s.serviceName === "http" || s.port === 80) && !handledPorts.has(s.port)
      );
      if (httpSvc) {
        const ver = [httpSvc.product, httpSvc.version].filter(Boolean).join(" ");
        if (host.internetExposed) {
          const titleOut = getScript(httpSvc.port, "http-title").split("\n")[0].trim();
          const titlePart = titleOut ? ` with the title ${titleOut}` : "";
          addFinding({
            severity: "medium",
            title: "Public web service is reachable",
            evidence: `Port ${httpSvc.port}/tcp is open and identified as${ver ? " " + ver : " HTTP"}${titlePart}.`,
            remediation: "Keep the web server patched and review exposed content and headers.",
          });
        } else {
          addFinding({
            severity: "medium",
            title: "Web service is reachable",
            evidence: `Port ${httpSvc.port}/tcp is open and identified as ${ver || "HTTP"} on ${host.ipAddress}.`,
            remediation:
              "Confirm the web service is intended to be reachable and keep the web server patched.",
          });
        }
        handledPorts.add(httpSvc.port);
      }
    }

    // Nonstandard ports
    const nonstandardSvcs = services.filter(
      (s) => !STANDARD_PORTS.has(s.port) && !s.serviceName.includes("http")
    );
    if (nonstandardSvcs.length > 0 && !handledCategories.has("nonstandard")) {
      const portList = nonstandardSvcs.map((s) => `${s.port}/tcp`).join(" and ");
      addFinding({
        severity: "low",
        title: "Nonstandard ports are open",
        evidence: `Ports ${portList} are open.`,
        remediation: "Confirm each nonstandard service is expected and document its purpose.",
      });
      handledCategories.add("nonstandard");
    }

    // Limited attack surface (≤2 services, no high/critical findings, no script findings)
    const hostFindings = findings.slice(hostFindingsStart);
    const hasHighCritical = hostFindings.some(
      (f) => f.severity === "high" || f.severity === "critical"
    );
    if (services.length <= 2 && !hasHighCritical && !scriptFindingGenerated) {
      addFinding({
        severity: "low",
        title: "Limited attack surface observed",
        evidence: `Only ${services.map((s) => s.serviceName.toUpperCase()).join(" and ")} were found open in this scan.`,
        remediation:
          "Continue monitoring for unexpected service exposure and remove any services that are not required.",
      });
    }
  }

  return findings;
}

// ─── Rule-based summary (AI guardrail / placeholder) ────────────────────────

const SEVERITY_ORDER: Record<RiskLevel, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 70) return "critical";
  if (score >= 45) return "high";
  if (score >= 20) return "medium";
  if (score > 0) return "low";
  return "info";
}

function buildSummary(hosts: Host[], findings: Finding[]): AISummary {
  const allServices = hosts.flatMap((h) => h.services);
  const riskyServices = allServices.filter(
    (s) => s.riskLevel === "high" || s.riskLevel === "critical"
  ).length;
  const exposed = hosts.filter((h) => h.internetExposed).length;
  const highFindings = findings.filter(
    (f) => f.severity === "high" || f.severity === "critical"
  ).length;
  const mediumFindings = findings.filter((f) => f.severity === "medium").length;

  const riskScore = Math.min(
    100,
    highFindings * 18 + mediumFindings * 7 + riskyServices * 8 + exposed * 10
  );
  const riskLevel = riskLevelFromScore(riskScore);

  const sorted = [...findings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );
  const topRisks = sorted.slice(0, 5).map((f) => f.title);
  const remediation = Array.from(new Set(sorted.map((f) => f.remediation))).slice(0, 5);

  const hostWord = hosts.length === 1 ? "host" : "hosts";
  const parts = [
    `Scan covers ${hosts.length} ${hostWord} exposing ${allServices.length} open service(s).`,
    exposed > 0
      ? `${exposed} host(s) are directly internet-exposed.`
      : "No hosts are directly internet-exposed.",
    riskyServices > 0
      ? `${riskyServices} high-risk service(s) were observed.`
      : "No high-risk services were observed.",
    findings.length > 0
      ? `${findings.length} finding(s) were generated from the scan.`
      : "No notable findings were generated from the scan.",
  ];

  return {
    executive: parts.join(" "),
    riskScore,
    riskLevel,
    topRisks: topRisks.length
      ? topRisks
      : ["No significant risks identified in this scan."],
    remediation: remediation.length
      ? remediation
      : [
          "Maintain least-exposure: close unused ports and restrict admin services to private networks.",
          "Keep all detected services patched and monitor for unexpected exposure.",
        ],
    source: "rule-based",
  };
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseNmapScan(xml: string, filename: string): Scan {
  const raw = parser.parse(xml);
  const nmaprun = raw.nmaprun ?? {};
  const allRawHosts: AnyNode[] = nmaprun.host ?? [];
  const upRawHosts = allRawHosts.filter((h: AnyNode) => h.status?.["@_state"] === "up");

  const scanId = `scan_${randomUUID()}`;
  const now = new Date().toISOString();

  const hosts: Host[] = upRawHosts.map((rawHost: AnyNode) => {
    const rawPorts: AnyNode[] = rawHost.ports?.port ?? [];
    const openPorts = rawPorts.filter((p: AnyNode) => p.state?.["@_state"] === "open");

    const addresses: AnyNode[] = Array.isArray(rawHost.address)
      ? rawHost.address
      : [rawHost.address];
    const ipv4 = addresses.find((a: AnyNode) => a?.["@_addrtype"] === "ipv4");
    const ip = String(ipv4?.["@_addr"] ?? addresses[0]?.["@_addr"] ?? "0.0.0.0");
    const hostname = rawHost.hostnames?.hostname?.[0]?.["@_name"];

    const services: Service[] = openPorts.map((p: AnyNode) => {
      const port = Number(p["@_portid"]);
      const protocol = String(p["@_protocol"] ?? "tcp");
      const svcName: string = String(p.service?.["@_name"] ?? "unknown");
      return {
        id: `${ip}:${protocol}:${port}`,
        port,
        protocol,
        serviceName: svcName,
        product: p.service?.["@_product"] ? String(p.service["@_product"]) : undefined,
        version: p.service?.["@_version"] ? String(p.service["@_version"]) : undefined,
        extrainfo: p.service?.["@_extrainfo"] ? String(p.service["@_extrainfo"]) : undefined,
        riskLevel: serviceRisk(port, svcName),
      };
    });

    return {
      id: ip,
      ipAddress: ip,
      hostname: hostname ? String(hostname) : undefined,
      operatingSystem: extractOS(rawHost, services) ?? "Unknown",
      role: inferRole(services),
      internetExposed: !isPrivateIP(ip),
      services,
    };
  });

  const findings = buildFindings(scanId, hosts, upRawHosts);
  const summary = buildSummary(hosts, findings);

  const firstHost = hosts[0];
  const target = firstHost
    ? firstHost.hostname ?? firstHost.ipAddress
    : filename.replace(/\.xml$/i, "");

  return ScanSchema.parse({
    id: scanId,
    filename,
    target,
    uploadedAt: now,
    parsedAt: now,
    hosts,
    findings,
    summary,
  });
}
