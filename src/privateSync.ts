import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Logger } from "./logger.ts";

export const PRIVATE_SYNC_CONFIG_FILE = ".sync-private.local.json";

export interface PrivateSyncConfig {
  remote?: string;
  branch?: string;
  allowDirty?: boolean;
}

export interface PrivateSyncTarget {
  remote: string;
  branch: string;
  allowDirty: boolean;
  source: "defaults" | "config" | "overrides" | "config+overrides";
}

export interface ResolvePrivateSyncTargetInput {
  cwd?: string;
  remoteOverride?: string;
  branchOverride?: string;
  allowDirtyOverride?: boolean;
}

const DEFAULT_PRIVATE_REMOTE = "private";
const DEFAULT_PRIVATE_BRANCH = "sync/oss-public";
const DEFAULT_GIT_TIMEOUT_MS = 5000;

export function loadPrivateSyncConfig(cwd = process.cwd()): PrivateSyncConfig | null {
  const configPath = path.join(cwd, PRIVATE_SYNC_CONFIG_FILE);
  if (!fs.existsSync(configPath)) return null;

  const raw = JSON.parse(fs.readFileSync(configPath, "utf-8")) as PrivateSyncConfig;
  return {
    remote: normalizeGitToken(raw.remote),
    branch: normalizeGitToken(raw.branch),
    allowDirty: raw.allowDirty === true,
  };
}

export function resolvePrivateSyncTarget(input: ResolvePrivateSyncTargetInput = {}): PrivateSyncTarget {
  const config = loadPrivateSyncConfig(input.cwd);
  const remote = normalizeGitToken(input.remoteOverride) ?? config?.remote ?? DEFAULT_PRIVATE_REMOTE;
  const branch = normalizeGitToken(input.branchOverride) ?? config?.branch ?? DEFAULT_PRIVATE_BRANCH;
  const allowDirty = input.allowDirtyOverride ?? config?.allowDirty ?? false;

  const hasConfig = config !== null;
  const hasOverrides = input.remoteOverride !== undefined || input.branchOverride !== undefined || input.allowDirtyOverride !== undefined;
  const source = hasConfig && hasOverrides ? "config+overrides" : hasConfig ? "config" : hasOverrides ? "overrides" : "defaults";

  return {
    remote,
    branch,
    allowDirty,
    source,
  };
}

export function buildPrivateSyncPushArgs(input: { remote: string; branch: string; dryRun: boolean }): string[] {
  return ["push", ...(input.dryRun ? ["--dry-run"] : []), input.remote, `HEAD:${input.branch}`];
}

export function assertCleanWorktree(cwd = process.cwd()): void {
  const status = gitOutput(["status", "--short"], cwd);
  if (status.length > 0) {
    throw new Error("sync-private requires a clean worktree. Commit or stash changes first, or opt in via allowDirty.");
  }
}

export function assertGitRemoteExists(remote: string, cwd = process.cwd()): string {
  return gitOutput(["remote", "get-url", remote], cwd);
}

export function runPrivateSync(logger: Logger, input: {
  cwd?: string;
  remoteOverride?: string;
  branchOverride?: string;
  allowDirtyOverride?: boolean;
  dryRun: boolean;
}): void {
  const cwd = input.cwd ?? process.cwd();
  const target = resolvePrivateSyncTarget({
    cwd,
    remoteOverride: input.remoteOverride,
    branchOverride: input.branchOverride,
    allowDirtyOverride: input.allowDirtyOverride,
  });

  if (!target.allowDirty) {
    assertCleanWorktree(cwd);
  }

  const remoteUrl = assertGitRemoteExists(target.remote, cwd);
  const args = buildPrivateSyncPushArgs({
    remote: target.remote,
    branch: target.branch,
    dryRun: input.dryRun,
  });

  logger.info("sync-private pushing HEAD to private remote", {
    remote: target.remote,
    branch: target.branch,
    dryRun: input.dryRun,
    source: target.source,
  });
  runGit(args, cwd, "inherit");
  logger.info("sync-private completed", {
    remote: target.remote,
    branch: target.branch,
    dryRun: input.dryRun,
    remoteUrl,
  });
}

function gitOutput(args: string[], cwd: string): string {
  return runGit(args, cwd, ["ignore", "pipe", "pipe"]).trim();
}

function runGit(args: string[], cwd: string, stdio: "inherit" | ["ignore", "pipe", "pipe"]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio,
    timeout: DEFAULT_GIT_TIMEOUT_MS,
  });
}

function normalizeGitToken(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/\s/.test(trimmed)) {
    throw new Error(`Invalid git token "${value}". Use a remote name or branch without whitespace.`);
  }
  return trimmed;
}
