import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Download,
  FileCode2,
  FileUp,
  GitCompareArrows,
  KeyRound,
  LayoutDashboard,
  ListTree,
  Network,
  Server,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  MAX_LARGE_SCAN_UPLOAD_BYTES,
  formatUploadLimit,
} from "@/lib/nmap/upload-validation-config";

export const metadata: Metadata = {
  title: "Documentation | AttackMap",
  description:
    "Learn how to generate an Nmap XML scan, upload it to AttackMap, investigate findings, compare scans, and create remediation guidance.",
};

const sections = [
  { id: "quick-start", label: "Quick start" },
  { id: "generate-scan", label: "Generate a scan" },
  { id: "upload", label: "Upload XML" },
  { id: "review", label: "Review results" },
  { id: "compare", label: "Compare scans" },
  { id: "ai", label: "AI workflows" },
  { id: "exports", label: "Export results" },
  { id: "troubleshooting", label: "Troubleshooting" },
  { id: "safe-use", label: "Safe use" },
];

const scanViews = [
  {
    icon: LayoutDashboard,
    title: "Overview",
    description:
      "Start with risk, the executive summary, exposure counts, top findings, and service distribution.",
  },
  {
    icon: Network,
    title: "Attack surface",
    description:
      "Explore the relationship between discovered hosts and services in an interactive graph.",
  },
  {
    icon: AlertTriangle,
    title: "Findings",
    description:
      "Review severity, evidence, affected services, and the recommended response for each issue.",
  },
  {
    icon: Wrench,
    title: "Remediation",
    description:
      "Work through ordered fixes, implementation commands, and verification guidance.",
  },
  {
    icon: ListTree,
    title: "Services",
    description:
      "Inspect open ports, detected products, versions, protocols, and service metadata.",
  },
  {
    icon: Server,
    title: "Hosts",
    description:
      "Review the host inventory, operating-system hints, exposure, and highest risk per host.",
  },
];

export default function DocsPage() {
  const maximumUpload = formatUploadLimit(MAX_LARGE_SCAN_UPLOAD_BYTES);

  return (
    <main className="bg-background text-foreground">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-10 lg:grid-cols-[220px_minmax(0,760px)] lg:gap-16 lg:px-6 lg:py-14 xl:grid-cols-[220px_minmax(0,760px)_1fr]">
        <aside>
          <details className="rounded-lg border bg-card p-4 lg:hidden">
            <summary className="cursor-pointer text-sm font-semibold">
              On this page
            </summary>
            <TableOfContents className="mt-3" />
          </details>
          <div className="sticky top-24 hidden lg:block">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              On this page
            </p>
            <TableOfContents />
          </div>
        </aside>

        <article className="min-w-0 space-y-16 pb-10">
          <DocsSection id="quick-start" title="Quick start" icon={Sparkles}>
            <p>
              You need an AttackMap account, an Nmap XML file, and permission to
              scan the target environment. Once signed in, the basic workflow
              is:
            </p>
            <ol className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ["1", "Generate", "Export an authorized Nmap scan as XML."],
                ["2", "Upload", "Choose the XML file from the New scan page."],
                ["3", "Review", "Open the saved scan and prioritize findings."],
              ].map(([number, title, description]) => (
                <li key={number} className="rounded-lg border bg-card p-4">
                  <span className="font-mono text-xs text-muted-foreground">
                    {number.padStart(2, "0")}
                  </span>
                  <p className="mt-3 text-sm font-semibold text-foreground">
                    {title}
                  </p>
                  <p className="mt-1 text-sm leading-6">{description}</p>
                </li>
              ))}
            </ol>
            <DocsCallout icon={KeyRound} title="Authentication is required">
              Your scans are saved to your account. If a protected app link
              returns you to the homepage, sign in and open it again.
            </DocsCallout>
          </DocsSection>

          <DocsSection
            id="generate-scan"
            title="Generate an Nmap XML scan"
            icon={TerminalSquare}
          >
            <p>
              AttackMap reads Nmap&apos;s XML output. The recommended starting
              command enables default scripts and service-version detection:
            </p>
            <Command>nmap -sC -sV -oX scan.xml &lt;target&gt;</Command>
            <ul className="mt-6 space-y-3">
              <DocsListItem>
                <code>-sC</code> runs Nmap&apos;s default script set to collect
                useful service evidence.
              </DocsListItem>
              <DocsListItem>
                <code>-sV</code> detects service products and versions.
              </DocsListItem>
              <DocsListItem>
                <code>-oX scan.xml</code> writes the XML file AttackMap expects.
              </DocsListItem>
            </ul>
            <DocsCallout icon={ShieldCheck} title="Scan only with permission">
              Replace <code>&lt;target&gt;</code> with a host, range, or
              environment you are explicitly authorized to assess. Choose any
              additional Nmap options according to that authorization and your
              operating requirements.
            </DocsCallout>
          </DocsSection>

          <DocsSection id="upload" title="Upload the XML" icon={FileUp}>
            <p>
              Open <Link href="/dashboard/upload">New scan</Link>, then drag the file into
              the upload area or use the file picker. AttackMap accepts Nmap XML
              files up to <strong>{maximumUpload}</strong>.
            </p>
            <div className="mt-6 rounded-lg border bg-card p-5">
              <h3 className="font-semibold text-foreground">
                What happens next
              </h3>
              <div className="mt-4 space-y-4">
                {[
                  "The file type, size, and XML structure are validated.",
                  "Hosts, services, OS hints, scripts, and findings are parsed.",
                  "A rule-based risk summary and remediation baseline are created.",
                  "The completed scan is saved and opened from your account.",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex gap-3 text-sm leading-6 text-muted-foreground"
                  >
                    <CheckCircle2 className="mt-1 size-4 shrink-0 text-foreground" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-5">
              Larger files are uploaded in chunks and processed as an import
              job, so they can take longer to become available. Keep the page
              open while the upload completes.
            </p>
          </DocsSection>

          <DocsSection
            id="review"
            title="Review scan results"
            icon={LayoutDashboard}
          >
            <p>
              The Scans page is your account-level inventory. Search and filter
              saved scans, sort them by risk or activity, and open one to move
              through six focused views.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {scanViews.map(({ icon: Icon, title, description }) => (
                <div key={title} className="rounded-lg border bg-card p-5">
                  <Icon className="size-5 text-muted-foreground" />
                  <h3 className="mt-4 font-semibold text-foreground">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-6">{description}</p>
                </div>
              ))}
            </div>
            <DocsCallout icon={AlertTriangle} title="Start with evidence">
              Risk scoring helps prioritize investigation; it is not a
              substitute for validating the affected asset, exposure path, and
              script output in your environment.
            </DocsCallout>
          </DocsSection>

          <DocsSection
            id="compare"
            title="Compare scans"
            icon={GitCompareArrows}
          >
            <p>
              Choose <strong>Compare</strong> from the app navigation or from an
              individual scan. Select two different scans to review host,
              service, finding, and risk changes between the baseline and the
              comparison scan.
            </p>
            <p className="mt-4">
              Comparisons are most useful when the scans cover the same target
              and use similar Nmap options. This makes newly exposed services
              and resolved findings easier to interpret.
            </p>
          </DocsSection>

          <DocsSection id="ai" title="Use AI workflows" icon={Bot}>
            <p>
              Every scan starts with deterministic, rule-based analysis. When
              the server&apos;s AI integration is configured, signed-in users
              can add:
            </p>
            <ul className="mt-6 space-y-3">
              <DocsListItem>
                An AI-generated executive summary from the scan overview.
              </DocsListItem>
              <DocsListItem>
                A context-aware remediation plan with commands and verification.
              </DocsListItem>
              <DocsListItem>
                The AttackMap AI panel for scan-specific questions and CVE
                context.
              </DocsListItem>
            </ul>
            <DocsCallout icon={Sparkles} title="AI is an optional enhancement">
              If the server is not configured for AI, the application displays
              an error for those actions while the rule-based scan results
              remain available. Review generated guidance before applying
              changes.
            </DocsCallout>
          </DocsSection>

          <DocsSection id="exports" title="Export results" icon={Download}>
            <p>
              Use <strong>Export CSV</strong> from the Hosts view to share or
              analyze the host inventory. Use <strong>Export Markdown</strong>
              from Remediation to move the current plan into tickets, notes, or
              a review workflow.
            </p>
            <p className="mt-4">
              Exports reflect the scan and remediation content visible when you
              download them. Regenerate the export after making or generating
              changes you want included.
            </p>
          </DocsSection>

          <DocsSection
            id="troubleshooting"
            title="Troubleshooting"
            icon={Wrench}
          >
            <div className="space-y-3">
              <TroubleshootingItem
                title="The file is rejected"
                answer={`Confirm it is non-empty Nmap XML, has an .xml extension or XML content type, and is no larger than ${maximumUpload}.`}
              />
              <TroubleshootingItem
                title="A protected link returns to the homepage"
                answer="Your session is missing or expired. Sign in, then return to Scans, New scan, or Compare."
              />
              <TroubleshootingItem
                title="The scan is still processing"
                answer="Large uploads run as background import jobs. Leave the upload page open until the job reports completion, then check Scans."
              />
              <TroubleshootingItem
                title="AI is not configured"
                answer="The deployment does not currently have its server-side AI credentials configured. Continue with the rule-based results or contact the application operator."
              />
              <TroubleshootingItem
                title="A scan cannot be found"
                answer="Confirm you are signed into the account that uploaded it. Scan records are scoped to their owner."
              />
            </div>
          </DocsSection>

          <DocsSection
            id="safe-use"
            title="Use AttackMap safely"
            icon={ShieldCheck}
          >
            <p>
              Only scan systems you own or have explicit permission to test.
              Treat uploaded scan data and exports as sensitive security
              information, and share them only with the people who need access.
            </p>
            <p className="mt-4">
              Findings, risk scores, and generated guidance are decision
              support. Validate them against the live environment, test
              remediations in a safe context, and keep a recovery path before
              changing production systems.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/dashboard/upload">
                  Upload an authorized scan
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="bg-background">
                <Link href="/dashboard/scans">View scans</Link>
              </Button>
            </div>
          </DocsSection>
        </article>

        <aside className="hidden xl:block">
          <div className="sticky top-24 rounded-lg border bg-card p-5">
            <FileCode2 className="size-5 text-muted-foreground" />
            <p className="mt-4 text-sm font-semibold">Ready to scan?</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Export Nmap XML, then upload it to build your first attack-surface
              view.
            </p>
            <Button asChild size="sm" className="mt-4 w-full">
              <Link href="/dashboard/upload">New scan</Link>
            </Button>
          </div>
        </aside>
      </div>
    </main>
  );
}

function TableOfContents({ className = "" }: { className?: string }) {
  return (
    <nav className={className} aria-label="Documentation sections">
      <ul className="space-y-1 border-l">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className="block border-l border-transparent px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function DocsSection({
  id,
  title,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  icon: typeof ShieldCheck;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="size-4" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      </div>
      <div className="mt-5 text-[15px] leading-7 text-muted-foreground [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_code]:text-foreground">
        {children}
      </div>
    </section>
  );
}

function Command({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-5 overflow-x-auto rounded-lg border bg-foreground p-4 text-sm text-background shadow-sm">
      <code className="!bg-transparent !p-0 !text-inherit">{children}</code>
    </pre>
  );
}

function DocsListItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <CheckCircle2 className="mt-1.5 size-4 shrink-0 text-foreground" />
      <span>{children}</span>
    </li>
  );
}

function DocsCallout({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof ShieldCheck;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 flex gap-4 rounded-lg border bg-muted/45 p-5">
      <Icon className="mt-0.5 size-5 shrink-0 text-foreground" />
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <div className="mt-1 text-sm leading-6">{children}</div>
      </div>
    </div>
  );
}

function TroubleshootingItem({
  title,
  answer,
}: {
  title: string;
  answer: string;
}) {
  return (
    <details className="group rounded-lg border bg-card px-5 py-4">
      <summary className="cursor-pointer list-none pr-6 font-semibold text-foreground marker:hidden">
        {title}
      </summary>
      <p className="mt-3 border-t pt-3 text-sm leading-6">{answer}</p>
    </details>
  );
}
