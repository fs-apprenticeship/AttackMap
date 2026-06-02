import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import fixture from "@/fixtures/scans/simple-web-server.json";
import type { Scan } from "@/lib/parser/schema";

// Mock the OpenAI client so tests never hit the network.
const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: createMock } };
  },
}));

import { AiNotConfiguredError, distillScan, summarizeScan } from "./summarize";

const scan = fixture as Scan;

describe("distillScan", () => {
  it("strips ids/timestamps and keeps the structural data", () => {
    const distilled = distillScan(scan);

    expect(distilled).not.toHaveProperty("id");
    expect(distilled).not.toHaveProperty("parsedAt");
    expect(distilled.target).toBe(scan.target);
    expect(distilled.hostCount).toBe(scan.hosts.length);
    expect(distilled.findingCount).toBe(scan.findings.length);
    expect(distilled.hosts[0]).not.toHaveProperty("id");
    expect(distilled.hosts[0].services[0]).toHaveProperty("port");
    expect(distilled.ruleBased.riskScore).toBe(scan.summary.riskScore);
  });
});

describe("summarizeScan", () => {
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    createMock.mockReset();
  });
  afterEach(() => {
    process.env.OPENAI_API_KEY = originalKey;
  });

  it("throws AiNotConfiguredError when no API key is set", async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(summarizeScan(scan)).rejects.toBeInstanceOf(
      AiNotConfiguredError,
    );
  });

  it("returns AI executive but keeps the rule-based score and level", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              executive: "Test executive summary.",
            }),
          },
        },
      ],
    });

    const result = await summarizeScan(scan);

    expect(result.source).toBe("ai");
    expect(result.executive).toBe("Test executive summary.");
    // Score and level are unchanged from the rule-based summary.
    expect(result.riskScore).toBe(scan.summary.riskScore);
    expect(result.riskLevel).toBe(scan.summary.riskLevel);
  });
});
