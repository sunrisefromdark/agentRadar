import { afterEach, describe, expect, it, vi } from "vitest";
import { executeGitHubSearchRequest, resetGitHubSearchRuntimeState } from "../signal/githubSearchRuntime.ts";

const originalGithubToken = process.env.GITHUB_TOKEN;

afterEach(() => {
  if (originalGithubToken === undefined) delete process.env.GITHUB_TOKEN;
  else process.env.GITHUB_TOKEN = originalGithubToken;
  resetGitHubSearchRuntimeState();
  vi.unstubAllGlobals();
});

describe("github search runtime", () => {
  it("opens the circuit after a rate limit and short-circuits the next request", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    const fetchMock = vi.fn(async () => new Response("rate limited", { status: 429, headers: { "retry-after": "60" } }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await executeGitHubSearchRequest("https://api.github.com/search/repositories?q=test", "test-search", {
      timeoutMs: 50,
      retryAttempts: 1,
      retryBaseDelayMs: 1,
    });
    const second = await executeGitHubSearchRequest("https://api.github.com/search/repositories?q=test2", "test-search", {
      timeoutMs: 50,
      retryAttempts: 1,
      retryBaseDelayMs: 1,
    });

    expect(first.status).toBe("failed");
    if (first.status === "ok") throw new Error("expected rate limit failure");
    expect(first.reason).toBe("rate_limited");
    expect(second.status).toBe("circuit_open");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
