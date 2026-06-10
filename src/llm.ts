import { sleep } from "./date.ts";
import {
  createProvider,
  formatProviderError,
  isRetryableProviderError,
  type LlmProvider,
} from "./providers/index.ts";

export const LLM_TOKENS_CLASSIFICATION = 1024;

const DEFAULT_LLM_CONCURRENCY = 2;
const DEFAULT_LLM_MAX_RETRIES = 1;
const DEFAULT_LLM_RETRY_BASE_MS = 1000;
const providerCache = new Map<string, LlmProvider>();
let slots = readPositiveInt(process.env["LLM_CONCURRENCY"], DEFAULT_LLM_CONCURRENCY);
const queue: Array<() => void> = [];

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveProvider(providerName?: string): LlmProvider {
  const cacheKey = providerName ?? process.env["LLM_PROVIDER"] ?? "anthropic";
  const cached = providerCache.get(cacheKey);
  if (cached) return cached;

  const provider = createProvider(providerName as never);
  providerCache.set(cacheKey, provider);
  return provider;
}

export function resetLlmStateForTests(): void {
  providerCache.clear();
  slots = readPositiveInt(process.env["LLM_CONCURRENCY"], DEFAULT_LLM_CONCURRENCY);
  queue.length = 0;
}

function acquireSlot(): Promise<void> {
  if (slots > 0) {
    slots--;
    return Promise.resolve();
  }
  return new Promise((resolve) => queue.push(resolve));
}

function releaseSlot(): void {
  const next = queue.shift();
  if (next) {
    next();
  } else {
    slots++;
  }
}

/**
 * LLM 调用层只消费 provider 归一化后的错误语义。
 * 这样重试策略不再依赖 SDK 原始字符串细节，后续接更多 provider 也能复用。
 */
export async function callLlm(
  prompt: string,
  opts: { providerName?: string; maxTokens?: number; maxRetries?: number; retryBaseMs?: number } = {},
): Promise<string> {
  const provider = resolveProvider(opts.providerName);
  const maxTokens = opts.maxTokens ?? LLM_TOKENS_CLASSIFICATION;
  const maxRetries = opts.maxRetries ?? readPositiveInt(process.env["LLM_MAX_RETRIES"], DEFAULT_LLM_MAX_RETRIES);
  const retryBaseMs = opts.retryBaseMs ?? readPositiveInt(process.env["LLM_RETRY_BASE_MS"], DEFAULT_LLM_RETRY_BASE_MS);

  for (let attempt = 0; ; attempt++) {
    await acquireSlot();
    let released = false;
    try {
      return await provider.call(prompt, maxTokens);
    } catch (err) {
      if (attempt < maxRetries && isRetryableProviderError(err)) {
        releaseSlot();
        released = true;
        const wait = retryBaseMs * 2 ** attempt;
        console.error(`[llm] 可重试 provider 错误；${wait / 1000}s 后进行第 ${attempt + 1}/${maxRetries} 次重试: ${formatProviderError(err)}`);
        await sleep(wait);
        continue;
      }
      throw err instanceof Error ? err : new Error(formatProviderError(err));
    } finally {
      if (!released) releaseSlot();
    }
  }
}
