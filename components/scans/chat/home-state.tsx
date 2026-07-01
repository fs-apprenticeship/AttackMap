"use client";

import { Bug, Database, FileSearch, Globe, ShieldAlert, Wrench } from "lucide-react";

import type { Scan } from "@/lib/types";

import { ActionCard } from "./action-card";

// The landing experience before the first message. Communicates value up front:
// a contextual intro tied to *this* scan, premium action cards (what + why), and
// a compact "how I work" provenance section that builds trust without repeating
// the actions.

const ACTIONS: { icon: typeof ShieldAlert; title: string; description: string; prompt: string }[] = [
  {
    icon: ShieldAlert,
    title: "Explain the biggest risk",
    description: "Triage the most serious exposure and why it matters",
    prompt: "What's the biggest risk in this scan, and why?",
  },
  {
    icon: Bug,
    title: "Look up CVEs",
    description: "Live NVD lookups for the detected service versions",
    prompt: "Look up known CVEs for the services in this scan.",
  },
  {
    icon: Wrench,
    title: "Prioritize remediation",
    description: "An ordered plan for what to fix first",
    prompt: "What should I fix first, and in what order?",
  },
  {
    icon: Globe,
    title: "Internet-facing services",
    description: "Surface what's reachable from outside",
    prompt: "Which services are internet-exposed, and how risky are they?",
  },
];

const PROVENANCE = [
  { icon: FileSearch, text: "Grounded in this scan's hosts, services & findings" },
  { icon: Database, text: "CVEs verified live against the NVD database" },
];

export function HomeState({ scan, onSelect }: { scan: Scan; onSelect: (prompt: string) => void }) {
  const serviceCount = scan.hosts.reduce((total, host) => total + host.services.length, 0);

  return (
    <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Ask anything about{" "}
        <code className="font-mono text-foreground">{scan.target}</code>. I&apos;ll answer from the{" "}
        {scan.hosts.length} {scan.hosts.length === 1 ? "host" : "hosts"} and {serviceCount}{" "}
        {serviceCount === 1 ? "service" : "services"} in this scan, and verify CVEs against live
        NVD data.
      </p>

      <div className="flex flex-col gap-2">
        {ACTIONS.map((action) => (
          <ActionCard
            key={action.title}
            icon={action.icon}
            title={action.title}
            description={action.description}
            onSelect={() => onSelect(action.prompt)}
          />
        ))}
      </div>

      <div className="mt-auto space-y-2 rounded-lg border bg-muted/30 p-3">
        <p className="text-[0.625rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          How I work
        </p>
        <ul className="space-y-1.5">
          {PROVENANCE.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              {text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
