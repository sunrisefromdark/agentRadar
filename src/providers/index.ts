/**
 * Provider barrel: re-exports and factory.
 *
 * Usage:
 *   import { createProvider, type LlmProvider } from "./providers/index.ts";
 */

export type { LlmProvider, ProviderFactory } from "./types.ts";
export { OpenAICompatibleProvider } from "./openai-compatible.ts";
export { AnthropicProvider } from "./anthropic.ts";
export { OpenAIProvider } from "./openai.ts";
export { DeepSeekProvider, resolveDeepSeekConnectionInfo } from "./deepseek.ts";
export { GitHubCopilotProvider } from "./github-copilot.ts";
export { OpenRouterProvider } from "./openrouter.ts";
export { MiniMaxProvider, resolveMiniMaxConnectionInfo } from "./minimax.ts";
export {
  ProviderCallError,
  buildProviderResponseError,
  classifyProviderError,
  formatProviderError,
  isRateLimitProviderError,
  isRetryableProviderError,
} from "./providerErrors.ts";

import type { LlmProvider, ProviderFactory } from "./types.ts";
import { AnthropicProvider } from "./anthropic.ts";
import { OpenAIProvider } from "./openai.ts";
import { DeepSeekProvider } from "./deepseek.ts";
import { GitHubCopilotProvider } from "./github-copilot.ts";
import { OpenRouterProvider } from "./openrouter.ts";
import { MiniMaxProvider } from "./minimax.ts";

// ---------------------------------------------------------------------------
// Single source of truth: add new providers here only.
// ---------------------------------------------------------------------------

// 中文约束说明：
// provider 注册表是唯一可信入口。后续新增 provider 时，只允许在这里注册，
// 避免不同调用点各自维护 provider 名称、默认值和错误提示，导致配置语义漂移。

const PROVIDERS = {
  anthropic: () => new AnthropicProvider(),
  openai: () => new OpenAIProvider(),
  deepseek: () => new DeepSeekProvider(),
  "github-copilot": () => new GitHubCopilotProvider(),
  openrouter: () => new OpenRouterProvider(),
  minimax: () => new MiniMaxProvider(),
} satisfies Record<string, ProviderFactory>;

/** Supported provider name derived from the PROVIDERS registry. */
export type ProviderName = keyof typeof PROVIDERS;

/** All valid provider names derived from the registry. */
export const VALID_PROVIDER_NAMES = Object.keys(PROVIDERS) as ProviderName[];

/**
 * Create an LLM provider by name.
 *
 * Reads `LLM_PROVIDER` env var when no explicit name is given.
 * Throws a descriptive error if the provider name is invalid.
 *
 * Log safety: only the provider name is logged; never API keys or endpoint URLs.
 */
export function createProvider(name?: ProviderName): LlmProvider {
  const providerName = name ?? (process.env["LLM_PROVIDER"] as ProviderName | undefined) ?? "anthropic";

  const factory = (PROVIDERS as Record<string, ProviderFactory | undefined>)[providerName];
  if (!factory) {
    throw new Error(
      `Invalid LLM provider: "${providerName}". ` +
        `Valid providers are: ${VALID_PROVIDER_NAMES.join(", ")}. ` +
        `Set the LLM_PROVIDER env var to one of these values.`,
    );
  }

  console.log(`[providers] Using LLM provider: ${providerName}`);
  return factory();
}
