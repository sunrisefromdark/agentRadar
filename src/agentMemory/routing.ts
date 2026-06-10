import fs from "node:fs";
import path from "node:path";
import { listApprovedSpecPaths, resolveDocumentApprovalState } from "./approvals.ts";
import { buildProjectFacts } from "./projectFacts.ts";
import { readJsonFile, sha256File } from "./fs.ts";
import { validateManifestFreshness } from "./manifest.ts";
import { validateManualRegistryFreshness } from "./manualRegistry.ts";
import { normalizePathList } from "./paths.ts";
import type {
  BoundGateRequirement,
  GateEvaluation,
  GateRequirement,
  GateState,
  ProjectFactRecord,
  ProjectFactSourceState,
  RoutingManifest,
  RoutingReceipt,
  SkillRoutingEvaluation,
  SkillRoutingIndexEntry,
  TaskFingerprint,
} from "./types.ts";

const FACTS_INDEX_PATH = "data/agent-memory/facts/index.json";
const FACTS_SOURCE_STATE_PATH = "data/agent-memory/facts/source-state.json";

export interface RouteTaskInput {
  rootDir: string;
  taskId: string;
  now: string;
  taskFingerprint: TaskFingerprint;
  gateEvidenceById: Record<
    string,
    {
      state: Extract<GateState, "passed" | "failed" | "missing_evidence">;
      evidence_ref: string;
      detail: string;
    }
  >;
}

export interface GateEvidenceRecord {
  state: Extract<GateState, "passed" | "failed" | "missing_evidence">;
  evidence_ref: string;
  detail: string;
}

export function routeTask(input: RouteTaskInput): RoutingReceipt {
  const manualRegistry = validateManualRegistryFreshness(input.rootDir);
  if (manualRegistry.status !== "available") {
    return emptyRoutingReceipt(input.taskId, input.now, input.taskFingerprint, [], [], [], "no_confident_match:manual-registry-unavailable");
  }

  const facts = validateProjectFactsFreshness(input.rootDir);
  if (facts.status !== "available") {
    return emptyRoutingReceipt(input.taskId, input.now, input.taskFingerprint, [], [], [], "no_confident_match:stale-project-facts");
  }

  const manifestFreshness = validateManifestFreshness(input.rootDir);
  if (manifestFreshness.status !== "fresh") {
    return emptyRoutingReceipt(input.taskId, input.now, input.taskFingerprint, facts.records.map((item) => item.fact_id), [], [], "no_confident_match:manifest-stale");
  }

  const manifest = readJsonFile<RoutingManifest>(input.rootDir, "data/agent-memory/manifests/latest.json");
  const taskScopeGates = bindTaskScopeGates(input.taskFingerprint, facts.records);
  const taskRoutingGatesEvaluated = taskScopeGates
    .filter((boundGate) => boundGate.gate.gate_phase === "routing-precondition")
    .map((boundGate) => evaluateGateRequirement(boundGate.gate, input.taskFingerprint, input.now, input.gateEvidenceById, input.rootDir, "routing"));

  const routingBlocked = taskRoutingGatesEvaluated.some((evaluation) => evaluation.state !== "passed");
  const candidateEvaluations = manifest.routing_index.map((skill) =>
    evaluateCandidate(skill, taskScopeGates, input.taskFingerprint, input.now, input.gateEvidenceById, input.rootDir),
  );
  const sortedCandidates = [...candidateEvaluations].sort((left, right) => right.score - left.score);

  let primaryMatch: string | null = null;
  if (!routingBlocked && input.taskFingerprint.resolution_status === "resolved" && sortedCandidates.length > 0) {
    const topCandidate = sortedCandidates[0]!;
    const runnerUpScore = sortedCandidates[1]?.score ?? -Infinity;
    if (topCandidate.decision === "primary_match" && topCandidate.score >= 75 && topCandidate.score - runnerUpScore >= 10) {
      primaryMatch = topCandidate.skill_id;
    }
  }

  const referenceMatches = primaryMatch
    ? sortedCandidates.filter((candidate) => candidate.skill_id !== primaryMatch && candidate.decision === "reference_match").slice(0, 2)
    : sortedCandidates.filter((candidate) => candidate.decision === "reference_match").slice(0, 2);
  const rejectedMatches = sortedCandidates
    .filter((candidate) => candidate.decision === "rejected")
    .map((candidate) => ({ skill_id: candidate.skill_id, reasons: candidate.rejection_reasons }));

  return {
    task_id: input.taskId,
    created_at: input.now,
    task_fingerprint: input.taskFingerprint,
    resolved_project_facts: facts.records.map((item) => item.fact_id),
    task_routing_gates_evaluated: taskRoutingGatesEvaluated,
    candidate_evaluations: sortedCandidates,
    primary_match: primaryMatch,
    reference_matches: referenceMatches.map((item) => item.skill_id),
    rejected_matches: rejectedMatches,
    decision_reason: primaryMatch ? `primary_match:${primaryMatch}` : "no_confident_match:routing-preconditions-or-threshold",
  };
}

export function evaluateTaskCompletionGates(
  requirements: GateRequirement[],
  taskFingerprint: TaskFingerprint,
  evaluatedAt: string,
  gateEvidenceById: Record<string, GateEvidenceRecord>,
  rootDir: string | null,
  evaluator: GateEvaluation["evaluator"] = "task-execution",
): GateEvaluation[] {
  return requirements.map((gate) => evaluateGateRequirement(gate, taskFingerprint, evaluatedAt, gateEvidenceById, rootDir, evaluator));
}

export function evaluateGateRequirement(
  gate: GateRequirement,
  taskFingerprint: TaskFingerprint,
  evaluatedAt: string,
  gateEvidenceById: Record<string, GateEvidenceRecord>,
  rootDir: string | null,
  evaluator: GateEvaluation["evaluator"],
): GateEvaluation {
  const predefined = evaluateSpecialGateRequirement(gate, taskFingerprint, evaluatedAt, rootDir, evaluator);
  if (predefined) return predefined;

  const explicitEvidence = gateEvidenceById[gate.gate_id] ?? gateEvidenceById[gate.evidence_ref_hint];
  if (!explicitEvidence) {
    return missingEvidenceEvaluation(gate, evaluator, evaluatedAt);
  }

  return gateEvaluation(gate, evaluator, explicitEvidence.state, explicitEvidence.detail, explicitEvidence.evidence_ref, evaluatedAt);
}

export interface ProjectFactsValidationResult {
  status: "available" | "stale-project-facts";
  reasons: string[];
  records: ProjectFactRecord[];
}

export function validateProjectFactsFreshness(rootDir: string): ProjectFactsValidationResult {
  const factsIndexPath = path.join(rootDir, FACTS_INDEX_PATH);
  const factsSourceStatePath = path.join(rootDir, FACTS_SOURCE_STATE_PATH);
  if (!pathExists(factsIndexPath) || !pathExists(factsSourceStatePath)) {
    return { status: "stale-project-facts", reasons: ["project-facts-files-missing"], records: [] };
  }

  let records: ProjectFactRecord[];
  let sourceState: ProjectFactSourceState;
  try {
    records = readJsonFile<ProjectFactRecord[]>(rootDir, FACTS_INDEX_PATH);
    sourceState = readJsonFile<ProjectFactSourceState>(rootDir, FACTS_SOURCE_STATE_PATH);
  } catch {
    return {
      status: "stale-project-facts",
      reasons: ["project-facts-json-invalid"],
      records: [],
    };
  }

  const reasons: string[] = [];
  const expectedSources = new Set(
    [
      "docs/specs/repo-policy.md",
      "docs/specs/agent-work/README.md",
      "docs/specs/system-spec.md",
      "docs/specs/design-docs/architecture-boundaries.md",
      ...listApprovedSpecPaths(rootDir),
    ].sort((left, right) => left.localeCompare(right)),
  );
  for (const snapshot of sourceState.source_docs) {
    const fullPath = path.join(rootDir, snapshot.path);
    if (!pathExists(fullPath)) {
      reasons.push(`project-fact-source-missing:${snapshot.path}`);
      continue;
    }
    if (sha256File(rootDir, snapshot.path) !== snapshot.content_sha256) reasons.push(`project-fact-source-hash-mismatch:${snapshot.path}`);
  }
  for (const expectedSource of expectedSources) {
    if (!sourceState.source_docs.some((snapshot) => snapshot.path === expectedSource)) reasons.push(`project-fact-source-untracked:${expectedSource}`);
  }

  try {
    const rebuilt = buildProjectFacts(rootDir, sourceState.generated_at);
    if (JSON.stringify(records) !== JSON.stringify(rebuilt.records)) reasons.push("project-facts-index-mismatch");
    if (JSON.stringify(sourceState) !== JSON.stringify(rebuilt.sourceState)) reasons.push("project-facts-source-state-mismatch");
  } catch (error) {
    reasons.push(`project-facts-rebuild-failed:${error instanceof Error ? error.message : "unknown-error"}`);
  }

  return {
    status: reasons.length > 0 ? "stale-project-facts" : "available",
    reasons,
    records,
  };
}

function bindTaskScopeGates(taskFingerprint: TaskFingerprint, projectFacts: ProjectFactRecord[]): BoundGateRequirement[] {
  const byGateId = new Map<string, BoundGateRequirement>();

  const addGate = (gateId: string) => {
    const fact = projectFacts.find((record) => record.required_gates.some((gate) => gate.gate_id === gateId));
    const gate = fact?.required_gates.find((candidate) => candidate.gate_id === gateId);
    if (!fact || !gate) return;
    byGateId.set(gateId, {
      gate,
      source_layer: "project-fact",
      source_ref: fact.fact_id,
    });
  };

  const artifactTypes = new Set(taskFingerprint.requested_artifact_types);
  if (taskFingerprint.domain === "design" && taskFingerprint.task_kind === "review" && artifactTypes.has("design-doc")) addGate("design-review-preflight");
  if (taskFingerprint.domain === "exec-plan" && taskFingerprint.task_kind === "review" && artifactTypes.has("exec-plan")) addGate("exec-plan-review-preflight");
  if (
    taskFingerprint.domain === "artifact-review" &&
    taskFingerprint.task_kind === "review" &&
    [...artifactTypes].some((artifactType) => ["source-code", "test-code", "config"].includes(artifactType))
  ) {
    addGate("code-review-preflight");
  }
  if (taskFingerprint.domain === "code-implementation" && taskFingerprint.task_kind === "implement") addGate("code-implementation-preflight");
  if (taskFingerprint.domain === "testing" && ["draft", "revise", "verify"].includes(taskFingerprint.task_kind ?? "")) addGate("testing-skill-preflight");

  if (taskFingerprint.domain === "exec-plan" && ["draft", "revise", "implement"].includes(taskFingerprint.task_kind ?? "")) {
    addGate("design-approved");
  }

  const needsRepoCompletion =
    ["code-implementation", "testing", "visual-console", "repo-ops"].includes(taskFingerprint.domain ?? "") ||
    [...artifactTypes].some((artifactType) => ["source-code", "test-code", "config", "skill-script"].includes(artifactType)) ||
    taskFingerprint.target_paths.some(
      (targetPath) =>
        targetPath.startsWith("src/") ||
        targetPath.startsWith("app/") ||
        targetPath.startsWith("scripts/") ||
        ["package.json", "tsconfig.json", "config.yaml"].includes(targetPath),
    );
  if (needsRepoCompletion) {
    addGate("pnpm lint");
    addGate("pnpm typecheck");
    addGate("pnpm test");
  }

  return Array.from(byGateId.values());
}

function evaluateCandidate(
  skill: SkillRoutingIndexEntry,
  taskScopeGates: BoundGateRequirement[],
  taskFingerprint: TaskFingerprint,
  evaluatedAt: string,
  gateEvidenceById: Record<string, GateEvidenceRecord>,
  rootDir: string,
): SkillRoutingEvaluation {
  const gateMerge = mergeEffectiveSkillGates(skill, taskScopeGates);
  const routingGates = gateMerge.routingGates;
  const taskCompletionGates = gateMerge.taskCompletionGates;
  const routingGateEvaluations = routingGates.map((boundGate) =>
    evaluateGateRequirement(boundGate.gate, taskFingerprint, evaluatedAt, gateEvidenceById, rootDir, "routing"),
  );
  const { score, scoreBreakdown, artifactMatched, targetPathMatched } = scoreCandidate(skill, taskFingerprint);
  const rejectionReasons: string[] = [...gateMerge.rejectionReasons];

  if (taskFingerprint.resolution_status !== "resolved") rejectionReasons.push("unresolved-fingerprint");
  if (routingGateEvaluations.some((gate) => gate.state !== "passed")) rejectionReasons.push("routing-gates-not-passed");
  if (!artifactMatched && !targetPathMatched) rejectionReasons.push("no-artifact-or-target-path-match");
  if (skill.drift_status !== "trusted") rejectionReasons.push("untrusted-drift-status");
  if (skill.lifecycle_status !== "stable" && skill.trust_tier !== "learned_candidate") rejectionReasons.push("non-stable-lifecycle");

  const decision = deriveCandidateDecision(skill, score, rejectionReasons);
  return buildRoutingEvaluation(
    skill.skill_id,
    score,
    scoreBreakdown,
    routingGates,
    routingGateEvaluations,
    taskCompletionGates,
    decision,
    decision === "primary_match" ? [] : rejectionReasons,
  );
}

function buildRoutingEvaluation(
  skillId: string,
  score: number,
  scoreBreakdown: SkillRoutingEvaluation["score_breakdown"],
  routingGates: BoundGateRequirement[],
  routingGateEvaluations: GateEvaluation[],
  taskCompletionGates: BoundGateRequirement[],
  decision: SkillRoutingEvaluation["decision"],
  rejectionReasons: string[],
): SkillRoutingEvaluation {
  return {
    skill_id: skillId,
    score,
    score_breakdown: scoreBreakdown,
    effective_routing_gates: routingGates,
    routing_gate_evaluations: routingGateEvaluations,
    effective_task_completion_gates: taskCompletionGates,
    decision,
    rejection_reasons: rejectionReasons,
  };
}

function deriveCandidateDecision(
  skill: SkillRoutingIndexEntry,
  score: number,
  rejectionReasons: string[],
): SkillRoutingEvaluation["decision"] {
  if (rejectionReasons.includes("gate-contract-conflict")) return "rejected";
  if (rejectionReasons.length === 0 && score >= 75 && (skill.trust_tier === "manual" || skill.trust_tier === "learned_stable")) {
    return "primary_match";
  }
  if (score >= 55) return "reference_match";
  return "rejected";
}

function evaluateSpecialGateRequirement(
  gate: GateRequirement,
  taskFingerprint: TaskFingerprint,
  evaluatedAt: string,
  rootDir: string | null,
  evaluator: GateEvaluation["evaluator"],
): GateEvaluation | null {
  if (gate.gate_id === "design-approved") {
    const designRefs = taskFingerprint.referenced_specs.filter((spec) => spec.startsWith("docs/specs/design-docs/"));
    if (designRefs.length === 0) return gateEvaluation(gate, evaluator, "missing_evidence", "missing-design-reference", "", evaluatedAt);
    if (designRefs.length > 1) return gateEvaluation(gate, evaluator, "failed", "ambiguous-design-reference", designRefs.join(","), evaluatedAt);
    const root = rootDir ?? process.cwd();
    const approval = resolveDocumentApprovalState(root, designRefs[0]!);
    return gateEvaluation(
      gate,
      evaluator,
      approval.state === "authority_conflict" ? "stale" : approval.state,
      approval.detail,
      approval.evidence_ref,
      evaluatedAt,
    );
  }
  if (gate.gate_id === "code-implementation-preflight") {
    const execPlanRefs = taskFingerprint.referenced_specs.filter((spec) => spec.startsWith("docs/specs/exec-plans/") && spec.endsWith(".exec-plan.md"));
    if (execPlanRefs.length === 0) return gateEvaluation(gate, evaluator, "missing_evidence", "missing-exec-plan-reference", "", evaluatedAt);
    if (execPlanRefs.length > 1) return gateEvaluation(gate, evaluator, "failed", "ambiguous-exec-plan-reference", execPlanRefs.join(","), evaluatedAt);
  }
  return null;
}

function missingEvidenceEvaluation(
  gate: GateRequirement,
  evaluator: GateEvaluation["evaluator"],
  evaluatedAt: string,
): GateEvaluation {
  if (gate.gate_id === "task-specific-verification") {
    return gateEvaluation(
      gate,
      evaluator,
      "missing_evidence",
      "未唯一解析出 run-daily / run-weekly / score / build-kb 中的哪一条任务特定验证命令",
      "",
      evaluatedAt,
    );
  }
  return gateEvaluation(gate, evaluator, "missing_evidence", "missing-command-evidence", "", evaluatedAt);
}

function mergeEffectiveSkillGates(
  skill: SkillRoutingIndexEntry,
  taskScopeGates: BoundGateRequirement[],
): {
  routingGates: BoundGateRequirement[];
  taskCompletionGates: BoundGateRequirement[];
  rejectionReasons: string[];
} {
  const merged = new Map<string, BoundGateRequirement>();
  const rejectionReasons: string[] = [];
  const skillGates = skill.required_gates.map((gate) => ({
    gate,
    source_layer: "skill-metadata" as const,
    source_ref: skill.skill_id,
  }));

  for (const boundGate of [...taskScopeGates, ...skillGates]) {
    const key = gateMergeKey(boundGate.gate);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, boundGate);
      continue;
    }

    if (!sameGateContract(existing.gate, boundGate.gate)) {
      rejectionReasons.push("gate-contract-conflict");
      continue;
    }
  }

  const effective = Array.from(merged.values());
  return {
    routingGates: effective.filter((boundGate) => boundGate.gate.gate_phase === "routing-precondition"),
    taskCompletionGates: effective.filter((boundGate) => boundGate.gate.gate_phase === "task-completion"),
    rejectionReasons: Array.from(new Set(rejectionReasons)),
  };
}

function gateMergeKey(gate: GateRequirement): string {
  return `${gate.gate_id}::${gate.gate_kind}::${gate.gate_phase}`;
}

function sameGateContract(left: GateRequirement, right: GateRequirement): boolean {
  return (
    left.evidence_source_type === right.evidence_source_type &&
    left.evidence_ref_hint === right.evidence_ref_hint &&
    left.freshness_rule === right.freshness_rule
  );
}

function scoreCandidate(skill: SkillRoutingIndexEntry, taskFingerprint: TaskFingerprint): {
  score: number;
  scoreBreakdown: SkillRoutingEvaluation["score_breakdown"];
  artifactMatched: boolean;
  targetPathMatched: boolean;
} {
  const scoreBreakdown: SkillRoutingEvaluation["score_breakdown"] = [];
  let score = 0;

  if (skill.domain === taskFingerprint.domain) {
    score += 20;
    scoreBreakdown.push({ dimension: "domain", points: 20, evidence: skill.domain });
  }
  if (taskFingerprint.task_kind && skill.task_kinds.includes(taskFingerprint.task_kind)) {
    score += 20;
    scoreBreakdown.push({ dimension: "task_kind", points: 20, evidence: taskFingerprint.task_kind });
  }
  const artifactIntersection = skill.artifact_types.filter((artifactType) => taskFingerprint.requested_artifact_types.includes(artifactType));
  const artifactMatched = artifactIntersection.length > 0;
  if (artifactMatched) {
    score += 20;
    scoreBreakdown.push({ dimension: "artifact_types", points: 20, evidence: artifactIntersection.join(",") });
  }
  const targetPathMatched = targetPathsOverlap(skill.target_paths, taskFingerprint.target_paths);
  if (targetPathMatched) {
    score += 15;
    scoreBreakdown.push({ dimension: "target_paths", points: 15, evidence: "prefix-overlap" });
  }
  const constraintIntersection = skill.constraint_tags.filter((tag) => taskFingerprint.constraint_tags.includes(tag));
  if (constraintIntersection.length > 0) {
    score += 10;
    scoreBreakdown.push({ dimension: "constraint_tags", points: 10, evidence: constraintIntersection.join(",") });
  }
  const goalIntersection = skill.goal_terms.filter((goalTerm) => taskFingerprint.goal_terms.includes(goalTerm));
  if (goalIntersection.length > 0) {
    score += 10;
    scoreBreakdown.push({ dimension: "goal_terms", points: 10, evidence: goalIntersection.join(",") });
  }
  if (skill.successful_reuse_count > 0) {
    score += 5;
    scoreBreakdown.push({ dimension: "recent-success", points: 5, evidence: String(skill.successful_reuse_count) });
  }

  return {
    score,
    scoreBreakdown,
    artifactMatched,
    targetPathMatched,
  };
}

function targetPathsOverlap(left: string[], right: string[]): boolean {
  const normalizedLeft = normalizePathList(left);
  const normalizedRight = normalizePathList(right);
  return normalizedLeft.some((leftPath) => normalizedRight.some((rightPath) => leftPath.startsWith(rightPath) || rightPath.startsWith(leftPath)));
}

function emptyRoutingReceipt(
  taskId: string,
  createdAt: string,
  taskFingerprint: TaskFingerprint,
  resolvedProjectFacts: string[],
  taskRoutingGatesEvaluated: GateEvaluation[],
  candidateEvaluations: SkillRoutingEvaluation[],
  decisionReason: string,
): RoutingReceipt {
  return {
    task_id: taskId,
    created_at: createdAt,
    task_fingerprint: taskFingerprint,
    resolved_project_facts: resolvedProjectFacts,
    task_routing_gates_evaluated: taskRoutingGatesEvaluated,
    candidate_evaluations: candidateEvaluations,
    primary_match: null,
    reference_matches: [],
    rejected_matches: [],
    decision_reason: decisionReason,
  };
}

function gateEvaluation(
  gate: GateRequirement,
  evaluator: GateEvaluation["evaluator"],
  state: GateState,
  detail: string,
  evidenceRef: string,
  evaluatedAt: string,
): GateEvaluation {
  return {
    gate_id: gate.gate_id,
    gate_kind: gate.gate_kind,
    gate_phase: gate.gate_phase,
    evaluator,
    evidence_source_type: gate.evidence_source_type,
    evidence_ref: evidenceRef,
    freshness_rule: gate.freshness_rule,
    state,
    evaluated_at: evaluatedAt,
    detail,
  };
}

function pathExists(fullPath: string): boolean {
  return path.isAbsolute(fullPath) && fs.existsSync(fullPath);
}
