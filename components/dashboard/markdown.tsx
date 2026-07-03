"use client";

import { useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";

import { cn } from "@/lib/utils";
import { remarkCodeifyCommands } from "./remark-codeify-commands";

const remarkPlugins = [remarkGfm, remarkCodeifyCommands];

// Robust markdown rendering for AI-authored content (executive summary,
// remediation detail). Built on react-markdown + remark-gfm, which renders to
// React nodes — never raw HTML — so model output can't inject markup. Each
// element is mapped to the dashboard's zinc/emerald design tokens.

/** Copy-to-clipboard button for fenced code blocks. */
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can reject (permissions / insecure context); fail silently.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
      className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
    >
      {copied ? (
        <Check className="size-4 text-emerald-400" />
      ) : (
        <Copy className="size-4" />
      )}
    </button>
  );
}

/** A dark code block with an always-visible copy button. Used both by the
 * markdown `pre` mapping and directly for the remediation `commands` arrays. */
export function CodeBlock({ value }: { value: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md bg-zinc-900 py-3 pl-3 pr-11 text-xs text-zinc-100">
        <code className="font-mono">{value}</code>
      </pre>
      <CopyButton value={value} />
    </div>
  );
}

/** Pull the raw text out of a code block's React children for copying. */
function childrenToText(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(childrenToText).join("");
  if (children && typeof children === "object" && "props" in children) {
    return childrenToText(
      (children as { props: { children?: ReactNode } }).props.children,
    );
  }
  return "";
}

const components: Components = {
  p: ({ children }) => <p>{children}</p>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  h1: ({ children }) => (
    <h3 className="text-sm font-semibold text-foreground">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="text-sm font-semibold text-foreground">{children}</h3>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-foreground">{children}</h3>
  ),
  ul: ({ children }) => (
    <ul className="list-disc space-y-1 pl-5 marker:text-muted-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-1 pl-5 marker:text-muted-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-border pl-3 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-border" />,
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b px-2 py-1 font-semibold text-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b px-2 py-1 align-top">{children}</td>
  ),
  // Inline code only. Fenced blocks are routed through `pre` below, which
  // extracts the text and renders its own dark block — so distinguishing block
  // vs inline here (unreliable for fences with no language) is unnecessary.
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.8125rem] text-foreground">
      {children}
    </code>
  ),
  // Any fenced code block — with or without a language hint — becomes a dark
  // copy-able CodeBlock, identical to the remediation `commands` blocks.
  pre: ({ children }) => (
    <CodeBlock value={childrenToText(children).replace(/\n$/, "")} />
  ),
};

/** Inline-only components: unwrap the top-level paragraph so the rendered
 * markdown can sit inside an existing `<li>` / inline context. */
const inlineComponents: Components = {
  ...components,
  p: ({ children }) => <>{children}</>,
};

/** Inline-only rendering (no block wrappers), for list items etc. */
export function MarkdownInline({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={remarkPlugins} components={inlineComponents}>
      {content}
    </ReactMarkdown>
  );
}

type MarkdownProps = {
  content: string;
  className?: string;
};

export function Markdown({ content, className }: MarkdownProps) {
  return (
    <div
      className={cn(
        "space-y-2 text-sm leading-6 text-muted-foreground [&_p]:m-0",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
