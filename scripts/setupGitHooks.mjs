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

function main() {
  if (shouldSkipHookSetup()) return;

  const repoRoot = tryGitOutput(["rev-parse", "--show-toplevel"], process.cwd());
  if (!repoRoot) return;

  const currentHooksPath = tryGitOutput(["config", "--get", "core.hooksPath"], repoRoot);
  if (currentHooksPath && currentHooksPath !== HOOKS_PATH) return;
  if (currentHooksPath === HOOKS_PATH) return;

  try {
    runGit(["config", "core.hooksPath", HOOKS_PATH], repoRoot, "ignore");
  } catch {
    // Keep installs non-blocking even if local git config is unavailable.
  }
}

main();
