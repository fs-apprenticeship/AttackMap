import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import fixture from "@/fixtures/scans/simple-web-server.json";
import type { Scan } from "@/lib/nmap/schema";

import { AiNotConfiguredError } from "./summarize";
import { streamScanChat } from "./chat";

const scan = fixture as Scan;

const userMessage = [
  { id: "1", role: "user" as const, parts: [{ type: "text" as const, text: "hi" }] },
];

/** A mock model that records its call options and streams back a fixed reply. */
function mockModel(capture: { options?: unknown }) {
  return new MockLanguageModelV4({
    doStream: async (options) => {
      capture.options = options;
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start", id: "t1" },
            { type: "text-delta", id: "t1", delta: "Looks safe." },
            { type: "text-end", id: "t1" },
            {
              type: "finish",
              finishReason: { unified: "stop", raw: undefined },
              logprobs: undefined,
              usage: {
                inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
                outputTokens: { total: 1, text: 1, reasoning: undefined },
              },
            },
          ],
        }),
      };
    },
  });
}

describe("streamScanChat", () => {
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });
  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  });

  it("throws AiNotConfiguredError when no API key is set", async () => {
    await expect(streamScanChat(scan, userMessage)).rejects.toBeInstanceOf(
      AiNotConfiguredError,
    );
  });

  it("grounds the model in the scan and wires up the lookupCves tool", async () => {
    const capture: { options?: { prompt: { role: string; content: unknown }[]; tools?: { name: string }[] } } = {};
    const result = await streamScanChat(
      scan,
      userMessage,
      mockModel(capture) as never,
    );

    // Drain the stream so the mock is invoked.
    const text = await result.text;
    expect(text).toBe("Looks safe.");

    const system = capture.options!.prompt.find((m) => m.role === "system");
    const systemText = JSON.stringify(system?.content);
    // Scan context is injected into the system prompt...
    expect(systemText).toContain(scan.target);
    // ...including each service's CPE, so the model can pass it to the tool.
    expect(systemText).toContain("cpe:/a:openbsd:openssh");

    // The CVE lookup tool is exposed to the model.
    const toolNames = (capture.options!.tools ?? []).map((t) => t.name);
    expect(toolNames).toContain("lookupCves");
  });

  it("instructs the model to stay on task and resist prompt overrides", async () => {
    const capture: { options?: { prompt: { role: string; content: unknown }[] } } = {};
    const result = await streamScanChat(scan, userMessage, mockModel(capture) as never);
    await result.text; // drain so the mock captures the prompt

    const system = capture.options!.prompt.find((m) => m.role === "system");
    const systemText = JSON.stringify(system?.content);
    // Scope guard: decline off-topic questions and refuse instruction overrides.
    expect(systemText).toContain("Stay on task");
    expect(systemText).toContain("unrelated to this scan");
    expect(systemText).toContain("ignore these rules");
  });
});
