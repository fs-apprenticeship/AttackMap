import { Fragment, type ReactNode } from "react";

import { cn } from "@/lib/utils";

// Minimal markdown renderer for AI remediation detail. Handles the subset the
// model emits — fenced code blocks, inline `code`, **bold**, and "- " bullets —
// by building React nodes (never raw HTML), so AI output can't inject markup.

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("`")) {
      nodes.push(
        <code
          key={`${keyPrefix}-c${i}`}
          className="rounded bg-zinc-200 px-1 py-0.5 font-mono text-[0.8125rem] text-zinc-800"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      nodes.push(
        <strong key={`${keyPrefix}-b${i}`} className="font-semibold text-zinc-800">
          {token.slice(2, -2)}
        </strong>,
      );
    }
    last = match.index + token.length;
    i += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Inline-only rendering (inline `code` + **bold**), for list items etc. */
export function MarkdownInline({ content }: { content: string }) {
  return <>{renderInline(content, "i")}</>;
}

type MarkdownProps = {
  content: string;
  className?: string;
};

export function Markdown({ content, className }: MarkdownProps) {
  // Split on fenced code blocks: even segments are prose, odd are code.
  const segments = content.split(/```/);

  return (
    <div className={cn("space-y-2 text-sm leading-6 text-zinc-600", className)}>
      {segments.map((segment, index) => {
        if (index % 2 === 1) {
          const body = segment.replace(/^[a-z]+\n/, "").replace(/^\n|\n$/g, "");
          return (
            <pre
              key={index}
              className="overflow-x-auto rounded-md bg-zinc-900 p-3 text-xs text-zinc-100"
            >
              <code className="font-mono">{body}</code>
            </pre>
          );
        }

        const text = segment.replace(/^\n+|\n+$/g, "");
        if (!text) return null;

        return (
          <Fragment key={index}>
            {text.split("\n").map((line, li) => {
              if (/^\s*[-*]\s+/.test(line)) {
                return (
                  <div key={li} className="flex gap-2">
                    <span aria-hidden>•</span>
                    <span>
                      {renderInline(line.replace(/^\s*[-*]\s+/, ""), `${index}-${li}`)}
                    </span>
                  </div>
                );
              }
              return line.trim() ? (
                <p key={li}>{renderInline(line, `${index}-${li}`)}</p>
              ) : null;
            })}
          </Fragment>
        );
      })}
    </div>
  );
}
