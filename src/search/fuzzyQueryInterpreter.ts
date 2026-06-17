import type { AppConfig } from "../config.ts";
import { parseJsonObjectFromText } from "../jsonObject.ts";
import { callLlm } from "../llm.ts";
import { buildFuzzyQueryPrompt, buildFuzzyQueryRepairPrompt } from "./fuzzyQueryPrompt.ts";
import {
  FUZZY_SEARCH_LLM_TIMEOUT_MS,
  FUZZY_SEARCH_MAX_REPAIR_CALLS,
  type FuzzySearchFallbackReason,
  type LlmFuzzyQueryInterpretation,
  validateLlmFuzzyQueryInterpretation,
} from "./fuzzyQueryTypes.ts";

export type FuzzyQueryLlmCaller = (prompt: string, opts: { providerName: string; maxTokens?: number }) => Promise<string>;

export type FuzzyQueryInterpretationResult =
  | {
      status: "ok";
      interpretation: LlmFuzzyQueryInterpretation;
      rawOutput: string;
      repaired: boolean;
    }
  | {
      status: "fallback";
      fallbackReason: FuzzySearchFallbackReason;
      rawOutput?: string;
      validationError?: string;
      repaired: boolean;
    };

export interface InterpretFuzzyQueryOptions {
  llm: AppConfig["llm"];
  rawQuery: string;
  searchFieldsSummary?: string;
  directionAliasSummary?: string;
  caller?: FuzzyQueryLlmCaller;
  timeoutMs?: number;
  maxRepairCalls?: number;
  maxTokens?: number;
}

function isFuzzyLlmEnabled(llm: AppConfig["llm"]): boolean {
  return llm.enabled && llm.mode === "semantic-classification" && llm.provider !== "none";
}

function fallbackReasonFromError(error: unknown): FuzzySearchFallbackReason {
  if (error instanceof Error && error.message === "fuzzy_llm_timeout") return "llm_timeout";
  return "llm_unconfigured";
}

function callWithTimeout(
  caller: FuzzyQueryLlmCaller,
  prompt: string,
  opts: { providerName: string; maxTokens?: number },
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("fuzzy_llm_timeout")), timeoutMs);
    caller(prompt, opts).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function parseAndValidate(rawOutput: string): { ok: true; interpretation: LlmFuzzyQueryInterpretation } | { ok: false; reason: FuzzySearchFallbackReason; error: string } {
  let parsed: unknown;
  try {
    parsed = parseJsonObjectFromText<unknown>(rawOutput);
  } catch (error) {
    return { ok: false, reason: "invalid_json", error: error instanceof Error ? error.message : String(error) };
  }

  const validation = validateLlmFuzzyQueryInterpretation(parsed);
  if (!validation.ok) return { ok: false, reason: "schema_invalid", error: validation.error };
  return { ok: true, interpretation: validation.value };
}

export async function interpretFuzzyQuery(options: InterpretFuzzyQueryOptions): Promise<FuzzyQueryInterpretationResult> {
  if (!isFuzzyLlmEnabled(options.llm)) {
    return { status: "fallback", fallbackReason: "llm_unconfigured", repaired: false };
  }

  const caller = options.caller ?? ((prompt, opts) => callLlm(prompt, opts));
  const timeoutMs = options.timeoutMs ?? FUZZY_SEARCH_LLM_TIMEOUT_MS;
  const maxRepairCalls = options.maxRepairCalls ?? FUZZY_SEARCH_MAX_REPAIR_CALLS;
  const providerName = options.llm.provider;
  const promptInput = {
    rawQuery: options.rawQuery,
    searchFieldsSummary: options.searchFieldsSummary,
    directionAliasSummary: options.directionAliasSummary,
  };

  let rawOutput: string;
  try {
    rawOutput = await callWithTimeout(caller, buildFuzzyQueryPrompt(promptInput), { providerName, maxTokens: options.maxTokens }, timeoutMs);
  } catch (error) {
    return { status: "fallback", fallbackReason: fallbackReasonFromError(error), repaired: false };
  }

  const first = parseAndValidate(rawOutput);
  if (first.ok) {
    return {
      status: "ok",
      interpretation: first.interpretation,
      rawOutput,
      repaired: false,
    };
  }

  if (maxRepairCalls < 1) {
    return {
      status: "fallback",
      fallbackReason: first.reason,
      rawOutput,
      validationError: first.error,
      repaired: false,
    };
  }

  let repairedOutput: string;
  try {
    repairedOutput = await callWithTimeout(
      caller,
      buildFuzzyQueryRepairPrompt({
        ...promptInput,
        validationError: first.error,
        previousResponse: rawOutput,
      }),
      { providerName, maxTokens: options.maxTokens },
      timeoutMs,
    );
  } catch (error) {
    return {
      status: "fallback",
      fallbackReason: fallbackReasonFromError(error),
      rawOutput,
      validationError: first.error,
      repaired: true,
    };
  }

  const repaired = parseAndValidate(repairedOutput);
  if (repaired.ok) {
    return {
      status: "ok",
      interpretation: repaired.interpretation,
      rawOutput: repairedOutput,
      repaired: true,
    };
  }

  return {
    status: "fallback",
    fallbackReason: first.reason,
    rawOutput: repairedOutput,
    validationError: repaired.error,
    repaired: true,
  };
}
