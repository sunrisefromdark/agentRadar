import type { AppConfig } from "../config.ts";
import { parseJsonObjectFromText } from "../jsonObject.ts";
import { callLlm } from "../llm.ts";
import { formatProviderError } from "../providers/index.ts";

export function isEnhancementEnabled(config: AppConfig): boolean {
  return config.llm.enabled && config.llm.mode === "semantic-classification" && config.llm.provider !== "none";
}

export function parseJsonObject<T>(text: string): T {
  return parseJsonObjectFromText<T>(text);
}

export async function callStructuredEnhancement<T>(
  prompt: string,
  config: AppConfig,
  opts: { maxTokens?: number } = {},
): Promise<T | undefined> {
  if (!isEnhancementEnabled(config)) return undefined;

  try {
    const response = await callLlm(prompt, {
      providerName: config.llm.provider,
      maxTokens: opts.maxTokens,
    });
    try {
      return parseJsonObject<T>(response);
    } catch (parseError) {
      try {
        const repaired = await callLlm(
          [
            "Rewrite the previous answer into valid JSON only.",
            "Return exactly one JSON object and nothing else.",
            "Do not use markdown fences.",
            "If the previous answer already contains one valid JSON object, output that object only.",
            "Drop any explanatory prefix, suffix, or trailing commentary.",
            `Parse failure: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
            "",
            "Previous answer:",
            response,
          ].join("\n"),
          {
            providerName: config.llm.provider,
            maxTokens: opts.maxTokens,
          },
        );
        return parseJsonObject<T>(repaired);
      } catch (repairError) {
        try {
          const retriedResponse = await callLlm(prompt, {
            providerName: config.llm.provider,
            maxTokens: opts.maxTokens,
          });
          return parseJsonObject<T>(retriedResponse);
        } catch (retryError) {
          console.warn(
            `[enhancement] structured parse failed after repair and retry: ${formatProviderError(retryError)} | repair_error=${formatProviderError(
              repairError,
            )} | initial_parse_error=${parseError instanceof Error ? parseError.message : String(parseError)}`,
          );
          return undefined;
        }
      }
    }
  } catch (error) {
    console.warn(`[enhancement] failed: ${formatProviderError(error)}`);
    return undefined;
  }
}
