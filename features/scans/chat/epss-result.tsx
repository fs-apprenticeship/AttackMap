"use client";

import { Activity, ExternalLink, Loader2, TriangleAlert } from "lucide-react";

import type { EpssResult } from "@/lib/ai/tools/get-epss";
import { cn } from "@/lib/utils";

import { EvidenceCard } from "./evidence-card";
import { ResponseCard } from "./response-card";

// The structured rendering of a `getEpss` tool call. Where KEV answers "is it
// exploited right now" (yes/no) and CVE lookup answers "how severe", EPSS answers
// "how *likely* is exploitation" — a continuous probability. So this card reads
// as a ranked meter: each CVE's 30-day exploitation probability as a bar, sorted
// highest-first, colored by how urgent that likelihood is.

export type EpssToolPart = {
  type: "tool-getEpss";
  state: "input-streaming" | "input-available" | "output-available" | "output-error";
  input?: { cveIds?: string[] };
  output?: Partial<EpssResult> & { error?: string };
  errorText?: string;
};

function nvdUrl(cveId: string) {
  return `https://nvd.nist.gov/vuln/detail/${cveId}`;
}

// EPSS probability bands. There's no official cutoff, but ~0.5 and ~0.1 are the
// common thresholds for "high" and "elevated" real-world exploitation risk.
function band(epss: number): "high" | "elevated" | "low" {
  if (epss >= 0.5) return "high";
  if (epss >= 0.1) return "elevated";
  return "low";
}

const ACCENT_BY_BAND: Record<ReturnType<typeof band>, string> = {
  high: "border-l-red-500/60",
  elevated: "border-l-amber-500/60",
  low: "border-l-emerald-500/60",
};

const BAR_BY_BAND: Record<ReturnType<typeof band>, string> = {
  high: "bg-red-500",
  elevated: "bg-amber-500",
  low: "bg-emerald-500",
};

const TEXT_BY_BAND: Record<ReturnType<typeof band>, string> = {
  high: "text-red-600 dark:text-red-400",
  elevated: "text-amber-600 dark:text-amber-400",
  low: "text-emerald-600 dark:text-emerald-400",
};

/** A probability as a percentage, keeping tiny scores legible ("<0.1%"). */
function formatProbability(epss: number): string {
  const pct = epss * 100;
  if (pct > 0 && pct < 0.1) return "<0.1%";
  // EPSS is asymptotic and never truly reaches 1.0, so a near-ceiling score
  // reads "99.9%" rather than an impossible, certainty-implying "100%".
  if (pct >= 99.95) return "99.9%";
  return `${pct.toFixed(1)}%`;
}

/** A percentile (0–1) as an ordinal rank, e.g. 0.819 -> "82nd pct". */
function formatPercentile(percentile: number): string {
  const n = Math.round(percentile * 100);
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : n % 10 === 1
        ? "st"
        : n % 10 === 2
          ? "nd"
          : n % 10 === 3
            ? "rd"
            : "th";
  return `${n}${suffix} pct`;
}

export function EpssResult({ part }: { part: EpssToolPart }) {
  const checkedCount = part.input?.cveIds?.length ?? 0;

  // 1 — Scoring. Calm progress row, matching the CVE and KEV cards.
  if (part.state === "input-streaming" || part.state === "input-available") {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-card/60 px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="size-3.5 shrink-0 animate-spin text-emerald-600 motion-reduce:animate-none dark:text-emerald-400" />
        <span>
          Scoring exploitation likelihood (EPSS)
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

  // 2 — Lookup failed. Degrade honestly; the assistant falls back to KEV/CVSS.
  if (part.state === "output-error" || part.output?.error) {
    return (
      <ResponseCard label="EPSS" accent="border-l-amber-500/60">
        <div className="flex items-start gap-2 px-3 pb-2.5 text-sm text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            Couldn&apos;t reach the EPSS API. Prioritizing by KEV and CVSS instead.
          </span>
        </div>
      </ResponseCard>
    );
  }

  const scores = part.output?.scores ?? [];
  const checked = part.output?.checked ?? part.input?.cveIds ?? [];

  // 3 — No scores. EPSS had no record for any checked CVE (too new/reserved).
  // Unlike KEV, this isn't an "all clear" — it's simply an absence of data.
  if (scores.length === 0) {
    return (
      <ResponseCard label="EPSS" accent="border-l-border">
        <div className="flex items-start gap-2 px-3 pb-2.5 text-sm text-muted-foreground">
          <Activity className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <span>
            {checked.length
              ? `No EPSS scores are published yet for the ${checked.length} CVE${checked.length === 1 ? "" : "s"} checked.`
              : "No CVEs to score against EPSS."}
          </span>
        </div>
      </ResponseCard>
    );
  }

  // 4 — Scores. A ranked meter: probability bars, highest likelihood first.
  const top = scores[0];
  return (
    <ResponseCard
      label="EPSS · exploitation likelihood"
      meta={`${scores.length} scored`}
      accent={ACCENT_BY_BAND[band(top.epss)]}
    >
      <div className="space-y-1.5 px-3 pb-2.5">
        {top.date ? <EvidenceCard label="Model" value={top.date} /> : null}
        <ul className="divide-y rounded-md border">
          {scores.map((score) => (
            <li key={score.cve}>
              <a
                href={nvdUrl(score.cve)}
                target="_blank"
                rel="noreferrer noopener"
                className="group flex items-center gap-2.5 px-2.5 py-2 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 font-mono text-xs font-medium text-foreground">
                    {score.cve}
                    <ExternalLink className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    <span
                      className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"
                      role="presentation"
                    >
                      <span
                        className={cn("block h-full rounded-full", BAR_BY_BAND[band(score.epss)])}
                        style={{ width: `${Math.max(2, score.epss * 100)}%` }}
                      />
                    </span>
                    <span className="text-[0.6875rem] text-muted-foreground">
                      {formatPercentile(score.percentile)}
                    </span>
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 font-mono text-sm font-semibold tabular-nums",
                    TEXT_BY_BAND[band(score.epss)],
                  )}
                >
                  {formatProbability(score.epss)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </ResponseCard>
  );
}
