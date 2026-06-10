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
    });
  }

  async call(prompt: string, maxTokens: number): Promise<string> {
    try {
      // 这里统一走 chat.completions，保证兼容 provider 的最小公共能力一致。
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_completion_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      });
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
