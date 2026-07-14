"use client";

import { useEffect, useRef } from "react";
import { ArrowUp, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconButtonTooltip } from "@/components/ui/tooltip";

// The investigation input. A bordered field that lights up on focus, an
// auto-growing textarea, a send action that flips to Stop while streaming, and
// a quiet footer stating scope (what it's grounded on) and the model — trust
// cues a security analyst expects. Enter sends; Shift+Enter / ⌘+Enter newline.
export function Composer({
  input,
  setInput,
  busy,
  scope,
  onSubmit,
  onStop,
}: {
  input: string;
  setInput: (value: string) => void;
  busy: boolean;
  scope: string;
  onSubmit: (text: string) => void;
  onStop: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow up to a cap as the user types or after it's cleared.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  return (
    <div className="border-t bg-card/40 p-3">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(input);
        }}
        className="group flex items-end gap-2 rounded-lg border bg-background px-2.5 py-2 transition-colors focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/15"
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
              event.preventDefault();
              onSubmit(input);
            }
          }}
          rows={1}
          placeholder="Ask about a host, service, or CVE…"
          aria-label="Ask the security analyst"
          className="max-h-[140px] min-h-6 flex-1 resize-none bg-transparent py-1 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
        />
        {busy ? (
          <IconButtonTooltip label="Stop generating">
            <Button
              type="button"
              size="icon-sm"
              variant="secondary"
              onClick={onStop}
              aria-label="Stop generating"
            >
              <Square className="size-3.5" />
            </Button>
          </IconButtonTooltip>
        ) : (
          <IconButtonTooltip label="Send" disabled={!input.trim()}>
            <Button
              type="submit"
              size="icon-sm"
              disabled={!input.trim()}
              aria-label="Send"
              className="bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-muted disabled:text-muted-foreground"
            >
              <ArrowUp className="size-4" />
            </Button>
          </IconButtonTooltip>
        )}
      </form>
      <div className="mt-1.5 flex items-center gap-2 px-1 text-[0.6875rem] text-muted-foreground">
        <span className="truncate">
          Grounded in <code className="font-mono">{scope}</code>
        </span>
      </div>
    </div>
  );
}
