/**
 * Abstract LLM provider interface.
 *
 * All concrete providers must implement this contract so the rest of the
 * codebase can stay provider-agnostic.
 */

export interface LlmProvider {
  /** Human-readable provider identifier (e.g. "anthropic", "openai"). */
  readonly name: string;
  /** Send a prompt and return the model's text response. */
  call(prompt: string, maxTokens: number): Promise<string>;
}

/** Factory function that creates an LlmProvider instance. */
export type ProviderFactory = () => LlmProvider;

export type { ProviderErrorKind, ProviderErrorMetadata } from "./providerErrors.ts";
export {
  ProviderCallError,
  buildProviderResponseError,
  classifyProviderError,
  formatProviderError,
  isRateLimitProviderError,
  isRetryableProviderError,
} from "./providerErrors.ts";
