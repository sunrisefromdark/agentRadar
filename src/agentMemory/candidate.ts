import fs from "node:fs";
import path from "node:path";
import { allocateNextEventId, buildSkillId, claimNextEventId } from "./ids.ts";
import { writeJsonAtomic, writeJsonExclusive, writeTextAtomic } from "./fs.ts";
import { extractRepoPathsFromText, normalizePath, normalizePathList, normalizeWatchPaths } from "./paths.ts";
import { buildLifecycleEvent } from "./lifecycle.ts";
import type {
  ArtifactType,
  Domain,
  GateRequirement,
  LearnedSkillMetadata,
  ManualSkillMetadata,
  SkillReuseReceipt,
  SkillLifecycleEventReceipt,
  TaskKind,
  TaskExecutionReceipt,
} from "./types.ts";

const DERIVED_AGENT_MEMORY_PREFIXES = [
  "data/agent-memory/tasks/",
  "data/agent-memory/routing/",
  "data/agent-memory/reuse/",
  "data/agent-memory/archives/",
  "data/agent-memory/lifecycle/",
  "data/agent-memory/drift/",
  "data/agent-memory/manifests/",
  "data/agent-memory/tree/",
] as const;

type ExistingSkill = ManualSkillMetadata | LearnedSkillMetadata;
type LineageTrack = "replacement" | "child" | "root";

export interface CandidateSynthesisInput {
  rootDir: string;
  now: string;
  taskReceipt: TaskExecutionReceipt;
  taskReceiptPath: string;
  reuseReceipts: SkillReuseReceipt[];
  reuseReceiptPaths: string[];
  existingSkills: ExistingSkill[];
}

export type CandidateSynthesisResult =
  | {
      status: "blocked";
      rejected_learning_reasons: string[];
    }
  | {
      status: "created";
      lineage_track: LineageTrack;
      metadata: LearnedSkillMetadata;
      markdown: string;
      lifecycle_event: SkillLifecycleEventReceipt;
      replaced_skill_id?: string;
    };

export function synthesizeLearnedCandidate(input: CandidateSynthesisInput): CandidateSynthesisResult {
  const blocked = validateTaskCandidateEligibility(input.taskReceipt);
  if (blocked.length > 0) return { status: "blocked", rejected_learning_reasons: blocked };

  const context = buildCandidateContext(input);
  if ("blocked" in context) return context.blocked;

  return buildCandidateResult(input, context);
}

export function writeLearnedCandidateArtifacts(
  rootDir: string,
  result: Extract<CandidateSynthesisResult, { status: "created" }>,
): Extract<CandidateSynthesisResult, { status: "created" }> {
  const persisted = claimNextEventId(rootDir, result.lifecycle_event.created_at.slice(0, 10), result.metadata.skill_id, (eventId) => {
    const lifecycle_event = {
      ...result.lifecycle_event,
      event_id: eventId,
    };
    writeJsonExclusive(
      rootDir,
      `data/agent-memory/lifecycle/${lifecycle_event.created_at.slice(0, 10)}/${lifecycle_event.event_id}.json`,
      lifecycle_event,
    );
    return {
      ...result,
      metadata: {
        ...result.metadata,
        last_lifecycle_event_id: eventId,
      },
      lifecycle_event,
    };
  });

  const learnedDir = `data/agent-memory/learned/${persisted.metadata.domain}`;
  writeJsonAtomic(rootDir, `${learnedDir}/${persisted.metadata.skill_id}.json`, persisted.metadata);
  writeTextAtomic(rootDir, `${learnedDir}/${persisted.metadata.skill_id}.md`, persisted.markdown);
  return persisted;
}

function validateTaskCandidateEligibility(taskReceipt: TaskExecutionReceipt): string[] {
  const rejections: string[] = [];
  if (taskReceipt.result !== "success") rejections.push(`task-result-not-success:${taskReceipt.result}`);
  if (taskReceipt.domain === null || taskReceipt.task_kind === null) rejections.push("classification-not-unique");
  if (!taskReceipt.reusable_summary || !isReusableSummaryComplete(taskReceipt.reusable_summary)) rejections.push("reusable-summary-invalid");
  if (taskReceipt.learning_blockers.length > 0) rejections.push(...taskReceipt.learning_blockers.map((item) => item.reason));
  if (taskReceipt.task_completion_gates_evaluated.some((gate) => gate.state !== "passed")) rejections.push("task-completion-gates-not-passed");
  if (taskReceipt.verification_commands.some((verification) => verification.status !== "passed")) rejections.push("verification-not-passed");
  return Array.from(new Set(rejections));
}

function isReusableSummaryComplete(summary: NonNullable<TaskExecutionReceipt["reusable_summary"]>): boolean {
  return Boolean(
    summary.intent &&
      summary.use_when.length > 0 &&
      summary.do_not_use_when.length > 0 &&
      summary.inputs_preconditions.length > 0 &&
      summary.steps.length > 0 &&
      summary.validation.length > 0 &&
      summary.failure_signals.length > 0 &&
      summary.fallback.length > 0,
  );
}

function extractRequiredGates(taskReceipt: TaskExecutionReceipt): GateRequirement[] {
  const passedGateIds = new Set(
    taskReceipt.task_completion_gates_evaluated.filter((gate) => gate.state === "passed").map((gate) => gate.gate_id),
  );
  return (taskReceipt.task_completion_gate_requirements ?? []).filter((gate) => passedGateIds.has(gate.gate_id));
}

function collectScriptRefs(rootDir: string, taskReceipt: TaskExecutionReceipt): string[] {
  const fromFiles = taskReceipt.files_touched.filter((item) => item.startsWith("scripts/"));
  const fromCommands = taskReceipt.commands_executed.flatMap((command) => extractRepoPathsFromText(command.command));
  return normalizePathList([...fromFiles, ...fromCommands]).filter((item) => item.startsWith("scripts/") && fs.existsSync(path.join(rootDir, item)));
}

function collectLearnedWatchPaths(targetPaths: string[], scriptRefs: string[], filesTouched: string[]): string[] {
  const relevantFiles = filesTouched.filter(
    (item) => !DERIVED_AGENT_MEMORY_PREFIXES.some((prefix) => item.startsWith(prefix)),
  );
  return normalizeWatchPaths([...targetPaths, ...scriptRefs, ...relevantFiles]);
}

function normalizedScopeKey(
  skill: {
  domain: string;
  subdomain?: string;
  task_kinds: string[];
  artifact_types: string[];
  target_paths: string[];
  constraint_tags: string[];
  goal_terms: string[];
},
  includeSubdomain = true,
): string {
  return JSON.stringify({
    domain: skill.domain,
    ...(includeSubdomain ? { subdomain: skill.subdomain ?? "general" } : {}),
    task_kinds: [...skill.task_kinds].sort((left, right) => left.localeCompare(right)),
    artifact_types: [...skill.artifact_types].sort((left, right) => left.localeCompare(right)),
    target_paths: normalizePathList(skill.target_paths),
    constraint_tags: [...skill.constraint_tags].sort((left, right) => left.localeCompare(right)),
    goal_terms: [...skill.goal_terms].sort((left, right) => left.localeCompare(right)),
  });
}

function isBroaderScopeAnchor(
  skill: ExistingSkill,
  candidate: {
    domain: string;
    task_kinds: string[];
    artifact_types: string[];
    target_paths: string[];
  },
  exactAnchors: ExistingSkill[],
): boolean {
  if (exactAnchors.some((anchor) => anchor.skill_id === skill.skill_id)) return false;
  if (skill.domain !== candidate.domain) return false;
  if (skill.subdomain === "general" && normalizePathList(skill.target_paths).length === 0) return false;
  if (!isSuperset(skill.task_kinds, candidate.task_kinds)) return false;
  if (!isSuperset(skill.artifact_types, candidate.artifact_types)) return false;
  return targetPathPrefixesCover(skill.target_paths, candidate.target_paths);
}

function isSuperset(values: string[], expected: string[]): boolean {
  return expected.every((value) => values.includes(value));
}

function targetPathPrefixesCover(anchorPaths: string[], candidatePaths: string[]): boolean {
  const normalizedAnchors = normalizePathList(anchorPaths);
  const normalizedCandidates = normalizePathList(candidatePaths);
  return normalizedCandidates.every((candidatePath) =>
    normalizedAnchors.some((anchorPath) => anchorPath === candidatePath || (anchorPath.endsWith("/") && candidatePath.startsWith(anchorPath))),
  );
}

function resolveLineage(
  domain: string,
  exactAnchors: ExistingSkill[],
  broaderAnchors: ExistingSkill[],
): { track: LineageTrack; subdomain: LearnedSkillMetadata["subdomain"]; parent_skill_id?: string; exact_anchor?: ExistingSkill } {
  if (exactAnchors.length === 1) {
    const anchor = exactAnchors[0]!;
    return {
      track: "replacement",
      subdomain: anchor.subdomain,
      parent_skill_id: anchor.parent_skill_id,
      exact_anchor: anchor,
    };
  }
  if (broaderAnchors.length === 1) {
    const anchor = broaderAnchors[0]!;
    return {
      track: "child",
      subdomain: anchor.subdomain,
      parent_skill_id: anchor.skill_id,
    };
  }
  return {
    track: "root",
    subdomain: "general",
  };
}

function detectCandidateConflicts(
  candidate: {
    skill_id: string;
    domain: string;
    subdomain: string;
    task_kinds: string[];
    artifact_types: string[];
    target_paths: string[];
    constraint_tags: string[];
    goal_terms: string[];
    required_gates: GateRequirement[];
    script_refs: string[];
  },
  existingSkills: ExistingSkill[],
  reuseReceipts: SkillReuseReceipt[],
  exactAnchor?: ExistingSkill,
): string[] {
  const rejections: string[] = [];
  const candidateScope = normalizedScopeKey(candidate, false);
  const empiricalReplacement =
    Boolean(exactAnchor) &&
    reuseReceipts.some(
      (receipt) =>
        receipt.skill_id === exactAnchor?.skill_id &&
        (receipt.execution_result === "failed" || receipt.execution_result === "partial"),
    );

  for (const skill of existingSkills) {
    if (skill.domain !== candidate.domain) continue;
    if (normalizedScopeKey(skill, false) !== candidateScope) continue;
    if (skill.origin === "manual") {
      rejections.push(`manual-authority-conflict:${skill.skill_id}`);
      continue;
    }
    if (!hasSameGateAndScriptContract(skill, candidate) && !empiricalReplacement) {
      rejections.push(`exact-scope-conflict-unresolved:${skill.skill_id}`);
    }
  }

  return Array.from(new Set(rejections)).sort((left, right) => left.localeCompare(right));
}

function hasSameGateAndScriptContract(
  skill: Pick<LearnedSkillMetadata, "required_gates" | "script_refs">,
  candidate: Pick<LearnedSkillMetadata, "required_gates" | "script_refs">,
): boolean {
  return (
    JSON.stringify(skill.required_gates) === JSON.stringify(candidate.required_gates) &&
    JSON.stringify(normalizePathList(skill.script_refs)) === JSON.stringify(normalizePathList(candidate.script_refs))
  );
}

function renderLearnedSkillMarkdown(
  metadata: LearnedSkillMetadata,
  summary: NonNullable<TaskExecutionReceipt["reusable_summary"]>,
): string {
  return [
    "## Intent",
    summary.intent,
    "",
    "## Use When",
    ...renderBulletList(summary.use_when),
    "",
    "## Do Not Use When",
    ...renderBulletList(summary.do_not_use_when),
    "",
    "## Inputs & Preconditions",
    ...renderBulletList(summary.inputs_preconditions),
    "",
    "## Steps",
    ...renderBulletList(summary.steps),
    "",
    "## Validation",
    ...renderBulletList(summary.validation),
    "",
    "## Failure Signals",
    ...renderBulletList(summary.failure_signals),
    "",
    "## Fallback",
    ...renderBulletList(summary.fallback),
    "",
    "## Attached Scripts",
    ...renderBulletList(metadata.script_refs.length > 0 ? metadata.script_refs : ["none"]),
    "",
    "## Source Tasks",
    ...renderBulletList(metadata.source_task_ids),
    "",
    "## Drift Watch",
    ...renderBulletList(metadata.watch_paths),
    "",
  ].join("\n");
}

function renderBulletList(values: string[]): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : ["- none"];
}

function buildCandidateContext(input: CandidateSynthesisInput):
  | {
      blocked: Extract<CandidateSynthesisResult, { status: "blocked" }>;
    }
  | {
      summary: NonNullable<TaskExecutionReceipt["reusable_summary"]>;
      routeableSkills: ExistingSkill[];
      candidateBase: CandidateBase;
      lineage: ReturnType<typeof resolveLineage>;
      skill_id: string;
      watch_paths: string[];
    } {
  const summary = input.taskReceipt.reusable_summary!;
  const taskKind = input.taskReceipt.task_kind!;
  const routeableSkills = input.existingSkills.filter((skill) => skill.lifecycle_status !== "retired");
  const candidateBase = buildCandidateBase(input, taskKind);
  const lineage = resolveCandidateLineage(routeableSkills, input.reuseReceipts, candidateBase);
  if ("blocked" in lineage) return { blocked: lineage.blocked };

  const skill_id = buildCandidateSkillId(routeableSkills, candidateBase, lineage.lineage.subdomain, taskKind);
  const conflictRejections = detectCandidateConflicts(
    { ...candidateBase, skill_id, subdomain: lineage.lineage.subdomain },
    routeableSkills,
    input.reuseReceipts,
    lineage.lineage.exact_anchor,
  );
  if (conflictRejections.length > 0) return { blocked: { status: "blocked", rejected_learning_reasons: conflictRejections } };

  const watch_paths = collectLearnedWatchPaths(candidateBase.target_paths, candidateBase.script_refs, input.taskReceipt.files_touched);
  if (watch_paths.length === 0) return { blocked: { status: "blocked", rejected_learning_reasons: ["missing-watch-paths"] } };

  return {
    summary,
    routeableSkills,
    candidateBase,
    lineage: lineage.lineage,
    skill_id,
    watch_paths,
  };
}

interface CandidateBase {
  domain: Domain;
  task_kinds: TaskKind[];
  artifact_types: ArtifactType[];
  target_paths: string[];
  constraint_tags: string[];
  goal_terms: string[];
  required_gates: GateRequirement[];
  script_refs: string[];
}

function buildCandidateBase(input: CandidateSynthesisInput, taskKind: TaskKind): CandidateBase {
  return {
    domain: input.taskReceipt.domain!,
    task_kinds: [taskKind],
    artifact_types: input.taskReceipt.requested_artifact_types,
    target_paths: normalizePathList(input.taskReceipt.target_paths),
    constraint_tags: [...input.taskReceipt.constraint_tags].sort((left, right) => left.localeCompare(right)),
    goal_terms: [...input.taskReceipt.goal_terms].sort((left, right) => left.localeCompare(right)),
    required_gates: extractRequiredGates(input.taskReceipt),
    script_refs: collectScriptRefs(input.rootDir, input.taskReceipt),
  };
}

function buildCandidateSkillId(
  routeableSkills: ExistingSkill[],
  candidateBase: CandidateBase,
  subdomain: LearnedSkillMetadata["subdomain"],
  taskKind: TaskKind,
): string {
  return buildSkillId({
    origin: "learned",
    domain: candidateBase.domain,
    subdomain,
    taskKinds: [taskKind],
    artifactTypes: candidateBase.artifact_types,
    targetPaths: candidateBase.target_paths,
    goalTerms: candidateBase.goal_terms,
    existingSkillIds: new Set(routeableSkills.map((skill) => skill.skill_id)),
  });
}

function resolveCandidateLineage(
  routeableSkills: ExistingSkill[],
  reuseReceipts: SkillReuseReceipt[],
  candidateBase: CandidateBase,
):
  | { blocked: Extract<CandidateSynthesisResult, { status: "blocked" }> }
  | { lineage: ReturnType<typeof resolveLineage> } {
  const skillsById = new Map(routeableSkills.map((skill) => [skill.skill_id, skill]));
  const lineageAnchors = reuseReceipts.map((receipt) => skillsById.get(receipt.skill_id)).filter((skill): skill is ExistingSkill => Boolean(skill));
  const exactAnchors = lineageAnchors.filter(
    (skill) => skill.domain === candidateBase.domain && normalizedScopeKey(skill, false) === normalizedScopeKey(candidateBase, false),
  );
  if (exactAnchors.length > 1) {
    return { blocked: { status: "blocked", rejected_learning_reasons: ["lineage-ambiguous-exact-scope"] } };
  }
  const broaderAnchors = lineageAnchors.filter((skill) => isBroaderScopeAnchor(skill, candidateBase, exactAnchors));
  return {
    lineage: resolveLineage(candidateBase.domain, exactAnchors, broaderAnchors),
  };
}

function buildCandidateResult(
  input: CandidateSynthesisInput,
  context: Exclude<ReturnType<typeof buildCandidateContext>, { blocked: Extract<CandidateSynthesisResult, { status: "blocked" }> }>,
): Extract<CandidateSynthesisResult, { status: "created" }> {
  const lifecycle_event = buildLifecycleEvent({
    eventId: allocateNextEventId(input.rootDir, input.taskReceipt.created_at.slice(0, 10), context.skill_id),
    skillId: context.skill_id,
    now: input.taskReceipt.created_at,
    eventType: "candidate-created",
    trigger: "task-success",
    reason: `candidate-created:${context.lineage.track}`,
    evidenceRefs: [input.taskReceiptPath, ...input.reuseReceiptPaths].sort((left, right) => left.localeCompare(right)),
    relatedSkillIds: context.lineage.exact_anchor ? [context.lineage.exact_anchor.skill_id] : context.lineage.parent_skill_id ? [context.lineage.parent_skill_id] : [],
    toTrustTier: "learned_candidate",
    toLifecycleStatus: "candidate",
  });

  const metadata: LearnedSkillMetadata = {
    skill_id: context.skill_id,
    title: context.summary.intent,
    origin: "learned",
    trust_tier: "learned_candidate",
    lifecycle_status: "candidate",
    drift_status: "trusted",
    domain: context.candidateBase.domain,
    subdomain: context.lineage.subdomain,
    task_kinds: context.candidateBase.task_kinds,
    artifact_types: context.candidateBase.artifact_types,
    target_paths: context.candidateBase.target_paths,
    constraint_tags: context.candidateBase.constraint_tags,
    goal_terms: context.candidateBase.goal_terms,
    required_gates: context.candidateBase.required_gates,
    ...(context.lineage.parent_skill_id ? { parent_skill_id: context.lineage.parent_skill_id } : {}),
    source_task_ids: [input.taskReceipt.task_id],
    source_receipt_paths: [input.taskReceiptPath, ...input.reuseReceiptPaths].sort((left, right) => left.localeCompare(right)),
    script_refs: context.candidateBase.script_refs,
    watch_paths: context.watch_paths,
    created_at: input.taskReceipt.created_at,
    last_verified_at: input.taskReceipt.created_at,
    successful_reuse_count: 0,
    failed_reuse_count: 0,
    last_lifecycle_event_id: lifecycle_event.event_id,
    conflict_with_skill_ids: [],
    ...(context.lineage.exact_anchor ? { replacement_skill_id: context.lineage.exact_anchor.skill_id } : {}),
  };

  return {
    status: "created",
    lineage_track: context.lineage.track,
    metadata,
    markdown: renderLearnedSkillMarkdown(metadata, context.summary),
    lifecycle_event,
    ...(context.lineage.exact_anchor ? { replaced_skill_id: context.lineage.exact_anchor.skill_id } : {}),
  };
}
