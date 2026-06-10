export type Domain =
  | "requirements"
  | "design"
  | "exec-plan"
  | "code-implementation"
  | "artifact-review"
  | "testing"
  | "visual-console"
  | "automation"
  | "repo-ops";

export type TaskKind = "analyze" | "draft" | "revise" | "review" | "implement" | "verify" | "debug" | "operate";

export type ArtifactType =
  | "requirement-doc"
  | "design-doc"
  | "exec-plan"
  | "source-code"
  | "test-code"
  | "config"
  | "report"
  | "skill-doc"
  | "skill-script"
  | "audit-receipt";

export type Subdomain =
  | "general"
  | "requirement-analysis"
  | "spec-gap-audit"
  | "design-doc"
  | "design-review"
  | "architecture-boundary"
  | "exec-plan-drafting"
  | "exec-plan-review"
  | "feature-delivery"
  | "bug-fix"
  | "refactor"
  | "code-review"
  | "artifact-audit"
  | "test-design"
  | "regression-validation"
  | "ui-implementation"
  | "visual-regression"
  | "workflow-automation"
  | "scheduled-automation"
  | "script-maintenance"
  | "dependency-ops"
  | "workspace-hygiene";

export type GateKind = "approval" | "preflight" | "verification-command" | "repo-policy";
export type GateState = "passed" | "failed" | "not_applicable" | "missing_evidence" | "stale";
export type GateEvidenceSourceType = "root-rule" | "project-fact" | "document-status" | "task-receipt" | "command-exit";
export type GateFreshnessRule = "per-task" | "until-source-change" | "until-replaced";
export type GatePhase = "routing-precondition" | "task-completion";

export interface GateRequirement {
  gate_id: string;
  gate_kind: GateKind;
  gate_phase: GatePhase;
  evidence_source_type: GateEvidenceSourceType;
  evidence_ref_hint: string;
  freshness_rule: GateFreshnessRule;
}

export interface GateEvaluation {
  gate_id: string;
  gate_kind: GateKind;
  gate_phase: GatePhase;
  evaluator: "routing" | "task-execution" | "candidate-synthesis" | "promotion" | "drift-scan";
  evidence_source_type: GateEvidenceSourceType;
  evidence_ref: string;
  freshness_rule: GateFreshnessRule;
  state: GateState;
  evaluated_at: string;
  detail: string;
}

export interface ProjectFactRecord {
  fact_id: string;
  title: string;
  fact_type: "module-boundary" | "stable-entrypoint" | "quality-gate" | "data-contract" | "repo-policy";
  summary: string;
  source_doc_paths: string[];
  related_paths: string[];
  constraint_tags: string[];
  required_gates: GateRequirement[];
  watch_paths: string[];
  updated_at: string;
}

export interface ProjectFactSourceSnapshot {
  path: string;
  content_sha256: string;
  observed_at: string;
  derived_fact_ids: string[];
}

export interface ProjectFactSourceState {
  generated_at: string;
  source_docs: ProjectFactSourceSnapshot[];
}

export type DocumentApprovalState = "passed" | "failed" | "missing_evidence" | "authority_conflict";

export interface DocumentApprovalResolution {
  path: string;
  state: DocumentApprovalState;
  evidence_ref: string;
  detail: string;
}

export interface ManualSkillSourceSnapshot {
  path: string;
  content_sha256: string;
  observed_at: string;
  skill_ids: string[];
}

export interface ManualSkillRegistrySourceState {
  generated_at: string;
  source_docs: ManualSkillSourceSnapshot[];
}

export interface ManualSkillMetadata {
  skill_id: string;
  title: string;
  origin: "manual";
  trust_tier: "manual";
  lifecycle_status: "stable" | "paused" | "retired";
  drift_status: "trusted" | "pending_recheck" | "degraded";
  source_doc_path: string;
  source_doc_sha256: string;
  domain: Domain;
  subdomain: Subdomain;
  task_kinds: TaskKind[];
  artifact_types: ArtifactType[];
  target_paths: string[];
  constraint_tags: string[];
  goal_terms: string[];
  required_gates: GateRequirement[];
  parent_skill_id?: string;
  script_refs: string[];
  watch_paths: string[];
  supersedes_learned_skill_ids?: string[];
  last_lifecycle_event_id?: string;
  updated_at: string;
}

export type RouteableSkillMetadata = ManualSkillMetadata | LearnedSkillMetadata;

export interface LearnedSkillMetadata {
  skill_id: string;
  title: string;
  origin: "learned";
  trust_tier: "learned_candidate" | "learned_stable";
  lifecycle_status: "candidate" | "stable" | "paused" | "expired" | "retired";
  drift_status: "trusted" | "pending_recheck" | "degraded";
  domain: Domain;
  subdomain: Subdomain;
  task_kinds: TaskKind[];
  artifact_types: ArtifactType[];
  target_paths: string[];
  constraint_tags: string[];
  goal_terms: string[];
  required_gates: GateRequirement[];
  parent_skill_id?: string;
  source_task_ids: string[];
  source_receipt_paths: string[];
  script_refs: string[];
  watch_paths: string[];
  created_at: string;
  promoted_at?: string;
  promotion_source?: "successful-reuse" | "manual-confirmation";
  promotion_evidence_refs?: string[];
  manual_confirmation_ref?: string;
  last_used_at?: string;
  last_verified_at?: string;
  successful_reuse_count: number;
  failed_reuse_count: number;
  last_lifecycle_event_id: string;
  conflict_with_skill_ids: string[];
  replacement_skill_id?: string;
  retirement_reason?: string;
  demotion_reason?: string;
}

export type ManifestInputKind =
  | "manual-skill-index"
  | "manual-skill-source-state"
  | "manual-skill-source-doc"
  | "project-facts-index"
  | "project-facts-source-state"
  | "learned-skill-json"
  | "learned-skill-markdown";

export interface ManifestInputSnapshot {
  path: string;
  input_kind: ManifestInputKind;
  content_sha256: string;
  observed_at: string;
  skill_id?: string;
}

export type FingerprintField =
  | "domain"
  | "task_kind"
  | "requested_artifact_types"
  | "target_paths"
  | "referenced_specs"
  | "constraint_tags"
  | "goal_terms";

export type FingerprintEvidenceSourceType = "user-request" | "task-title" | "explicit-path" | "quoted-spec-title" | "project-fact";

export interface TaskFingerprintEvidence {
  field: FingerprintField;
  value: string;
  source_type: FingerprintEvidenceSourceType;
  source_ref: string;
  priority: 1 | 2 | 3 | 4;
}

export interface TaskFingerprint {
  domain: Domain | null;
  task_kind: TaskKind | null;
  requested_artifact_types: ArtifactType[];
  target_paths: string[];
  referenced_specs: string[];
  constraint_tags: string[];
  goal_terms: string[];
  resolution_status: "resolved" | "ambiguous" | "underspecified";
  field_evidence: TaskFingerprintEvidence[];
  resolution_notes: string[];
}

export interface BoundGateRequirement {
  gate: GateRequirement;
  source_layer: "project-fact" | "skill-metadata";
  source_ref: string;
}

export type ScoreDimension = "domain" | "task_kind" | "artifact_types" | "target_paths" | "constraint_tags" | "goal_terms" | "recent-success";

export interface SkillRoutingScoreComponent {
  dimension: ScoreDimension;
  points: number;
  evidence: string;
}

export interface SkillRoutingEvaluation {
  skill_id: string;
  score: number;
  score_breakdown: SkillRoutingScoreComponent[];
  effective_routing_gates: BoundGateRequirement[];
  routing_gate_evaluations: GateEvaluation[];
  effective_task_completion_gates: BoundGateRequirement[];
  decision: "primary_match" | "reference_match" | "rejected";
  rejection_reasons: string[];
}

export interface RoutingReceipt {
  task_id: string;
  created_at: string;
  task_fingerprint: TaskFingerprint;
  resolved_project_facts: string[];
  task_routing_gates_evaluated: GateEvaluation[];
  candidate_evaluations: SkillRoutingEvaluation[];
  primary_match: string | null;
  reference_matches: string[];
  rejected_matches: Array<{
    skill_id: string;
    reasons: string[];
  }>;
  decision_reason: string;
}

export interface SkillRoutingIndexEntry {
  skill_id: string;
  trust_tier: "manual" | "learned_stable" | "learned_candidate";
  lifecycle_status: "candidate" | "stable" | "paused" | "expired" | "retired";
  drift_status: "trusted" | "pending_recheck" | "degraded";
  domain: Domain;
  task_kinds: TaskKind[];
  artifact_types: ArtifactType[];
  target_paths: string[];
  constraint_tags: string[];
  goal_terms: string[];
  required_gates: GateRequirement[];
  last_verified_at?: string;
  successful_reuse_count: number;
}

export interface RoutingManifest {
  generated_at: string;
  input_snapshots: ManifestInputSnapshot[];
  routing_index: SkillRoutingIndexEntry[];
  routeable_skill_ids: string[];
}

export type TaskResultReason =
  | "none"
  | "invalid-input"
  | "timeout"
  | "external-failure"
  | "execution-error"
  | "verification-failed"
  | "unresolved-classification"
  | "stale-project-facts"
  | "stale-skill-metadata";

export type TaskClassificationSource =
  | "routing-fingerprint"
  | "post-task-target-path"
  | "post-task-artifact"
  | "post-task-files-touched"
  | "post-task-referenced-spec"
  | "unresolved";

export interface TaskClassificationResolution {
  domain_source: TaskClassificationSource;
  task_kind_source: TaskClassificationSource;
  notes: string[];
}

export type TaskCommandKind = "read-only" | "preflight" | "verification" | "repo-script" | "repo-cli" | "ad-hoc-write" | "external-tool";
export type TaskRuntimeContext = "project-env" | "other" | "unknown";

export interface TaskCommandRecord {
  seq: number;
  command: string;
  kind: TaskCommandKind;
  exit_status: "passed" | "failed";
  runtime_context: TaskRuntimeContext;
  writes_repo_files: boolean;
  touches_outside_repo: boolean;
  uses_checked_in_entrypoint: boolean;
  evidence_ref: string;
}

export type ReusablePathSourceMode = "baseline-task" | "successful-reuse" | "corrected-after-fallback";

export type LearningBlockerReason =
  | "missing-reusable-summary"
  | "reusable-summary-invalid"
  | "unstable-steps"
  | "one-off-dirty-command"
  | "hardcoded-local-environment"
  | "missing-verification-evidence"
  | "conflicts-root-rules"
  | "conflicts-project-facts"
  | "conflicts-approved-specs";

export interface LearningBlocker {
  reason: LearningBlockerReason;
  evidence_refs: string[];
  detail: string;
}

export interface ReusableSummary {
  source_mode: ReusablePathSourceMode;
  source_command_seqs: number[];
  source_reuse_attempt_refs: string[];
  intent: string;
  use_when: string[];
  do_not_use_when: string[];
  inputs_preconditions: string[];
  steps: string[];
  validation: string[];
  failure_signals: string[];
  fallback: string[];
}

export interface VerificationCommandRecord {
  command_seq: number;
  command: string;
  kind: "preflight" | "verification-command";
  status: "passed" | "failed" | "not_run";
  evidence_ref: string;
}

export type TaskSkillUsageOutcome = "successful-reuse" | "corrected-after-fallback" | "failed-reuse";

export interface TaskSkillUsageRecord {
  skill_id: string;
  match_role: "primary" | "reference";
  reuse_receipt_ref: string;
  attempt_seqs: number[];
  outcome: TaskSkillUsageOutcome;
  reexplored_paths: string[];
}

export interface TaskExecutionReceipt {
  task_id: string;
  created_at: string;
  user_request_summary: string;
  domain: Domain | null;
  task_kind: TaskKind | null;
  requested_artifact_types: ArtifactType[];
  target_paths: string[];
  constraint_tags: string[];
  goal_terms: string[];
  referenced_specs: string[];
  commands_executed: TaskCommandRecord[];
  files_touched: string[];
  classification_resolution: TaskClassificationResolution;
  task_completion_gate_requirements: GateRequirement[];
  task_completion_gates_evaluated: GateEvaluation[];
  verification_commands: VerificationCommandRecord[];
  skill_usage: TaskSkillUsageRecord[];
  result: "success" | "partial" | "failed";
  result_reason: TaskResultReason;
  reusable_summary?: ReusableSummary;
  learning_blockers: LearningBlocker[];
  rejected_learning_reasons?: string[];
}

export type ReuseFailureKind =
  | "none"
  | "precondition-check-failed"
  | "execution-failed"
  | "verification-failed"
  | "stale-project-facts"
  | "stale-skill-metadata"
  | "wrong-runtime-context"
  | "missing-task-specific-verification";

export interface SkillReuseAttempt {
  attempt_seq: number;
  attempted_at: string;
  precondition_check: "passed" | "failed";
  execution_result: "success" | "partial" | "failed";
  verification_result: "passed" | "failed" | "not_run";
  fallback_used: boolean;
  failure_stage: "none" | "precondition-check" | "execution" | "verification";
  failure_kind: ReuseFailureKind;
  failure_reason?: string;
  failure_evidence_refs: string[];
  reexplored_paths: string[];
  correction_summary?: string;
}

export interface SkillReuseReceipt {
  task_id: string;
  skill_id: string;
  match_role: "primary" | "reference";
  attempts: SkillReuseAttempt[];
  attempt_count: number;
  last_attempted_at: string;
  precondition_check: "passed" | "failed";
  execution_result: "success" | "partial" | "failed";
  verification_result: "passed" | "failed" | "not_run";
  fallback_used: boolean;
  failure_stage: "none" | "precondition-check" | "execution" | "verification";
  failure_kind: ReuseFailureKind;
  failure_reason?: string;
  failure_evidence_refs: string[];
  reexplored_paths: string[];
  correction_summary?: string;
  successful_attempt_count: number;
  failed_attempt_count: number;
  partial_attempt_count: number;
  last_success_attempt_at?: string;
  last_failure_attempt_at?: string;
  corrected_task_receipt_ref?: string;
}

export type SkillLifecycleEventType =
  | "candidate-created"
  | "promoted"
  | "manually-confirmed"
  | "demoted"
  | "paused"
  | "expired"
  | "retired"
  | "superseded"
  | "conflict-recorded"
  | "revalidated";

export type SkillLifecycleTrigger =
  | "task-success"
  | "successful-reuse"
  | "manual-confirmation"
  | "scheduled-recheck"
  | "event-recheck"
  | "drift-failure"
  | "source-doc-change"
  | "script-missing"
  | "gate-change"
  | "manual-supersession"
  | "inactivity-expiration"
  | "conflict-resolution";

export interface SkillLifecycleEventReceipt {
  event_id: string;
  skill_id: string;
  event_type: SkillLifecycleEventType;
  trigger: SkillLifecycleTrigger;
  created_at: string;
  from_trust_tier?: "manual" | "learned_candidate" | "learned_stable";
  to_trust_tier?: "manual" | "learned_candidate" | "learned_stable";
  from_lifecycle_status?: "candidate" | "stable" | "paused" | "expired" | "retired";
  to_lifecycle_status?: "candidate" | "stable" | "paused" | "expired" | "retired";
  reason: string;
  evidence_refs: string[];
  related_skill_ids: string[];
  gate_evaluations?: GateEvaluation[];
  manual_confirmation_ref?: string;
}
