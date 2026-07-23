import type { Metadata } from "next";
import {
  Bot,
  CheckCircle2,
  CircleDot,
  Download,
  FileSearch,
  FileText,
  GitCompareArrows,
  Network,
  Radar,
  ScanLine,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
} from "lucide-react";

import { HomeCTA } from "@/features/landing/home-cta";

export const metadata: Metadata = {
  title: "AttackMap | Turn network scans into action",
  description:
    "Visualize Nmap scans, prioritize security findings, compare changes, and build practical remediation plans with AttackMap.",
};

const workflow = [
  {
    step: "01",
    icon: TerminalSquare,
    title: "Run an authorized scan",
    description:
      "Export service and host discovery from Nmap as structured XML.",
    detail: "nmap -sC -sV -oX scan.xml <target>",
  },
  {
    step: "02",
    icon: ScanLine,
    title: "Upload the XML",
    description:
      "AttackMap parses hosts, ports, services, operating systems, and script evidence.",
    detail: "Drag, drop, and process up to 100 MB",
  },
  {
    step: "03",
    icon: ShieldCheck,
    title: "Prioritize the work",
    description:
      "Explore the attack surface, review findings, and move into remediation.",
    detail: "Evidence first, actions next",
  },
];

const features = [
  {
    icon: Network,
    title: "Attack-surface map",
    description:
      "See how hosts and exposed services relate instead of reading raw XML line by line.",
  },
  {
    icon: ShieldAlert,
    title: "Prioritized findings",
    description:
      "Focus on critical and high-risk exposures with supporting scan evidence close at hand.",
  },
  {
    icon: GitCompareArrows,
    title: "Scan comparison",
    description:
      "Compare two saved scans to understand what appeared, disappeared, or changed.",
  },
  {
    icon: Bot,
    title: "AI security analyst",
    description:
      "Ask questions about a scan and generate context-aware summaries when AI is configured.",
  },
  {
    icon: FileText,
    title: "Remediation planning",
    description:
      "Turn findings into ordered actions, commands, and practical verification steps.",
  },
  {
    icon: Download,
    title: "Portable results",
    description:
      "Export host inventory as CSV and remediation guidance as Markdown for your workflow.",
  },
];

export default function LandingPage() {
  return (
    <main className="overflow-hidden bg-background text-foreground">
      <section className="relative border-b">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_28%,color-mix(in_oklch,var(--muted),transparent_25%),transparent_38%)]" />
        <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-7xl items-center gap-14 px-4 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:px-6 lg:py-24">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
              <Radar className="size-3.5 text-foreground" />
              From Nmap XML to a remediation-ready view
            </div>
            <h1 className="mt-6 text-balance text-4xl font-semibold tracking-[-0.035em] sm:text-5xl lg:text-6xl lg:leading-[1.05]">
              Make your attack surface easier to see—and act on.
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-lg leading-8 text-muted-foreground">
              AttackMap turns authorized Nmap scans into a structured security
              workspace for hosts, services, findings, comparisons, and
              remediation.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <HomeCTA />
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-foreground" />
                Evidence-backed findings
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-foreground" />
                Rule-based baseline
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-foreground" />
                Optional AI workflows
              </span>
            </div>
          </div>

          <ProductPreview />
        </div>
      </section>

      <section id="workflow" className="scroll-mt-20 border-b bg-card/35">
        <div className="mx-auto w-full max-w-7xl px-4 py-20 lg:px-6 lg:py-24">
          <SectionHeading
            eyebrow="A direct workflow"
            title="Go from scan output to a prioritized plan"
            description="Keep the richness of your Nmap evidence while making it useful to more than the person who ran the command."
          />
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {workflow.map(({ step, icon: Icon, title, description, detail }) => (
              <article key={step} className="relative rounded-xl border bg-card p-6 shadow-sm">
                <span className="absolute right-5 top-5 font-mono text-xs text-muted-foreground">
                  {step}
                </span>
                <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {description}
                </p>
                <p className="mt-5 rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
                  {detail}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="capabilities" className="scroll-mt-20 border-b">
        <div className="mx-auto w-full max-w-7xl px-4 py-20 lg:px-6 lg:py-24">
          <SectionHeading
            eyebrow="One investigation surface"
            title="The context you need, from exposure to fix"
            description="Move between the big picture and the underlying host, service, and finding details without losing the thread."
          />
          <div className="mt-12 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <article key={title} className="bg-card p-6 sm:p-7">
                <Icon className="size-5 text-muted-foreground" />
                <h3 className="mt-5 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-card/35">
        <div className="mx-auto w-full max-w-5xl px-4 py-20 text-center lg:px-6 lg:py-24">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="size-6" />
          </div>
          <h2 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
            Give your next scan a clearer destination.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
            Upload an Nmap XML file, explore the evidence, and leave with a
            prioritized view of what to address next.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <HomeCTA />
          </div>
        </div>
      </section>
    </main>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-lg leading-8 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function ProductPreview() {
  return (
    <div
      role="img"
      aria-label="AttackMap preview showing a scan summary, risk level, host relationships, and findings"
      className="relative mx-auto w-full max-w-2xl"
    >
      <div className="absolute -inset-5 rounded-[2rem] bg-muted/45 blur-2xl" />
      <div className="relative overflow-hidden rounded-xl border bg-card shadow-2xl shadow-foreground/10">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <p className="text-xs font-semibold">edge-network.xml</p>
              <p className="text-[10px] text-muted-foreground">Scan overview</p>
            </div>
          </div>
          <span className="rounded-full border px-2 py-1 text-[10px] font-medium text-muted-foreground">
            Analysis ready
          </span>
        </div>

        <div className="grid grid-cols-3 divide-x border-b bg-muted/25">
          {[
            ["12", "Hosts"],
            ["38", "Services"],
            ["7", "Findings"],
          ].map(([value, label]) => (
            <div key={label} className="px-4 py-3">
              <p className="text-lg font-semibold">{value}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        <div className="grid min-h-64 md:grid-cols-[1.45fr_0.85fr]">
          <div className="relative overflow-hidden border-b p-5 md:border-b-0 md:border-r">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">Attack surface</p>
              <Network className="size-4 text-muted-foreground" />
            </div>
            <div className="relative mt-4 h-44 rounded-lg border bg-background/70">
              <svg
                className="absolute inset-0 size-full text-border"
                viewBox="0 0 400 176"
                aria-hidden="true"
                preserveAspectRatio="none"
              >
                <path d="M78 90 L196 44 L318 75 M78 90 L202 135 L318 75 M196 44 L202 135" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
              <PreviewNode className="left-[10%] top-[38%]" icon={Radar} label="Gateway" />
              <PreviewNode className="left-[43%] top-[10%]" icon={Server} label="Web" />
              <PreviewNode className="left-[45%] top-[65%]" icon={Server} label="Data" />
              <PreviewNode className="right-[8%] top-[30%]" icon={CircleDot} label="Public" alert />
            </div>
          </div>

          <div className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">Priority findings</p>
              <span className="rounded bg-destructive/10 px-2 py-1 text-[10px] font-semibold text-destructive">
                High risk
              </span>
            </div>
            <div className="mt-4 space-y-3">
              <PreviewFinding severity="Critical" title="Exposed admin service" />
              <PreviewFinding severity="High" title="Anonymous FTP access" />
              <PreviewFinding severity="Medium" title="Legacy TLS service" />
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-md bg-muted p-3 text-[11px] text-muted-foreground">
              <FileSearch className="size-4 shrink-0" />
              Evidence stays attached to every finding.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewNode({
  className,
  icon: Icon,
  label,
  alert = false,
}: {
  className: string;
  icon: typeof Server;
  label: string;
  alert?: boolean;
}) {
  return (
    <div className={`absolute flex flex-col items-center gap-1 ${className}`}>
      <div
        className={`flex size-9 items-center justify-center rounded-full border-2 bg-card shadow-sm ${
          alert ? "border-destructive text-destructive" : "border-foreground/20"
        }`}
      >
        <Icon className="size-4" />
      </div>
      <span className="rounded bg-card/90 px-1.5 py-0.5 text-[9px] font-medium shadow-sm">
        {label}
      </span>
    </div>
  );
}

function PreviewFinding({ severity, title }: { severity: string; title: string }) {
  return (
    <div className="flex items-start gap-2 border-b pb-3 last:border-0 last:pb-0">
      <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-destructive" />
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium">{title}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{severity}</p>
      </div>
    </div>
  );
}
