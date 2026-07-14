"use client";

import { ExternalLink, Loader2, ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react";

import type { KevCheckResult, KevEntry } from "@/lib/ai/tools/check-kev";

import { EvidenceCard } from "./evidence-card";
import { ResponseCard } from "./response-card";

// The structured rendering of a `checkKev` tool call. Where a CVE lookup answers
// "does this have known vulns", KEV answers "is it being exploited *right now*" —
// so a match here is the opposite of the CVE-clear case: it's the strongest
// prioritization signal we can show, and it reads red.

export type KevToolPart = {
  type: "tool-checkKev";
  state: "input-streaming" | "input-available" | "output-available" | "output-error";
  input?: { cveIds?: string[] };
  output?: Partial<KevCheckResult> & { error?: string };
  errorText?: string;
};

function nvdUrl(cveId: string) {
  return `https://nvd.nist.gov/vuln/detail/${cveId}`;
}

/** A short "vendor · product" descriptor, skipping blanks. */
function source(entry: KevEntry) {
  return [entry.vendorProject, entry.product].filter(Boolean).join(" · ");
}

export function KevResult({ part }: { part: KevToolPart }) {
  const checkedCount = part.input?.cveIds?.length ?? 0;

  // 1 — Checking. Calm progress row, matching the CVE lookup's.
  if (part.state === "input-streaming" || part.state === "input-available") {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-card/60 px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="size-3.5 shrink-0 animate-spin text-emerald-600 motion-reduce:animate-none dark:text-emerald-400" />
        <span>
          Checking CISA KEV
          {checkedCount ? (
            <>
              {" "}
              for{" "}
              <span className="text-foreground/80">
                {checkedCount} CVE{checkedCount === 1 ? "" : "s"}
              </span>
            </>
          ) : null}
          …
        </span>
      </div>
    );
  }

  // 2 — Lookup failed. Degrade honestly; the assistant falls back to CVSS.
  if (part.state === "output-error" || part.output?.error) {
    return (
      <ResponseCard label="KEV check" accent="border-l-amber-500/60">
        <div className="flex items-start gap-2 px-3 pb-2.5 text-sm text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            Couldn&apos;t reach CISA&apos;s KEV catalog. Prioritizing by CVSS instead.
          </span>
        </div>
      </ResponseCard>
    );
  }

  const matches = part.output?.matches ?? [];
  const checked = part.output?.checked ?? part.input?.cveIds ?? [];

  // 3 — Clear. None of the checked CVEs are actively exploited — the good case.
  if (matches.length === 0) {
    return (
      <ResponseCard label="KEV check" accent="border-l-emerald-500/60">
        <div className="flex items-start gap-2 px-3 pb-2.5 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>
            {checked.length
              ? `None of the ${checked.length} CVE${checked.length === 1 ? "" : "s"} checked are in CISA's KEV catalog — none are known to be actively exploited.`
              : "No CVEs to check against CISA's KEV catalog."}
          </span>
        </div>
      </ResponseCard>
    );
  }

  // 4 — Actively exploited. The strongest prioritization signal: red, linkable.
  return (
    <ResponseCard
      label="Actively exploited (CISA KEV)"
      meta={`${matches.length} of ${checked.length}`}
      accent="border-l-red-500/60"
    >
      <div className="space-y-1.5 px-3 pb-2.5">
        {part.output?.catalogVersion ? (
          <EvidenceCard label="Catalog" value={part.output.catalogVersion} />
        ) : null}
        <ul className="divide-y rounded-md border">
          {matches.map((entry) => (
            <li key={entry.cveID}>
              <a
                href={nvdUrl(entry.cveID)}
                target="_blank"
                rel="noreferrer noopener"
                className="group flex items-start gap-2.5 px-2.5 py-2 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
              >
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="flex items-center gap-1 font-mono text-xs font-medium text-foreground">
                      {entry.cveID}
                      <ExternalLink className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                    </span>
                    {entry.knownRansomwareUse ? (
                      <span className="inline-flex items-center rounded-md border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[0.625rem] font-semibold tracking-wide text-red-600 uppercase dark:text-red-400">
                        Ransomware
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-foreground/80">
                    {entry.vulnerabilityName}
                  </span>
                  <span className="mt-0.5 block text-[0.6875rem] text-muted-foreground">
                    {source(entry)}
                    {entry.dateAdded ? ` · added ${entry.dateAdded}` : ""}
                    {entry.dueDate ? ` · due ${entry.dueDate}` : ""}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </ResponseCard>
  );
}
