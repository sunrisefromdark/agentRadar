import { sleep } from "./date.ts";

interface RetryOptions<T> {
  shouldRetryResult?: (result: T) => boolean;
  describeResult?: (result: T) => string;
}

export async function withRetry<T>(
  label: string,
  attempts: number,
  baseDelayMs: number,
  fn: () => Promise<T>,
  options: RetryOptions<T> = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const result = await fn();
      const shouldRetryResult = options.shouldRetryResult?.(result) ?? false;
      if (!shouldRetryResult) {
        return result;
      }

      const isLast = attempt === attempts - 1;
      if (isLast) {
        return result;
      }

      const waitMs = baseDelayMs * 2 ** attempt;
      const resultSummary = options.describeResult ? ` (${options.describeResult(result)})` : "";
      console.warn(
        `[retry] ${label} returned retryable result${resultSummary}; retry ${attempt + 1}/${attempts - 1} in ${waitMs}ms`,
      );
      await sleep(waitMs);
    } catch (err) {
      lastError = err;
      const isLast = attempt === attempts - 1;
      if (isLast) break;
      const waitMs = baseDelayMs * 2 ** attempt;
      console.warn(`[retry] ${label} failed; retry ${attempt + 1}/${attempts - 1} in ${waitMs}ms`);
      await sleep(waitMs);
    }
  }
  throw lastError;
}
