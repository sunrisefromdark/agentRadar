import fs from "node:fs";
import path from "node:path";
import { listFiles, readJsonFile, sha256File, writeJsonAtomic, writeJsonExclusive, writeTextAtomic } from "./fs.ts";
import { buildTaskFingerprint } from "./fingerprint.ts";
import { claimNextEventId, claimNextTaskId, shouldReuseTaskId } from "./ids.ts";
import {
  applyLifecycleEventToSkill,
  buildLifecycleEvent,
  expireSkillIfNeeded,
  recordSuccessfulReuseOnSkill,
  writeLifecycleEvent,
  type BuildLifecycleEventInput,
} from "./lifecycle.ts";
import { validateManualRegistryFreshness } from "./manualRegistry.ts";
import { buildRoutingManifest, validateManifestFreshness, writeRoutingManifest } from "./manifest.ts";
import { normalizePathList } from "./paths.ts";
import { buildProjectFacts, writeProjectFactsFiles } from "./projectFacts.ts";
import { buildSkillReuseReceipt, buildTaskExecutionReceipt, renderTaskArchive } from "./receipts.ts";
import { routeTask, validateProjectFactsFreshness } from "./routing.ts";
import { synthesizeLearnedCandidate, writeLearnedCandidateArtifacts } from "./candidate.ts";
import { scanDriftImpacts, type DriftEvent } from "./drift.ts";
import { buildSkillTreeArtifacts, writeSkillTreeArtifacts } from "./tree.ts";
import type {
  GateRequirement,
  LearnedSkillMetadata,
  ManualSkillRegistrySourceState,
  ManualSkillMetadata,
  ProjectFactRecord,
  ProjectFactSourceState,
  RoutingReceipt,
  SkillLifecycleEventReceipt,
  SkillReuseAttempt,
  SkillReuseReceipt,
  TaskCommandRecord,
  TaskExecutionReceipt,
  TaskFingerprint,
  TaskSkillUsageRecord,
  TaskResultReason,
} from "./types.ts";

interface ReusedSkillInput {
  skillId: string;
  matchRole: SkillReuseReceipt["match_role"];
  attempts: SkillReuseAttempt[];
}

export interface RunAgentTaskWorkflowInput {
  rootDir: string;
  now: string;
  taskId?: string;
  userRequest: string;
  taskTitle?: string;
  explicitPaths?: string[];
  referencedSpecs?: string[];
  gateEvidenceById: Record<
    string,
    {
      state: "passed" | "failed" | "missing_evidence";
      evidence_ref: string;
      detail: string;
    }
  >;
  commands: Array<Omit<TaskCommandRecord, "kind">>;
  filesTouched: string[];
  verificationBindings: Array<{
    command_seq: number;
    kind: "preflight" | "verification-command";
    status: "passed" | "failed" | "not_run";
  }>;
  autoReuseMatchedSkills?: boolean;
  result: TaskExecutionReceipt["result"];
  resultReason: TaskResultReason;
  reusedSkills?: ReusedSkillInput[];
}

export interface RunAgentTaskWorkflowResult {
  taskFingerprint: TaskFingerprint;
  routing: RoutingReceipt;
  taskReceipt: TaskExecutionReceipt;
  reuseReceipts: SkillReuseReceipt[];
  candidateResult?: ReturnType<typeof synthesizeLearnedCandidate>;
  lifecycleEvents: SkillLifecycleEventReceipt[];
  driftReceipt?: ReturnType<typeof scanDriftImpacts>;
  updatedLearnedSkills: LearnedSkillMetadata[];
}

export interface ReconcileManualTakeoversInput {
  rootDir: string;
  now: string;
}

export interface ReconcileManualTakeoversResult {
  lifecycleEvents: SkillLifecycleEventReceipt[];
  updatedLearnedSkills: LearnedSkillMetadata[];
}

export function runAgentTaskWorkflow(input: RunAgentTaskWorkflowInput): RunAgentTaskWorkflowResult {
  const lifecycleEvents = expireStaleLearnedSkills(input.rootDir, input.now);
  if (lifecycleEvents.length > 0) {
    refreshDerivedArtifacts(input.rootDir, input.now);
  }
  const prepared = prepareWorkflowArtifacts(input);
  const registry = validateManualRegistryFreshness(input.rootDir);
  let manualSkills = registry.metadata;
  let learnedSkills = readLearnedSkills(input.rootDir);

  if (isStaleFreshnessRouting(prepared.routing)) {
    const driftReceipt = applyDriftEvents({
      rootDir: input.rootDir,
      now: input.now,
      manualSkills,
      learnedSkills,
      manualSourceState: readManualSourceStateIfPresent(input.rootDir, registry.sourceState),
      events:
        prepared.routing.decision_reason === "no_confident_match:stale-project-facts"
          ? deriveProjectFactsDriftEvents(input.rootDir)
          : deriveManifestSkillSelfEvents(input.rootDir),
    });
    learnedSkills = driftReceipt.updatedLearnedSkills;
    manualSkills = driftReceipt.updatedManualSkills;
    const result = buildWorkflowResult(prepared, lifecycleEvents, learnedSkills, {
      ...(driftReceipt.receipt ? { driftReceipt: driftReceipt.receipt } : {}),
    });
    writeArchiveArtifact(input.rootDir, input.now, input.userRequest, result);
    refreshDerivedArtifacts(input.rootDir, input.now);
    return result;
  }

  if (registry.status !== "available" || prepared.routing.decision_reason === "no_confident_match:manual-registry-unavailable") {
    const driftReceipt = applyDriftEvents({
      rootDir: input.rootDir,
      now: input.now,
      manualSkills,
      learnedSkills,
      manualSourceState: readManualSourceStateIfPresent(input.rootDir, registry.sourceState),
      events: deriveManualRegistryDriftEvents(input.rootDir, registry.sourceState),
    });
    learnedSkills = driftReceipt.updatedLearnedSkills;
    manualSkills = driftReceipt.updatedManualSkills;
    const result = buildWorkflowResult(prepared, lifecycleEvents, learnedSkills, {
      ...(driftReceipt.receipt ? { driftReceipt: driftReceipt.receipt } : {}),
    });
    writeArchiveArtifact(input.rootDir, input.now, input.userRequest, result);
    refreshDerivedArtifacts(input.rootDir, input.now);
    return result;
  }

  learnedSkills = applyReuseUpdates(input.rootDir, prepared.taskReceipt, prepared.reuseReceipts, learnedSkills, lifecycleEvents);
  const candidateResult = maybeCreateCandidate(input, prepared.taskReceipt, prepared.reuseReceipts, manualSkills, learnedSkills);
  const runtimeDrift = applyDriftEvents({
    rootDir: input.rootDir,
    now: input.now,
    manualSkills,
    learnedSkills: readLearnedSkills(input.rootDir),
    manualSourceState: registry.sourceState,
    events: deriveWorkflowDriftEvents(input, manualSkills, prepared.reuseReceipts),
  });
  refreshDerivedArtifacts(input.rootDir, input.now);
  const result = buildWorkflowResult(prepared, lifecycleEvents, readLearnedSkills(input.rootDir), {
    candidateResult,
    ...(runtimeDrift.receipt ? { driftReceipt: runtimeDrift.receipt } : {}),
  });
  writeArchiveArtifact(input.rootDir, input.now, input.userRequest, result);
  return result;
}

export function reconcileManualTakeovers(input: ReconcileManualTakeoversInput): ReconcileManualTakeoversResult {
  const lifecycleEvents: SkillLifecycleEventReceipt[] = expireStaleLearnedSkills(input.rootDir, input.now);
  const registry = validateManualRegistryFreshness(input.rootDir);
  if (registry.status !== "available") {
    return {
      lifecycleEvents,
      updatedLearnedSkills: readLearnedSkills(input.rootDir),
    };
  }

  const learnedSkills = readLearnedSkills(input.rootDir);
  const updatedLearnedSkills = learnedSkills.map((skill) =>
    reconcileManualTakeoverForSkill(input.rootDir, input.now, skill, registry.metadata, lifecycleEvents),
  );

  refreshDerivedArtifacts(input.rootDir, input.now);
  return {
    lifecycleEvents,
    updatedLearnedSkills: readLearnedSkills(input.rootDir),
  };
}

interface PreparedWorkflowArtifacts {
  taskFingerprint: TaskFingerprint;
  routing: RoutingReceipt;
  taskReceipt: TaskExecutionReceipt;
  reuseReceipts: SkillReuseReceipt[];
}

function prepareWorkflowArtifacts(input: RunAgentTaskWorkflowInput): PreparedWorkflowArtifacts {
  const taskFingerprint = buildWorkflowFingerprint(input);
  const routing = writeRoutingArtifact(input, taskFingerprint);
  const taskId = routing.task_id;
  const effectiveInput = withResolvedReusedSkills(input, routing);
  const reuseReceipts = writeReuseArtifacts(effectiveInput, taskId);
  const taskReceipt = writeTaskReceiptArtifact(effectiveInput, taskId, taskFingerprint, routing, reuseReceipts);
  return {
    taskFingerprint,
    routing,
    taskReceipt,
    reuseReceipts,
  };
}

function buildWorkflowFingerprint(input: RunAgentTaskWorkflowInput): TaskFingerprint {
  const facts = validateProjectFactsFreshness(input.rootDir);
  return buildTaskFingerprint({
    userRequest: input.userRequest,
    taskTitle: input.taskTitle,
    explicitPaths: input.explicitPaths,
    referencedSpecs: input.referencedSpecs,
    projectFacts: facts.status === "available" ? facts.records : [],
  });
}

function writeRoutingArtifact(input: RunAgentTaskWorkflowInput, taskFingerprint: TaskFingerprint): RoutingReceipt {
  const explicitTaskId = input.taskId?.trim();
  if (explicitTaskId) {
    return createRoutingReceipt(input, explicitTaskId, taskFingerprint, "overwrite");
  }
  const reusedTaskId = findReusableTaskId(input.rootDir, taskFingerprint);
  if (reusedTaskId) {
    return createRoutingReceipt(input, reusedTaskId, taskFingerprint, "overwrite");
  }
  return claimNextTaskId(
    {
      rootDir: input.rootDir,
      taskDate: input.now.slice(0, 10),
      domain: taskFingerprint.domain,
      taskKind: taskFingerprint.task_kind,
      targetPaths: taskFingerprint.target_paths,
    },
    (taskId) => createRoutingReceipt(input, taskId, taskFingerprint, "exclusive"),
  );
}

function withResolvedReusedSkills(input: RunAgentTaskWorkflowInput, routing: RoutingReceipt): RunAgentTaskWorkflowInput {
  if ((input.reusedSkills ?? []).length > 0) return input;
  if (!input.autoReuseMatchedSkills) return input;
  const synthesized = synthesizeReusedSkills(input, routing);
  return synthesized.length > 0 ? { ...input, reusedSkills: synthesized } : input;
}

function synthesizeReusedSkills(input: RunAgentTaskWorkflowInput, routing: RoutingReceipt): ReusedSkillInput[] {
  const matchedSkills = [
    ...(routing.primary_match ? [{ skillId: routing.primary_match, matchRole: "primary" as const }] : []),
    ...routing.reference_matches.map((skillId) => ({ skillId, matchRole: "reference" as const })),
  ];
  if (matchedSkills.length === 0) return [];

  const verificationResult = deriveImplicitVerificationResult(input.verificationBindings);
  const failedEvidenceRefs = input.commands.filter((command) => command.exit_status !== "passed").map((command) => command.evidence_ref);
  const failureStage =
    input.result === "success" ? (verificationResult === "passed" ? "none" : "verification") : "execution";
  const failureKind =
    input.result === "success"
      ? verificationResult === "passed"
        ? "none"
        : "missing-task-specific-verification"
      : input.resultReason === "stale-project-facts"
        ? "stale-project-facts"
        : input.resultReason === "stale-skill-metadata"
          ? "stale-skill-metadata"
          : input.resultReason === "verification-failed"
            ? "verification-failed"
            : input.resultReason === "external-failure"
              ? "execution-failed"
              : "execution-failed";

  return matchedSkills.map((matchedSkill) => ({
    skillId: matchedSkill.skillId,
    matchRole: matchedSkill.matchRole,
    attempts: [
      {
        attempt_seq: 1,
        attempted_at: input.now,
        precondition_check: "passed",
        execution_result: input.result,
        verification_result: verificationResult,
        fallback_used: false,
        failure_stage: failureStage,
        failure_kind: failureKind,
        ...(input.result === "success" && verificationResult === "passed"
          ? { failure_evidence_refs: [] }
          : {
              failure_reason:
                input.result === "success" ? "verification evidence did not fully pass" : `task result: ${input.resultReason}`,
              failure_evidence_refs: failedEvidenceRefs,
            }),
        reexplored_paths: [],
      },
    ],
  }));
}

function deriveImplicitVerificationResult(
  verificationBindings: RunAgentTaskWorkflowInput["verificationBindings"],
): SkillReuseAttempt["verification_result"] {
  if (verificationBindings.length === 0) return "not_run";
  if (verificationBindings.every((binding) => binding.status === "passed")) return "passed";
  if (verificationBindings.some((binding) => binding.status === "failed")) return "failed";
  return "not_run";
}

function writeReuseArtifacts(input: RunAgentTaskWorkflowInput, taskId: string): SkillReuseReceipt[] {
  const reuseReceipts = buildReuseReceipts(input, taskId);
  return reuseReceipts.map((reuseReceipt) => {
    const relativePath = reuseReceiptPath(taskId, input.now, reuseReceipt.skill_id);
    const existing = fs.existsSync(path.join(input.rootDir, relativePath))
      ? readJsonFile<SkillReuseReceipt>(input.rootDir, relativePath)
      : null;
    const merged = existing ? mergeReuseReceipt(existing, reuseReceipt) : reuseReceipt;
    writeJsonAtomic(input.rootDir, relativePath, merged);
    return merged;
  });
}

function writeTaskReceiptArtifact(
  input: RunAgentTaskWorkflowInput,
  taskId: string,
  taskFingerprint: TaskFingerprint,
  routing: RoutingReceipt,
  reuseReceipts: SkillReuseReceipt[],
): TaskExecutionReceipt {
  const taskReceipt = buildTaskExecutionReceipt({
    now: input.now,
    taskId,
    userRequestSummary: input.taskTitle ?? input.userRequest,
    taskFingerprint,
    commands: input.commands,
    filesTouched: input.filesTouched,
    verificationBindings: input.verificationBindings,
    taskCompletionGateRequirements: deriveTaskCompletionGateRequirements(routing, input.reusedSkills ?? []),
    result: input.result,
    resultReason: input.resultReason,
    skillUsage: buildTaskSkillUsage(input, reuseReceipts),
    rootDir: input.rootDir,
  });
  writeJsonAtomic(input.rootDir, taskReceiptPath(taskId, input.now), taskReceipt);
  return taskReceipt;
}

function isStaleFreshnessRouting(routing: RoutingReceipt): boolean {
  return routing.decision_reason === "no_confident_match:stale-project-facts" || routing.decision_reason === "no_confident_match:manifest-stale";
}

function buildWorkflowResult(
  prepared: PreparedWorkflowArtifacts,
  lifecycleEvents: SkillLifecycleEventReceipt[],
  updatedLearnedSkills: LearnedSkillMetadata[],
  extras: {
    candidateResult?: ReturnType<typeof synthesizeLearnedCandidate>;
    driftReceipt?: ReturnType<typeof scanDriftImpacts>;
  } = {},
): RunAgentTaskWorkflowResult {
  return {
    taskFingerprint: prepared.taskFingerprint,
    routing: prepared.routing,
    taskReceipt: prepared.taskReceipt,
    reuseReceipts: prepared.reuseReceipts,
    lifecycleEvents,
    updatedLearnedSkills,
    ...(extras.candidateResult ? { candidateResult: extras.candidateResult } : {}),
    ...(extras.driftReceipt ? { driftReceipt: extras.driftReceipt } : {}),
  };
}

function applyReuseUpdates(
  rootDir: string,
  taskReceipt: TaskExecutionReceipt,
  reuseReceipts: SkillReuseReceipt[],
  learnedSkills: LearnedSkillMetadata[],
  lifecycleEvents: SkillLifecycleEventReceipt[],
): LearnedSkillMetadata[] {
  const updated = [...learnedSkills];
  for (const reuseReceipt of reuseReceipts) {
    const index = updated.findIndex((skill) => skill.skill_id === reuseReceipt.skill_id);
    if (index < 0) continue;
    const next = updateSkillFromReuse(rootDir, updated[index]!, taskReceipt.created_at, reuseReceipt, lifecycleEvents);
    updated[index] = next;
    writeLearnedSkillMetadata(rootDir, next);
  }
  return updated;
}

function maybeCreateCandidate(
  input: RunAgentTaskWorkflowInput,
  taskReceipt: TaskExecutionReceipt,
  reuseReceipts: SkillReuseReceipt[],
  manualSkills: ManualSkillMetadata[],
  learnedSkills: LearnedSkillMetadata[],
): ReturnType<typeof synthesizeLearnedCandidate> | undefined {
  if (taskReceipt.result !== "success") return undefined;
  const candidateResult = synthesizeLearnedCandidate({
      rootDir: input.rootDir,
      now: input.now,
      taskReceipt,
      taskReceiptPath: taskReceiptPath(taskReceipt.task_id, input.now),
      reuseReceipts,
      reuseReceiptPaths: reuseReceipts.map((receipt) => reuseReceiptPath(taskReceipt.task_id, input.now, receipt.skill_id)),
      existingSkills: [...manualSkills, ...learnedSkills],
    });
  if (candidateResult.status === "created") {
    return writeLearnedCandidateArtifacts(input.rootDir, candidateResult);
  }
  return candidateResult;
}

function reconcileManualTakeoverForSkill(
  rootDir: string,
  now: string,
  skill: LearnedSkillMetadata,
  manualSkills: ManualSkillMetadata[],
  lifecycleEvents: SkillLifecycleEventReceipt[],
): LearnedSkillMetadata {
  if (skill.lifecycle_status === "retired") return skill;
  const supersedingManual = manualSkills.find((manual) => manual.supersedes_learned_skill_ids?.includes(skill.skill_id));
  if (supersedingManual) return applySupersededTakeover(rootDir, now, skill, supersedingManual, lifecycleEvents);
  const conflictingManual = manualSkills.find((manual) => manualConflictsWithLearned(manual, skill));
  return conflictingManual ? applyConflictTakeover(rootDir, now, skill, conflictingManual, lifecycleEvents) : skill;
}

function deriveTaskCompletionGateRequirements(
  routing: RoutingReceipt,
  reusedSkills: ReusedSkillInput[],
): GateRequirement[] {
  const selected = new Map<string, GateRequirement>();
  const candidateById = new Map(routing.candidate_evaluations.map((candidate) => [candidate.skill_id, candidate]));
  const chosen = [
    ...(routing.primary_match ? [routing.primary_match] : []),
    ...reusedSkills.map((item) => item.skillId),
  ];
  for (const skillId of chosen) {
    const evaluation = candidateById.get(skillId);
    for (const gate of evaluation?.effective_task_completion_gates ?? []) {
      selected.set(gateRequirementKey(gate.gate), gate.gate);
    }
  }
  return Array.from(selected.values()).sort((left, right) => left.gate_id.localeCompare(right.gate_id));
}

function buildReuseReceipts(input: RunAgentTaskWorkflowInput, taskId: string): SkillReuseReceipt[] {
  return (input.reusedSkills ?? []).map((skill) =>
    buildSkillReuseReceipt({
      taskId,
      skillId: skill.skillId,
      matchRole: skill.matchRole,
      attempts: skill.attempts,
      correctedTaskReceiptRef: shouldAttachCorrectedTaskReceiptRef(input.result, skill.attempts)
        ? taskReceiptPath(taskId, input.now)
        : undefined,
    }),
  );
}

function shouldAttachCorrectedTaskReceiptRef(
  taskResult: TaskExecutionReceipt["result"],
  attempts: SkillReuseAttempt[],
): boolean {
  const latest = [...attempts].sort((left, right) => left.attempt_seq - right.attempt_seq)[attempts.length - 1];
  return Boolean(
    latest &&
      taskResult === "success" &&
      latest.execution_result === "success" &&
      latest.verification_result === "passed" &&
      latest.fallback_used,
  );
}

function buildTaskSkillUsage(input: RunAgentTaskWorkflowInput, reuseReceipts: SkillReuseReceipt[]): TaskSkillUsageRecord[] {
  const bySkillId = new Map((input.reusedSkills ?? []).map((skill) => [skill.skillId, skill]));
  return reuseReceipts.map((receipt) => ({
    skill_id: receipt.skill_id,
    match_role: receipt.match_role,
    reuse_receipt_ref: reuseReceiptPath(receipt.task_id, input.now, receipt.skill_id),
    attempt_seqs: receipt.attempts.map((attempt) => attempt.attempt_seq),
    outcome: deriveReuseOutcome(receipt, input.result),
    reexplored_paths: receipt.reexplored_paths,
    ...(bySkillId.get(receipt.skill_id) ? {} : {}),
  }));
}

function deriveReuseOutcome(
  receipt: SkillReuseReceipt,
  taskResult: TaskExecutionReceipt["result"],
): TaskSkillUsageRecord["outcome"] {
  const hasCorrection = receipt.fallback_used || receipt.attempts.some((attempt) => attempt.execution_result !== "success" || attempt.fallback_used);
  if (taskResult === "success" && isSuccessfulReuseReceipt(receipt)) {
    return hasCorrection ? "corrected-after-fallback" : "successful-reuse";
  }
  if (taskResult === "success" && hasCorrection) {
    return "corrected-after-fallback";
  }
  return "failed-reuse";
}

function updateSkillFromReuse(
  rootDir: string,
  skill: LearnedSkillMetadata,
  taskCreatedAt: string,
  reuseReceipt: SkillReuseReceipt,
  lifecycleEvents: SkillLifecycleEventReceipt[],
): LearnedSkillMetadata {
  const recorded = recordSuccessfulReuseOnSkill(skill, {
    taskCreatedAt,
    reuseReceipt,
  });
  if (!isSuccessfulReuseReceipt(reuseReceipt)) {
    return recorded;
  }

  if (skill.lifecycle_status === "candidate") {
    const event = createLifecycleEventReceipt(rootDir, {
      skillId: skill.skill_id,
      now: taskCreatedAt,
      eventType: "promoted",
      trigger: "successful-reuse",
      reason: "promoted after successful reuse",
      evidenceRefs: [reuseReceiptPath(reuseReceipt.task_id, taskCreatedAt, skill.skill_id)],
      fromTrustTier: skill.trust_tier,
      toTrustTier: "learned_stable",
      fromLifecycleStatus: skill.lifecycle_status,
      toLifecycleStatus: "stable",
    });
    lifecycleEvents.push(event);
    return applyLifecycleEventToSkill(recorded, event);
  }

  if (skill.lifecycle_status === "paused" || skill.lifecycle_status === "expired") {
    const event = createLifecycleEventReceipt(rootDir, {
      skillId: skill.skill_id,
      now: taskCreatedAt,
      eventType: "revalidated",
      trigger: "successful-reuse",
      reason: "revalidated after fresh successful reuse",
      evidenceRefs: [reuseReceiptPath(reuseReceipt.task_id, taskCreatedAt, skill.skill_id)],
      fromTrustTier: skill.trust_tier,
      toTrustTier: skill.trust_tier,
      fromLifecycleStatus: skill.lifecycle_status,
      toLifecycleStatus: "stable",
    });
    lifecycleEvents.push(event);
    return applyLifecycleEventToSkill(recorded, event);
  }

  return recorded;
}

function applySupersededTakeover(
  rootDir: string,
  now: string,
  skill: LearnedSkillMetadata,
  manual: ManualSkillMetadata,
  lifecycleEvents: SkillLifecycleEventReceipt[],
): LearnedSkillMetadata {
  const event = createLifecycleEventReceipt(rootDir, {
    skillId: skill.skill_id,
    now,
    eventType: "superseded",
    trigger: "manual-supersession",
    reason: `manual takeover by ${manual.skill_id}`,
    evidenceRefs: [manual.source_doc_path, "docs/specs/agent-work/manual-skill-index.json"],
    relatedSkillIds: [manual.skill_id],
    fromTrustTier: skill.trust_tier,
    toTrustTier: skill.trust_tier,
    fromLifecycleStatus: skill.lifecycle_status,
    toLifecycleStatus: "retired",
  });
  lifecycleEvents.push(event);
  const updated = applyLifecycleEventToSkill({ ...skill, replacement_skill_id: manual.skill_id }, event);
  writeLearnedSkillMetadata(rootDir, updated);
  return updated;
}

function applyConflictTakeover(
  rootDir: string,
  now: string,
  skill: LearnedSkillMetadata,
  manual: ManualSkillMetadata,
  lifecycleEvents: SkillLifecycleEventReceipt[],
): LearnedSkillMetadata {
  const event = createLifecycleEventReceipt(rootDir, {
    skillId: skill.skill_id,
    now,
    eventType: "conflict-recorded",
    trigger: "source-doc-change",
    reason: `manual-authority-conflict:${manual.skill_id}`,
    evidenceRefs: [manual.source_doc_path, "docs/specs/agent-work/manual-skill-index.json"],
    relatedSkillIds: [manual.skill_id],
    fromTrustTier: skill.trust_tier,
    toTrustTier: skill.trust_tier,
    fromLifecycleStatus: skill.lifecycle_status,
    toLifecycleStatus: skill.lifecycle_status === "stable" ? "paused" : skill.lifecycle_status,
  });
  lifecycleEvents.push(event);
  const updated = applyLifecycleEventToSkill(skill, event);
  writeLearnedSkillMetadata(rootDir, updated);
  return updated;
}

function manualConflictsWithLearned(manual: ManualSkillMetadata, learned: LearnedSkillMetadata): boolean {
  return (
    manual.domain === learned.domain &&
    manual.subdomain === learned.subdomain &&
    stableKey(manual.task_kinds) === stableKey(learned.task_kinds) &&
    stableKey(manual.artifact_types) === stableKey(learned.artifact_types) &&
    stableKey(normalizePathList(manual.target_paths)) === stableKey(normalizePathList(learned.target_paths))
  );
}

function applyDriftEvents(input: {
  rootDir: string;
  now: string;
  manualSkills: ManualSkillMetadata[];
  learnedSkills: LearnedSkillMetadata[];
  manualSourceState: ManualSkillRegistrySourceState | null;
  events: DriftEvent[];
}): {
  receipt?: ReturnType<typeof scanDriftImpacts>;
  updatedManualSkills: ManualSkillMetadata[];
  updatedLearnedSkills: LearnedSkillMetadata[];
} {
  if (input.events.length === 0 || !input.manualSourceState) {
    return {
      updatedManualSkills: input.manualSkills,
      updatedLearnedSkills: input.learnedSkills,
    };
  }
  const receipt = scanDriftImpacts({
    now: input.now,
    manualSkills: input.manualSkills,
    learnedSkills: input.learnedSkills,
    manualSourceState: input.manualSourceState,
    events: input.events,
  });
  writeJsonAtomic(input.rootDir, `data/agent-memory/drift/${input.now.slice(0, 10)}/${receipt.scan_id}.json`, receipt);
  const affected = new Set(receipt.affected_skill_ids);
  const updatedManualSkills = input.manualSkills.map((skill) =>
    affected.has(skill.skill_id) && skill.lifecycle_status !== "retired"
      ? {
          ...skill,
          drift_status: "pending_recheck" as const,
        }
      : skill,
  );
  if (updatedManualSkills.some((skill, index) => skill !== input.manualSkills[index])) {
    writeJsonAtomic(input.rootDir, "docs/specs/agent-work/manual-skill-index.json", updatedManualSkills);
  }
  const updatedLearnedSkills = input.learnedSkills.map((skill) => {
    if (!affected.has(skill.skill_id) || skill.lifecycle_status === "retired") return skill;
    const updated = { ...skill, drift_status: "pending_recheck" as const };
    writeLearnedSkillMetadata(input.rootDir, updated);
    return updated;
  });
  return { receipt, updatedManualSkills, updatedLearnedSkills };
}

function readLearnedSkills(rootDir: string): LearnedSkillMetadata[] {
  const skills: LearnedSkillMetadata[] = [];
  for (const relativePath of listFiles(rootDir, "data/agent-memory/learned", [".json"])) {
    try {
      skills.push(readJsonFile<LearnedSkillMetadata>(rootDir, relativePath));
    } catch {
      continue;
    }
  }
  return skills;
}

function refreshDerivedArtifacts(rootDir: string, now: string): void {
  expireStaleLearnedSkills(rootDir, now);
  const registry = validateManualRegistryFreshness(rootDir);
  let factsRebuilt = false;
  try {
    const facts = buildProjectFacts(rootDir, now);
    writeProjectFactsFiles(rootDir, facts);
    factsRebuilt = true;
  } catch {
    factsRebuilt = false;
  }

  if (registry.status !== "available" || !registry.sourceState || !factsRebuilt) return;
  const manifest = buildRoutingManifest(rootDir, now);
  writeRoutingManifest(rootDir, manifest);
  const tree = buildSkillTreeArtifacts({
    now,
    manualSkills: validateManualRegistryFreshness(rootDir).metadata,
    learnedSkills: readLearnedSkills(rootDir),
    routingReceipts: readArtifacts<RoutingReceipt>(rootDir, "data/agent-memory/routing", ".json"),
    reuseReceipts: readArtifacts<SkillReuseReceipt>(rootDir, "data/agent-memory/reuse", ".json"),
  });
  writeSkillTreeArtifacts(rootDir, tree);
}

function findReusableTaskId(rootDir: string, taskFingerprint: TaskFingerprint): string | null {
  const current = {
    domain: taskFingerprint.domain,
    taskKind: taskFingerprint.task_kind,
    artifactTypes: taskFingerprint.requested_artifact_types,
    targetPaths: taskFingerprint.target_paths,
    deliveryIntent: stableKey(taskFingerprint.goal_terms),
  };
  const routingReceipts = readArtifacts<RoutingReceipt>(rootDir, "data/agent-memory/routing", ".json").sort((left, right) =>
    right.created_at.localeCompare(left.created_at),
  );
  for (const receipt of routingReceipts) {
    const previous = {
      domain: receipt.task_fingerprint.domain,
      taskKind: receipt.task_fingerprint.task_kind,
      artifactTypes: receipt.task_fingerprint.requested_artifact_types,
      targetPaths: receipt.task_fingerprint.target_paths,
      deliveryIntent: stableKey(receipt.task_fingerprint.goal_terms),
    };
    if (shouldReuseTaskId(previous, current)) return receipt.task_id;
  }
  return null;
}

function mergeReuseReceipt(existing: SkillReuseReceipt, incoming: SkillReuseReceipt): SkillReuseReceipt {
  const appendedAttempts = incoming.attempts.map((attempt, index) => ({
    ...attempt,
    attempt_seq: existing.attempt_count + index + 1,
  }));
  return buildSkillReuseReceipt({
    taskId: existing.task_id,
    skillId: existing.skill_id,
    matchRole: incoming.match_role,
    attempts: [...existing.attempts, ...appendedAttempts],
    correctedTaskReceiptRef: incoming.corrected_task_receipt_ref ?? existing.corrected_task_receipt_ref,
  });
}

function readManualSourceStateIfPresent(
  rootDir: string,
  fallback: ManualSkillRegistrySourceState | null | undefined,
): ManualSkillRegistrySourceState | null {
  if (fallback) return fallback;
  const relativePath = "docs/specs/agent-work/manual-skill-source-state.json";
  if (!fs.existsSync(path.join(rootDir, relativePath))) return null;
  try {
    return readJsonFile<ManualSkillRegistrySourceState>(rootDir, relativePath);
  } catch {
    return null;
  }
}

function deriveManualRegistryDriftEvents(
  rootDir: string,
  sourceState: ManualSkillRegistrySourceState | null | undefined,
): DriftEvent[] {
  const currentSourceState = readManualSourceStateIfPresent(rootDir, sourceState);
  if (!currentSourceState) return [];
  const changedPaths = currentSourceState.source_docs
    .filter((snapshot) => !fs.existsSync(path.join(rootDir, snapshot.path)) || sha256File(rootDir, snapshot.path) !== snapshot.content_sha256)
    .map((snapshot) => snapshot.path);
  return changedPaths.length > 0
    ? [
        {
          kind: "manual-source",
          changed_paths: changedPaths,
        },
      ]
    : [];
}

function deriveProjectFactsDriftEvents(rootDir: string): DriftEvent[] {
  const sourceStatePath = "data/agent-memory/facts/source-state.json";
  const indexPath = "data/agent-memory/facts/index.json";
  if (!fs.existsSync(path.join(rootDir, sourceStatePath)) || !fs.existsSync(path.join(rootDir, indexPath))) {
    return [{ kind: "global-root" }];
  }

  try {
    const sourceState = readJsonFile<ProjectFactSourceState>(rootDir, sourceStatePath);
    const currentRecords = readJsonFile<ProjectFactRecord[]>(rootDir, indexPath);
    const rebuilt = buildProjectFacts(rootDir, sourceState.generated_at);
    const sourceByPath = new Map(sourceState.source_docs.map((snapshot) => [snapshot.path, snapshot]));
    let changedPaths = rebuilt.sourceState.source_docs
      .filter((snapshot) => sourceByPath.get(snapshot.path)?.content_sha256 !== snapshot.content_sha256)
      .map((snapshot) => snapshot.path);
    let changedFacts = rebuilt.records.filter((record) => record.source_doc_paths.some((sourceDocPath) => changedPaths.includes(sourceDocPath)));

    if (changedFacts.length === 0 && JSON.stringify(currentRecords) !== JSON.stringify(rebuilt.records)) {
      const currentById = new Map(currentRecords.map((record) => [record.fact_id, record]));
      changedFacts = rebuilt.records.filter((record) => JSON.stringify(currentById.get(record.fact_id) ?? null) !== JSON.stringify(record));
      changedPaths = normalizePathList(changedFacts.flatMap((record) => record.source_doc_paths));
    }

    if (changedFacts.length === 0) return [];
    return [
      {
        kind: "fact-source",
        changed_fact_ids: changedFacts.map((record) => record.fact_id).sort((left, right) => left.localeCompare(right)),
        changed_paths: changedPaths,
        constraint_tags: Array.from(new Set(changedFacts.flatMap((record) => record.constraint_tags))).sort((left, right) =>
          left.localeCompare(right),
        ),
        gate_ids: Array.from(new Set(changedFacts.flatMap((record) => record.required_gates.map((gate) => gate.gate_id)))).sort(
          (left, right) => left.localeCompare(right),
        ),
        related_paths: normalizePathList(changedFacts.flatMap((record) => record.related_paths)),
      },
    ];
  } catch {
    return [{ kind: "global-root" }];
  }
}

function deriveManifestSkillSelfEvents(rootDir: string): DriftEvent[] {
  const manifestPath = "data/agent-memory/manifests/latest.json";
  if (!fs.existsSync(path.join(rootDir, manifestPath))) return [];
  let manifest: { input_snapshots: Array<{ path: string; skill_id?: string }> };
  try {
    manifest = readJsonFile<{ input_snapshots: Array<{ path: string; skill_id?: string }> }>(rootDir, manifestPath);
  } catch {
    return [];
  }
  const skillIds = new Set<string>();
  for (const reason of validateManifestFreshness(rootDir).reasons) {
    const pathMatch = reason.match(/:(data\/agent-memory\/learned\/.+\.(?:json|md))$/);
    const relativePath = pathMatch?.[1];
    if (!relativePath) continue;
    const snapshotSkillId = manifest.input_snapshots.find((entry) => entry.path === relativePath)?.skill_id;
    const skillId = snapshotSkillId ?? relativePath.replace(/^data\/agent-memory\/learned\/[^/]+\//, "").replace(/\.(json|md)$/, "");
    if (skillId.length > 0) skillIds.add(skillId);
  }
  return Array.from(skillIds)
    .sort((left, right) => left.localeCompare(right))
    .map((skillId) => ({
      kind: "skill-self" as const,
      skill_id: skillId,
    }));
}

function deriveWorkflowDriftEvents(
  input: RunAgentTaskWorkflowInput,
  manualSkills: ManualSkillMetadata[],
  reuseReceipts: SkillReuseReceipt[],
): DriftEvent[] {
  const normalizedTouched = normalizePathList(input.filesTouched);
  const events: DriftEvent[] = [];
  if (normalizedTouched.some((currentPath) => currentPath.startsWith("scripts/") || ["package.json", "config.yaml"].includes(currentPath))) {
    events.push({
      kind: "script-runtime",
      changed_paths: normalizedTouched,
    });
  }
  const changedSkillIds = normalizedTouched
    .filter((currentPath) => currentPath.startsWith("data/agent-memory/learned/") && /\.(json|md)$/.test(currentPath))
    .map((currentPath) => currentPath.replace(/^data\/agent-memory\/learned\/[^/]+\//, "").replace(/\.(json|md)$/, ""));
  for (const skillId of Array.from(new Set(changedSkillIds)).sort((left, right) => left.localeCompare(right))) {
    events.push({
      kind: "skill-self",
      skill_id: skillId,
    });
  }
  const changedManualSourcePaths = normalizedTouched.filter((currentPath) => manualSkills.some((skill) => skill.source_doc_path === currentPath));
  if (changedManualSourcePaths.length > 0) {
    events.push({
      kind: "manual-source",
      changed_paths: changedManualSourcePaths,
    });
  }
  for (const event of deriveFailureSequenceDriftEvents(input.rootDir, reuseReceipts)) {
    events.push(event);
  }
  return events;
}

function deriveFailureSequenceDriftEvents(rootDir: string, reuseReceipts: SkillReuseReceipt[]): DriftEvent[] {
  const events: DriftEvent[] = [];
  for (const receipt of reuseReceipts) {
    if (isSuccessfulReuseReceipt(receipt)) continue;
    const history = readArtifacts<SkillReuseReceipt>(rootDir, "data/agent-memory/reuse", ".json")
      .filter((candidate) => candidate.skill_id === receipt.skill_id)
      .sort((left, right) => right.last_attempted_at.localeCompare(left.last_attempted_at));
    let consecutiveFailures = 0;
    for (const entry of history) {
      const failed =
        entry.execution_result === "failed" || entry.execution_result === "partial" || entry.verification_result === "failed";
      if (!failed) break;
      consecutiveFailures += 1;
    }
    if (consecutiveFailures >= 2) {
      events.push({
        kind: "failure-sequence",
        skill_id: receipt.skill_id,
        consecutive_failures: consecutiveFailures,
      });
    }
  }
  return events;
}

function readArtifacts<T>(rootDir: string, relativeDir: string, extension: string): T[] {
  return listFiles(rootDir, relativeDir, [extension]).map((relativePath) => readJsonFile<T>(rootDir, relativePath));
}

function writeLearnedSkillMetadata(rootDir: string, skill: LearnedSkillMetadata): void {
  writeJsonAtomic(rootDir, `data/agent-memory/learned/${skill.domain}/${skill.skill_id}.json`, skill);
}

function createRoutingReceipt(
  input: RunAgentTaskWorkflowInput,
  taskId: string,
  taskFingerprint: TaskFingerprint,
  writeMode: "exclusive" | "overwrite",
): RoutingReceipt {
  const routing = routeTask({
    rootDir: input.rootDir,
    taskId,
    now: input.now,
    taskFingerprint,
    gateEvidenceById: input.gateEvidenceById,
  });
  if (writeMode === "exclusive") {
    writeJsonExclusive(input.rootDir, routingReceiptPath(taskId, input.now), routing);
  } else {
    writeJsonAtomic(input.rootDir, routingReceiptPath(taskId, input.now), routing);
  }
  return routing;
}

function createLifecycleEventReceipt(rootDir: string, input: Omit<BuildLifecycleEventInput, "eventId">): SkillLifecycleEventReceipt {
  return claimNextEventId(rootDir, input.now.slice(0, 10), input.skillId, (eventId) => {
    const event = buildLifecycleEvent({ ...input, eventId });
    writeLifecycleEvent(rootDir, event);
    return event;
  });
}

function expireStaleLearnedSkills(rootDir: string, now: string): SkillLifecycleEventReceipt[] {
  const lifecycleEvents: SkillLifecycleEventReceipt[] = [];
  for (const skill of readLearnedSkills(rootDir)) {
    const expiration = expireSkillIfNeeded(skill, now);
    if (!expiration) continue;
    const event = createLifecycleEventReceipt(rootDir, {
      skillId: expiration.event.skill_id,
      now: expiration.event.created_at,
      eventType: expiration.event.event_type,
      trigger: expiration.event.trigger,
      reason: expiration.event.reason,
      evidenceRefs: expiration.event.evidence_refs,
      relatedSkillIds: expiration.event.related_skill_ids,
      fromTrustTier: expiration.event.from_trust_tier,
      toTrustTier: expiration.event.to_trust_tier,
      fromLifecycleStatus: expiration.event.from_lifecycle_status,
      toLifecycleStatus: expiration.event.to_lifecycle_status,
      manualConfirmationRef: expiration.event.manual_confirmation_ref,
    });
    const updated = applyLifecycleEventToSkill(skill, event);
    writeLearnedSkillMetadata(rootDir, updated);
    lifecycleEvents.push(event);
  }
  return lifecycleEvents;
}

function isSuccessfulReuseReceipt(receipt: SkillReuseReceipt): boolean {
  return receipt.execution_result === "success" && receipt.verification_result === "passed" && receipt.fallback_used === false;
}

function routingReceiptPath(taskId: string, now: string): string {
  return `data/agent-memory/routing/${now.slice(0, 10)}/${taskId}.json`;
}

function taskReceiptPath(taskId: string, now: string): string {
  return `data/agent-memory/tasks/${now.slice(0, 10)}/${taskId}.json`;
}

function reuseReceiptPath(taskId: string, now: string, skillId: string): string {
  return `data/agent-memory/reuse/${now.slice(0, 10)}/${taskId}/${skillId}.json`;
}

function writeArchiveArtifact(
  rootDir: string,
  now: string,
  userRequest: string,
  result: RunAgentTaskWorkflowResult,
): void {
  const lifecycleRefs = [
    ...result.lifecycleEvents.map((event) => lifecycleReceiptPath(event.created_at, event.event_id)),
    ...(result.candidateResult?.status === "created"
      ? [lifecycleReceiptPath(result.candidateResult.lifecycle_event.created_at, result.candidateResult.lifecycle_event.event_id)]
      : []),
  ];
  const archive = renderTaskArchive({
    userRequest,
    routingSummary: {
      task_id: result.routing.task_id,
      decision_reason: result.routing.decision_reason,
      primary_match: result.routing.primary_match,
      reference_matches: result.routing.reference_matches,
      rejected_matches: result.routing.rejected_matches,
    },
    taskReceipt: {
      task_id: result.taskReceipt.task_id,
      result: result.taskReceipt.result,
      verification_commands: result.taskReceipt.verification_commands,
      task_completion_gates_evaluated: result.taskReceipt.task_completion_gates_evaluated,
      skill_usage: result.taskReceipt.skill_usage,
    },
    reuseReceipts: result.reuseReceipts,
    sourceReceiptRefs: [
      routingReceiptPath(result.routing.task_id, now),
      taskReceiptPath(result.taskReceipt.task_id, now),
      ...result.reuseReceipts.map((receipt) => reuseReceiptPath(receipt.task_id, now, receipt.skill_id)),
      ...lifecycleRefs,
    ],
  });
  writeTextAtomic(rootDir, archivePath(result.taskReceipt.task_id, now), archive);
}

function archivePath(taskId: string, now: string): string {
  return `data/agent-memory/archives/${now.slice(0, 10)}/${taskId}.md`;
}

function lifecycleReceiptPath(createdAt: string, eventId: string): string {
  return `data/agent-memory/lifecycle/${createdAt.slice(0, 10)}/${eventId}.json`;
}

function gateRequirementKey(gate: GateRequirement): string {
  return `${gate.gate_id}::${gate.gate_kind}::${gate.gate_phase}`;
}

function stableKey(values: string[]): string {
  return JSON.stringify([...values].sort((left, right) => left.localeCompare(right)));
}
