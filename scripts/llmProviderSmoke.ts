import path from "node:path";
import { loadConfig } from "../src/config.ts";
import { toLocalIsoString } from "../src/date.ts";
import { assertValidDateOnly } from "../src/dateInput.ts";
import { loadRuntimeEnv } from "../src/env.ts";
import { callLlm } from "../src/llm.ts";
import { formatProviderError } from "../src/providers/index.ts";
import { resolveDeepSeekConnectionInfo } from "../src/providers/deepseek.ts";
import { resolveMiniMaxConnectionInfo } from "../src/providers/minimax.ts";
import { ensureDataDirs, writeJsonFile } from "../src/storage/files.ts";

interface SmokeResult {
  date: string;
  generated_at: string;
  status: "pass" | "fail" | "skipped";
  enabled: boolean;
  provider: string;
  mode: string;
  api_style?: string;
  model?: string;
  base_url?: string;
  response_excerpt?: string;
  error_summary?: string;
}

function localDateStr(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseArgs(argv: string[]): { date: string; configPath: string } {
  const result = {
    date: localDateStr(new Date()),
    configPath: "config.yaml",
  };

  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--") continue;
    if (token === "--date" && argv[i + 1]) {
      result.date = argv[i + 1] ?? result.date;
      i += 1;
      continue;
    }
    if (token === "--config" && argv[i + 1]) {
      result.configPath = argv[i + 1] ?? result.configPath;
      i += 1;
    }
  }

  assertValidDateOnly(result.date, "--date");

  return result;
}

function artifactPath(date: string): string {
  return path.join("data", "reports", `${date}.llm-smoke.json`);
}

async function main(): Promise<void> {
  loadRuntimeEnv(process.cwd(), { overrideProcessEnv: true });
  ensureDataDirs();

  const args = parseArgs(process.argv);
  const config = loadConfig(args.configPath);
  const generatedAt = toLocalIsoString(new Date());
  const result: SmokeResult = {
    date: args.date,
    generated_at: generatedAt,
    status: "skipped",
    enabled: config.llm.enabled,
    provider: config.llm.provider,
    mode: config.llm.mode,
  };

  if (!config.llm.enabled || config.llm.provider === "none" || config.llm.mode !== "semantic-classification") {
    writeJsonFile(artifactPath(args.date), result, false);
    writeJsonFile(path.join("data", "reports", "latest.llm-smoke.json"), result, false);
    console.log(`[llm-smoke] skipped: llm is not enabled for semantic classification`);
    console.log(`[llm-smoke] artifact=${artifactPath(args.date)}`);
    return;
  }

  if (config.llm.provider === "minimax") {
    const connection = resolveMiniMaxConnectionInfo();
    result.base_url = connection.baseURL;
    result.model = connection.model;
    result.api_style = connection.apiStyle;
  }

  if (config.llm.provider === "deepseek") {
    const connection = resolveDeepSeekConnectionInfo();
    result.base_url = connection.baseURL;
    result.model = connection.model;
  }

  try {
    const response = await callLlm(
      'Return compact JSON only: {"ok":true,"ping":"pong","provider":"smoke"}',
      {
        providerName: config.llm.provider,
        maxTokens: 128,
        maxRetries: 0,
      },
    );
    result.status = "pass";
    result.response_excerpt = response.slice(0, 300);
  } catch (error) {
    result.status = "fail";
    result.error_summary = formatProviderError(error);
  }

  writeJsonFile(artifactPath(args.date), result, false);
  writeJsonFile(path.join("data", "reports", "latest.llm-smoke.json"), result, false);

  console.log(`[llm-smoke] provider=${result.provider} status=${result.status}`);
  if (result.api_style) console.log(`[llm-smoke] api_style=${result.api_style}`);
  if (result.base_url) console.log(`[llm-smoke] base_url=${result.base_url}`);
  if (result.model) console.log(`[llm-smoke] model=${result.model}`);
  if (result.error_summary) console.log(`[llm-smoke] error=${result.error_summary}`);
  console.log(`[llm-smoke] artifact=${artifactPath(args.date)}`);

  if (result.status === "fail") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
