export type ProviderErrorKind =
  | "auth"
  | "rate_limit"
  | "timeout"
  | "network"
  | "invalid_request"
  | "empty_response"
  | "response_shape"
  | "unknown";

export interface ProviderErrorMetadata {
  providerName: string;
  kind: ProviderErrorKind;
  retryable: boolean;
  status?: number;
  code?: string;
  cause?: unknown;
}

interface ErrorSignals {
  status?: number;
  code?: string;
  text: string;
}

interface ProviderErrorRule {
  kind: ProviderErrorKind;
  message: string;
  retryable: boolean;
  matches: (signals: ErrorSignals) => boolean;
}

/**
 * Provider 层错误必须在这里统一分类。
 * 这样上层只消费 kind / retryable 语义，不再继续猜 SDK 原始错误文本。
 */
export class ProviderCallError extends Error {
  readonly providerName: string;
  readonly kind: ProviderErrorKind;
  readonly retryable: boolean;
  readonly status?: number;
  readonly code?: string;
  override readonly cause?: unknown;

  constructor(message: string, metadata: ProviderErrorMetadata) {
    super(message);
    this.name = "ProviderCallError";
    this.providerName = metadata.providerName;
    this.kind = metadata.kind;
    this.retryable = metadata.retryable;
    this.status = metadata.status;
    this.code = metadata.code;
    this.cause = metadata.cause;
  }
}

function readStatus(error: unknown): number | undefined {
  const candidate = error as { status?: unknown; response?: { status?: unknown }; cause?: { status?: unknown; response?: { status?: unknown } } };
  const direct = typeof candidate?.status === "number" ? candidate.status : undefined;
  if (direct !== undefined) return direct;
  const responseStatus = typeof candidate?.response?.status === "number" ? candidate.response.status : undefined;
  if (responseStatus !== undefined) return responseStatus;
  if (typeof candidate?.cause?.status === "number") return candidate.cause.status;
  return typeof candidate?.cause?.response?.status === "number" ? candidate.cause.response.status : undefined;
}

function readCode(error: unknown): string | undefined {
  const candidate = error as { code?: unknown; type?: unknown; cause?: { code?: unknown; type?: unknown } };
  if (typeof candidate?.code === "string" && candidate.code) return candidate.code;
  if (typeof candidate?.type === "string" && candidate.type) return candidate.type;
  if (typeof candidate?.cause?.code === "string" && candidate.cause.code) return candidate.cause.code;
  return typeof candidate?.cause?.type === "string" && candidate.cause.type ? candidate.cause.type : undefined;
}

function buildSignals(error: unknown): ErrorSignals {
  const causeText =
    error && typeof error === "object" && "cause" in error ? String((error as { cause?: unknown }).cause ?? "") : "";
  return {
    status: readStatus(error),
    code: readCode(error),
    text: `${String(error)} ${causeText}`.toLowerCase(),
  };
}

function hasStatus(status: number | undefined, expected: readonly number[]): boolean {
  return status !== undefined && expected.includes(status);
}

function isClientRequestStatus(status: number | undefined): boolean {
  return status !== undefined && status >= 400 && status < 500;
}

function hasFragment(text: string, fragments: readonly string[]): boolean {
  return fragments.some((fragment) => text.includes(fragment));
}

function hasCode(code: string | undefined, codes: readonly string[]): boolean {
  return code !== undefined && codes.includes(code);
}

function buildProviderCallError(
  providerName: string,
  rule: Pick<ProviderErrorRule, "kind" | "message" | "retryable">,
  signals: ErrorSignals,
  cause: unknown,
): ProviderCallError {
  return new ProviderCallError(`${rule.message} for ${providerName}`, {
    providerName,
    kind: rule.kind,
    retryable: rule.retryable,
    status: signals.status,
    code: signals.code,
    cause,
  });
}

const ERROR_RULES: ProviderErrorRule[] = [
  {
    kind: "auth",
    message: "Provider auth failed",
    retryable: false,
    matches: ({ status, text }) =>
      hasStatus(status, [401, 403]) || hasFragment(text, ["unauthorized", "authentication"]),
  },
  {
    kind: "rate_limit",
    message: "Provider rate limit",
    retryable: true,
    matches: ({ status, text }) => hasStatus(status, [429]) || hasFragment(text, ["429", "rate limit"]),
  },
  {
    kind: "timeout",
    message: "Provider timeout",
    retryable: true,
    matches: ({ code, text }) =>
      hasCode(code, ["ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT"]) ||
      hasFragment(text, ["timeout", "timed out", "connect timeout"]),
  },
  {
    kind: "network",
    message: "Provider network failure",
    retryable: true,
    matches: ({ text }) =>
      hasFragment(text, ["fetch failed", "network", "econnreset", "enotfound", "eai_again", "socket hang up"]),
  },
  {
    kind: "invalid_request",
    message: "Provider request rejected",
    retryable: false,
    matches: ({ status }) => isClientRequestStatus(status),
  },
];

function findMatchingRule(signals: ErrorSignals): ProviderErrorRule | undefined {
  return ERROR_RULES.find((rule) => rule.matches(signals));
}

export function classifyProviderError(providerName: string, error: unknown): ProviderCallError {
  if (error instanceof ProviderCallError) return error;

  const signals = buildSignals(error);
  const matchedRule = findMatchingRule(signals);
  if (matchedRule) {
    return buildProviderCallError(providerName, matchedRule, signals, error);
  }

  return new ProviderCallError(`Provider call failed for ${providerName}`, {
    providerName,
    kind: "unknown",
    retryable: false,
    status: signals.status,
    code: signals.code,
    cause: error,
  });
}

export function buildProviderResponseError(
  providerName: string,
  kind: "empty_response" | "response_shape",
  message: string,
): ProviderCallError {
  return new ProviderCallError(message, {
    providerName,
    kind,
    retryable: false,
  });
}

export function isRetryableProviderError(error: unknown): boolean {
  return error instanceof ProviderCallError ? error.retryable : false;
}

export function isRateLimitProviderError(error: unknown): boolean {
  return error instanceof ProviderCallError ? error.kind === "rate_limit" : false;
}

export function formatProviderError(error: unknown): string {
  if (error instanceof ProviderCallError) {
    const suffix = [error.kind, error.status, error.code].filter((item) => item !== undefined).join("/");
    return suffix ? `${error.message} [${suffix}]` : error.message;
  }
  return String(error);
}
