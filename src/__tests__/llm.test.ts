import { beforeEach, describe, expect, it, vi } from "vitest";

const { providerCallMock, createProviderMock, formatProviderErrorMock, isRetryableProviderErrorMock, sleepMock } =
  vi.hoisted(() => ({
    providerCallMock: vi.fn(),
    createProviderMock: vi.fn(),
    formatProviderErrorMock: vi.fn((error: unknown) => String(error)),
    isRetryableProviderErrorMock: vi.fn((error: unknown) => Boolean((error as { retryable?: boolean })?.retryable)),
    sleepMock: vi.fn(() => Promise.resolve()),
  }));

vi.mock("../providers/index.ts", () => ({
  createProvider: createProviderMock,
  formatProviderError: formatProviderErrorMock,
  isRetryableProviderError: isRetryableProviderErrorMock,
}));

vi.mock("../date.ts", () => ({
  sleep: sleepMock,
}));

import { callLlm, resetLlmStateForTests, sanitizePromptForLlm } from "../llm.ts";

describe("callLlm", () => {
  beforeEach(() => {
    resetLlmStateForTests();
    providerCallMock.mockReset();
    createProviderMock.mockReset();
    formatProviderErrorMock.mockClear();
    isRetryableProviderErrorMock.mockClear();
    sleepMock.mockClear();
    createProviderMock.mockReturnValue({
      name: "mock-provider",
      call: providerCallMock,
    });
  });

  it("retries timeout or network class retryable errors", async () => {
    providerCallMock
      .mockRejectedValueOnce({ retryable: true, kind: "timeout", message: "timed out" })
      .mockResolvedValueOnce("ok");

    await expect(callLlm("prompt", { maxRetries: 1, retryBaseMs: 0 })).resolves.toBe("ok");

    expect(providerCallMock).toHaveBeenCalledTimes(2);
    expect(isRetryableProviderErrorMock).toHaveBeenCalledTimes(1);
    expect(sleepMock).toHaveBeenCalledWith(0);
  });

  it("does not retry non-retryable provider errors", async () => {
    const error = Object.assign(new Error("unauthorized"), {
      retryable: false,
      kind: "auth",
    });
    providerCallMock.mockRejectedValueOnce(error);

    await expect(callLlm("prompt", { maxRetries: 2, retryBaseMs: 0 })).rejects.toBe(error);

    expect(providerCallMock).toHaveBeenCalledTimes(1);
    expect(sleepMock).not.toHaveBeenCalled();
  });

  it("reuses the same provider instance across repeated calls", async () => {
    providerCallMock.mockResolvedValue("ok");

    await expect(callLlm("prompt-1")).resolves.toBe("ok");
    await expect(callLlm("prompt-2")).resolves.toBe("ok");

    expect(createProviderMock).toHaveBeenCalledTimes(1);
    expect(providerCallMock).toHaveBeenCalledTimes(2);
  });

  it("redacts sensitive values before sending the prompt to the provider", async () => {
    providerCallMock.mockResolvedValue("ok");

    const prompt = [
      "DEEPSEEK_API_KEY=sk-1234567890abcdefghijklmn",
      "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature",
      "cookie: sessionid=abcdef1234567890",
      "proxy=http://user:pass@example.com:8080",
    ].join("\n");

    await expect(callLlm(prompt)).resolves.toBe("ok");

    const sentPrompt = String(providerCallMock.mock.calls[0]?.[0] ?? "");
    expect(sentPrompt).toContain("[REDACTED_SECRET]");
    expect(sentPrompt).not.toContain("sk-1234567890abcdefghijklmn");
    expect(sentPrompt).not.toContain("user:pass@example.com");
    expect(sentPrompt).not.toContain("sessionid=abcdef1234567890");
    expect(sentPrompt).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature");
  });

  it("keeps ordinary prompts readable while redacting env-secret exact matches", () => {
    const prompt = "Use token SECRET_TEST_12345678 for the demo and explain the repo.";
    const sanitized = sanitizePromptForLlm(prompt, {
      DEMO_API_KEY: "SECRET_TEST_12345678",
    } as NodeJS.ProcessEnv);

    expect(sanitized.prompt).toContain("[REDACTED_SECRET]");
    expect(sanitized.prompt).toContain("explain the repo");
    expect(sanitized.redactionCount).toBeGreaterThan(0);
  });
});
