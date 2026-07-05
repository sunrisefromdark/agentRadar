/**
 * Base class for OpenAI-compatible providers.
 *
 * Shared by OpenAI, GitHub Copilot, and OpenRouter providers.
 */

/**
 * 这里抽的是“协议兼容层”，不是业务层。
 * 目的只是把 OpenAI-compatible provider 的共同调用方式收敛到一处，
 * 避免 OpenAI / OpenRouter / GitHub Copilot 各自复制同一套请求拼装逻辑。
 */

import OpenAI from "openai";
import { buildProviderResponseError, classifyProviderError } from "./providerErrors.ts";
import type { LlmProvider } from "./types.ts";

const DEFAULT_PROVIDER_TIMEOUT_MS = 60_000;

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveProviderTimeoutMs(): number {
  return readPositiveInt(
    process.env["LLM_PROVIDER_TIMEOUT_MS"] ?? process.env["LLM_TIMEOUT_MS"] ?? process.env["OPENAI_TIMEOUT_MS"],
    DEFAULT_PROVIDER_TIMEOUT_MS,
  );
}

export abstract class OpenAICompatibleProvider implements LlmProvider {
  abstract readonly name: string;
  protected readonly client: OpenAI;
  protected readonly model: string;

  constructor(opts: { apiKey?: string; baseURL?: string; model: string }) {
    this.model = opts.model;
    this.client = new OpenAI({
      apiKey: opts.apiKey,
      baseURL: opts.baseURL,
      maxRetries: 0,
      timeout: resolveProviderTimeoutMs(),
    });
  }

  protected async runWithTimeout<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), resolveProviderTimeoutMs());
    try {
      return await operation(controller.signal);
    } finally {
      clearTimeout(timeout);
    }
  }

  async call(prompt: string, maxTokens: number): Promise<string> {
    try {
      // 这里统一走 chat.completions，保证兼容 provider 的最小公共能力一致。
      const response = await this.runWithTimeout((signal) =>
        this.client.chat.completions.create(
          {
            model: this.model,
            max_completion_tokens: maxTokens,
            messages: [{ role: "user", content: prompt }],
          },
          { signal },
        ),
      );
      const text = response.choices[0]?.message?.content;
      if (!text) {
        throw buildProviderResponseError(this.name, "empty_response", `Unexpected empty response from ${this.name}`);
      }
      return text;
    } catch (error) {
      throw classifyProviderError(this.name, error);
    }
  }
}
