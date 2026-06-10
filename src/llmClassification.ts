import type { AppConfig } from "./config.ts";
import { parseJsonObjectFromText } from "./jsonObject.ts";
import { callLlm } from "./llm.ts";
import { formatProviderError } from "./providers/index.ts";
import type { NormalizedProject } from "./types.ts";

export type {
  DailySemanticInputBundle,
  DailySemanticInputProject,
  WeeklyAuditReport,
  WeeklyReport,
  WeeklySemanticInputBundle,
  WeeklySemanticInputProject,
  WeeklySupportProject,
  WeeklyTrendCandidate,
  EnhancementAudit,
  EnhancementStatus,
  EnhancementSource,
  PersonalizedWeeklyFocus,
  RejectedOutput,
  RiskReviewSource,
  CoreTrendCard,
  WeakSignalCard,
} from "./types.ts";

export type ParadigmClass = "agent_runtime" | "infra" | "system" | "ordinary_tool" | "unknown";
export type AutonomyLevel = "high" | "medium" | "low" | "unknown";

export interface SemanticClassification {
  paradigm_class: ParadigmClass;
  has_persistent_memory: boolean;
  has_self_improving_loop: boolean;
  has_skill_ecosystem: boolean;
  autonomy_level: AutonomyLevel;
  has_governance_boundary: boolean;
  evidence_snippets: string[];
  confidence: number;
}

const DEFAULT_CLASSIFICATION: SemanticClassification = {
  paradigm_class: "unknown",
  has_persistent_memory: false,
  has_self_improving_loop: false,
  has_skill_ecosystem: false,
  autonomy_level: "unknown",
  has_governance_boundary: false,
  evidence_snippets: [],
  confidence: 0,
};

export interface ClassificationArtifact {
  repo_full_name: string;
  project_name: string;
  classification: SemanticClassification;
}

export interface ClassificationRunDiagnostics {
  enabled: boolean;
  mode: AppConfig["llm"]["mode"];
  provider: string;
  classification_cache_hit_count?: number;
  classification_attempt_count: number;
  classification_success_count: number;
  classification_failure_count: number;
  classification_last_error?: string;
}

export function isSemanticClassificationEnabled(config: AppConfig): boolean {
  return config.llm.enabled && config.llm.mode === "semantic-classification" && config.llm.provider !== "none";
}

function buildClassificationPayload(project: NormalizedProject): Record<string, unknown> {
  return {
    project_name: project.project_name,
    repo_url: project.repo_url,
    description: project.description,
    tags: project.tags,
    sources: project.sources,
    appearances: project.appearances,
    persistence_state: project.persistence_state,
  };
}

function buildClassificationPrompt(project: NormalizedProject): string {
  return [
    "You are classifying an AI project into a strict JSON schema.",
    "Return exactly one JSON object and nothing else.",
    "Do not use markdown fences.",
    "Do not add commentary, analysis, or prose before or after the JSON.",
    "If uncertain, use the schema's \"unknown\" enum values instead of explaining uncertainty in prose.",
    "",
    "JSON schema:",
    `{`,
    `  "paradigm_class": "agent_runtime" | "infra" | "system" | "ordinary_tool" | "unknown",`,
    `  "has_persistent_memory": boolean,`,
    `  "has_self_improving_loop": boolean,`,
    `  "has_skill_ecosystem": boolean,`,
    `  "autonomy_level": "high" | "medium" | "low" | "unknown",`,
    `  "has_governance_boundary": boolean,`,
    `  "evidence_snippets": string[],`,
    `  "confidence": number`,
    `}`,
    "",
    "Classify this project:",
    JSON.stringify(buildClassificationPayload(project), null, 2),
  ].join("\n");
}

function buildClassificationRepairPrompt(project: NormalizedProject, rawResponse: string, errorMessage: string): string {
  return [
    "The previous answer was not valid JSON.",
    "Ignore the broken answer and classify the project again from scratch.",
    "Return exactly one compact JSON object that strictly matches the schema below.",
    "Return exactly one JSON object and nothing else.",
    "Do not use markdown fences.",
    `Previous parse failure: ${errorMessage}`,
    "",
    "Required schema:",
    `{`,
    `  "paradigm_class": "agent_runtime" | "infra" | "system" | "ordinary_tool" | "unknown",`,
    `  "has_persistent_memory": boolean,`,
    `  "has_self_improving_loop": boolean,`,
    `  "has_skill_ecosystem": boolean,`,
    `  "autonomy_level": "high" | "medium" | "low" | "unknown",`,
    `  "has_governance_boundary": boolean,`,
    `  "evidence_snippets": string[],`,
    `  "confidence": number`,
    `}`,
    "",
    "Project context:",
    JSON.stringify(buildClassificationPayload(project), null, 2),
    "",
    "Previous answer to repair:",
    rawResponse,
  ].join("\n");
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function asConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function asParadigmClass(value: unknown): ParadigmClass {
  if (value === "agent_runtime" || value === "infra" || value === "system" || value === "ordinary_tool") {
    return value;
  }
  return "unknown";
}

function asAutonomyLevel(value: unknown): AutonomyLevel {
  if (value === "high" || value === "medium" || value === "low") return value;
  return "unknown";
}

export function parseSemanticClassification(text: string): SemanticClassification {
  const raw = parseJsonObjectFromText<Record<string, unknown>>(text);

  return {
    paradigm_class: asParadigmClass(raw["paradigm_class"]),
    has_persistent_memory: asBoolean(raw["has_persistent_memory"]),
    has_self_improving_loop: asBoolean(raw["has_self_improving_loop"]),
    has_skill_ecosystem: asBoolean(raw["has_skill_ecosystem"]),
    autonomy_level: asAutonomyLevel(raw["autonomy_level"]),
    has_governance_boundary: asBoolean(raw["has_governance_boundary"]),
    evidence_snippets: asStringArray(raw["evidence_snippets"]),
    confidence: asConfidence(raw["confidence"]),
  };
}

async function callAndParseClassification(
  prompt: string,
  config: AppConfig,
): Promise<{
  classification?: SemanticClassification;
  rawResponse?: string;
  errorSummary?: string;
  failureKind?: "provider_call" | "response_parse";
}> {
  try {
    const response = await callLlm(prompt, {
      providerName: config.llm.provider,
    });
    try {
      return {
        classification: parseSemanticClassification(response),
        rawResponse: response,
      };
    } catch (error) {
      return {
        rawResponse: response,
        errorSummary: error instanceof Error ? error.message : String(error),
        failureKind: "response_parse",
      };
    }
  } catch (error) {
    return {
      errorSummary: formatProviderError(error),
      failureKind: "provider_call",
    };
  }
}

export async function classifyProject(
  project: NormalizedProject,
  config: AppConfig,
): Promise<SemanticClassification | undefined> {
  if (!isSemanticClassificationEnabled(config)) return undefined;

  const { classification } = await classifyProjectDetailed(project, config);
  return classification;
}

function buildClassificationRepairSeed(
  project: NormalizedProject,
  attempt: Awaited<ReturnType<typeof callAndParseClassification>>,
): string {
  if (attempt.rawResponse && attempt.rawResponse.trim().length > 0) {
    return attempt.rawResponse;
  }
  return `Project name: ${project.project_name}\nDescription: ${project.description ?? ""}`;
}

async function repairClassificationAfterParseFailure(
  project: NormalizedProject,
  config: AppConfig,
  attempt: Awaited<ReturnType<typeof callAndParseClassification>>,
): Promise<{ classification?: SemanticClassification; errorSummary: string }> {
  const firstError = attempt.errorSummary ?? "unknown classification error";
  const repairedAttempt = await callAndParseClassification(
    buildClassificationRepairPrompt(project, buildClassificationRepairSeed(project, attempt), firstError),
    config,
  );
  if (repairedAttempt.classification) {
    return { classification: repairedAttempt.classification, errorSummary: firstError };
  }
  return {
    errorSummary: repairedAttempt.errorSummary ?? firstError,
  };
}

async function classifyProjectDetailed(
  project: NormalizedProject,
  config: AppConfig,
): Promise<{ classification?: SemanticClassification; errorSummary?: string }> {
  if (!isSemanticClassificationEnabled(config)) return {};

  const firstAttempt = await callAndParseClassification(buildClassificationPrompt(project), config);
  if (firstAttempt.classification) {
    return { classification: firstAttempt.classification };
  }

  if (firstAttempt.failureKind === "provider_call") {
    return { errorSummary: firstAttempt.errorSummary ?? "unknown provider error" };
  }

  const repairedAttempt = await repairClassificationAfterParseFailure(project, config, firstAttempt);
  if (repairedAttempt.classification) {
    return { classification: repairedAttempt.classification };
  }

  console.warn(`[classification] failed for ${project.repo_full_name}: ${repairedAttempt.errorSummary}`);
  return { errorSummary: repairedAttempt.errorSummary };
}

export async function classifyProjects(
  projects: NormalizedProject[],
  config: AppConfig,
): Promise<Map<string, SemanticClassification>> {
  const detailed = await classifyProjectsDetailed(projects, config);
  return detailed.classifications;
}

export async function classifyProjectsDetailed(
  projects: NormalizedProject[],
  config: AppConfig,
): Promise<{
  classifications: Map<string, SemanticClassification>;
  diagnostics: ClassificationRunDiagnostics;
}> {
  const results = new Map<string, SemanticClassification>();
  const diagnostics: ClassificationRunDiagnostics = {
    enabled: isSemanticClassificationEnabled(config),
    mode: config.llm.mode,
    provider: config.llm.provider,
    classification_attempt_count: 0,
    classification_success_count: 0,
    classification_failure_count: 0,
  };

  if (!diagnostics.enabled) {
    return { classifications: results, diagnostics };
  }

  const configuredConcurrency = Number.parseInt(
    process.env["CLASSIFY_CONCURRENCY"] ?? process.env["LLM_CONCURRENCY"] ?? "2",
    10,
  );
  const concurrency = Number.isFinite(configuredConcurrency) && configuredConcurrency > 0 ? configuredConcurrency : 2;

  for (let i = 0; i < projects.length; i += concurrency) {
    const chunk = projects.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (project) => {
        diagnostics.classification_attempt_count += 1;
        const { classification, errorSummary } = await classifyProjectDetailed(project, config);
        if (classification) {
          diagnostics.classification_success_count += 1;
          results.set(project.repo_full_name.toLowerCase(), classification);
          return;
        }

        diagnostics.classification_failure_count += 1;
        diagnostics.classification_last_error = errorSummary ?? diagnostics.classification_last_error;
      }),
    );
  }

  return { classifications: results, diagnostics };
}

export function getDefaultClassification(): SemanticClassification {
  return { ...DEFAULT_CLASSIFICATION };
}

export function serializeClassificationArtifacts(
  projects: NormalizedProject[],
  classifications: Map<string, SemanticClassification>,
): ClassificationArtifact[] {
  return projects.flatMap((project) => {
    const classification = classifications.get(project.repo_full_name.toLowerCase());
    if (!classification) return [];
    return [
      {
        repo_full_name: project.repo_full_name,
        project_name: project.project_name,
        classification,
      },
    ];
  });
}
