/**
 * MiniMax provider with compatibility for both Anthropic-style and
 * OpenAI-compatible endpoints.
 *
 * Env vars:
 *   MINIMAX_API_KEY           - API key
 *   MINIMAX_API_BASE          - preferred endpoint override
 *   MINIMAX_BASE_URL          - legacy endpoint override alias
 *   MINIMAX_COMPLETION_MODEL  - preferred model name
 *   MINIMAX_MODEL             - legacy model name alias
 *   MINIMAX_API_STYLE         - "anthropic-messages" | "openai-compatible"
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { buildProviderResponseError, classifyProviderError } from "./providerErrors.ts";
import type { LlmProvider } from "./types.ts";

const MINIMAX_ANTHROPIC_BASE_URL = "https://api.minimax.io/anthropic";
const MINIMAX_OPENAI_BASE_URL = "https://api.minimax.io/v1";

export type MiniMaxApiStyle = "anthropic-messages" | "openai-compatible";

export interface MiniMaxConnectionInfo {
  baseURL: string;
  model: string;
  apiStyle: MiniMaxApiStyle;
}

function alternateMiniMaxBaseURL(baseURL: string, apiStyle: MiniMaxApiStyle): string | undefined {
  const anthropicPath = "/anthropic";
  const openAiPath = "/v1";
  const currentPath = apiStyle === "anthropic-messages" ? anthropicPath : openAiPath;

  if (baseURL === `https://api.minimaxi.com${currentPath}`) {
    return `https://api.minimax.io${currentPath}`;
  }
  if (baseURL === `https://api.minimax.io${currentPath}`) {
    return `https://api.minimaxi.com${currentPath}`;
  }
  return undefined;
}

export function resolveMiniMaxConnectionInfo(opts?: {
  baseURL?: string;
  model?: string;
  apiStyle?: MiniMaxApiStyle;
  env?: NodeJS.ProcessEnv;
}): MiniMaxConnectionInfo {
  const env = opts?.env ?? process.env;
  const configuredBaseURL = opts?.baseURL ?? env["MINIMAX_API_BASE"] ?? env["MINIMAX_BASE_URL"];
  const configuredStyle = opts?.apiStyle ?? readMiniMaxApiStyle(env["MINIMAX_API_STYLE"]);
  const apiStyle = configuredStyle ?? inferMiniMaxApiStyle(configuredBaseURL);
  const baseURL = configuredBaseURL ?? defaultBaseURLForStyle(apiStyle);

  return {
    baseURL,
    model: normalizeMiniMaxModel(
      opts?.model ?? env["MINIMAX_COMPLETION_MODEL"] ?? env["MINIMAX_MODEL"] ?? "MiniMax-M2.7",
      apiStyle,
    ),
    apiStyle,
  };
}

function readMiniMaxApiStyle(value: string | undefined): MiniMaxApiStyle | undefined {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "anthropic-messages" || normalized === "openai-compatible") {
    return normalized;
  }
  return undefined;
}

function inferMiniMaxApiStyle(baseURL: string | undefined): MiniMaxApiStyle {
  return baseURL?.includes("/anthropic") ? "anthropic-messages" : "openai-compatible";
}

function defaultBaseURLForStyle(apiStyle: MiniMaxApiStyle): string {
  return apiStyle === "anthropic-messages" ? MINIMAX_ANTHROPIC_BASE_URL : MINIMAX_OPENAI_BASE_URL;
}

function normalizeMiniMaxModel(model: string, apiStyle: MiniMaxApiStyle): string {
  const configured = model.trim();
  if (!configured) {
    return "MiniMax-M2.7";
  }

  if (configured.startsWith("anthropic/")) {
    return apiStyle === "anthropic-messages" ? configured.slice("anthropic/".length) : configured;
  }
  if (configured.startsWith("openai/")) {
    return apiStyle === "openai-compatible" ? configured.slice("openai/".length) : configured;
  }
  if (configured.startsWith("minimax/")) {
    return configured.slice("minimax/".length);
  }
  return configured;
}

type ContentBlock = {
  type?: string;
  text?: string;
  thinking?: string;
};

const NON_OUTPUT_BLOCK_TYPES = new Set(["reasoning", "thinking"]);

function extractMiniMaxText(content: unknown): string | undefined {
  if (!Array.isArray(content)) return undefined;

  const textEntries = content
    .map((item) => {
      if (!item || typeof item !== "object") return undefined;
      const candidate = item as ContentBlock;
      const textValue =
        typeof candidate.text === "string" && candidate.text.trim()
          ? candidate.text
          : typeof candidate.thinking === "string" && candidate.thinking.trim()
            ? candidate.thinking
            : undefined;
      if (!textValue) return undefined;
      return {
        type: candidate.type ?? "unknown",
        text: textValue,
      };
    })
    .filter((item): item is { type: string; text: string } => Boolean(item));

  if (textEntries.length === 0) return undefined;

  const preferredText = textEntries
    .filter((entry) => !NON_OUTPUT_BLOCK_TYPES.has(entry.type))
    .map((entry) => entry.text);
  const fallbackText = textEntries.map((entry) => entry.text);
  const textParts = preferredText.length > 0 ? preferredText : fallbackText;
  return textParts.join("\n").trim();
}

function summarizeMiniMaxContent(content: unknown): string {
  if (!Array.isArray(content)) {
    return `content_type=${typeof content}`;
  }

  const blockTypes = content.map((item) => {
    if (!item || typeof item !== "object") return typeof item;
    const candidate = item as ContentBlock;
    return candidate.type ?? "unknown";
  });

  return `block_types=${blockTypes.join(",") || "none"}`;
}

function isRetryableMiniMaxTransportError(error: unknown): boolean {
  const status = typeof error === "object" && error && "status" in error ? (error as { status?: unknown }).status : undefined;
  if (typeof status === "number" && (status === 408 || status === 429 || status >= 500)) return true;

  const text = String(error).toLowerCase();
  return (
    text.includes("timeout") ||
    text.includes("fetch failed") ||
    text.includes("econnreset") ||
    text.includes("enotfound") ||
    text.includes("socket hang up") ||
    text.includes("network")
  );
}

export class MiniMaxProvider implements LlmProvider {
  readonly name = "minimax";
  private readonly anthropicClient?: Anthropic;
  private readonly openAiClient?: OpenAI;
  private readonly model: string;
  private readonly apiStyle: MiniMaxApiStyle;
  private readonly apiKey?: string;
  private readonly baseURL: string;
  private readonly fallbackBaseURL?: string;

  constructor(opts?: { apiKey?: string; baseURL?: string; model?: string; apiStyle?: MiniMaxApiStyle }) {
    const connection = resolveMiniMaxConnectionInfo({
      baseURL: opts?.baseURL,
      model: opts?.model,
      apiStyle: opts?.apiStyle,
    });
    const apiKey = opts?.apiKey ?? process.env["MINIMAX_API_KEY"];
    this.model = connection.model;
    this.apiStyle = connection.apiStyle;
    this.apiKey = apiKey;
    this.baseURL = connection.baseURL;
    this.fallbackBaseURL = alternateMiniMaxBaseURL(connection.baseURL, connection.apiStyle);

    if (connection.apiStyle === "anthropic-messages") {
      this.anthropicClient = new Anthropic({
        apiKey,
        baseURL: connection.baseURL,
      });
      return;
    }

    this.openAiClient = new OpenAI({
      apiKey,
      baseURL: connection.baseURL,
      maxRetries: 0,
    });
  }

  private async callAnthropic(prompt: string, maxTokens: number, client: Anthropic): Promise<string> {
    const message = await client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      temperature: 0.1,
      thinking: { type: "disabled" } as never,
      messages: [{ role: "user", content: prompt }],
    });
    const text = extractMiniMaxText(message.content);
    if (!text) {
      const details = summarizeMiniMaxContent(message.content);
      throw buildProviderResponseError(
        this.name,
        "response_shape",
        `Unexpected response type from minimax (${details})`,
      );
    }
    return text;
  }

  private async callOpenAiCompatible(prompt: string, maxTokens: number, client: OpenAI): Promise<string> {
    const response = await client.chat.completions.create({
      model: this.model,
      max_completion_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.choices[0]?.message?.content;
    if (!text) {
      throw buildProviderResponseError(this.name, "empty_response", "Unexpected empty response from minimax");
    }
    return text;
  }

  private buildFallbackAnthropicClient(): Anthropic | undefined {
    if (!this.fallbackBaseURL) return undefined;
    return new Anthropic({
      apiKey: this.apiKey,
      baseURL: this.fallbackBaseURL,
    });
  }

  private buildFallbackOpenAiClient(): OpenAI | undefined {
    if (!this.fallbackBaseURL) return undefined;
    return new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.fallbackBaseURL,
      maxRetries: 0,
    });
  }

  async call(prompt: string, maxTokens: number): Promise<string> {
    try {
      if (this.apiStyle === "anthropic-messages") {
        try {
          return await this.callAnthropic(prompt, maxTokens, this.anthropicClient!);
        } catch (error) {
          if (!this.fallbackBaseURL || !isRetryableMiniMaxTransportError(error)) throw error;
          return this.callAnthropic(prompt, maxTokens, this.buildFallbackAnthropicClient()!);
        }
      }

      try {
        return await this.callOpenAiCompatible(prompt, maxTokens, this.openAiClient!);
      } catch (error) {
        if (!this.fallbackBaseURL || !isRetryableMiniMaxTransportError(error)) throw error;
        return this.callOpenAiCompatible(prompt, maxTokens, this.buildFallbackOpenAiClient()!);
      }
    } catch (error) {
      throw classifyProviderError(this.name, error);
    }
  }
}
