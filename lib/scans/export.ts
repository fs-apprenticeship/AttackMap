import type { HostWithScan } from "@/lib/scans/metrics";
import { severityOrder } from "@/lib/scans/severity";
import type { RemediationPlan, Severity } from "@/lib/types";

const csvHeaders = [
  "Host",
  "IP address",
  "Operating system",
  "Role",
  "Exposure",
  "Service count",
  "Highest risk",
  "Source scan",
] as const;

function displayLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function csvCell(value: string | number) {
  let text = String(value);

  if (/^[\t\r ]*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function highestHostRisk(host: HostWithScan): Severity {
  return (
    severityOrder.find((severity) =>
      host.services.some((service) => service.riskLevel === severity),
    ) ?? "info"
  );
}

export function serializeHostInventoryCsv(hosts: HostWithScan[]) {
  const rows = hosts.map((host) => [
    host.hostname || host.ipAddress,
    host.ipAddress,
    host.operatingSystem || "Unknown",
    displayLabel(host.role),
    host.internetExposed ? "internet" : "internal",
    host.services.length,
    displayLabel(highestHostRisk(host)),
    host.scanFilename,
  ]);

  return [csvHeaders, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}

function inlineText(value: string, fallback: string) {
  return value.replace(/\s+/g, " ").trim() || fallback;
}

function codeFence(command: string) {
  const longestFence = Math.max(
    0,
    ...Array.from(command.matchAll(/`+/g), (match) => match[0].length),
  );
  const fence = "`".repeat(Math.max(3, longestFence + 1));
  return `${fence}sh\n${command}\n${fence}`;
}

export function serializeRemediationPlanMarkdown({
  plan,
  target,
  scanFilename,
}: {
  plan: RemediationPlan;
  target: string;
  scanFilename: string;
}) {
  const sections = [
    `# Remediation Plan: ${inlineText(target, "Unknown target")}`,
    `- Source scan: ${inlineText(scanFilename, "Unknown scan")}\n- Plan source: ${
      plan.source === "ai" ? "AI" : "Rule-based"
    }`,
  ];

  for (const step of plan.steps) {
    const stepSections = [
      `## ${step.priority.toUpperCase()} — ${inlineText(step.title, "Untitled action")}`,
    ];

    if (step.addresses.length > 0) {
      stepSections.push(`**Addresses:** ${step.addresses.join(", ")}`);
    }
    if (step.summary.trim()) stepSections.push(step.summary.trim());
    if (step.steps.length > 0) {
      stepSections.push(
        `### Steps\n\n${step.steps.map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
      );
    }
    if (step.commands.length > 0) {
      stepSections.push(
        `### Commands\n\n${step.commands.map(codeFence).join("\n\n")}`,
      );
    }
    if (step.verification.trim()) {
      stepSections.push(`### Verification\n\n${step.verification.trim()}`);
    }

    sections.push(stepSections.join("\n\n"));
  }

  return `${sections.join("\n\n")}\n`;
}

export function exportFilename(scanFilename: string, suffix: string) {
  const basename = scanFilename.replace(/\.[^.]+$/, "");
  const safeBasename = basename
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${safeBasename || "scan"}-${suffix}`;
}
