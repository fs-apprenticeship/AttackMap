import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import fixture from "@/fixtures/scans/simple-web-server.json";
import type { Scan } from "@/lib/nmap/schema";

// Mock the OpenAI client so tests never hit the network.
const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: createMock } };
  },
}));

import { AiNotConfiguredError } from "./summarize";
import { generateRemediationPlan } from "./remediate";

const scan = fixture as Scan;

describe("generateRemediationPlan", () => {
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    createMock.mockReset();
  });
  afterEach(() => {
    process.env.OPENAI_API_KEY = originalKey;
  });

  it("throws AiNotConfiguredError when no API key is set", async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(generateRemediationPlan(scan)).rejects.toBeInstanceOf(
      AiNotConfiguredError,
    );
  });

  it("returns a validated AI plan with prioritized steps", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              steps: [
                {
                  priority: "now",
                  title: "Disable anonymous FTP",
                  summary: "Anonymous FTP exposes the server to unauthenticated access.",
                  steps: ["Edit the vsftpd config", "Restart the service"],
                  commands: ["anonymous_enable=NO"],
                  verification: "nmap --script ftp-anon -p21 <host>",
                  addresses: ["Anonymous FTP login is allowed"],
                },
              ],
            }),
          },
        },
      ],
    });

    const result = await generateRemediationPlan(scan);

    expect(result.source).toBe("ai");
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].priority).toBe("now");
    expect(result.steps[0].addresses).toContain(
      "Anonymous FTP login is allowed",
    );
  });
});
