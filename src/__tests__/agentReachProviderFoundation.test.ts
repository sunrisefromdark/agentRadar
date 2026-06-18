import { describe, expect, it } from "vitest";

import {
  AGENT_REACH_PROVIDER_MODES,
  AGENT_REACH_PROVIDER_RUN_STATUSES,
  type AgentReachProducerProvider,
  type AgentReachProviderContext,
} from "../agentReach/types.ts";
import {
  AgentReachProviderError,
  toSafeAgentReachProviderError,
} from "../agentReach/providerErrors.ts";

describe("AgentReach provider foundation", () => {
  it("defines stable provider modes and run statuses", () => {
    expect(AGENT_REACH_PROVIDER_MODES).toEqual(["active", "manual_import_only"]);
    expect(AGENT_REACH_PROVIDER_RUN_STATUSES).toEqual([
      "ok",
      "partial",
      "not_configured",
      "manual_import_only",
      "unavailable",
      "failed",
    ]);
  });

  it("supports one asynchronous provider contract", async () => {
    const calls: string[] = [];
    const provider: AgentReachProducerProvider = {
      provider_id: "hacker-news",
      platforms: ["hacker_news"],
      mode: "active",
      default_enabled: true,
      async run(context: AgentReachProviderContext) {
        calls.push(`${context.date}:${context.provider_config.input_path}`);
        return {
          provider_id: "hacker-news",
          status: "ok",
          items: [],
          coverage: { hacker_news: { status: "ok" } },
          warnings: [],
          rejected_items: [],
        };
      },
    };

    const result = await provider.run({
      date: "2026-06-18",
      generated_at: "2026-06-18T00:00:00.000Z",
      query_pack: [],
      provider_config: { input_path: "fixtures/hacker-news.json" },
      transport: {
        async request() {
          throw new Error("transport must not be used by this test provider");
        },
      },
    });

    expect(calls).toEqual(["2026-06-18:fixtures/hacker-news.json"]);
    expect(result.status).toBe("ok");
  });

  it.each([
    ["configuration_invalid", false],
    ["input_missing", false],
    ["input_invalid", false],
    ["timeout", true],
    ["http", true],
    ["unavailable", true],
    ["response_too_large", false],
    ["unexpected", false],
  ] as const)("serializes %s failures without leaking their cause", (code, retryable) => {
    const error = new AgentReachProviderError({
      providerId: "official-web",
      code,
      retryable,
      safeMessage: "provider request failed",
      httpStatus: code === "http" ? 503 : undefined,
      cause: new Error(
        "C:\\private\\agentreach.config.json OAuth token=secret response body=private",
      ),
    });

    const safe = toSafeAgentReachProviderError(error);

    expect(safe).toEqual({
      provider_id: "official-web",
      code,
      retryable,
      message: "provider request failed",
      ...(code === "http" ? { http_status: 503 } : {}),
    });
    expect(JSON.stringify(safe)).not.toMatch(
      /private|agentreach\.config|OAuth|token|secret|response body/i,
    );
  });

  it("classifies unknown thrown values as safe unexpected failures", () => {
    const safe = toSafeAgentReachProviderError(
      new Error("cookie=session-secret at C:\\private\\fixture.json"),
      "rss-blog",
    );

    expect(safe).toEqual({
      provider_id: "rss-blog",
      code: "unexpected",
      retryable: false,
      message: "provider execution failed",
    });
  });
});
