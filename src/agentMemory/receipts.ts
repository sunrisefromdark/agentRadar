import { evaluateTaskCompletionGates } from "./routing.ts";
import { normalizePathList } from "./paths.ts";
import type {
  ArtifactType,
  Domain,
  GateEvaluation,
  GateRequirement,
  ReusableSummary,
  SkillReuseAttempt,
  SkillReuseReceipt,
  TaskClassificationResolution,
  TaskCommandKind,
  TaskCommandRecord,
  TaskKind,
  TaskExecutionReceipt,
  TaskFingerprint,
  TaskSkillUsageRecord,
  VerificationCommandRecord,
} from "./types.ts";

export interface BuildTaskExecutionReceiptInput {
  now: string;
  taskId: string;
  userRequestSummary: string;
  taskFingerprint: TaskFingerprint;
  commands: Array<Omit<TaskCommandRecord, "kind">>;
  filesTouched: string[];
  verificationBindings: Array<{
    command_seq: number;
    kind: VerificationCommandRecord["kind"];
    status: VerificationCommandRecord["status"];
  }>;
  taskCompletionGateRequirements: GateRequirement[];
  result: TaskExecutionReceipt["result"];
  resultReason: TaskExecutionReceipt["result_reason"];
  skillUsage?: TaskSkillUsageRecord[];
  rootDir?: string | null;
}

export interface BuildSkillReuseReceiptInput {
  taskId: string;
  skillId: string;
  matchRole: SkillReuseReceipt["match_role"];
  attempts: SkillReuseAttempt[];
  correctedTaskReceiptRef?: string;
}

export function buildTaskExecutionReceipt(input: BuildTaskExecutionReceiptInput): TaskExecutionReceipt {
  const verificationMap = new Map(input.verificationBindings.map((binding) => [binding.command_seq, binding]));
  const commandsExecuted = input.commands.map((command) => ({
    ...command,
    kind: classifyCommandKind(command, verificationMap.get(command.seq)),
  }));
  const verificationCommands = buildVerificationCommands(commandsExecuted, input.verificationBindings);

  const gateEvidenceById = buildGateEvidenceMap(commandsExecuted, verificationCommands);
  const taskCompletionGateRequirements = dedupeGateRequirements([
    ...input.taskCompletionGateRequirements,
    ...inferAdditionalTaskCompletionGateRequirements(input.taskFingerprint, input.filesTouched),
  ]);
  const taskCompletionGatesEvaluated = evaluateTaskCompletionGates(
    taskCompletionGateRequirements,
    input.taskFingerprint,
    input.now,
    gateEvidenceById,
    input.rootDir ?? null,
    "task-execution",
  );
  const classification = resolveTaskClassification(input.taskFingerprint, input.filesTouched);

  const reusableSummary = buildReusableSummary(
    input.taskFingerprint,
    classification.domain,
    classification.taskKind,
    commandsExecuted,
    verificationCommands,
    taskCompletionGatesEvaluated,
    input.skillUsage ?? [],
  );
  const learningBlockers = buildLearningBlockers(
    commandsExecuted,
    verificationCommands,
    taskCompletionGatesEvaluated,
    reusableSummary,
    classification,
  );

  return {
    task_id: input.taskId,
    created_at: input.now,
    user_request_summary: input.userRequestSummary,
    domain: classification.domain,
    task_kind: classification.taskKind,
    requested_artifact_types: input.taskFingerprint.requested_artifact_types,
    target_paths: input.taskFingerprint.target_paths,
    constraint_tags: input.taskFingerprint.constraint_tags,
    goal_terms: input.taskFingerprint.goal_terms,
    referenced_specs: input.taskFingerprint.referenced_specs,
    commands_executed: commandsExecuted,
    files_touched: [...input.filesTouched].sort((left, right) => left.localeCompare(right)),
    classification_resolution: classification.resolution,
    task_completion_gate_requirements: taskCompletionGateRequirements,
    task_completion_gates_evaluated: taskCompletionGatesEvaluated,
    verification_commands: verificationCommands,
    skill_usage: input.skillUsage ?? [],
    result: input.result,
    result_reason: input.resultReason,
    reusable_summary: reusableSummary,
    learning_blockers: learningBlockers,
    ...(learningBlockers.length > 0 ? { rejected_learning_reasons: learningBlockers.map((blocker) => blocker.reason) } : {}),
  };
}

function dedupeGateRequirements(requirements: GateRequirement[]): GateRequirement[] {
  const byKey = new Map<string, GateRequirement>();
  for (const gate of requirements) {
    const key = `${gate.gate_id}::${gate.gate_kind}::${gate.gate_phase}`;
    if (!byKey.has(key)) byKey.set(key, gate);
  }
  return Array.from(byKey.values()).sort((left, right) => left.gate_id.localeCompare(right.gate_id));
}

export function buildSkillReuseReceipt(input: BuildSkillReuseReceiptInput): SkillReuseReceipt {
  const attempts = [...input.attempts].sort((left, right) => left.attempt_seq - right.attempt_seq);
  const latest = attempts[attempts.length - 1];
  if (!latest) throw new Error("reuse receipt requires at least one attempt");

  const successAttempts = attempts.filter((attempt) => attempt.execution_result === "success");
  const failedAttempts = attempts.filter((attempt) => attempt.execution_result === "failed");
  const partialAttempts = attempts.filter((attempt) => attempt.execution_result === "partial");

  return {
    task_id: input.taskId,
    skill_id: input.skillId,
    match_role: input.matchRole,
    attempts,
    attempt_count: attempts.length,
    last_attempted_at: latest.attempted_at,
    precondition_check: latest.precondition_check,
    execution_result: latest.execution_result,
    verification_result: latest.verification_result,
    fallback_used: latest.fallback_used,
    failure_stage: latest.failure_stage,
    failure_kind: latest.failure_kind,
    failure_reason: latest.failure_reason,
    failure_evidence_refs: latest.failure_evidence_refs,
    reexplored_paths: Array.from(new Set(attempts.flatMap((attempt) => attempt.reexplored_paths))).sort((left, right) =>
      left.localeCompare(right),
    ),
    correction_summary: latest.correction_summary,
    successful_attempt_count: successAttempts.length,
    failed_attempt_count: failedAttempts.length,
    partial_attempt_count: partialAttempts.length,
    last_success_attempt_at: successAttempts[successAttempts.length - 1]?.attempted_at,
    last_failure_attempt_at: failedAttempts[failedAttempts.length - 1]?.attempted_at,
    ...(shouldPersistCorrectedTaskReceiptRef(latest, input.correctedTaskReceiptRef)
      ? { corrected_task_receipt_ref: input.correctedTaskReceiptRef }
      : {}),
  };
}

function shouldPersistCorrectedTaskReceiptRef(
  latest: SkillReuseAttempt,
  correctedTaskReceiptRef: string | undefined,
): correctedTaskReceiptRef is string {
  return (
    Boolean(correctedTaskReceiptRef) &&
    latest.execution_result === "success" &&
    latest.verification_result === "passed" &&
    latest.fallback_used
  );
}

export function renderTaskArchive(input: {
  userRequest: string;
  routingSummary: {
    task_id: string;
    decision_reason: string;
    primary_match: string | null;
    reference_matches: string[];
    rejected_matches: Array<{ skill_id: string; reasons: string[] }>;
  };
  taskReceipt: {
    task_id: string;
    result: string;
    verification_commands: Array<{ command: string; evidence_ref: string }>;
    task_completion_gates_evaluated: GateEvaluation[];
    skill_usage: TaskSkillUsageRecord[];
  };
  reuseReceipts: SkillReuseReceipt[];
  sourceReceiptRefs: string[];
}): string {
  const lines = [
    "## User Request",
    input.userRequest,
    "",
    "## Routing Summary",
    `- task_id: ${input.routingSummary.task_id}`,
    `- decision_reason: ${input.routingSummary.decision_reason}`,
    `- primary_match: ${input.routingSummary.primary_match ?? "none"}`,
    "",
    "## Skills Actually Used",
    ...renderUsedSkills(input.taskReceipt.skill_usage),
    "",
    "## Re-explored Paths And Corrections",
    ...renderReexploredPaths(input.taskReceipt.skill_usage, input.reuseReceipts),
    "",
    "## Verification Evidence",
    ...renderVerificationEvidence(input.taskReceipt.verification_commands, input.taskReceipt.task_completion_gates_evaluated),
    "",
    "## Source Receipt Refs",
    ...input.sourceReceiptRefs.map((ref) => `- ${ref}`),
  ];
  return `${lines.join("\n")}\n`;
}

function buildVerificationCommands(
  commandsExecuted: TaskCommandRecord[],
  verificationBindings: BuildTaskExecutionReceiptInput["verificationBindings"],
): VerificationCommandRecord[] {
  return verificationBindings.map((binding) => {
    const command = commandsExecuted.find((candidate) => candidate.seq === binding.command_seq);
    if (!command) throw new Error(`verification binding missing command seq ${binding.command_seq}`);
    return {
      command_seq: binding.command_seq,
      command: command.command,
      kind: binding.kind,
      status: binding.status,
      evidence_ref: command.evidence_ref,
    };
  });
}

function renderUsedSkills(skillUsage: TaskSkillUsageRecord[]): string[] {
  if (skillUsage.length === 0) return ["No reused skills in this task."];
  return skillUsage.map((usage) => `- ${usage.skill_id} (${usage.outcome})`);
}

function renderReexploredPaths(skillUsage: TaskSkillUsageRecord[], reuseReceipts: SkillReuseReceipt[]): string[] {
  const reexplored = Array.from(
    new Set([...skillUsage.flatMap((usage) => usage.reexplored_paths), ...reuseReceipts.flatMap((receipt) => receipt.reexplored_paths)]),
  ).sort((left, right) => left.localeCompare(right));
  return reexplored.length > 0 ? reexplored.map((entry) => `- ${entry}`) : ["No re-exploration was required."];
}

function renderVerificationEvidence(
  verificationCommands: Array<{ command: string; evidence_ref: string }>,
  taskCompletionGatesEvaluated: Array<{ gate_id: string; evidence_ref: string; detail: string }>,
): string[] {
  return [
    ...verificationCommands.map((verification) => `- ${verification.command} -> ${verification.evidence_ref}`),
    ...taskCompletionGatesEvaluated.map((gate) => `- ${gate.gate_id} -> ${gate.evidence_ref || gate.detail}`),
  ];
}

function classifyCommandKind(
  command: Omit<TaskCommandRecord, "kind">,
  verificationBinding: { kind: VerificationCommandRecord["kind"] } | undefined,
): TaskCommandKind {
  if (verificationBinding?.kind === "preflight") return "preflight";
  if (verificationBinding?.kind === "verification-command") return "verification";
  if (command.writes_repo_files && !command.uses_checked_in_entrypoint) return "ad-hoc-write";
  if (command.uses_checked_in_entrypoint && command.command.includes("scripts/")) return "repo-script";
  if (command.uses_checked_in_entrypoint) return "repo-cli";
  if (command.touches_outside_repo) return "external-tool";
  return "read-only";
}

function buildGateEvidenceMap(
  commandsExecuted: TaskCommandRecord[],
  verificationCommands: VerificationCommandRecord[],
): Record<string, { state: "passed" | "failed" | "missing_evidence"; evidence_ref: string; detail: string }> {
  const evidence: Record<string, { state: "passed" | "failed" | "missing_evidence"; evidence_ref: string; detail: string }> = {};
  for (const verification of verificationCommands) {
    const command = commandsExecuted.find((candidate) => candidate.seq === verification.command_seq);
    if (!command) continue;
    const runtimeAdjusted = applyRuntimeEvidencePolicy(command, verification.status);
    evidence[command.command] = runtimeAdjusted;
    for (const gateId of inferVerificationGateIds(command.command)) {
      evidence[gateId] = runtimeAdjusted;
    }
  }
  return evidence;
}

function applyRuntimeEvidencePolicy(
  command: TaskCommandRecord,
  verificationStatus: VerificationCommandRecord["status"],
): { state: "passed" | "failed" | "missing_evidence"; evidence_ref: string; detail: string } {
  const baseState = verificationStatus === "passed" ? "passed" : verificationStatus === "failed" ? "failed" : "missing_evidence";
  if (!requiresCondaRuntime(command.command)) {
    return {
      state: baseState,
      evidence_ref: command.evidence_ref,
      detail: verificationStatus,
    };
  }

  if (command.runtime_context === "other") {
    return {
      state: "failed",
      evidence_ref: command.evidence_ref,
      detail: `wrong-runtime-context:${command.runtime_context}`,
    };
  }
  if (command.runtime_context === "unknown") {
    return {
      state: "missing_evidence",
      evidence_ref: command.evidence_ref,
      detail: `wrong-runtime-context:${command.runtime_context}`,
    };
  }

  return {
    state: baseState,
    evidence_ref: command.evidence_ref,
    detail: verificationStatus,
  };
}

function buildReusableSummary(
  taskFingerprint: TaskFingerprint,
  resolvedDomain: Domain | null,
  resolvedTaskKind: TaskKind | null,
  commandsExecuted: TaskCommandRecord[],
  verificationCommands: VerificationCommandRecord[],
  gateEvaluations: GateEvaluation[],
  skillUsage: TaskSkillUsageRecord[],
): ReusableSummary {
  const sourceMode = deriveReusableSourceMode(skillUsage);
  const sourceCommandSeqs = listSuccessfulSourceCommandSeqs(commandsExecuted);
  const artifactTypes = sortUnique(taskFingerprint.requested_artifact_types);
  const targetPaths = normalizePathList(taskFingerprint.target_paths);
  const goalTerms = sortUnique(taskFingerprint.goal_terms);
  const passedGateIds = listPassedGateIds(gateEvaluations);
  const validation = buildReusableValidation(verificationCommands, gateEvaluations);
  const sourceReuseAttemptRefs = buildSourceReuseAttemptRefs(skillUsage, sourceMode);
  const failingGateDetails = listFailingGateDetails(gateEvaluations);
  const fallbackPaths = sortUnique(skillUsage.flatMap((usage) => usage.reexplored_paths));

  return {
    source_mode: sourceMode,
    source_command_seqs: sourceCommandSeqs,
    source_reuse_attempt_refs: sourceReuseAttemptRefs,
    intent: buildReusableIntent(resolvedDomain, resolvedTaskKind, artifactTypes, targetPaths, goalTerms),
    use_when: uniqueNonEmpty([
      ...(resolvedDomain ? [resolvedDomain] : []),
      ...(resolvedTaskKind ? [resolvedTaskKind] : []),
      ...artifactTypes,
      ...targetPaths,
      ...normalizePathList(taskFingerprint.referenced_specs),
      ...passedGateIds,
    ]),
    do_not_use_when: buildDoNotUseWhen(artifactTypes, targetPaths, passedGateIds, failingGateDetails),
    inputs_preconditions: uniqueNonEmpty([
      ...targetPaths,
      ...sortUnique(taskFingerprint.constraint_tags),
      ...passedGateIds,
      ...normalizePathList(taskFingerprint.referenced_specs),
    ]),
    steps: commandsExecuted.filter((command) => sourceCommandSeqs.includes(command.seq)).map((command) => command.command),
    validation,
    failure_signals: buildFailureSignals(failingGateDetails),
    fallback: buildFallbackInstructions(fallbackPaths),
  };
}

function buildLearningBlockers(
  commandsExecuted: TaskCommandRecord[],
  verificationCommands: VerificationCommandRecord[],
  gateEvaluations: GateEvaluation[],
  reusableSummary: ReusableSummary,
  classification: {
    domain: Domain | null;
    taskKind: TaskKind | null;
    resolution: TaskClassificationResolution;
  },
) {
  const blockers: TaskExecutionReceipt["learning_blockers"] = [];
  const sourceCommandSeqs = new Set(reusableSummary.source_command_seqs);
  const sourceCommands = commandsExecuted.filter((command) => sourceCommandSeqs.has(command.seq));
  const invalidSummaryBlocker = buildReusableSummaryInvalidBlocker(classification, reusableSummary);
  if (invalidSummaryBlocker) blockers.push(invalidSummaryBlocker);
  const unstableStepsBlocker = buildUnstableStepsBlocker(reusableSummary, sourceCommands);
  if (unstableStepsBlocker) blockers.push(unstableStepsBlocker);
  const adHocWriteBlocker = buildAdHocWriteBlocker(sourceCommands);
  if (adHocWriteBlocker) blockers.push(adHocWriteBlocker);
  const localEnvironmentBlocker = buildLocalEnvironmentBlocker(sourceCommands);
  if (localEnvironmentBlocker) blockers.push(localEnvironmentBlocker);
  const verificationBlocker = buildVerificationEvidenceBlocker(verificationCommands, gateEvaluations, reusableSummary);
  if (verificationBlocker) blockers.push(verificationBlocker);
  blockers.push(...buildConflictBlockers(gateEvaluations));
  return blockers;
}

function deriveReusableSourceMode(skillUsage: TaskSkillUsageRecord[]): ReusableSummary["source_mode"] {
  if (skillUsage.length === 0) return "baseline-task";
  return skillUsage.some((usage) => usage.outcome === "corrected-after-fallback") ? "corrected-after-fallback" : "successful-reuse";
}

function listSuccessfulSourceCommandSeqs(commandsExecuted: TaskCommandRecord[]): number[] {
  return commandsExecuted.filter((command) => command.exit_status === "passed" && command.kind !== "read-only").map((command) => command.seq);
}

function listPassedGateIds(gateEvaluations: GateEvaluation[]): string[] {
  return sortUnique(gateEvaluations.filter((gate) => gate.state === "passed").map((gate) => gate.gate_id));
}

function buildReusableValidation(
  verificationCommands: VerificationCommandRecord[],
  gateEvaluations: GateEvaluation[],
): string[] {
  return uniqueNonEmpty([
    ...verificationCommands.filter((command) => command.status === "passed").map((command) => command.command),
    ...gateEvaluations.filter((gate) => gate.state === "passed").map((gate) => `${gate.gate_id}:${gate.detail}`),
  ]);
}

function buildSourceReuseAttemptRefs(
  skillUsage: TaskSkillUsageRecord[],
  sourceMode: ReusableSummary["source_mode"],
): string[] {
  if (sourceMode === "baseline-task") return [];
  return skillUsage
    .filter((usage) => usage.outcome === sourceMode)
    .flatMap((usage) => usage.attempt_seqs.map((attemptSeq) => `${usage.reuse_receipt_ref}#attempt-${attemptSeq}`));
}

function listFailingGateDetails(gateEvaluations: GateEvaluation[]): string[] {
  return gateEvaluations.filter((gate) => gate.state !== "passed").map((gate) => `${gate.gate_id}:${gate.detail}`);
}

function buildDoNotUseWhen(
  artifactTypes: string[],
  targetPaths: string[],
  passedGateIds: string[],
  failingGateDetails: string[],
): string[] {
  return uniqueNonEmpty([
    artifactTypes.length > 0 ? `missing requested artifact_types: ${artifactTypes.join(",")}` : "",
    targetPaths.length > 0 ? `missing target_paths: ${targetPaths.join(",")}` : "",
    passedGateIds.length > 0 ? `missing required gates: ${passedGateIds.join(",")}` : "",
    "precondition_check failed",
    "verification failed",
    "stale-*",
    ...failingGateDetails,
  ]);
}

function buildFailureSignals(failingGateDetails: string[]): string[] {
  return uniqueNonEmpty(
    failingGateDetails.length > 0
      ? [...failingGateDetails, "precondition_check failed", "verification failed", "stale-*"]
      : ["precondition_check failed", "verification failed", "stale-*", "script missing", "task-specific verification missing"],
  );
}

function buildFallbackInstructions(fallbackPaths: string[]): string[] {
  const fallbackInstruction =
    "fallback to the baseline workflow after any precondition_check failed, verification failed, stale-* signal, script missing, or missing required gate";
  return uniqueNonEmpty(fallbackPaths.length > 0 ? [`re-explore paths: ${fallbackPaths.join(",")}`, fallbackInstruction] : [fallbackInstruction]);
}

function buildReusableSummaryInvalidBlocker(
  classification: {
    domain: Domain | null;
    taskKind: TaskKind | null;
    resolution: TaskClassificationResolution;
  },
  reusableSummary: ReusableSummary,
): TaskExecutionReceipt["learning_blockers"][number] | null {
  if (classification.domain && classification.taskKind && !isReusableSummaryStructurallyInvalid(reusableSummary)) return null;
  return {
    reason: "reusable-summary-invalid",
    evidence_refs: [],
    detail:
      !classification.domain || !classification.taskKind
        ? `post-task classification unresolved: ${classification.resolution.notes.join(",") || "missing-domain-or-task-kind"}`
        : "reusable_summary is structurally incomplete",
  };
}

function buildUnstableStepsBlocker(
  reusableSummary: ReusableSummary,
  sourceCommands: TaskCommandRecord[],
): TaskExecutionReceipt["learning_blockers"][number] | null {
  return reusableSummary.steps.length === 0 || sourceCommands.length === 0
    ? { reason: "unstable-steps", evidence_refs: [], detail: "no successful task steps" }
    : null;
}

function buildAdHocWriteBlocker(
  sourceCommands: TaskCommandRecord[],
): TaskExecutionReceipt["learning_blockers"][number] | null {
  const adHocWrites = sourceCommands.filter((command) => command.kind === "ad-hoc-write");
  return adHocWrites.length > 0
    ? {
        reason: "one-off-dirty-command",
        evidence_refs: adHocWrites.map((command) => command.evidence_ref),
        detail: "ad-hoc write command is not reusable",
      }
    : null;
}

function buildLocalEnvironmentBlocker(
  sourceCommands: TaskCommandRecord[],
): TaskExecutionReceipt["learning_blockers"][number] | null {
  const localEnvironmentCommands = sourceCommands.filter((command) => command.touches_outside_repo || !command.uses_checked_in_entrypoint);
  return localEnvironmentCommands.length > 0
    ? {
        reason: "hardcoded-local-environment",
        evidence_refs: localEnvironmentCommands.map((command) => command.evidence_ref),
        detail: "successful path depends on outside-repo or unchecked entrypoints",
      }
    : null;
}

function buildVerificationEvidenceBlocker(
  verificationCommands: VerificationCommandRecord[],
  gateEvaluations: GateEvaluation[],
  reusableSummary: ReusableSummary,
): TaskExecutionReceipt["learning_blockers"][number] | null {
  const failedVerificationEvidence = verificationCommands.filter((command) => command.status !== "passed").map((command) => command.evidence_ref);
  const failedGateEvidence = gateEvaluations.filter((gate) => gate.state !== "passed").map((gate) => gate.evidence_ref);
  if (failedVerificationEvidence.length === 0 && failedGateEvidence.length === 0 && reusableSummary.validation.length > 0) return null;
  return {
    reason: "missing-verification-evidence",
    evidence_refs: uniqueEvidenceRefs([...failedVerificationEvidence, ...failedGateEvidence]),
    detail: "verification evidence is incomplete",
  };
}

function buildReusableIntent(
  resolvedDomain: Domain | null,
  resolvedTaskKind: TaskKind | null,
  artifactTypes: string[],
  targetPaths: string[],
  goalTerms: string[],
): string {
  return [
    `domain=${resolvedDomain ?? "unknown"}`,
    `task_kind=${resolvedTaskKind ?? "unknown"}`,
    `artifact_types=${formatIntentValue(artifactTypes)}`,
    `target_paths=${formatIntentValue(targetPaths)}`,
    `goal_terms=${formatIntentValue(goalTerms)}`,
  ].join(" | ");
}

function formatIntentValue(values: string[]): string {
  return values.length > 0 ? values.join(",") : "none";
}

function sortUnique(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function uniqueNonEmpty(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function uniqueEvidenceRefs(values: string[]): string[] {
  return Array.from(new Set(values));
}

function isReusableSummaryStructurallyInvalid(reusableSummary: ReusableSummary): boolean {
  return (
    reusableSummary.intent.trim().length === 0 ||
    reusableSummary.use_when.length === 0 ||
    reusableSummary.do_not_use_when.length === 0 ||
    reusableSummary.inputs_preconditions.length === 0 ||
    reusableSummary.steps.length === 0 ||
    reusableSummary.validation.length === 0 ||
    reusableSummary.failure_signals.length === 0 ||
    reusableSummary.fallback.length === 0
  );
}

function buildConflictBlockers(gateEvaluations: GateEvaluation[]): TaskExecutionReceipt["learning_blockers"] {
  const failedGates = gateEvaluations.filter((gate) => gate.state !== "passed");
  return [
    buildConflictBlocker(
      "conflicts-root-rules",
      failedGates.filter((gate) => gate.evidence_source_type === "root-rule"),
      "root-rule gate conflict",
    ),
    buildConflictBlocker(
      "conflicts-project-facts",
      failedGates.filter(
        (gate) => gate.evidence_source_type === "project-fact" && gate.gate_kind !== "approval" && gate.gate_kind !== "repo-policy",
      ),
      "project-fact gate conflict",
    ),
    buildConflictBlocker(
      "conflicts-approved-specs",
      failedGates.filter(
        (gate) => gate.evidence_source_type === "document-status" || gate.gate_kind === "approval" || gate.gate_kind === "repo-policy",
      ),
      "approved-spec gate conflict",
    ),
  ].filter((blocker): blocker is NonNullable<typeof blocker> => blocker !== null);
}

function buildConflictBlocker(
  reason: TaskExecutionReceipt["learning_blockers"][number]["reason"],
  failedGates: GateEvaluation[],
  detailPrefix: string,
): TaskExecutionReceipt["learning_blockers"][number] | null {
  if (failedGates.length === 0) return null;
  return {
    reason,
    evidence_refs: uniqueEvidenceRefs(failedGates.map((gate) => gate.evidence_ref)),
    detail: `${detailPrefix}: ${failedGates.map((gate) => `${gate.gate_id}:${gate.detail}`).join("; ")}`,
  };
}

function resolveTaskClassification(
  taskFingerprint: TaskFingerprint,
  filesTouched: string[],
): {
  domain: Domain | null;
  taskKind: TaskKind | null;
  resolution: TaskClassificationResolution;
} {
  const normalizedFilesTouched = normalizePathList(filesTouched);
  let domain = taskFingerprint.domain;
  let taskKind = taskFingerprint.task_kind;
  let domainSource: TaskClassificationResolution["domain_source"] = domain ? "routing-fingerprint" : "unresolved";
  let taskKindSource: TaskClassificationResolution["task_kind_source"] = taskKind ? "routing-fingerprint" : "unresolved";
  const notes: string[] = [];

  if (!domain) {
    const referencedSpecDomain = inferSpecDomain(taskFingerprint.referenced_specs);
    if (referencedSpecDomain) {
      domain = referencedSpecDomain;
      domainSource = "post-task-referenced-spec";
    } else {
      const targetPathDomain = inferSpecDomain(taskFingerprint.target_paths);
      if (targetPathDomain) {
        domain = targetPathDomain;
        domainSource = "post-task-target-path";
      } else {
        const filesTouchedSpecDomain = inferSpecDomain(normalizedFilesTouched);
        if (filesTouchedSpecDomain) {
          domain = filesTouchedSpecDomain;
          domainSource = "post-task-files-touched";
        } else {
          const filesTouchedOperationalDomain = inferOperationalDomain(normalizedFilesTouched);
          if (filesTouchedOperationalDomain) {
            domain = filesTouchedOperationalDomain;
            domainSource = "post-task-files-touched";
          } else {
            const artifactDomain = inferArtifactDomain(taskFingerprint.requested_artifact_types);
            if (artifactDomain) {
              domain = artifactDomain;
              domainSource = "post-task-artifact";
            }
          }
        }
      }
    }
  }

  if (!taskKind) {
    if (domain === "code-implementation" && (normalizedFilesTouched.length > 0 || hasImplementationArtifact(taskFingerprint.requested_artifact_types))) {
      taskKind = "implement";
      taskKindSource = normalizedFilesTouched.length > 0 ? "post-task-files-touched" : "post-task-artifact";
    } else if (domain === "testing" && (normalizedFilesTouched.length > 0 || taskFingerprint.requested_artifact_types.includes("test-code"))) {
      taskKind = "verify";
      taskKindSource = normalizedFilesTouched.length > 0 ? "post-task-files-touched" : "post-task-artifact";
    } else if (domain && ["requirements", "design", "exec-plan"].includes(domain) && normalizedFilesTouched.some((item) => item.startsWith("docs/specs/"))) {
      taskKind = "revise";
      taskKindSource = "post-task-files-touched";
    }
  }

  if (!domain) notes.push("post-task-domain-unresolved");
  if (!taskKind) notes.push("post-task-task-kind-unresolved");

  return {
    domain,
    taskKind,
    resolution: {
      domain_source: domainSource,
      task_kind_source: taskKindSource,
      notes,
    },
  };
}

function inferAdditionalTaskCompletionGateRequirements(
  taskFingerprint: TaskFingerprint,
  filesTouched: string[],
): GateRequirement[] {
  const candidates = resolveEntrypointVerificationGateIds([...taskFingerprint.target_paths, ...filesTouched]);
  if (candidates.uniqueGateId) {
    return [taskSpecificVerificationGate(candidates.uniqueGateId)];
  }
  if (candidates.requiresSyntheticGate) {
    return [syntheticTaskSpecificVerificationGate()];
  }
  return [];
}

function resolveEntrypointVerificationGateIds(paths: string[]): {
  uniqueGateId: string | null;
  requiresSyntheticGate: boolean;
} {
  const normalizedPaths = normalizePathList(paths);
  if (normalizedPaths.some((current) => pathMatches(current, "scripts/automationDailyPipeline.sh"))) {
    return { uniqueGateId: "run-daily-dry-run", requiresSyntheticGate: false };
  }
  if (normalizedPaths.some((current) => pathMatches(current, "scripts/automationWeeklyPipeline.sh"))) {
    return { uniqueGateId: "run-weekly-dry-run", requiresSyntheticGate: false };
  }
  const entrypointRules = [
    {
      gateId: "run-daily-dry-run",
      relatedPaths: ["src/signal/", "src/filter/", "src/action/", "src/storage/", "data/reports/"],
    },
    {
      gateId: "run-weekly-dry-run",
      relatedPaths: ["src/action/", "src/storage/", "data/reports/"],
    },
    {
      gateId: "score-dry-run",
      relatedPaths: ["src/filter/", "src/storage/", "data/normalized/", "data/scores/"],
    },
    {
      gateId: "build-kb-dry-run",
      relatedPaths: ["src/action/", "src/storage/", "data/kb/"],
    },
  ];
  const matched = entrypointRules
    .filter((rule) => rule.relatedPaths.some((relatedPath) => normalizedPaths.some((current) => pathMatches(current, relatedPath))))
    .map((rule) => rule.gateId);
  const unique = Array.from(new Set(matched));
  if (unique.length === 1) {
    return { uniqueGateId: unique[0]!, requiresSyntheticGate: false };
  }

  const touchesMainProductPath = normalizedPaths.some(
    (current) =>
      current.startsWith("src/signal/") ||
      current.startsWith("src/filter/") ||
      current.startsWith("src/action/") ||
      current.startsWith("src/storage/") ||
      current.startsWith("data/reports/") ||
      current.startsWith("data/kb/"),
  );
  return {
    uniqueGateId: null,
    requiresSyntheticGate: touchesMainProductPath,
  };
}

function pathMatches(current: string, relatedPath: string): boolean {
  return current === relatedPath || current.startsWith(relatedPath) || relatedPath.startsWith(current);
}

function taskSpecificVerificationGate(gateId: string): GateRequirement {
  const commandByGateId: Record<string, string> = {
    "run-daily-dry-run": "pnpm run-daily -- --date <date> --dry-run",
    "run-weekly-dry-run": "pnpm run-weekly -- --date <date> --dry-run",
    "score-dry-run": "pnpm score -- --input <normalized-file>",
    "build-kb-dry-run": "pnpm build-kb -- --since <date>",
  };
  return {
    gate_id: gateId,
    gate_kind: "verification-command",
    gate_phase: "task-completion",
    evidence_source_type: "command-exit",
    evidence_ref_hint: commandByGateId[gateId] ?? gateId,
    freshness_rule: "per-task",
  };
}

function syntheticTaskSpecificVerificationGate(): GateRequirement {
  return {
    gate_id: "task-specific-verification",
    gate_kind: "verification-command",
    gate_phase: "task-completion",
    evidence_source_type: "project-fact",
    evidence_ref_hint: "run-daily / run-weekly / score / build-kb",
    freshness_rule: "per-task",
  };
}

function inferVerificationGateIds(command: string): string[] {
  if (command === "pnpm lint") return ["pnpm lint"];
  if (command === "pnpm typecheck") return ["pnpm typecheck"];
  if (command === "pnpm test") return ["pnpm test"];
  if (/^pnpm run-daily\s+--\s+--date\s+\S+(?:\s+--dry-run)?$/.test(command)) return ["run-daily-dry-run"];
  if (/^pnpm run-weekly\s+--\s+--date\s+\S+(?:\s+--dry-run)?$/.test(command)) return ["run-weekly-dry-run"];
  if (/^pnpm score(?:\s+--\s+--(?:date|input)\s+\S+)+$/.test(command)) return ["score-dry-run"];
  if (/^pnpm build-kb(?:\s+--\s+--since\s+\S+)?$/.test(command)) return ["build-kb-dry-run"];
  return [];
}

function requiresCondaRuntime(command: string): boolean {
  return (
    command === "pnpm typecheck" ||
    command === "pnpm test" ||
    /^pnpm run-daily\s+--\s+--date\s+\S+(?:\s+--dry-run)?$/.test(command) ||
    /^pnpm run-weekly\s+--\s+--date\s+\S+(?:\s+--dry-run)?$/.test(command) ||
    /^pnpm score(?:\s+--\s+--(?:date|input)\s+\S+)+$/.test(command) ||
    /^pnpm build-kb(?:\s+--\s+--since\s+\S+)?$/.test(command)
  );
}

function inferSpecDomain(paths: string[]): Domain | null {
  const domains = new Set<Domain>();
  for (const currentPath of paths) {
    if (currentPath.startsWith("docs/specs/product-specs/")) domains.add("requirements");
    if (currentPath.startsWith("docs/specs/design-docs/")) domains.add("design");
    if (currentPath.startsWith("docs/specs/exec-plans/")) domains.add("exec-plan");
  }
  return domains.size === 1 ? Array.from(domains)[0]! : null;
}

function inferOperationalDomain(paths: string[]): Domain | null {
  const repoPaths = paths.filter((item) =>
    item.startsWith("src/") ||
    item.startsWith("app/") ||
    item.startsWith("scripts/") ||
    ["config.yaml", "package.json", "tsconfig.json"].includes(item),
  );
  if (repoPaths.length === 0) return null;
  if (repoPaths.every((item) => item.startsWith("src/__tests__/") || item.endsWith(".test.ts"))) {
    return "testing";
  }
  return "code-implementation";
}

function inferArtifactDomain(artifactTypes: ArtifactType[]): Domain | null {
  if (hasImplementationArtifact(artifactTypes)) return "code-implementation";
  if (artifactTypes.length > 0 && artifactTypes.every((item) => item === "test-code")) return "testing";
  return null;
}

function hasImplementationArtifact(artifactTypes: ArtifactType[]): boolean {
  return artifactTypes.some((item) => ["source-code", "config", "skill-script"].includes(item));
}
