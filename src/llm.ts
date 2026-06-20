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
const REDACTED_SECRET = "[REDACTED_SECRET]";
const REDACTED_BLOCK = "[REDACTED_BLOCK]";
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceAllWithCount(
  source: string,
  pattern: RegExp,
  replacer: string | ((substring: string, ...args: string[]) => string),
): { text: string; count: number } {
  let count = 0;
  const text = source.replace(pattern, (...args) => {
    count += 1;
    return typeof replacer === "string" ? replacer : replacer(args[0], ...(args.slice(1, -2) as string[]));
  });
  return { text, count };
}

function collectSensitiveEnvValues(env: NodeJS.ProcessEnv): string[] {
  const values = new Set<string>();
  for (const [key, rawValue] of Object.entries(env)) {
    const value = rawValue?.trim();
    if (!value || value.length < 8) continue;
    if (/^(true|false|null|undefined|0|1)$/i.test(value)) continue;

    if (/(key|token|secret|password|passwd|cookie|authorization|session|private[_-]?key|client[_-]?secret)/i.test(key)) {
      values.add(value);
      continue;
    }

    if (/proxy/i.test(key) && /:\/\/[^/\s:@]+:[^/\s@]+@/i.test(value)) {
      values.add(value);
    }
  }
  return [...values].sort((left, right) => right.length - left.length);
}

export function sanitizePromptForLlm(prompt: string, env: NodeJS.ProcessEnv = process.env): { prompt: string; redactionCount: number } {
  let sanitized = prompt;
  let redactionCount = 0;

  for (const secret of collectSensitiveEnvValues(env)) {
    const escaped = escapeRegExp(secret);
    const result = replaceAllWithCount(sanitized, new RegExp(escaped, "g"), REDACTED_SECRET);
    sanitized = result.text;
    redactionCount += result.count;
  }

  const exactPatterns: Array<[RegExp, string | ((substring: string, ...args: string[]) => string)]> = [
    [/-----BEGIN [A-Z0-9 ]+-----[\s\S]*?-----END [A-Z0-9 ]+-----/g, REDACTED_BLOCK],
    [/\bAuthorization(\s*:\s*)(?:Bearer\s+)?[^\n]+/gi, (_all, separator: string) => `Authorization${separator}${REDACTED_SECRET}`],
    [/\b(cookie|set-cookie)(\s*:\s*)[^\n]+/gi, (_all, name: string, separator: string) => `${name}${separator}${REDACTED_SECRET}`],
    [
      /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|auth(?:orization)?|secret|password|passwd|session(?:[_-]?token)?|cookie|bearer[_-]?token|private[_-]?key|client[_-]?secret)\b(\s*[:=]\s*)(["'`]?)([^\s"'`\n]+)(\3)/gi,
      (_all, key: string, separator: string, quote: string) => `${key}${separator}${quote}${REDACTED_SECRET}${quote}`,
    ],
    [/((?:https?|socks5?):\/\/)([^/\s:@]+):([^/\s@]+)@/gi, (_all, scheme: string) => `${scheme}${REDACTED_SECRET}@`],
    [/(Bearer\s+)([A-Za-z0-9._\-+/=]{8,})/gi, (_all, prefix: string) => `${prefix}${REDACTED_SECRET}`],
    [/\bsk-ant-[A-Za-z0-9\-_]{12,}\b/g, REDACTED_SECRET],
    [/\bsk-or-v1-[A-Za-z0-9\-_]{12,}\b/g, REDACTED_SECRET],
    [/\bsk-[A-Za-z0-9\-_]{12,}\b/g, REDACTED_SECRET],
    [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, REDACTED_SECRET],
    [/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, REDACTED_SECRET],
    [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, REDACTED_SECRET],
    [/\bAKIA[0-9A-Z]{16}\b/g, REDACTED_SECRET],
    [/\bAIza[0-9A-Za-z\-_]{20,}\b/g, REDACTED_SECRET],
    [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9._-]{8,}\.[A-Za-z0-9._-]{8,}\b/g, REDACTED_SECRET],
  ];

  for (const [pattern, replacer] of exactPatterns) {
    const result = replaceAllWithCount(sanitized, pattern, replacer);
    sanitized = result.text;
    redactionCount += result.count;
  }

  return { prompt: sanitized, redactionCount };
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
  const sanitizedPrompt = sanitizePromptForLlm(prompt).prompt;
  const maxTokens = opts.maxTokens ?? LLM_TOKENS_CLASSIFICATION;
  const maxRetries = opts.maxRetries ?? readPositiveInt(process.env["LLM_MAX_RETRIES"], DEFAULT_LLM_MAX_RETRIES);
  const retryBaseMs = opts.retryBaseMs ?? readPositiveInt(process.env["LLM_RETRY_BASE_MS"], DEFAULT_LLM_RETRY_BASE_MS);

  for (let attempt = 0; ; attempt++) {
    await acquireSlot();
    let released = false;
    try {
      return await provider.call(sanitizedPrompt, maxTokens);
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
