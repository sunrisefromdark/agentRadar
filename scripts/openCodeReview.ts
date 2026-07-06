import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const VALID_MODES = new Set(["review", "scan"]);
const HARD_EXCLUDES = [
  "node_modules/**",
  "dist/**",
  "tmp/**",
  "data/**",
  "github-pages-site/**",
  "github-profile/**",
  ".git/**",
  ".env",
  ".env.*",
  "pnpm-lock.yaml",
];

function usage(): string {
  return [
    "Usage:",
    "  tsx scripts/openCodeReview.ts review [--required] [ocr args...]",
    "  tsx scripts/openCodeReview.ts scan [--required] [ocr args...]",
    "",
    "Examples:",
    "  corepack pnpm code-review:ocr",
    "  corepack pnpm code-review:ocr:scan",
    "  corepack pnpm code-review:ocr:required -- --from origin/main --to HEAD",
  ].join("\n");
}

function takeFlag(args: string[], flag: string): boolean {
  const index = args.indexOf(flag);
  if (index === -1) return false;

  args.splice(index, 1);
  return true;
}

function removeSeparators(args: string[]): void {
  for (let index = args.length - 1; index >= 0; index -= 1) {
    if (args[index] === "--") {
      args.splice(index, 1);
    }
  }
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag) || args.some((arg) => arg.startsWith(`${flag}=`));
}

function takeValues(args: string[], flag: string): string[] {
  const values: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === flag) {
      const value = args[index + 1];
      args.splice(index, value === undefined ? 1 : 2);
      if (value !== undefined) values.push(value);
      index -= 1;
      continue;
    }

    if (arg.startsWith(`${flag}=`)) {
      values.push(arg.slice(flag.length + 1));
      args.splice(index, 1);
      index -= 1;
    }
  }

  return values;
}

function commandExists(command: string): boolean {
  const result = spawnSync(command, ["--help"], {
    cwd: ROOT,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: "pipe",
  });

  if (result.error) return false;
  if (result.status === 127) return false;

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.toLowerCase();
  if (result.status !== 0 && (output.includes("not recognized") || output.includes("not found"))) {
    return false;
  }

  return true;
}

function splitCsv(values: string[]): string[] {
  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function appendMergedExclude(commandArgs: string[], extraArgs: string[], envExtra?: string): void {
  const callerExcludes = takeValues(extraArgs, "--exclude");
  const merged = unique([...HARD_EXCLUDES, ...splitCsv(envExtra ? [envExtra] : []), ...splitCsv(callerExcludes)]);
  commandArgs.push("--exclude", merged.join(","));
}

function missingCliMessage(ocrBin: string): string {
  return [
    `[open-code-review] ${ocrBin} CLI was not found.`,
    "Install it with: npm install -g @alibaba-group/open-code-review",
    "Then configure OCR_LLM_URL/OCR_LLM_TOKEN/OCR_LLM_MODEL, or configure the provider through ocr llm setup.",
  ].join("\n");
}

function buildCommandArgs(mode: string, extraArgs: string[]): string[] {
  const commandArgs = [mode];

  if (mode === "review") {
    if (!hasFlag(extraArgs, "--audience")) {
      commandArgs.push("--audience", process.env.OCR_AUDIENCE ?? "agent");
    }
    appendMergedExclude(commandArgs, extraArgs, process.env.OCR_REVIEW_EXCLUDES);
  }

  if (mode === "scan") {
    if (!hasFlag(extraArgs, "--path")) {
      commandArgs.push("--path", process.env.OCR_SCAN_PATHS ?? "src,scripts,app");
    }
    appendMergedExclude(commandArgs, extraArgs, process.env.OCR_SCAN_EXCLUDES);
    if (!hasFlag(extraArgs, "--max-tokens-budget")) {
      commandArgs.push("--max-tokens-budget", process.env.OCR_SCAN_TOKEN_BUDGET ?? "500000");
    }
  }

  commandArgs.push(...extraArgs);
  return commandArgs;
}

function main(): void {
  const args = process.argv.slice(2);

  if (takeFlag(args, "--help") || takeFlag(args, "-h")) {
    console.log(usage());
    return;
  }

  let mode = "review";
  if (args[0] && VALID_MODES.has(args[0])) {
    mode = args.shift() ?? mode;
  }

  removeSeparators(args);

  const required = takeFlag(args, "--required");
  const ocrBin = process.env.OCR_BIN ?? "ocr";

  if (!commandExists(ocrBin)) {
    const message = missingCliMessage(ocrBin);
    if (required) {
      console.error(message);
      process.exit(1);
    }

    console.warn(`${message}\n[open-code-review] skipped because this run is optional.`);
    return;
  }

  const commandArgs = buildCommandArgs(mode, args);
  console.error(`[open-code-review] running: ${ocrBin} ${commandArgs.join(" ")}`);

  const result = spawnSync(ocrBin, commandArgs, {
    cwd: ROOT,
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`[open-code-review] failed to start ${ocrBin}: ${result.error.message}`);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

main();
