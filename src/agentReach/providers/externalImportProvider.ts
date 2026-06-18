import fs from "node:fs";

import { normalizeAgentReachProviderItems } from "../normalizer.ts";
import { AgentReachProviderError } from "../providerErrors.ts";
import type {
  AgentReachProducerProvider,
  AgentReachProviderResult,
} from "../types.ts";

export interface LoadExternalImportProviderInput {
  inputPath: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readExternalImportItems(inputPath: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(inputPath, "utf-8")) as unknown;
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error && error.code === "ENOENT"
        ? "input_missing"
        : "input_invalid";
    throw new AgentReachProviderError({
      providerId: "external-import",
      code,
      retryable: false,
      safeMessage:
        code === "input_missing"
          ? "external-import input is missing"
          : "external-import input JSON is invalid",
      cause: error,
    });
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.items)) {
    throw new AgentReachProviderError({
      providerId: "external-import",
      code: "input_invalid",
      retryable: false,
      safeMessage: "external-import input must contain items[]",
    });
  }
  return parsed.items;
}

export function loadExternalImportProvider(
  input: LoadExternalImportProviderInput,
): AgentReachProviderResult {
  return normalizeAgentReachProviderItems({
    providerId: "external-import",
    rawItems: readExternalImportItems(input.inputPath),
  });
}

export const externalImportProvider: AgentReachProducerProvider = {
  provider_id: "external-import",
  platforms: [],
  mode: "active",
  default_enabled: true,
  async run(context) {
    const inputPath = context.provider_config.input_path;
    if (!inputPath) {
      return {
        provider_id: "external-import",
        status: "not_configured",
        items: [],
        coverage: {},
        warnings: ["external_import_input_missing"],
        rejected_items: [],
      };
    }
    return loadExternalImportProvider({ inputPath });
  },
};
