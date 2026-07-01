"use client";

import type { UIMessage } from "ai";
import { Crosshair } from "lucide-react";

import { Markdown, MarkdownInline } from "@/components/dashboard/markdown";
import { cn } from "@/lib/utils";

import { CveResult, type CveToolPart } from "./cve-result";

// One turn in the transcript. Deliberately *not* a chat bubble: the analyst's
// question reads like a logged query (mono, flush-left, accent rule), and the
// assistant's answer reads like an analysis report — a bold verdict line, then
// supporting prose, then structured evidence. Hierarchy via type and spacing,
// not colored balloons.

function formatTime(date: Date) {
  return new Intl.DateTimeFormat([], { hour: "2-digit", minute: "2-digit" }).format(date);
}

// A verdict is only sensible for a short prose lead — never for structured
// content (lists, headings, code, tables). Bailing out here is what keeps a CVE
// rundown from being mistaken for a one-line headline and rendered as raw text.
const STRUCTURED = /(^|\n)\s*(\d+\.\s|[-*+]\s|#{1,6}\s|>|\|)|```/;
const MAX_VERDICT_LEN = 220;

/**
 * Split streamed prose into a headline verdict (first sentence) and the rest.
 * Splits only on a sentence terminator followed by whitespace + a capital/quote,
 * so version strings (`3.0.5`) and IPs (`10.0.0.1`) never split mid-token. If
 * the text is structured or the lead is too long, there's no verdict — the
 * whole thing renders as markdown.
 */
function splitVerdict(text: string): { verdict: string; body: string } {
  const trimmed = text.replace(/^\s+/, "");
  if (STRUCTURED.test(trimmed)) return { verdict: "", body: trimmed };

  const match = trimmed.match(/^([\s\S]*?[.!?])\s+(?=["'`(\-A-Z])/);
  if (!match) {
    return trimmed.length <= MAX_VERDICT_LEN
      ? { verdict: trimmed, body: "" }
      : { verdict: "", body: trimmed };
  }
  return { verdict: match[1], body: trimmed.slice(match[0].length) };
}

function RoleLabel({ assistant, time }: { assistant: boolean; time?: Date }) {
  return (
    <div className="flex items-center gap-1.5">
      {assistant ? (
        <Crosshair className="size-3.5 text-emerald-600 dark:text-emerald-400" />
      ) : null}
      <span
        className={cn(
          "text-[0.625rem] font-semibold tracking-[0.08em] uppercase",
          assistant ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
        )}
      >
        {assistant ? "Analysis" : "You asked"}
      </span>
      {time ? (
        <span className="font-mono text-[0.625rem] text-muted-foreground tabular-nums">
          {formatTime(time)}
        </span>
      ) : null}
    </div>
  );
}

export function ChatMessage({
  message,
  timestamp,
}: {
  message: UIMessage;
  timestamp?: Date;
}) {
  const isUser = message.role === "user";

  if (isUser) {
    const text = message.parts
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("");

    return (
      <div className="flex flex-col gap-1.5">
        <RoleLabel assistant={false} time={timestamp} />
        <p className="border-l-2 border-emerald-500/40 pl-3 text-sm leading-relaxed font-medium text-foreground">
          {text}
        </p>
      </div>
    );
  }

  // Assistant: verdict-first. The first text part's opening sentence is the
  // headline; the remainder and any later parts are supporting analysis.
  const firstTextIndex = message.parts.findIndex((part) => part.type === "text");

  return (
    <div className="flex flex-col gap-2">
      <RoleLabel assistant time={timestamp} />
      {message.parts.map((part, index) => {
        if (part.type === "text") {
          if (index === firstTextIndex) {
            const { verdict, body } = splitVerdict(part.text);
            return (
              <div key={index} className="space-y-2">
                {verdict ? (
                  <div className="text-[0.95rem] leading-relaxed font-medium text-balance text-foreground">
                    <MarkdownInline content={verdict} />
                  </div>
                ) : null}
                {body ? <Markdown content={body} /> : null}
              </div>
            );
          }
          return <Markdown key={index} content={part.text} />;
        }
        if (part.type === "tool-lookupCves") {
          return <CveResult key={index} part={part as unknown as CveToolPart} />;
        }
        return null;
      })}
    </div>
  );
}
