import { spawn } from "node:child_process";
import path from "node:path";

import type { ExternalAgentReachLocalRunner } from "./localRunnerAdapter.ts";
import type {
  AgentReachGatewayRequest,
  AgentReachLocalRunnerResult,
  ExternalCoverageStatus,
  ExternalPlatform,
  GatewayRunStatus,
} from "./types.ts";

const NODE_RUNNER_EXTENSIONS = new Set([".cjs", ".js", ".mjs"]);
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_STDIO_BYTES = 1024 * 1024;
const GATEWAY_RUN_STATUSES = new Set<GatewayRunStatus>([
  "ok",
  "partial",
  "skipped",
  "unavailable",
  "failed",
  "not_configured",
]);
const COVERAGE_STATUSES = new Set<ExternalCoverageStatus>([
  "ok",
  "partial",
  "not_configured",
  "manual_import_only",
  "unavailable",
  "failed",
]);

export class ExternalAgentReachRunnerExecutionError extends Error {
  constructor(readonly safeReasonCode: string) {
    super(safeReasonCode);
    this.name = "ExternalAgentReachRunnerExecutionError";
  }
}

export interface ExternalAgentReachProcessRunnerOptions {
  runnerPath: string;
  timeoutMs?: number;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isGatewayRunStatus(value: unknown): value is GatewayRunStatus {
  return typeof value === "string" && GATEWAY_RUN_STATUSES.has(value as GatewayRunStatus);
}

function isCoverageStatus(value: unknown): value is ExternalCoverageStatus {
  return typeof value === "string" && COVERAGE_STATUSES.has(value as ExternalCoverageStatus);
}

function isExternalPlatform(value: unknown): value is ExternalPlatform {
  return (
    value === "x_twitter" ||
    value === "reddit" ||
    value === "hacker_news" ||
    value === "official_web" ||
    value === "official_blog"
  );
}

function isCoverage(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  return Object.entries(value).every(([platform, coverage]) => {
    if (!isExternalPlatform(platform) || !isRecord(coverage)) return false;
    if (!isCoverageStatus(coverage.status)) return false;
    if (coverage.reason !== undefined && typeof coverage.reason !== "string") return false;
    if (coverage.warnings !== undefined && !isStringArray(coverage.warnings)) return false;
    return true;
  });
}

function isRunnerObservation(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (!isExternalPlatform(value.platform)) return false;
  if (typeof value.observed_at !== "string") return false;
  if (!isOptionalString(value.raw_ref)) return false;
  if (!isOptionalString(value.url)) return false;
  if (!isOptionalString(value.source_published_at)) return false;
  if (!isOptionalString(value.title)) return false;
  if (!isOptionalString(value.raw_event_kind)) return false;
  if (value.derived_signal_kinds !== undefined && !isStringArray(value.derived_signal_kinds)) {
    return false;
  }
  if (value.direction_labels !== undefined && !isStringArray(value.direction_labels)) {
    return false;
  }
  if (value.tags !== undefined && !isStringArray(value.tags)) return false;
  return true;
}

function isRejectedItem(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (typeof value.reason_code !== "string") return false;
  if (!isOptionalString(value.reason_detail)) return false;
  if (value.platform !== undefined && !isExternalPlatform(value.platform)) return false;
  return true;
}

function isRunnerResult(value: unknown): value is AgentReachLocalRunnerResult {
  if (!isRecord(value)) return false;
  if (!isOptionalString(value.provider_run_id)) return false;
  if (!isOptionalString(value.generated_at)) return false;
  if (value.configured !== undefined && typeof value.configured !== "boolean") return false;
  if (
    value.requested_platforms !== undefined &&
    (!Array.isArray(value.requested_platforms) || !value.requested_platforms.every(isExternalPlatform))
  ) {
    return false;
  }
  if (!isGatewayRunStatus(value.gateway_status)) return false;
  if (!isCoverage(value.coverage)) return false;
  if (
    value.observations !== undefined &&
    (!Array.isArray(value.observations) || !value.observations.every(isRunnerObservation))
  ) {
    return false;
  }
  if (
    value.rejected_items !== undefined &&
    (!Array.isArray(value.rejected_items) || !value.rejected_items.every(isRejectedItem))
  ) {
    return false;
  }
  if (value.diagnostics !== undefined && !isRecord(value.diagnostics)) return false;
  if (
    isRecord(value.diagnostics) &&
    value.diagnostics.warnings !== undefined &&
    !isStringArray(value.diagnostics.warnings)
  ) {
    return false;
  }
  return true;
}

function runnerCommand(runnerPath: string): { command: string; args: string[] } {
  if (NODE_RUNNER_EXTENSIONS.has(path.extname(runnerPath).toLowerCase())) {
    return { command: process.execPath, args: [runnerPath] };
  }
  return { command: runnerPath, args: [] };
}

function runnerTimeoutMs(options: ExternalAgentReachProcessRunnerOptions, request: AgentReachGatewayRequest): number {
  const timeout = options.timeoutMs ?? request.budget?.timeout_ms ?? DEFAULT_TIMEOUT_MS;
  return Number.isInteger(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS;
}

export function createExternalAgentReachProcessRunner(
  options: ExternalAgentReachProcessRunnerOptions,
): ExternalAgentReachLocalRunner {
  return async (request) => {
    const { command, args } = runnerCommand(options.runnerPath);
    const timeoutMs = runnerTimeoutMs(options, request);

    return await new Promise<AgentReachLocalRunnerResult>((resolve, reject) => {
      let settled = false;
      let stdout = "";
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let timedOut = false;
      let outputTooLarge = false;

      const settleReject = (reasonCode: string) => {
        if (settled) return;
        settled = true;
        reject(new ExternalAgentReachRunnerExecutionError(reasonCode));
      };
      const settleResolve = (result: AgentReachLocalRunnerResult) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      const child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env ? { ...process.env, ...options.env } : process.env,
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, timeoutMs);

      child.stdout.setEncoding("utf-8");
      child.stdout.on("data", (chunk: string) => {
        stdoutBytes += Buffer.byteLength(chunk, "utf-8");
        if (stdoutBytes > MAX_STDIO_BYTES) {
          outputTooLarge = true;
          child.kill();
          return;
        }
        stdout += chunk;
      });

      child.stderr.on("data", (chunk: Buffer | string) => {
        stderrBytes += Buffer.byteLength(chunk);
        if (stderrBytes > MAX_STDIO_BYTES) {
          outputTooLarge = true;
          child.kill();
        }
      });

      child.stdin.on("error", () => settleReject("runner_stdin_failed"));
      child.on("error", () => {
        clearTimeout(timer);
        settleReject("runner_spawn_failed");
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (timedOut) {
          settleReject("runner_timeout");
          return;
        }
        if (outputTooLarge) {
          settleReject("runner_output_too_large");
          return;
        }
        if (code !== 0) {
          settleReject("runner_failed");
          return;
        }
        if (stdout.trim().length === 0) {
          settleReject("runner_output_empty");
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(stdout);
        } catch {
          settleReject("runner_output_invalid_json");
          return;
        }
        if (!isRunnerResult(parsed)) {
          settleReject("runner_output_invalid_shape");
          return;
        }
        settleResolve(parsed);
      });

      child.stdin.end(`${JSON.stringify(request)}\n`, "utf-8");
    });
  };
}
