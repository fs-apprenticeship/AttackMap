"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Crosshair } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { IconButtonTooltip } from "@/components/ui/tooltip";
import type { Scan } from "@/lib/types";

import { AIHeader } from "./ai-header";
import { Composer } from "./composer";
import { Conversation } from "./conversation";
import { HomeState } from "./home-state";

// The scan analysis workspace. A non-modal slide-over that fuses a contextual
// header, a home/landing state, an analysis transcript, and an investigation
// composer. Grounded server-side — we send only `scanId`; the model answers
// from that scan plus live NVD CVE lookups (see /api/scan/chat). The pieces
// live in ./chat/* so this stays a thin composition root.
export function ScanChat({ scan }: { scan: Scan }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");

  const { messages, sendMessage, status, stop, error } = useChat({
    id: scan.id,
    transport: new DefaultChatTransport({
      api: "/api/scan/chat",
      body: { scanId: scan.id },
    }),
  });

  const busy = status === "submitted" || status === "streaming";
  const empty = messages.length === 0;

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  return (
    <Sheet open={open} onOpenChange={setOpen} modal={false}>
      <IconButtonTooltip label="Open the AI security analyst" side="left">
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Open the AI security analyst"
            style={{ position: "fixed" }}
            className="top-[38%] right-0 z-40 flex -translate-y-1/2 flex-col items-center gap-2 rounded-l-md border border-r-0 border-emerald-600/60 bg-emerald-600 px-2.5 py-4 text-white shadow-[0_0_22px_-6px] shadow-emerald-500/60 transition-[padding,background-color] hover:bg-emerald-500 hover:pr-3.5 focus-visible:ring-3 focus-visible:ring-emerald-300/50 focus-visible:outline-none"
          >
            <Crosshair className="size-4" />
            <span className="text-xs font-medium tracking-wide [writing-mode:vertical-rl]">
              Ask AI
            </span>
          </button>
        </SheetTrigger>
      </IconButtonTooltip>

      <SheetContent
        showCloseButton={false}
        onInteractOutside={(event) => event.preventDefault()}
        className="flex flex-col gap-0 p-0 sm:max-w-[31.5rem]"
      >
        <SheetTitle className="sr-only">AttackMap AI — analysis for {scan.target}</SheetTitle>
        <SheetDescription className="sr-only">
          Ask questions about this Nmap scan. Answers are grounded in the scan data and live NVD
          CVE lookups.
        </SheetDescription>

        <AIHeader scan={scan} />

        {empty ? (
          <HomeState scan={scan} onSelect={submit} />
        ) : (
          <Conversation messages={messages} busy={busy} error={error} />
        )}

        <Composer
          input={input}
          setInput={setInput}
          busy={busy}
          scope={scan.target}
          onSubmit={submit}
          onStop={stop}
        />
      </SheetContent>
    </Sheet>
  );
}
