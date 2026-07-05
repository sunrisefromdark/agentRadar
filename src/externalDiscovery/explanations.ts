import type { AppConfig } from "../config.ts";
import type { ProjectLibraryEnhancementArtifact, ScoredProject } from "../types.ts";
import { callStructuredEnhancement, isEnhancementEnabled } from "../action/enhancementLlm.ts";
import { stableSourceInputHash } from "./redaction.ts";
import { buildCandidateExplanationPrompt } from "./explanationPrompts.ts";
import { assertPublicSafeCandidateExplanations, assertPublicSafeCandidateExplanationInputs } from "./explanationRedaction.ts";
import type {
  DailyExternalAggregate,
  ExternalCandidateExplanationTitleContext,
  ExternalEvidence,
  ExternalPlatform,
  ObservationCandidate,
} from "./types.ts";

export type ExternalCandidateExplanationStatus = "ok" | "partial" | "skipped" | "failed";
export type ExternalCandidateExplanationScope = "bound_object" | "direction_signal" | "external_evidence_boost";
export type ExternalCandidateExplanationConfidence = "high" | "medium" | "low";
export type ExternalCandidateExplanationSource = "llm" | "rules_fallback" | "existing_project_brief";
type CandidateExplanationSelectionBucket = "project_evidence" | "new_discovery" | "direction_signal" | "official_signal";

export interface CandidateExplanationInput {
  candidate_key: string;
  candidate_kind: ObservationCandidate["candidate_kind"];
  target_key: string;
  display_name: string;
  explanation_scope: ExternalCandidateExplanationScope;
  target_url?: string;
  repo_url?: string;
  target_display_name?: string;
  existing_project_brief_cn?: string;
  repo_description?: string;
  public_evidence_titles: string[];
  public_source_titles: string[];
  evidence_reason_facts: string[];
  evidence_ids: string[];
  platforms: ExternalPlatform[];
  mention_count: number;
  distinct_actor_count: number;
  top_tier_actor_count: number;
  named_registry_actor_names: string[];
  can_enter_daily: boolean;
  can_enter_weekly: boolean;
  cannot_be_primary_conclusion: true;
  input_confidence: ExternalCandidateExplanationConfidence;
  input_warnings: string[];
}

export interface CandidateExplanationBuildResult {
  inputs: CandidateExplanationInput[];
  input_context_hash: string;
  warnings: Array<{ reason_code: string; reason_detail: string }>;
  eligible_count: number;
}

export interface ExternalCandidateExplanation {
  candidate_key: string;
  candidate_kind: ObservationCandidate["candidate_kind"];
  target_key: string;
  explanation_scope: ExternalCandidateExplanationScope;
  what_it_is_cn: string;
  why_watch_cn: string;
  summary_confidence: ExternalCandidateExplanationConfidence;
  summary_source: ExternalCandidateExplanationSource;
  evidence_ids: string[];
  platforms: ExternalPlatform[];
  caveats: string[];
  generated_at: string;
}

export interface ExternalCandidateExplanationArtifact {
  schema_version: "external-discovery.candidate-explanations.v1";
  date: string;
  generated_at: string;
  provider: string;
  explanation_policy_version: "candidate-explanations.v1";
  aggregate_source_input_hash: string;
  aggregate_generated_at: string;
  input_context_hash: string;
  public_safe: true;
  redaction_policy_version: string;
  contains_raw_text: false;
  contains_profile_urls: false;
  status: ExternalCandidateExplanationStatus;
  status_reason?: string;
  explanations: ExternalCandidateExplanation[];
  audit: {
    eligible_count: number;
    attempted_count: number;
    accepted_count: number;
    enhanced_count: number;
    rejected_count: number;
    fallback_count: number;
    warnings: Array<{ reason_code: string; reason_detail: string }>;
  };
}

type BuildInputsArgs = {
  aggregate: DailyExternalAggregate;
  titleContext?: ExternalCandidateExplanationTitleContext[];
  scoredProjects?: ScoredProject[];
  projectLibraryArtifact?: ProjectLibraryEnhancementArtifact | null;
  topN?: number;
};

type GenerateArgs = {
  aggregate: DailyExternalAggregate;
  inputBuild: CandidateExplanationBuildResult;
  config: AppConfig;
  generatedAt: string;
};

type LlmExplanationDraft = {
  candidate_key: string;
  what_it_is_cn?: string;
  why_watch_cn?: string;
  summary_confidence?: ExternalCandidateExplanationConfidence;
  caveats?: string[];
};

const POLICY_VERSION = "candidate-explanations.v1";
const DEFAULT_TOP_N = 50;
const ENHANCED_COVERAGE_THRESHOLD = 0.7;
const QUOTA_BASE_TOTAL = 50;
const DEFAULT_SELECTION_QUOTAS: Record<CandidateExplanationSelectionBucket, number> = {
  project_evidence: 16,
  new_discovery: 16,
  direction_signal: 12,
  official_signal: 6,
};
const SELECTION_BUCKET_ORDER: CandidateExplanationSelectionBucket[] = ["project_evidence", "new_discovery", "direction_signal", "official_signal"];
const OFFICIAL_PLATFORMS = new Set<ExternalPlatform>(["official_web", "official_blog"]);
const textUrlPattern = /https?:\/\/\S+/gi;
const markdownLinkPattern = /\[([^\]]+)\]\([^)]+\)/g;
const rawHandlePattern = /(^|\s)@[\w.-]{2,}/g;
const sensitiveTermPattern = /\b(cookie|session|oauth|bearer|token|api[_ -]?key|password)\b/gi;

const platformNames: Record<ExternalPlatform, string> = {
  x_twitter: "X",
  reddit: "Reddit",
  hacker_news: "HN",
  official_web: "官方网页",
  official_blog: "官方博客",
};

export function buildCandidateExplanationInputs(args: BuildInputsArgs): CandidateExplanationBuildResult {
  const evidenceByTarget = buildEvidenceLookup(args.aggregate);
  const candidates = readCandidateBase(args.aggregate);
  const titleByTarget = groupTitleContext(args.titleContext ?? []);
  const projectBriefs = buildProjectBriefLookup(args.projectLibraryArtifact);
  const scoredProjects = buildScoredProjectLookup(args.scoredProjects ?? []);
  const warnings: Array<{ reason_code: string; reason_detail: string }> = [];

  const inputs = candidates.map((candidate) => {
    const evidenceRows = evidenceByTarget.get(candidate.target_key) ?? [];
    const titleRows = titleByTarget.get(candidate.target_key) ?? [];
    const evidenceIds = unique(evidenceRows.map((evidence) => evidence.evidence_id)).sort();
    const platforms = unique(evidenceRows.flatMap((evidence) => evidence.platforms)).sort() as ExternalPlatform[];
    const scored = findScoredProject(scoredProjects, candidate.target_key);
    const projectBrief = cleanPublicText(findProjectBrief(projectBriefs, candidate.target_key, scored?.project.repo_full_name));
    const repoUrl = scored?.project.repo_url ?? repoUrlFromTargetKey(candidate.target_key);
    const repoDescription = cleanPublicText(scored?.project.description);
    const targetUrl = candidate.target_key.startsWith("http") ? candidate.target_key : repoUrl;
    const publicEvidenceTitles = unique(titleRows.map((item) => cleanPublicText(item.public_evidence_title)).filter(isNonEmptyString)).slice(0, 5);
    const publicSourceTitles = unique(titleRows.map((item) => cleanPublicText(item.public_source_title)).filter(isNonEmptyString)).slice(0, 5);
    const targetDisplayName = firstNonEmpty([
      ...titleRows.map((item) => item.target_display_name),
      scored?.project.project_name,
      displayNameFromTargetKey(candidate.target_key),
    ].map((item) => cleanPublicText(item)));
    const explanationScope = explanationScopeFor(candidate, evidenceRows, Boolean(repoUrl || projectBrief));
    const inputWarnings = inputWarningsFor({
      projectBrief,
      repoDescription,
      publicEvidenceTitles,
      publicSourceTitles,
      explanationScope,
    });

    for (const reasonCode of inputWarnings) {
      warnings.push({
        reason_code: reasonCode,
        reason_detail: `${candidate.candidate_kind}:${candidate.target_key}`,
      });
    }

    return {
      candidate_key: `${candidate.candidate_kind}:${candidate.target_key}`,
      candidate_kind: candidate.candidate_kind,
      target_key: candidate.target_key,
      display_name: targetDisplayName ?? safeDisplayNameFromTargetKey(candidate.target_key),
      explanation_scope: explanationScope,
      target_url: targetUrl,
      repo_url: repoUrl,
      target_display_name: targetDisplayName,
      existing_project_brief_cn: projectBrief,
      repo_description: repoDescription,
      public_evidence_titles: publicEvidenceTitles,
      public_source_titles: publicSourceTitles,
      evidence_reason_facts: evidenceReasonFacts(candidate, evidenceRows).map((item) => cleanPublicText(item)).filter(isNonEmptyString),
      evidence_ids: evidenceIds,
      platforms,
      mention_count: sum(evidenceRows.map((evidence) => evidence.mention_count)),
      distinct_actor_count: sum(evidenceRows.map((evidence) => evidence.distinct_actor_count)),
      top_tier_actor_count: sum(evidenceRows.map((evidence) => evidence.top_tier_actor_count)),
      named_registry_actor_names: unique(
        evidenceRows.flatMap((evidence) => evidence.named_registry_actors.map((actor) => cleanPublicText(actor.display_name)).filter(isNonEmptyString)),
      ).slice(0, 8),
      can_enter_daily: candidate.can_enter_daily,
      can_enter_weekly: candidate.can_enter_weekly,
      cannot_be_primary_conclusion: true as const,
      input_confidence: inputConfidence({
        projectBrief,
        repoDescription,
        repoUrl,
        publicEvidenceTitles,
        publicSourceTitles,
        explanationScope,
        evidenceRows,
      }),
      input_warnings: inputWarnings,
    };
  });

  const sortedInputs = selectInputsWithQuotas(inputs, Math.max(1, args.topN ?? DEFAULT_TOP_N));
  const redaction = assertPublicSafeCandidateExplanationInputs(sortedInputs);
  if (!redaction.ok) {
    warnings.push({
      reason_code: "public_safe_validation_failed",
      reason_detail: redaction.reason_codes.join(","),
    });
  }

  return {
    inputs: sortedInputs,
    input_context_hash: stableSourceInputHash(JSON.stringify(sortedInputs)),
    warnings: uniqueWarnings(warnings),
    eligible_count: sortedInputs.length,
  };
}

export async function generateExternalCandidateExplanations(args: GenerateArgs): Promise<ExternalCandidateExplanationArtifact> {
  const enabled = isEnhancementEnabled(args.config);
  const provider = enabled ? args.config.llm.provider : "rules";
  const inputs = args.inputBuild.inputs;
  const warnings = [...args.inputBuild.warnings];
  const inputSafety = assertPublicSafeCandidateExplanationInputs(inputs);
  if (!inputSafety.ok) {
    return artifact(args, {
      provider,
      status: "failed",
      statusReason: "public_safe_validation_failed",
      explanations: [],
      attemptedCount: 0,
      rejectedCount: inputs.length,
      warnings: [
        ...warnings,
        {
          reason_code: "public_safe_validation_failed",
          reason_detail: inputSafety.reason_codes.join(","),
        },
      ],
    });
  }

  if (inputs.length === 0) {
    return artifact(args, {
      provider,
      status: "skipped",
      statusReason: "no_candidates",
      explanations: [],
      attemptedCount: 0,
      rejectedCount: 0,
      warnings,
    });
  }

  const existing = inputs
    .filter((input) => Boolean(input.existing_project_brief_cn))
    .map((input) => explanationFromExistingBrief(input, args.generatedAt));
  const existingKeys = new Set(existing.map((item) => item.candidate_key));
  const llmInputs = inputs.filter((input) => !existingKeys.has(input.candidate_key) && input.input_confidence !== "low");
  const fallbackInputs = new Map(inputs.filter((input) => !existingKeys.has(input.candidate_key)).map((input) => [input.candidate_key, input] as const));
  const llmExplanations: ExternalCandidateExplanation[] = [];
  let attemptedCount = 0;
  let rejectedCount = 0;

  if (!enabled) {
    warnings.push({ reason_code: "llm_disabled", reason_detail: "LLM is disabled; using rules fallback explanations" });
  } else if (llmInputs.length === 0) {
    warnings.push({ reason_code: "input_context_insufficient", reason_detail: "No candidate had enough context for LLM explanation" });
  } else {
    attemptedCount = llmInputs.length;
    const raw = await callStructuredEnhancement<unknown>(buildCandidateExplanationPrompt(llmInputs), args.config, {
      maxTokens: 5000,
    });
    const drafts = buildDraftMap(raw);

    for (const input of llmInputs) {
      const draft = drafts.get(input.candidate_key);
      if (!draft) {
        rejectedCount += 1;
        warnings.push({ reason_code: "summary_generation_failed", reason_detail: input.candidate_key });
        continue;
      }
      const accepted = explanationFromDraft(input, draft, args.generatedAt);
      if (!accepted) {
        rejectedCount += 1;
        warnings.push({ reason_code: "summary_validation_failed", reason_detail: input.candidate_key });
        continue;
      }
      llmExplanations.push(accepted);
      fallbackInputs.delete(input.candidate_key);
    }
  }

  const fallback = [...fallbackInputs.values()].map((input) => rulesFallbackExplanation(input, args.generatedAt));
  const deduped = dedupeEnhancedSummaries([...existing, ...llmExplanations, ...fallback], inputs, args.generatedAt);
  warnings.push(...deduped.warnings);
  const explanations = deduped.explanations.sort((left, right) => left.candidate_key.localeCompare(right.candidate_key));
  const enhancedCount = explanations.filter((item) => item.summary_source === "llm" || item.summary_source === "existing_project_brief").length;
  const status = explanationStatus({
    enabled,
    candidateCount: inputs.length,
    enhancedCount,
    fallbackCount: fallback.length,
  });
  const statusReason =
    status === "ok"
      ? "candidate_explanation_ok"
      : !enabled
        ? "llm_disabled"
        : enhancedCount === 0
          ? "summary_generation_failed"
          : "partial_llm_failure";
  const candidateArtifact = artifact(args, {
    provider,
    status,
    statusReason,
    explanations,
    attemptedCount,
    rejectedCount,
    warnings,
  });
  const redaction = assertPublicSafeCandidateExplanations(candidateArtifact);
  if (redaction.ok) return candidateArtifact;

  return artifact(args, {
    provider,
    status: "failed",
    statusReason: "public_safe_validation_failed",
    explanations: inputs.map((input) => rulesFallbackExplanation(input, args.generatedAt)),
    attemptedCount,
    rejectedCount: inputs.length,
    warnings: [
      ...warnings,
      {
        reason_code: "public_safe_validation_failed",
        reason_detail: redaction.reason_codes.join(","),
      },
    ],
  });
}

function artifact(
  args: GenerateArgs,
  values: {
    provider: string;
    status: ExternalCandidateExplanationStatus;
    statusReason: string;
    explanations: ExternalCandidateExplanation[];
    attemptedCount: number;
    rejectedCount: number;
    warnings: Array<{ reason_code: string; reason_detail: string }>;
  },
): ExternalCandidateExplanationArtifact {
  const enhancedCount = values.explanations.filter((item) => item.summary_source === "llm" || item.summary_source === "existing_project_brief").length;
  const fallbackCount = values.explanations.filter((item) => item.summary_source === "rules_fallback").length;
  return {
    schema_version: "external-discovery.candidate-explanations.v1",
    date: args.aggregate.date,
    generated_at: args.generatedAt,
    provider: values.provider,
    explanation_policy_version: POLICY_VERSION,
    aggregate_source_input_hash: args.aggregate.source_input_hash,
    aggregate_generated_at: args.aggregate.generated_at,
    input_context_hash: args.inputBuild.input_context_hash,
    public_safe: true,
    redaction_policy_version: "external-discovery-explanation-redaction.v1",
    contains_raw_text: false,
    contains_profile_urls: false,
    status: values.status,
    status_reason: values.statusReason,
    explanations: values.explanations,
    audit: {
      eligible_count: args.inputBuild.eligible_count,
      attempted_count: values.attemptedCount,
      accepted_count: values.explanations.length,
      enhanced_count: enhancedCount,
      rejected_count: values.rejectedCount,
      fallback_count: fallbackCount,
      warnings: uniqueWarnings(values.warnings),
    },
  };
}

function explanationStatus(args: {
  enabled: boolean;
  candidateCount: number;
  enhancedCount: number;
  fallbackCount: number;
}): ExternalCandidateExplanationStatus {
  if (!args.enabled) return "skipped";
  if (args.candidateCount === 0) return "skipped";
  if (args.enhancedCount === 0) return "failed";
  return args.enhancedCount / args.candidateCount >= ENHANCED_COVERAGE_THRESHOLD ? "ok" : "partial";
}

function explanationFromExistingBrief(input: CandidateExplanationInput, generatedAt: string): ExternalCandidateExplanation {
  return {
    candidate_key: input.candidate_key,
    candidate_kind: input.candidate_kind,
    target_key: input.target_key,
    explanation_scope: input.explanation_scope,
    what_it_is_cn: input.existing_project_brief_cn!,
    why_watch_cn: whyWatchFallback(input),
    summary_confidence: "high",
    summary_source: "existing_project_brief",
    evidence_ids: input.evidence_ids,
    platforms: input.platforms,
    caveats: caveatsFor(input),
    generated_at: generatedAt,
  };
}

function explanationFromDraft(
  input: CandidateExplanationInput,
  draft: LlmExplanationDraft,
  generatedAt: string,
): ExternalCandidateExplanation | null {
  const what = draft.what_it_is_cn?.trim();
  const why = draft.why_watch_cn?.trim();
  if (!what || !why) return null;
  if (input.explanation_scope === "direction_signal" && !/(方向|线索|尚未绑定明确项目|尚未绑定明确 GitHub 项目)/.test(`${what}${why}`)) {
    return null;
  }
  if (input.explanation_scope !== "direction_signal" && input.candidate_kind !== "direction" && hasDirectionOnlySemantics(`${what}${why}`)) {
    return null;
  }
  return {
    candidate_key: input.candidate_key,
    candidate_kind: input.candidate_kind,
    target_key: input.target_key,
    explanation_scope: input.explanation_scope,
    what_it_is_cn: what,
    why_watch_cn: why,
    summary_confidence: draft.summary_confidence ?? input.input_confidence,
    summary_source: "llm",
    evidence_ids: input.evidence_ids,
    platforms: input.platforms,
    caveats: normalizeCaveats(draft.caveats, input),
    generated_at: generatedAt,
  };
}

function hasDirectionOnlySemantics(value: string): boolean {
  return /方向线索|尚未绑定明确项目|尚未绑定明确 GitHub 项目|进入方向观察|作为方向观察/.test(value);
}

function rulesFallbackExplanation(input: CandidateExplanationInput, generatedAt: string): ExternalCandidateExplanation {
  return {
    candidate_key: input.candidate_key,
    candidate_kind: input.candidate_kind,
    target_key: input.target_key,
    explanation_scope: input.explanation_scope,
    what_it_is_cn: whatItIsFallback(input),
    why_watch_cn: whyWatchFallback(input),
    summary_confidence: input.input_confidence === "high" ? "medium" : input.input_confidence,
    summary_source: "rules_fallback",
    evidence_ids: input.evidence_ids,
    platforms: input.platforms,
    caveats: caveatsFor(input),
    generated_at: generatedAt,
  };
}

function whatItIsFallback(input: CandidateExplanationInput): string {
  if (input.explanation_scope === "direction_signal" || input.candidate_kind === "direction") {
    return `${input.display_name} 是今天外部讨论中出现的方向线索，尚未绑定明确 GitHub 项目。`;
  }
  if (input.explanation_scope === "external_evidence_boost") {
    return `${input.display_name} 是已有候选获得外部补证的对象，目前只确认它在外部来源中再次出现。`;
  }
  if (input.repo_description) {
    return `${input.display_name} 是已绑定 repo 的项目候选，已有描述显示：${trimSentence(input.repo_description)}。`;
  }
  return `${input.display_name} 是已绑定对象的外部发现候选，当前仍需主链路补充具体功能说明。`;
}

function whyWatchFallback(input: CandidateExplanationInput): string {
  const platformText = input.platforms.length > 0 ? input.platforms.map((platform) => platformNames[platform]).join("、") : "外部来源";
  const actorText =
    input.named_registry_actor_names.length > 0
      ? `，并命中 ${input.named_registry_actor_names.slice(0, 3).join("、")} 等公开讨论者`
      : "";
  const entryText = input.can_enter_daily || input.can_enter_weekly ? "，可作为日报或周报的次级证据" : "";
  if (input.explanation_scope === "direction_signal") {
    return `${platformText} 出现相关讨论${actorText}，适合先进入方向观察${entryText}，但不能替代主链路判断。`;
  }
  return `${platformText} 出现该对象的外部讨论或官方信号${actorText}${entryText}，适合继续查看证据来源。`;
}

function caveatsFor(input: CandidateExplanationInput): string[] {
  const caveats = ["外部层不能作为主榜结论，仍需 GitHub / Trendshift 主链路确认。"];
  if (input.explanation_scope === "direction_signal") caveats.push("该候选尚未绑定明确 GitHub 项目。");
  if (!input.repo_description && !input.existing_project_brief_cn) caveats.push("当前缺少稳定项目简介，具体用途不做推断。");
  return unique(caveats);
}

function normalizeCaveats(caveats: unknown, input: CandidateExplanationInput): string[] {
  const fromDraft = Array.isArray(caveats)
    ? caveats.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
    : [];
  return unique([...fromDraft, ...caveatsFor(input)]).slice(0, 5);
}

function dedupeEnhancedSummaries(
  explanations: ExternalCandidateExplanation[],
  inputs: CandidateExplanationInput[],
  generatedAt: string,
): {
  explanations: ExternalCandidateExplanation[];
  warnings: Array<{ reason_code: string; reason_detail: string }>;
} {
  const inputByKey = new Map(inputs.map((input) => [input.candidate_key, input] as const));
  const seen = new Set<string>();
  const warnings: Array<{ reason_code: string; reason_detail: string }> = [];

  return {
    explanations: explanations.map((explanation) => {
      if (explanation.summary_source === "rules_fallback") return explanation;
      const summaryKey = normalizeSummaryText(`${explanation.what_it_is_cn}${explanation.why_watch_cn}`);
      if (!seen.has(summaryKey)) {
        seen.add(summaryKey);
        return explanation;
      }

      const input = inputByKey.get(explanation.candidate_key);
      if (!input) return explanation;
      warnings.push({
        reason_code: "duplicate_summary_fallback",
        reason_detail: explanation.candidate_key,
      });
      return rulesFallbackExplanation(input, generatedAt);
    }),
    warnings,
  };
}

function buildDraftMap(raw: unknown): Map<string, LlmExplanationDraft> {
  if (!raw || typeof raw !== "object") return new Map();
  const record = raw as Record<string, unknown>;
  const explanations = Array.isArray(record.explanations) ? record.explanations : [];
  const map = new Map<string, LlmExplanationDraft>();
  for (const item of explanations) {
    if (!item || typeof item !== "object") continue;
    const draft = item as Record<string, unknown>;
    const candidateKey = typeof draft.candidate_key === "string" ? draft.candidate_key.trim() : "";
    if (!candidateKey) continue;
    map.set(candidateKey, {
      candidate_key: candidateKey,
      what_it_is_cn: typeof draft.what_it_is_cn === "string" ? draft.what_it_is_cn.trim() : undefined,
      why_watch_cn: typeof draft.why_watch_cn === "string" ? draft.why_watch_cn.trim() : undefined,
      summary_confidence: isConfidence(draft.summary_confidence) ? draft.summary_confidence : undefined,
      caveats: Array.isArray(draft.caveats) ? draft.caveats.filter((entry): entry is string => typeof entry === "string") : undefined,
    });
  }
  return map;
}

function readCandidateBase(aggregate: DailyExternalAggregate): ObservationCandidate[] {
  if (aggregate.observation_candidates.length > 0) return aggregate.observation_candidates;
  const fromProject = aggregate.project_evidence.map((evidence): ObservationCandidate => ({
    candidate_kind: "project",
    target_key: evidence.target_key,
    qualification: "needs_primary_confirmation",
    can_enter_daily: true,
    can_enter_weekly: evidence.platforms.length > 1 || evidence.mention_count >= 2,
    cannot_be_primary_conclusion: true,
  }));
  const fromDirection = aggregate.direction_evidence.map((evidence): ObservationCandidate => ({
    candidate_kind: "direction",
    target_key: evidence.target_key,
    qualification: "direction_observation",
    can_enter_daily: true,
    can_enter_weekly: evidence.platforms.length > 1 || evidence.mention_count >= 3,
    cannot_be_primary_conclusion: true,
  }));
  return uniqueCandidates([...fromProject, ...fromDirection]);
}

function buildEvidenceLookup(aggregate: DailyExternalAggregate): Map<string, ExternalEvidence[]> {
  const map = new Map<string, ExternalEvidence[]>();
  for (const evidence of [...aggregate.project_evidence, ...aggregate.direction_evidence]) {
    map.set(evidence.target_key, [...(map.get(evidence.target_key) ?? []), evidence]);
  }
  return map;
}

function groupTitleContext(context: ExternalCandidateExplanationTitleContext[]): Map<string, ExternalCandidateExplanationTitleContext[]> {
  const map = new Map<string, ExternalCandidateExplanationTitleContext[]>();
  for (const item of context) {
    map.set(item.target_key, [...(map.get(item.target_key) ?? []), item]);
  }
  return map;
}

function buildProjectBriefLookup(artifact: ProjectLibraryEnhancementArtifact | null | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of artifact?.entries ?? []) {
    map.set(entry.repo_full_name.toLowerCase(), entry.project_brief_cn.trim());
  }
  return map;
}

function buildScoredProjectLookup(projects: ScoredProject[]): Map<string, ScoredProject> {
  const map = new Map<string, ScoredProject>();
  for (const project of projects) {
    map.set(project.project.repo_full_name.toLowerCase(), project);
    map.set(project.project.repo_url.toLowerCase(), project);
  }
  return map;
}

function findScoredProject(projects: Map<string, ScoredProject>, targetKey: string): ScoredProject | undefined {
  return projects.get(targetKey.toLowerCase()) ?? projects.get(normalizedRepoKey(targetKey));
}

function findProjectBrief(briefs: Map<string, string>, targetKey: string, repoFullName?: string): string | undefined {
  return briefs.get((repoFullName ?? "").toLowerCase()) ?? briefs.get(normalizedRepoKey(targetKey));
}

function normalizedRepoKey(value: string): string {
  const repo = /^https?:\/\/github\.com\/([^/\s]+\/[^/\s#?]+)/i.exec(value.trim())?.[1] ?? value.trim();
  return repo.replace(/\.git$/i, "").toLowerCase();
}

function repoUrlFromTargetKey(value: string): string | undefined {
  if (/^https?:\/\/github\.com\/[^/\s]+\/[^/\s#?]+/i.test(value)) return value;
  return /^[\w.-]+\/[\w.-]+$/.test(value) ? `https://github.com/${value}` : undefined;
}

function displayNameFromTargetKey(value: string): string {
  if (/^https?:\/\/github\.com\//i.test(value)) return normalizedRepoKey(value);
  if (/^https?:\/\//i.test(value)) return "外部对象";
  return value;
}

function explanationScopeFor(
  candidate: ObservationCandidate,
  evidenceRows: ExternalEvidence[],
  hasBoundObjectContext: boolean,
): ExternalCandidateExplanationScope {
  if (candidate.candidate_kind === "direction" || candidate.qualification === "direction_observation") return "direction_signal";
  if (evidenceRows.some((evidence) => evidence.derived_signal_kinds.includes("evidence"))) return "external_evidence_boost";
  return hasBoundObjectContext ? "bound_object" : "direction_signal";
}

function inputConfidence(args: {
  projectBrief?: string;
  repoDescription?: string;
  repoUrl?: string;
  publicEvidenceTitles: string[];
  publicSourceTitles: string[];
  explanationScope: ExternalCandidateExplanationScope;
  evidenceRows: ExternalEvidence[];
}): ExternalCandidateExplanationConfidence {
  if (args.projectBrief) return "high";
  if (args.explanationScope === "direction_signal") return args.publicEvidenceTitles.length + args.publicSourceTitles.length > 0 ? "medium" : "low";
  if (args.repoDescription && args.repoUrl && args.evidenceRows.length > 0) return "high";
  if (args.repoUrl || args.publicEvidenceTitles.length > 0 || args.publicSourceTitles.length > 0) return "medium";
  return "low";
}

function inputWarningsFor(args: {
  projectBrief?: string;
  repoDescription?: string;
  publicEvidenceTitles: string[];
  publicSourceTitles: string[];
  explanationScope: ExternalCandidateExplanationScope;
}): string[] {
  const warnings: string[] = [];
  if (!args.projectBrief && !args.repoDescription && args.publicEvidenceTitles.length === 0 && args.publicSourceTitles.length === 0) {
    warnings.push("public_title_context_missing");
  }
  if (args.explanationScope === "direction_signal") warnings.push("direction_candidate_low_confidence");
  return warnings;
}

function evidenceReasonFacts(candidate: ObservationCandidate, evidenceRows: ExternalEvidence[]): string[] {
  const platforms = unique(evidenceRows.flatMap((evidence) => evidence.platforms));
  const namedActors = unique(evidenceRows.flatMap((evidence) => evidence.named_registry_actors.map((actor) => actor.display_name)));
  const facts = [
    platforms.length > 0 ? `来源平台：${platforms.map((platform) => platformNames[platform]).join("、")}` : "来源平台：unknown",
    platforms.length > 1 ? "跨平台出现" : undefined,
    namedActors.length > 0 ? `具名讨论者：${namedActors.slice(0, 5).join("、")}` : undefined,
    candidate.can_enter_daily ? "可进入日报作为次级证据" : undefined,
    candidate.can_enter_weekly ? "可进入周报作为次级证据" : undefined,
    candidate.cannot_be_primary_conclusion ? "仍需主源确认，不能作为主榜结论" : undefined,
  ];
  return facts.filter(isNonEmptyString);
}

function selectInputsWithQuotas(inputs: CandidateExplanationInput[], limit: number): CandidateExplanationInput[] {
  const sorted = sortInputs(inputs);
  const quotas = quotasForLimit(limit);
  const selected = new Map<string, CandidateExplanationInput>();
  const selectedCounts = new Map<CandidateExplanationSelectionBucket, number>();

  for (const bucket of SELECTION_BUCKET_ORDER) {
    const quota = quotas[bucket];
    if (quota <= 0) continue;
    for (const input of sorted) {
      if (selected.size >= limit) break;
      if (selectionBucketFor(input) !== bucket || selected.has(input.candidate_key)) continue;
      selected.set(input.candidate_key, input);
      selectedCounts.set(bucket, (selectedCounts.get(bucket) ?? 0) + 1);
      if ((selectedCounts.get(bucket) ?? 0) >= quota) break;
    }
  }

  for (const input of sorted) {
    if (selected.size >= limit) break;
    if (!selected.has(input.candidate_key)) selected.set(input.candidate_key, input);
  }

  return sortInputs([...selected.values()]);
}

function quotasForLimit(limit: number): Record<CandidateExplanationSelectionBucket, number> {
  return {
    project_evidence: scaledQuota(DEFAULT_SELECTION_QUOTAS.project_evidence, limit),
    new_discovery: scaledQuota(DEFAULT_SELECTION_QUOTAS.new_discovery, limit),
    direction_signal: scaledQuota(DEFAULT_SELECTION_QUOTAS.direction_signal, limit),
    official_signal: scaledQuota(DEFAULT_SELECTION_QUOTAS.official_signal, limit),
  };
}

function scaledQuota(quota: number, limit: number): number {
  if (limit >= QUOTA_BASE_TOTAL) return quota;
  return Math.max(1, Math.floor((quota * limit) / QUOTA_BASE_TOTAL));
}

function selectionBucketFor(input: CandidateExplanationInput): CandidateExplanationSelectionBucket {
  if (input.platforms.some((platform) => OFFICIAL_PLATFORMS.has(platform))) return "official_signal";
  if (input.explanation_scope === "direction_signal") return "direction_signal";
  if (input.explanation_scope === "external_evidence_boost") return "project_evidence";
  return "new_discovery";
}

function sortInputs(inputs: CandidateExplanationInput[]): CandidateExplanationInput[] {
  const rank: Record<ExternalCandidateExplanationScope, number> = {
    external_evidence_boost: 0,
    bound_object: 1,
    direction_signal: 2,
  };
  return [...inputs].sort(
    (left, right) =>
      rank[left.explanation_scope] - rank[right.explanation_scope] ||
      right.evidence_ids.length - left.evidence_ids.length ||
      right.platforms.length - left.platforms.length ||
      right.top_tier_actor_count - left.top_tier_actor_count ||
      right.mention_count - left.mention_count ||
      left.candidate_key.localeCompare(right.candidate_key),
  );
}

function trimSentence(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 80 ? `${normalized.slice(0, 80)}...` : normalized;
}

function cleanPublicText(value: string | undefined): string | undefined {
  const cleaned = value
    ?.replace(markdownLinkPattern, "$1")
    .replace(textUrlPattern, "")
    .replace(rawHandlePattern, "$1")
    .replace(sensitiveTermPattern, "credential")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\b(?:demo|link|url|website)\s*:\s*$/i, "")
    .trim();
  return cleaned || undefined;
}

function safeDisplayNameFromTargetKey(value: string): string {
  return cleanPublicText(displayNameFromTargetKey(value)) ?? cleanPublicText(value) ?? "external object";
}

function normalizeSummaryText(value: string): string {
  return value.replace(/\s+/g, "").replace(/[锛屻€傘€佲€溾€?'锛涳細:,.!?锛侊紵()锛堬級\-\s]/g, "").toLowerCase();
}

function firstNonEmpty(values: Array<string | undefined>): string | undefined {
  return values.find(isNonEmptyString);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isConfidence(value: unknown): value is ExternalCandidateExplanationConfidence {
  return value === "high" || value === "medium" || value === "low";
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function uniqueCandidates(candidates: ObservationCandidate[]): ObservationCandidate[] {
  const byKey = new Map<string, ObservationCandidate>();
  for (const candidate of candidates) {
    byKey.set(`${candidate.candidate_kind}:${candidate.target_key}`, candidate);
  }
  return [...byKey.values()];
}

function uniqueWarnings<T extends { reason_code: string; reason_detail: string }>(warnings: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const warning of warnings) {
    byKey.set(`${warning.reason_code}:${warning.reason_detail}`, warning);
  }
  return [...byKey.values()];
}
