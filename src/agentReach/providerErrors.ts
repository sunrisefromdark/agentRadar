import type { AgentReachProviderId } from "./types.ts";
import { isPublicSafeAgentReachValue } from "./sanitizer.ts";

export const AGENT_REACH_PROVIDER_ERROR_CODES = [
  "configuration_invalid",
  "input_missing",
  "input_invalid",
  "timeout",
  "http",
  "unavailable",
  "response_too_large",
  "unexpected",
] as const;

export type AgentReachProviderErrorCode =
  (typeof AGENT_REACH_PROVIDER_ERROR_CODES)[number];

export interface AgentReachSafeProviderError {
  provider_id: AgentReachProviderId;
  code: AgentReachProviderErrorCode;
  retryable: boolean;
  message: string;
  http_status?: number;
}

export interface AgentReachProviderErrorInput {
  providerId: AgentReachProviderId;
  code: AgentReachProviderErrorCode;
  retryable: boolean;
  safeMessage: string;
  httpStatus?: number;
  cause?: unknown;
}

function safeMessageOrFallback(message: string): string {
  return isPublicSafeAgentReachValue(message) ? message : "provider execution failed";
}

export class AgentReachProviderError extends Error {
  readonly providerId: AgentReachProviderId;
  readonly code: AgentReachProviderErrorCode;
  readonly retryable: boolean;
  readonly httpStatus?: number;
  override readonly cause?: unknown;

  constructor(input: AgentReachProviderErrorInput) {
    const safeMessage = safeMessageOrFallback(input.safeMessage);
    super(safeMessage);
    this.name = "AgentReachProviderError";
    this.providerId = input.providerId;
    this.code = input.code;
    this.retryable = input.retryable;
    this.httpStatus = input.httpStatus;
    this.cause = input.cause;
  }
}

export function toSafeAgentReachProviderError(
  error: unknown,
  fallbackProviderId?: AgentReachProviderId,
): AgentReachSafeProviderError {
  if (error instanceof AgentReachProviderError) {
    return {
      provider_id: error.providerId,
      code: error.code,
      retryable: error.retryable,
      message: error.message,
      ...(error.httpStatus !== undefined ? { http_status: error.httpStatus } : {}),
    };
  }

  if (!fallbackProviderId) {
    throw new Error("fallback provider id is required for unknown provider errors");
  }

  return {
    provider_id: fallbackProviderId,
    code: "unexpected",
    retryable: false,
    message: "provider execution failed",
  };
}
