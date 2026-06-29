import { withRetry } from "../retry.ts";

export interface GitHubSearchRuntimeOptions {
  timeoutMs: number;
  retryAttempts: number;
  retryBaseDelayMs: number;
}

export type GitHubSearchFailureReason =
  | "circuit_open"
  | "auth_invalid"
  | "rate_limited"
  | "network_or_5xx"
  | "timeout"
  | "http_error";

export interface GitHubSearchSuccess {
  status: "ok";
  response: Response;
  usedUnauthenticatedRetry: boolean;
}

export interface GitHubSearchFailure {
  status: "failed" | "circuit_open";
  reason: GitHubSearchFailureReason;
  error: string;
  http_status?: number;
  usedUnauthenticatedRetry: boolean;
  circuit_open_reason?: "auth_invalid" | "rate_limited" | "network_or_5xx";
  circuit_open_until?: number;
}

export type GitHubSearchResult = GitHubSearchSuccess | GitHubSearchFailure;

const AUTH_INVALID_COOLDOWN_MS = 60 * 60 * 1000;
const RATE_LIMIT_DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;
const TRANSIENT_DEFAULT_COOLDOWN_MS = 60 * 1000;
const TRANSIENT_FAILURES_TO_OPEN = 3;

const circuitState: {
  openUntil: number;
  reason: "auth_invalid" | "rate_limited" | "network_or_5xx" | null;
  consecutiveTransientFailures: number;
} = {
  openUntil: 0,
  reason: null,
  consecutiveTransientFailures: 0,
};

export function resetGitHubSearchRuntimeState(): void {
  circuitState.openUntil = 0;
  circuitState.reason = null;
  circuitState.consecutiveTransientFailures = 0;
}

function fetchWithTimeout(url: string, headers: Record<string, string>, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { headers, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function githubApiHeadersWithAuth(includeAuth: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "agent-radar/0.1",
  };
  const token = process.env["GITHUB_TOKEN"];
  if (includeAuth && token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function parseRetryAfterMs(response: Response): number | undefined {
  const retryAfter = response.headers.get("retry-after");
  if (!retryAfter) return undefined;
  const seconds = Number.parseInt(retryAfter, 10);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;

  const dateMs = Date.parse(retryAfter);
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
  return undefined;
}

function isRetryableStatus(status: number): boolean {
  return status === 403 || status === 429 || status >= 500;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function clearExpiredCircuit(now: number): void {
  if (circuitState.reason && circuitState.openUntil <= now) {
    circuitState.openUntil = 0;
    circuitState.reason = null;
  }
}

function currentCircuitOpen(): GitHubSearchFailure | null {
  const now = Date.now();
  clearExpiredCircuit(now);
  if (!circuitState.reason || circuitState.openUntil <= now) return null;
  return {
    status: "circuit_open",
    reason: "circuit_open",
    error: `GitHub Search circuit is open due to ${circuitState.reason}`,
    usedUnauthenticatedRetry: false,
    circuit_open_reason: circuitState.reason,
    circuit_open_until: circuitState.openUntil,
  };
}

function openCircuit(reason: "auth_invalid" | "rate_limited" | "network_or_5xx", cooldownMs: number): void {
  circuitState.reason = reason;
  circuitState.openUntil = Date.now() + cooldownMs;
  circuitState.consecutiveTransientFailures = 0;
}

function recordSuccess(): void {
  circuitState.consecutiveTransientFailures = 0;
  clearExpiredCircuit(Date.now());
}

function recordTransientFailure(): void {
  circuitState.consecutiveTransientFailures += 1;
  if (circuitState.consecutiveTransientFailures >= TRANSIENT_FAILURES_TO_OPEN) {
    openCircuit("network_or_5xx", TRANSIENT_DEFAULT_COOLDOWN_MS);
  }
}

async function fetchGitHubSearchResponseWithRetry(
  url: string,
  options: GitHubSearchRuntimeOptions,
  includeAuth: boolean,
  retryLabel: string,
): Promise<Response> {
  return withRetry(
    retryLabel,
    options.retryAttempts,
    options.retryBaseDelayMs,
    () => fetchWithTimeout(url, githubApiHeadersWithAuth(includeAuth), options.timeoutMs),
    {
      shouldRetryResult: (resp) => isRetryableStatus(resp.status),
      describeResult: (resp) => `HTTP ${resp.status}`,
    },
  );
}

export async function executeGitHubSearchRequest(
  url: string,
  label: string,
  options: GitHubSearchRuntimeOptions,
): Promise<GitHubSearchResult> {
  const openCircuitState = currentCircuitOpen();
  if (openCircuitState) return openCircuitState;

  const tokenPresent = Boolean(process.env["GITHUB_TOKEN"]);
  let usedUnauthenticatedRetry = false;

  try {
    const initialResponse = await fetchGitHubSearchResponseWithRetry(
      url,
      options,
      true,
      `${label}:${url}`,
    );
    let effectiveResponse = initialResponse;
    if (initialResponse.status === 401 && tokenPresent) {
      usedUnauthenticatedRetry = true;
      effectiveResponse = await fetchGitHubSearchResponseWithRetry(
        url,
        options,
        false,
        `${label}:${url}:unauth`,
      );
      if (!effectiveResponse.ok) {
        openCircuit("auth_invalid", AUTH_INVALID_COOLDOWN_MS);
        return {
          status: "failed",
          reason: "auth_invalid",
          error: `GitHub Search auth fallback failed with HTTP ${effectiveResponse.status}`,
          http_status: effectiveResponse.status,
          usedUnauthenticatedRetry,
        };
      }
    }

    if (effectiveResponse.ok) {
      recordSuccess();
      return {
        status: "ok",
        response: effectiveResponse,
        usedUnauthenticatedRetry,
      };
    }

    if (effectiveResponse.status === 403 || effectiveResponse.status === 429) {
      openCircuit("rate_limited", parseRetryAfterMs(effectiveResponse) ?? RATE_LIMIT_DEFAULT_COOLDOWN_MS);
      return {
        status: "failed",
        reason: "rate_limited",
        error: `GitHub Search returned HTTP ${effectiveResponse.status}`,
        http_status: effectiveResponse.status,
        usedUnauthenticatedRetry,
      };
    }

    if (effectiveResponse.status >= 500) {
      recordTransientFailure();
      return {
        status: "failed",
        reason: "network_or_5xx",
        error: `GitHub Search returned HTTP ${effectiveResponse.status}`,
        http_status: effectiveResponse.status,
        usedUnauthenticatedRetry,
      };
    }

    return {
      status: "failed",
      reason: "http_error",
      error: `GitHub Search returned HTTP ${effectiveResponse.status}`,
      http_status: effectiveResponse.status,
      usedUnauthenticatedRetry,
    };
  } catch (error) {
    recordTransientFailure();
    return {
      status: "failed",
      reason: isAbortError(error) ? "timeout" : "network_or_5xx",
      error: error instanceof Error ? error.message : String(error),
      usedUnauthenticatedRetry,
    };
  }
}

export async function mapInBatchesOrdered<T, R>(
  items: T[],
  batchSize: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const normalizedBatchSize = Math.max(1, batchSize);
  const results: R[] = [];
  for (let i = 0; i < items.length; i += normalizedBatchSize) {
    const chunk = items.slice(i, i + normalizedBatchSize);
    const chunkResults = await Promise.all(chunk.map((item, index) => mapper(item, i + index)));
    results.push(...chunkResults);
  }
  return results;
}
