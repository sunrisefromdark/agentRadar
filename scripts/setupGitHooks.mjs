import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const HOOKS_PATH = ".githooks";
const DEFAULT_GIT_TIMEOUT_MS = Number.parseInt(
  process.env.AGENT_TREND_RADAR_GIT_HOOK_TIMEOUT_MS ?? "5000",
  10,
);

function runGit(args, cwd, stdio) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio,
    timeout: Number.isFinite(DEFAULT_GIT_TIMEOUT_MS) ? DEFAULT_GIT_TIMEOUT_MS : 5000,
  });
}

function gitOutput(args, cwd) {
  return runGit(args, cwd, ["ignore", "pipe", "ignore"]).trim();
}

function tryGitOutput(args, cwd) {
  try {
    return gitOutput(args, cwd);
  } catch {
    return null;
  }
}

function shouldSkipHookSetup() {
  const rawFlag = process.env.AGENT_TREND_RADAR_SKIP_GIT_HOOKS;
  if (!rawFlag) return false;

  return ["1", "true", "yes", "on"].includes(rawFlag.toLowerCase());
}

function ensureHooksExecutable(repoRoot) {
  if (process.platform === "win32") return;

  const hooksRoot = path.join(repoRoot, HOOKS_PATH);
  if (!fs.existsSync(hooksRoot)) return;

  const stack = [hooksRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;
      fs.chmodSync(fullPath, 0o755);
    }
  }
}

function main() {
  if (shouldSkipHookSetup()) return;

  const repoRoot = tryGitOutput(["rev-parse", "--show-toplevel"], process.cwd());
  if (!repoRoot) return;

  const currentHooksPath = tryGitOutput(["config", "--get", "core.hooksPath"], repoRoot);
  try {
    if (!currentHooksPath) {
      runGit(["config", "core.hooksPath", HOOKS_PATH], repoRoot, "ignore");
    } else if (currentHooksPath !== HOOKS_PATH) {
      return;
    }

    ensureHooksExecutable(repoRoot);
  } catch {
    // Keep installs non-blocking even if local git config is unavailable.
  }
}

main();
