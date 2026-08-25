// Populates the dev DB with scans for local development and the e2e suite.
// Standalone script (its own PrismaClient, no `@/` aliases, no imports from
// lib/scans/store.ts): everything under lib/ is guarded by `import
// "server-only"`, which throws unconditionally outside a bundler's
// "react-server" condition — including under a plain tsx/node run. Row
// shapes below intentionally mirror store.ts's buildScanRows/scopeId so
// seeded data round-trips through the app identically to a real upload.
import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../lib/generated/prisma/client";

loadEnv({ path: path.resolve(__dirname, "../.env") });
loadEnv({ path: path.resolve(__dirname, "../.env.local"), override: true });

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

if (!process.env.E2E_CLERK_USER_ID) {
  throw new Error(
    "E2E_CLERK_USER_ID is not set. Run `npx tsx scripts/resolve-e2e-user.ts` first.",
  );
}
// Re-bound to a non-optional const: TS narrows process.env.E2E_CLERK_USER_ID
// to `string` at the guard above, but that narrowing doesn't survive into
// the functions below that close over it.
const SEED_USER_ID: string = process.env.E2E_CLERK_USER_ID;
const SEED_USER_EMAIL = process.env.E2E_CLERK_USER_EMAIL ?? "seed@attackmap.dev";

// ─── Minimal Scan shape this script needs — a subset of lib/nmap/schema's
// Scan, just the fields that turn into DB rows. ─────────────────────────────

type SeedService = {
  id: string;
  port: number;
  protocol: "tcp" | "udp";
  serviceName: string;
  product?: string;
  version?: string;
  extrainfo?: string;
  cpe?: string[];
  riskLevel: "critical" | "high" | "medium" | "low" | "info";
};

type SeedHost = {
  id: string;
  ipAddress: string;
  hostname?: string;
  operatingSystem: string;
  role: string;
  internetExposed: boolean;
  services: SeedService[];
};

type SeedFinding = {
  id: string;
  hostId?: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  evidence: string;
  remediation: string;
};

type SeedScan = {
  id: string;
  filename: string;
  target: string;
  uploadedAt: string;
  scannedAt?: string;
  hosts: SeedHost[];
  findings: SeedFinding[];
};

const SCOPE_SEP = "::";
const scopeId = (scanId: string, id: string) => `${scanId}${SCOPE_SEP}${id}`;

async function saveSeedScan(scan: SeedScan): Promise<void> {
  const hostRows = scan.hosts.map((h) => ({
    id: scopeId(scan.id, h.id),
    scanId: scan.id,
    ipAddress: h.ipAddress,
    hostname: h.hostname ?? null,
    operatingSystem: h.operatingSystem,
    role: h.role,
    internetExposed: h.internetExposed,
  }));

  const serviceRows = scan.hosts.flatMap((h) =>
    h.services.map((s) => ({
      id: scopeId(scan.id, s.id),
      hostId: scopeId(scan.id, h.id),
      port: s.port,
      protocol: s.protocol as Prisma.ServiceCreateManyInput["protocol"],
      serviceName: s.serviceName,
      product: s.product ?? null,
      version: s.version ?? null,
      extrainfo: s.extrainfo ?? null,
      cpe: s.cpe ?? [],
      riskLevel: s.riskLevel as Prisma.ServiceCreateManyInput["riskLevel"],
    })),
  );

  const findingRows = scan.findings.map((f) => ({
    id: f.id,
    scanId: scan.id,
    hostId: f.hostId ? scopeId(scan.id, f.hostId) : null,
    severity: f.severity as Prisma.FindingCreateManyInput["severity"],
    title: f.title,
    evidence: f.evidence,
    remediation: f.remediation,
  }));

  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.scan.upsert({
      where: { id: scan.id },
      update: {
        filename: scan.filename,
        target: scan.target,
        scannedAt: scan.scannedAt ? new Date(scan.scannedAt) : null,
        parsedAt: now,
        userId: SEED_USER_ID,
      },
      create: {
        id: scan.id,
        userId: SEED_USER_ID,
        filename: scan.filename,
        target: scan.target,
        scannedAt: scan.scannedAt ? new Date(scan.scannedAt) : null,
        uploadedAt: new Date(scan.uploadedAt),
        parsedAt: now,
      },
    });

    await tx.host.deleteMany({ where: { scanId: scan.id } });
    await tx.finding.deleteMany({ where: { scanId: scan.id } });
    await tx.host.createMany({ data: hostRows });
    await tx.service.createMany({ data: serviceRows });
    await tx.finding.createMany({ data: findingRows });
  });
}

// ─── Static fixtures — one scan each, populating the general scans list ────

const FIXTURE_NAMES = [
  "simple-web-server",
  "web-server",
  "linux-host",
  "domain-controller",
  "internal-platform",
  "scanme-public-host",
] as const;

function loadFixture(name: string): SeedScan {
  const raw = readFileSync(
    path.resolve(__dirname, `../fixtures/scans/${name}.json`),
    "utf8",
  );
  return JSON.parse(raw) as SeedScan;
}

// ─── Synthetic trend series — three scans of the same target over time, so
// the risk-over-time chart (features/scans/detail/risk-trend-card.tsx) has
// something to plot: a critical exposure appears, then gets remediated. ────

const TREND_TARGET = "prod-app.internal";
const TREND_HOST_ID = "10.50.0.10";
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS).toISOString();

const trendScans: SeedScan[] = [
  {
    id: "seed_trend_1",
    filename: "prod-app-week1.xml",
    target: TREND_TARGET,
    uploadedAt: daysAgo(70),
    scannedAt: daysAgo(70),
    hosts: [
      {
        id: TREND_HOST_ID,
        ipAddress: TREND_HOST_ID,
        hostname: TREND_TARGET,
        operatingSystem: "Linux",
        role: "web_server",
        internetExposed: false,
        services: [
          {
            id: `${TREND_HOST_ID}:tcp:22`,
            port: 22,
            protocol: "tcp",
            serviceName: "ssh",
            product: "OpenSSH",
            version: "9.6p1",
            riskLevel: "medium",
            cpe: ["cpe:/a:openbsd:openssh:9.6p1"],
          },
          {
            id: `${TREND_HOST_ID}:tcp:443`,
            port: 443,
            protocol: "tcp",
            serviceName: "https",
            product: "nginx",
            version: "1.24.0",
            riskLevel: "medium",
            cpe: ["cpe:/a:igor_sysoev:nginx:1.24.0"],
          },
        ],
      },
    ],
    findings: [
      {
        id: "seed_trend_1_f1",
        hostId: TREND_HOST_ID,
        severity: "low",
        title: "Limited attack surface observed",
        evidence: "Only SSH and HTTPS were found open in this scan.",
        remediation: "Continue monitoring for unexpected service exposure.",
      },
    ],
  },
  {
    id: "seed_trend_2",
    filename: "prod-app-week10.xml",
    target: TREND_TARGET,
    uploadedAt: daysAgo(35),
    scannedAt: daysAgo(35),
    hosts: [
      {
        id: TREND_HOST_ID,
        ipAddress: TREND_HOST_ID,
        hostname: TREND_TARGET,
        operatingSystem: "Linux",
        role: "database_server",
        internetExposed: true,
        services: [
          {
            id: `${TREND_HOST_ID}:tcp:22`,
            port: 22,
            protocol: "tcp",
            serviceName: "ssh",
            product: "OpenSSH",
            version: "9.6p1",
            riskLevel: "medium",
            cpe: ["cpe:/a:openbsd:openssh:9.6p1"],
          },
          {
            id: `${TREND_HOST_ID}:tcp:443`,
            port: 443,
            protocol: "tcp",
            serviceName: "https",
            product: "nginx",
            version: "1.24.0",
            riskLevel: "medium",
            cpe: ["cpe:/a:igor_sysoev:nginx:1.24.0"],
          },
          {
            id: `${TREND_HOST_ID}:tcp:3306`,
            port: 3306,
            protocol: "tcp",
            serviceName: "mysql",
            product: "MySQL",
            version: "8.0.35",
            riskLevel: "high",
            cpe: ["cpe:/a:mysql:mysql:8.0.35"],
          },
        ],
      },
    ],
    findings: [
      {
        id: "seed_trend_2_f1",
        hostId: TREND_HOST_ID,
        severity: "critical",
        title: "Database exposed to the internet",
        evidence: "Port 3306/tcp (MySQL 8.0.35) is open on an internet-exposed host.",
        remediation: "Move the database behind a private network and close port 3306 externally.",
      },
      {
        id: "seed_trend_2_f2",
        hostId: TREND_HOST_ID,
        severity: "low",
        title: "SSH is exposed",
        evidence: "Port 22/tcp is open and identified as OpenSSH 9.6p1.",
        remediation: "Limit SSH access to trusted sources and enforce key-based authentication.",
      },
    ],
  },
  {
    id: "seed_trend_3",
    filename: "prod-app-week14.xml",
    target: TREND_TARGET,
    uploadedAt: daysAgo(4),
    scannedAt: daysAgo(4),
    hosts: [
      {
        id: TREND_HOST_ID,
        ipAddress: TREND_HOST_ID,
        hostname: TREND_TARGET,
        operatingSystem: "Linux",
        role: "web_server",
        internetExposed: false,
        services: [
          {
            id: `${TREND_HOST_ID}:tcp:22`,
            port: 22,
            protocol: "tcp",
            serviceName: "ssh",
            product: "OpenSSH",
            version: "9.6p1",
            riskLevel: "medium",
            cpe: ["cpe:/a:openbsd:openssh:9.6p1"],
          },
          {
            id: `${TREND_HOST_ID}:tcp:443`,
            port: 443,
            protocol: "tcp",
            serviceName: "https",
            product: "nginx",
            version: "1.24.0",
            riskLevel: "medium",
            cpe: ["cpe:/a:igor_sysoev:nginx:1.24.0"],
          },
        ],
      },
    ],
    findings: [
      {
        id: "seed_trend_3_f1",
        hostId: TREND_HOST_ID,
        severity: "low",
        title: "SSH is exposed",
        evidence: "Port 22/tcp is open and identified as OpenSSH 9.6p1.",
        remediation: "Limit SSH access to trusted sources and enforce key-based authentication.",
      },
    ],
  },
];

async function main() {
  await db.user.upsert({
    where: { id: SEED_USER_ID },
    update: { email: SEED_USER_EMAIL },
    create: { id: SEED_USER_ID, email: SEED_USER_EMAIL },
  });
  console.log(`Seeded user ${SEED_USER_ID} (${SEED_USER_EMAIL})`);

  for (const name of FIXTURE_NAMES) {
    const scan = loadFixture(name);
    await saveSeedScan(scan);
    console.log(`Seeded scan "${name}" (target: ${scan.target})`);
  }

  for (const scan of trendScans) {
    await saveSeedScan(scan);
    console.log(`Seeded trend scan "${scan.id}" (target: ${scan.target})`);
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
