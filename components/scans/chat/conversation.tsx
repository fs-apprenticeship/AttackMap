"use client";

import { useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";
import { ArrowDown, TriangleAlert } from "lucide-react";

import { ChatMessage } from "./chat-message";
import { LoadingState } from "./loading-state";

// The transcript. A scroll region that stays pinned to the newest content while
// streaming, but yields to the user the moment they scroll up to re-read (with
// a "jump to latest" affordance). Announced politely to assistive tech.
export function Conversation({
  messages,
  busy,
  error,
}: {
  messages: UIMessage[];
  busy: boolean;
  error: Error | undefined;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);
  // UIMessages carry no timestamp, so stamp each id the first time we see it.
  const [times, setTimes] = useState<Map<string, Date>>(new Map());

  useEffect(() => {
    // Idempotent: only stamps unseen ids and returns the same map otherwise.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimes((prev) => {
      let next: Map<string, Date> | undefined;
      for (const message of messages) {
        if (!prev.has(message.id)) {
          next ??= new Map(prev);
          next.set(message.id, new Date());
        }
      }
      return next ?? prev;
    });
  }, [messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  function onScroll(event: React.UIEvent<HTMLDivElement>) {
    const el = event.currentTarget;
    const pinned = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    pinnedRef.current = pinned;
    setAtBottom(pinned);
  }

  function jumpToLatest() {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    pinnedRef.current = true;
    setAtBottom(true);
  }

  const waitingForFirstToken = busy && messages.at(-1)?.role === "user";

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        role="log"
        aria-live="polite"
        aria-busy={busy}
        className="flex h-full flex-col gap-6 overflow-y-auto p-4"
      >
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} timestamp={times.get(message.id)} />
        ))}

        {waitingForFirstToken ? <LoadingState /> : null}

        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>Something went wrong generating a response. Please try again.</span>
          </div>
        ) : null}
      </div>

      {!atBottom ? (
        <button
          type="button"
          onClick={jumpToLatest}
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-md transition-colors hover:bg-muted"
        >
          <ArrowDown className="size-3.5" />
          Latest
        </button>
      ) : null}
    </div>
  );
}
