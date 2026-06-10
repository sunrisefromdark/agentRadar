/**
 * Anthropic provider: wraps the @anthropic-ai/sdk.
 *
 * Env vars:
 *   ANTHROPIC_API_KEY   - API key (read automatically by the SDK)
 *   ANTHROPIC_BASE_URL  - endpoint override (read automatically by the SDK)
 *   ANTHROPIC_MODEL     - model name (default: claude-sonnet-4-6)
 */

import Anthropic from "@anthropic-ai/sdk";
import { buildProviderResponseError, classifyProviderError } from "./providerErrors.ts";
import type { LlmProvider } from "./types.ts";

/**
 * 这里保持 provider 封装尽量薄：
 * 只负责把项目内统一的 LlmProvider 接口映射到 Anthropic SDK，
 * 不在这一层混入业务 prompt、评分规则或复杂降级逻辑。
 */
export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(model?: string) {
    this.model = model ?? process.env["ANTHROPIC_MODEL"] ?? "claude-sonnet-4-6";
    // 由 SDK 自行读取 ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL，调用层不重复解析。
    this.client = new Anthropic();
  }

  async call(prompt: string, maxTokens: number): Promise<string> {
    try {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      });
      const block = message.content.find((item) => item.type === "text");
      if (!block) {
        throw buildProviderResponseError(this.name, "response_shape", "Unexpected response type from Anthropic");
      }
      return block.text;
    } catch (error) {
      throw classifyProviderError(this.name, error);
    }
  }
}
