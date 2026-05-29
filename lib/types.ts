// Normalized AttackMap domain model

export type RiskLevel = "critical" | "high" | "medium" | "low" | "info";

export type Severity = RiskLevel;

export interface Service {
  id: string;
  port: number;
  protocol: string; // "tcp" | "udp"
  serviceName: string; // nmap service name, e.g. "ssh", "http"
  product?: string;
  version?: string;
  extrainfo?: string;
  riskLevel: RiskLevel;
}

export interface Host {
  id: string;
  ipAddress: string;
  hostname?: string;
  operatingSystem: string; // derived, e.g. "Linux (Ubuntu)", "Windows Server 2019"
  role: string; // derived, e.g. "Domain Controller", "Web Server"
  internetExposed: boolean;
  services: Service[];
}

export interface Finding {
  id: string;
  hostId?: string; // host the finding relates to (omitted for scan-wide)
  host?: string; // human label (ip / hostname) for display
  severity: Severity;
  title: string;
  evidence: string;
  remediation: string;
}

export interface AISummary {
  executive: string;
  riskScore: number; // 0-100
  riskLevel: RiskLevel;
  topRisks: string[];
  remediation: string[];
  source: "ai" | "rule-based";
}

export interface Scan {
  id: string;
  filename: string;
  target: string; // best-effort label of what was scanned (hostname or ip)
  uploadedAt: string; // ISO
  parsedAt: string; // ISO
  hosts: Host[];
  findings: Finding[];
  summary: AISummary;
}
