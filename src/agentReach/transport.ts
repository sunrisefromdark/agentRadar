import {
  AgentReachProviderError,
  type AgentReachProviderErrorCode,
} from "./providerErrors.ts";
import type { AgentReachProviderId } from "./types.ts";

export interface AgentReachTransportRequest {
  provider_id: AgentReachProviderId;
  url: string;
  method: "GET";
  headers: Readonly<Record<string, string>>;
  timeout_ms: number;
  max_response_bytes: number;
}

export interface AgentReachTransportResponse {
  status: number;
  headers: Readonly<Record<string, string>>;
  body: string;
}

export interface AgentReachTransport {
  request(request: AgentReachTransportRequest): Promise<AgentReachTransportResponse>;
}

export type AgentReachTransportHandler = (
  request: AgentReachTransportRequest,
) => AgentReachTransportResponse | Promise<AgentReachTransportResponse>;

type AgentReachTransportErrorCode = Extract<
  AgentReachProviderErrorCode,
  "timeout" | "http" | "unavailable" | "response_too_large"
>;

export interface CreateAgentReachTransportErrorInput {
  providerId: AgentReachProviderId;
  code: AgentReachTransportErrorCode;
  httpStatus?: number;
  cause?: unknown;
}

const SAFE_TRANSPORT_MESSAGES: Record<AgentReachTransportErrorCode, string> = {
  timeout: "provider transport timed out",
  http: "provider transport returned an HTTP error",
  unavailable: "provider transport is unavailable",
  response_too_large: "provider transport response exceeded the byte limit",
};

function isRetryableTransportFailure(
  code: AgentReachTransportErrorCode,
  httpStatus: number | undefined,
): boolean {
  if (code === "timeout" || code === "unavailable") return true;
  if (code === "http") {
    return httpStatus === 429 || (httpStatus !== undefined && httpStatus >= 500);
  }
  return false;
}

export function createAgentReachTransportError(
  input: CreateAgentReachTransportErrorInput,
): AgentReachProviderError {
  return new AgentReachProviderError({
    providerId: input.providerId,
    code: input.code,
    retryable: isRetryableTransportFailure(input.code, input.httpStatus),
    safeMessage: SAFE_TRANSPORT_MESSAGES[input.code],
    httpStatus: input.httpStatus,
    cause: input.cause,
  });
}

function validateTransportResponse(
  request: AgentReachTransportRequest,
  response: AgentReachTransportResponse,
): AgentReachTransportResponse {
  if (response.status < 200 || response.status >= 300) {
    throw createAgentReachTransportError({
      providerId: request.provider_id,
      code: "http",
      httpStatus: response.status,
    });
  }

  if (Buffer.byteLength(response.body, "utf8") > request.max_response_bytes) {
    throw createAgentReachTransportError({
      providerId: request.provider_id,
      code: "response_too_large",
    });
  }

  return response;
}

export function createInMemoryAgentReachTransport(
  handler: AgentReachTransportHandler,
): AgentReachTransport {
  return {
    async request(request) {
      try {
        const response = await handler(request);
        return validateTransportResponse(request, response);
      } catch (error) {
        if (error instanceof AgentReachProviderError) throw error;
        throw createAgentReachTransportError({
          providerId: request.provider_id,
          code: "unavailable",
          cause: error,
        });
      }
    },
  };
}

export function createDisabledAgentReachTransport(): AgentReachTransport {
  return {
    async request(request) {
      throw createAgentReachTransportError({
        providerId: request.provider_id,
        code: "unavailable",
      });
    },
  };
}
