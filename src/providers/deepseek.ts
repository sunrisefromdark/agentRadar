/**
 * DeepSeek provider — OpenAI-compatible endpoint via api.deepseek.com.
 *
 * Env vars:
 *   DEEPSEEK_API_KEY    - API key
 *   DEEPSEEK_BASE_URL   - endpoint override (optional)
 *   DEEPSEEK_MODEL      - model name (default: deepseek-v4-flash)
 */

import type OpenAI from "openai";
import { OpenAICompatibleProvider } from "./openai-compatible.ts";
import { buildProviderResponseError, classifyProviderError, ProviderCallError } from "./providerErrors.ts";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEEPSEEK_DEFAULT_MODEL = "deepseek-v4-flash";
const DEEPSEEK_DEFAULT_COMPLEX_MODEL = "deepseek-v4-pro";
const DEEPSEEK_DEFAULT_COMPLEX_PROMPT_HINTS = [
  "You are the weekly trend review agent.",
  "Input legend: repo repo_full_name, surf surface rank",
];

function wantsJsonOutput(prompt: string): boolean {
  return /\bjson\b/i.test(prompt);
}

function readCsvList(value: string | undefined, fallback: string[]): string[] {
  if (!value?.trim()) return fallback;
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
}

type DeepSeekChatCompletionRequest = OpenAI.Chat.ChatCompletionCreateParamsNonStreaming & {
  thinking?: { type: "disabled" };
};

export function resolveDeepSeekConnectionInfo(opts?: {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  env?: NodeJS.ProcessEnv;
}): {
  apiKey?: string;
  baseURL: string;
  model: string;
  complexModel: string;
  complexPromptHints: string[];
} {
  const env = opts?.env ?? process.env;
  return {
    apiKey: opts?.apiKey ?? env["DEEPSEEK_API_KEY"],
    baseURL: opts?.baseURL ?? env["DEEPSEEK_BASE_URL"] ?? DEEPSEEK_BASE_URL,
    model: opts?.model ?? env["DEEPSEEK_MODEL"] ?? DEEPSEEK_DEFAULT_MODEL,
    complexModel: env["DEEPSEEK_COMPLEX_MODEL"] ?? DEEPSEEK_DEFAULT_COMPLEX_MODEL,
    complexPromptHints: readCsvList(
      env["DEEPSEEK_COMPLEX_PROMPT_HINTS"],
      DEEPSEEK_DEFAULT_COMPLEX_PROMPT_HINTS,
    ),
  };
}

export class DeepSeekProvider extends OpenAICompatibleProvider {
  readonly name = "deepseek";
  private readonly complexModel: string;
  private readonly complexPromptHints: string[];
  private readonly hasApiKey: boolean;

  constructor(opts?: { apiKey?: string; baseURL?: string; model?: string }) {
    const connection = resolveDeepSeekConnectionInfo(opts);
    super({
      ...connection,
      apiKey: connection.apiKey?.trim() ? connection.apiKey : "missing-deepseek-api-key",
    });
    this.complexModel = connection.complexModel;
    this.complexPromptHints = connection.complexPromptHints;
    this.hasApiKey = Boolean(connection.apiKey?.trim());
  }

  private selectModel(prompt: string): string {
    return this.complexPromptHints.some((hint) => prompt.includes(hint)) ? this.complexModel : this.model;
  }

  async call(prompt: string, maxTokens: number): Promise<string> {
    try {
      if (!this.hasApiKey) {
        throw new ProviderCallError("Missing DEEPSEEK_API_KEY for DeepSeek provider.", {
          providerName: this.name,
          kind: "auth",
          retryable: false,
        });
      }
      const request: DeepSeekChatCompletionRequest = {
        model: this.selectModel(prompt),
        max_completion_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
        // Keep semantic-classification output stable on v4-flash by opting out of
        // the default thinking mode unless the caller selects another model.
        thinking: { type: "disabled" },
        ...(wantsJsonOutput(prompt) ? { response_format: { type: "json_object" } } : {}),
      };
      const response = await this.client.chat.completions.create(
        request as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
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
