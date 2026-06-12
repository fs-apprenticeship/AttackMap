"use client";

import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";
import { isWebService } from "@/lib/parser/web-service";
import type { Scan } from "@/lib/types";

// Wraps an AI content region. While generating, the existing rule-based or
// previous AI content stays readable underneath a compact terminal-style log.

type AiGeneratingProps = {
  generating: boolean;
  children: ReactNode;
  className?: string;
  scan?: Scan;
  variant?: "summary" | "remediation";
};

type Severity = "critical" | "high" | "medium" | "low";

type Step = {
  text: string;
  // `intro` + `active` render green; `success` is dark text with a green check;
  // an untoned line with a `severity` is dark text with a colored severity tag.
  tone?: "intro" | "success" | "active";
  severity?: Severity;
};

// Most-severe first, for picking the top finding lines.
const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

// Color for the trailing "(HIGH)" / "(MEDIUM)" tag on finding lines.
const severityTagClass: Record<Severity, string> = {
  critical: "text-red-600",
  high: "text-red-600",
  medium: "text-amber-600",
  low: "text-amber-500",
};

const fallbackSteps: Step[] = [
  {
    text: "Starting analysis",
    tone: "intro",
  },
  {
    text: "Parsing scan results...",
    tone: "success",
  },
  {
    text: "Identifying risks...",
    tone: "success",
  },
  {
    text: "Generating summary",
    tone: "active",
  },
];

export function AiGenerating({
  generating,
  children,
  className,
  scan,
  variant = "summary",
}: AiGeneratingProps) {
  const [isExiting, setIsExiting] = useState(false);
  const wasGenerating = useRef(false);
  const showTerminal = generating || isExiting;

  const contentRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();

  useEffect(() => {
    if (generating) {
      wasGenerating.current = true;
      return;
    }

    if (!wasGenerating.current) return;

    const startExit = window.setTimeout(() => {
      setIsExiting(true);
    }, 0);
    const finishExit = window.setTimeout(() => {
      wasGenerating.current = false;
      setIsExiting(false);
    }, 620);

    return () => {
      window.clearTimeout(startExit);
      window.clearTimeout(finishExit);
    };
  }, [generating]);

  // Drive an explicit, animatable height: the loader's natural height while
  // generating, the summary's natural height otherwise. We switch the target to
  // the content height the instant generation ends, so the box shrinks to fit
  // the new summary while the terminal fades out over it — one fluid settle
  // instead of a snap. A ResizeObserver keeps the height honest as the content
  // reflows (window resize, a longer/shorter summary).
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const measure = () => {
      const terminal = terminalRef.current;
      setHeight(
        generating && terminal ? terminal.offsetHeight : content.offsetHeight,
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    if (terminalRef.current) observer.observe(terminalRef.current);
    return () => observer.disconnect();
  }, [generating, showTerminal]);

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        "transition-[height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        className,
      )}
      style={height != null ? { height } : undefined}
    >
      <div
        ref={contentRef}
        className={cn(
          "transition-opacity duration-500",
          generating && "opacity-0",
          isExiting && !generating && "ai-content-reveal",
        )}
      >
        {children}
      </div>
      {showTerminal ? (
        <TerminalLoading
          ref={terminalRef}
          exiting={isExiting && !generating}
          scan={scan}
          variant={variant}
        />
      ) : null}
    </div>
  );
}

const TerminalLoading = forwardRef<
  HTMLDivElement,
  {
    exiting: boolean;
    scan?: Scan;
    variant: "summary" | "remediation";
  }
>(function TerminalLoading({ exiting, scan, variant }, ref) {
  const lines = getSteps(scan, variant);
  const { baseTime, now } = useLiveLogClock(lines.length);

  return (
    <div
      ref={ref}
      className={cn("ai-terminal-loading", exiting && "ai-terminal-exiting")}
      aria-hidden
    >
      <div className="ai-terminal-card">
        <div className="space-y-2 font-mono">
          {lines.map((line, index) => (
            <div
              key={`${line.text}-${index}`}
              className={cn(
                "ai-terminal-row",
                (line.tone === "intro" || line.tone === "active") &&
                  "text-emerald-700",
              )}
              style={stepStyle(index)}
            >
              <span
                className={cn(
                  "ai-terminal-time",
                  line.tone === "active" && "text-emerald-700",
                )}
              >
                [{getLineTime({ baseTime, index, line, now })}]
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="truncate">
                  {line.text}
                  {line.tone === "active" ? (
                    <span className="ai-terminal-cursor" />
                  ) : null}
                </span>
                {line.severity ? (
                  <span
                    className={cn("shrink-0", severityTagClass[line.severity])}
                  >
                    ({line.severity.toUpperCase()})
                  </span>
                ) : null}
                {line.tone === "success" ? (
                  <span className="shrink-0 text-emerald-600">✓</span>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

function getSteps(
  scan: Scan | undefined,
  variant: "summary" | "remediation",
): Step[] {
  if (!scan) {
    return variant === "remediation" ? fallbackRemediationSteps : fallbackSteps;
  }

  if (variant === "remediation") return getRemediationSteps(scan);

  return getSummarySteps(scan);
}

// Top findings as dark lines with a colored "(SEVERITY)" tag. Falls back to a
// reassuring green line when nothing notable was found, so the log never ends
// on an empty stretch before the active line.
function findingSteps(scan: Scan): Step[] {
  const ranked = scan.findings
    .filter((finding) =>
      ["critical", "high", "medium"].includes(finding.severity),
    )
    .sort(
      (a, b) =>
        (SEVERITY_RANK[a.severity] ?? 99) - (SEVERITY_RANK[b.severity] ?? 99),
    )
    .slice(0, 3)
    .map<Step>((finding) => ({
      text: finding.title,
      severity: finding.severity as Severity,
    }));

  if (ranked.length > 0) return ranked;

  return [{ text: "No critical exposures found", tone: "success" }];
}

function getSummarySteps(scan: Scan): Step[] {
  const services = scan.hosts.flatMap((host) => host.services);
  const webServices = services.filter(isWebService).length;

  return [
    {
      text: `Starting analysis for ${scan.target}`,
      tone: "intro",
    },
    {
      text: `Identified ${scan.hosts.length} ${pluralize("host", scan.hosts.length)}`,
      tone: "success",
    },
    {
      text: `Detected ${services.length} open ${pluralize("port", services.length)}`,
      tone: "success",
    },
    {
      text: `Found ${webServices} web ${pluralize("service", webServices)}`,
      tone: "success",
    },
    {
      text: "Checking for critical exposures...",
      tone: "success",
    },
    ...findingSteps(scan),
    {
      text: "Generating summary",
      tone: "active",
    },
  ];
}

const fallbackRemediationSteps: Step[] = [
  {
    text: "Loading exposure context",
    tone: "intro",
  },
  {
    text: "Grouping remediation actions...",
    tone: "success",
  },
  {
    text: "Prioritizing fixes...",
    tone: "success",
  },
  {
    text: "Generating remediation plan",
    tone: "active",
  },
];

function getRemediationSteps(scan: Scan): Step[] {
  const services = scan.hosts.flatMap((host) => host.services);
  const highRiskServices = services.filter((service) =>
    ["critical", "high"].includes(service.riskLevel),
  ).length;
  const affectedHosts = new Set(
    scan.findings
      .map((finding) => finding.hostId ?? finding.host)
      .filter(Boolean),
  ).size;

  return [
    {
      text: `Loading remediation context for ${scan.target}`,
      tone: "intro",
    },
    {
      text: "Grouping remediation actions...",
      tone: "success",
    },
    {
      text: `Grouped ${scan.findings.length} ${pluralize("finding", scan.findings.length)} across ${affectedHosts || scan.hosts.length} ${pluralize("host", affectedHosts || scan.hosts.length)}`,
      tone: "success",
    },
    {
      text: `Mapped ${highRiskServices} high-risk ${pluralize("service", highRiskServices)} to fixes`,
      tone: "success",
    },
    {
      text: "Prioritizing fixes...",
      tone: "success",
    },
    ...findingSteps(scan),
    {
      text: "Generating remediation plan",
      tone: "active",
    },
  ];
}

function formatLogTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function useLiveLogClock(lineCount: number) {
  const [baseTime] = useState(() => Date.now() - Math.max(0, lineCount - 1) * 1000);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  return { baseTime, now };
}

function getLineTime({
  baseTime,
  index,
  line,
  now,
}: {
  baseTime: number;
  index: number;
  line: Step;
  now: Date;
}) {
  if (line.tone === "active") return formatLogTime(now);

  return formatLogTime(new Date(baseTime + index * 1000));
}

function pluralize(word: string, count: number) {
  return count === 1 ? word : `${word}s`;
}

function stepStyle(index: number): CSSProperties {
  return { "--step-index": index } as CSSProperties;
}
