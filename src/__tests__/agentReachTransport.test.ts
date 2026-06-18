import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createAgentReachTransportError,
  createDisabledAgentReachTransport,
  createFetchAgentReachTransport,
  createInMemoryAgentReachTransport,
  type AgentReachTransportRequest,
} from "../agentReach/transport.ts";
import { toSafeAgentReachProviderError } from "../agentReach/providerErrors.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

function request(
  overrides: Partial<AgentReachTransportRequest> = {},
): AgentReachTransportRequest {
  return {
    provider_id: "official-web",
    url: "https://example.com/agents",
    method: "GET",
    headers: {},
    timeout_ms: 1000,
    max_response_bytes: 1024,
    ...overrides,
  };
}

describe("AgentReach transport", () => {
  it("uses an injected in-memory handler deterministically", async () => {
    const seen: AgentReachTransportRequest[] = [];
    const transport = createInMemoryAgentReachTransport(async (input) => {
      seen.push(input);
      return {
        status: 200,
        headers: { "content-type": "application/json" },
        body: '{"items":[]}',
      };
    });

    const result = await transport.request(request());

    expect(seen).toEqual([request()]);
    expect(result).toEqual({
      status: 200,
      headers: { "content-type": "application/json" },
      body: '{"items":[]}',
    });
  });

  it.each([
    ["timeout", true],
    ["unavailable", true],
  ] as const)("keeps %s transport failures typed and public-safe", async (code, retryable) => {
    const transport = createInMemoryAgentReachTransport(() => {
      throw createAgentReachTransportError({
        providerId: "official-web",
        code,
        cause: new Error("OAuth token=private at C:\\secret\\provider.json"),
      });
    });

    const error = await transport.request(request()).catch((caught) => caught);

    expect(toSafeAgentReachProviderError(error)).toEqual({
      provider_id: "official-web",
      code,
      retryable,
      message:
        code === "timeout"
          ? "provider transport timed out"
          : "provider transport is unavailable",
    });
  });

  it("maps non-success responses to typed HTTP errors", async () => {
    const transport = createInMemoryAgentReachTransport(() => ({
      status: 503,
      headers: {},
      body: "private upstream body must not enter diagnostics",
    }));

    const error = await transport.request(request()).catch((caught) => caught);

    expect(toSafeAgentReachProviderError(error)).toEqual({
      provider_id: "official-web",
      code: "http",
      retryable: true,
      message: "provider transport returned an HTTP error",
      http_status: 503,
    });
  });

  it("rejects responses larger than the configured byte limit", async () => {
    const transport = createInMemoryAgentReachTransport(() => ({
      status: 200,
      headers: {},
      body: "12345",
    }));

    const error = await transport
      .request(request({ max_response_bytes: 4 }))
      .catch((caught) => caught);

    expect(toSafeAgentReachProviderError(error)).toEqual({
      provider_id: "official-web",
      code: "response_too_large",
      retryable: false,
      message: "provider transport response exceeded the byte limit",
    });
  });

  it("keeps the default PR1 transport disabled without calling global fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const transport = createDisabledAgentReachTransport();

    const error = await transport.request(request()).catch((caught) => caught);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(toSafeAgentReachProviderError(error)).toEqual({
      provider_id: "official-web",
      code: "unavailable",
      retryable: true,
      message: "provider transport is unavailable",
    });
  });

  it("uses global fetch only when the explicit live transport is constructed", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("live body", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    );
    const transport = createFetchAgentReachTransport();

    const result = await transport.request(request({ url: "https://example.com/feed.xml" }));

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.com/feed.xml",
      expect.objectContaining({
        method: "GET",
        headers: {},
      }),
    );
    expect(result.body).toBe("live body");
  });
});
