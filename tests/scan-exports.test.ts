import { describe, expect, it } from "vitest";

import {
  exportFilename,
  serializeHostInventoryCsv,
  serializeRemediationPlanMarkdown,
} from "@/lib/scans/export";
import type { HostWithScan } from "@/lib/scans/metrics";
import type { RemediationPlan } from "@/lib/types";

describe("host inventory CSV export", () => {
  it("writes displayed columns in deterministic order with CSV escaping", () => {
    const host: HostWithScan = {
      id: "host-1",
      ipAddress: "10.0.0.5",
      hostname: "edge,\n\"proxy\"",
      operatingSystem: "Linux, Ubuntu",
      role: "web_server",
      internetExposed: true,
      services: [
        {
          id: "service-1",
          port: 443,
          protocol: "tcp",
          serviceName: "https",
          cpe: [],
          riskLevel: "high",
        },
        {
          id: "service-2",
          port: 22,
          protocol: "tcp",
          serviceName: "ssh",
          cpe: [],
          riskLevel: "low",
        },
      ],
      scanFilename: "scan \"May\".xml",
    };

    expect(serializeHostInventoryCsv([host])).toBe(
      'Host,IP address,Operating system,Role,Exposure,Service count,Highest risk,Source scan\r\n"edge,\n""proxy""",10.0.0.5,"Linux, Ubuntu",Web Server,internet,2,High,"scan ""May"".xml"',
    );
  });

  it("uses displayed fallbacks and neutralizes spreadsheet formulas", () => {
    const host: HostWithScan = {
      id: "host-2",
      ipAddress: "=1+1",
      operatingSystem: "",
      role: "database_server",
      internetExposed: false,
      services: [],
      scanFilename: "@malicious.xml",
    };

    expect(serializeHostInventoryCsv([host])).toBe(
      "Host,IP address,Operating system,Role,Exposure,Service count,Highest risk,Source scan\r\n'=1+1,'=1+1,,Database Server,internal,0,Info,'@malicious.xml",
    );
  });
});

describe("remediation plan Markdown export", () => {
  it("renders complete and minimal steps into stable readable Markdown", () => {
    const plan: RemediationPlan = {
      source: "ai",
      steps: [
        {
          priority: "now",
          title: "Patch SSH",
          addresses: ["CVE-2024-0001", "Exposed SSH"],
          summary: "Upgrade the affected package.",
          steps: ["Back up config", "Install the update"],
          commands: ["sudo apt update", "sudo apt install openssh-server"],
          verification: "Run `sshd -V`.",
        },
        {
          priority: "later",
          title: "Review access",
          addresses: [],
          summary: "",
          steps: [],
          commands: [],
          verification: "",
        },
      ],
    };

    expect(
      serializeRemediationPlanMarkdown({
        plan,
        target: "edge.example.com",
        scanFilename: "edge-scan.xml",
      }),
    ).toBe(`# Remediation Plan: edge.example.com

- Source scan: edge-scan.xml
- Plan source: AI

## NOW — Patch SSH

**Addresses:** CVE-2024-0001, Exposed SSH

Upgrade the affected package.

### Steps

1. Back up config
2. Install the update

### Commands

\`\`\`sh
sudo apt update
\`\`\`

\`\`\`sh
sudo apt install openssh-server
\`\`\`

### Verification

Run \`sshd -V\`.

## LATER — Review access
`);
  });
});

describe("export filenames", () => {
  it("produces safe scan-derived filenames", () => {
    expect(exportFilename("Quarterly Scan (East).xml", "hosts.csv")).toBe(
      "quarterly-scan-east-hosts.csv",
    );
    expect(exportFilename("...", "remediation-plan.md")).toBe(
      "scan-remediation-plan.md",
    );
  });
});
