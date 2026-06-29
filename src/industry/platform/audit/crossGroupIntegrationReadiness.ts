import fs from "node:fs";
import path from "node:path";
import type { AcademicFormalHandoffBundle } from "../contracts/academicHandoff.ts";
import { buildIndustryArtifactRef } from "../contracts/artifactPaths.ts";
import type { FinancePolicyHandoffBundle } from "../contracts/financePolicyHandoff.ts";
import { buildProductEcosystemFormalHandoff } from "../../agents/community-news-agent/formalHandoff.ts";
import { consumeAcademicHandoffForDryRun } from "../normalization/academicDryRun.ts";
import { buildIndustryRuntimeSummaryArtifact, buildProductEcosystemInput } from "../normalization/industryRuntimeSummary.ts";
import {
  assembleProductEcosystemPhase6Inputs,
  type ProductEcosystemPhase6AssemblyResult,
} from "./productEcosystemPhase6Assembly.ts";
import { writeJsonFile } from "../../../storage/files.ts";

type RecordLike = Record<string, unknown>;
type EvalCaseFamily =
  | "positive_canonical_case"
  | "near_boundary_case"
  | "anti_upgrade_case"
  | "coverage_vs_tier_case"
  | "counter_override_case";

export type CrossGroupIntegrationReadiness = {
  artifact_kind: "cross_group_integration_readiness";
  date: string;
  generated_at: string;
  status: "phase3_backlog_ready" | "phase5_internal_weekly_ready" | "blocked";
  ready_group_count: number;
  weekly_output_ready: false;
  blocked_until:
    | "closed_fact_snapshot_and_audit"
    | "tier_decision_and_weekly_packaging"
    | "public_projection_after_evidence_window_recovery";
  daily_pack_v2_ready: boolean;
  rolling_snapshot_ready: boolean;
  daily_pack_v2: {
    schema_version: "daily-industry-evidence-pack.v2";
    date: string;
    source_message_ids: string[];
    input_artifact_refs: string[];
    normalized_event_batch_ref: string;
    rejected_event_batch_ref: string;
    agent_contributions: string[];
    accepted_event_count: number;
    rejected_event_count: number;
    registry_snapshot_ref: string;
    tool_registry_snapshot_ref: string;
    public_projection: "blocked_until_audit";
    cost_and_degradation_summary: string;
    coverage_summary: string;
  };
  rolling_snapshot: {
    snapshot_id: string;
    schema_version: "rolling-evidence-window-snapshot.v1";
    window_end: string;
    carry_forward_horizon_days: 7;
    derived_from_daily_pack_refs: string[];
    derived_from_claim_ledger_refs: string[];
    carry_forward_entries: unknown[];
    expired_entry_ids: string[];
    fact_snapshot_ref: string;
    registry_snapshot_ref: string;
  };
  policy_finance: {
    status: string;
    candidate_pool_ready: boolean;
    negative_reason_code: string;
  };
  academic: {
    status: string;
    formal_handoff_ready: boolean;
    eval_backlog_ready: boolean;
  };
  product_ecosystem: {
    status: string;
    eval_backlog_ready: boolean;
  };
  platform_continuation: {
    can_continue_without_more_academic_inputs: boolean;
    blocked_until:
      | "closed_fact_snapshot_and_audit"
      | "tier_decision_and_weekly_packaging"
      | "public_projection_after_evidence_window_recovery";
    next_required_owner: "executor_4";
  };
  academic_feedback: RecordLike;
  replay_eval_backlog: {
    status: "ready" | "blocked";
    group_count: number;
    policy_finance_fixture_refs: string[];
    academic_fixture_refs: string[];
    product_ecosystem_fixture_refs: string[];
    product_replay_window_ids: string[];
    eval_case_coverage: Array<{
      case_family: EvalCaseFamily;
      status: "ready" | "missing";
      fixture_refs: string[];
      missing_reason_code?: "requires_frozen_eval_case" | "requires_replay_eval_execution";
    }>;
    blocked_eval_case_families: EvalCaseFamily[];
    decision_diff_audit_status: "blocked_pending_profile_change_or_replay_result";
  };
  closed_fact_snapshot_prep: {
    status: "ready_to_start" | "blocked";
    fact_snapshot_ref: string;
    fact_resolution_audit_ref: string;
    input_artifact_refs: string[];
  };
  closed_fact_snapshot: {
    status: "closed" | "blocked";
    snapshot_id: string;
    claim_builder_input_ready: boolean;
    weekly_output_ready: false;
    fact_resolution_audit: {
      audit_id: string;
      schema_version: "fact-resolution-audit.v1";
      snapshot_id: string;
      event_fact_assignments: Array<{
        event_id: string;
        fact_id: string;
        fact_resolution_state: "canonical";
        resolution_basis_codes: string[];
        confidence: "high";
        requires_manual_review: false;
      }>;
      relation_edges: [];
      high_impact_unresolved_groups: [];
    };
  };
  claim_builder: {
    status: "ready" | "blocked";
    candidate_batch: {
      payload_schema: "claim-candidate-batch.v1";
      payload_id: string;
      schema_version: "1.0.0";
      run_id: string;
      window_start: string;
      window_end: string;
      source_message_id: string;
      claim_candidate_batch_ref: string;
      claim_evidence_link_batch_ref: string;
      claim_builder_audit_refs: string[];
      candidate_group_ids: string[];
      input_event_ids: string[];
      generated_claim_ids: string[];
      deferred_event_ids: string[];
      rejected_event_ids: string[];
    };
    evidence_links: Array<{
      link_id: string;
      claim_id: string;
      event_id: string;
      axis: "cross_group";
      role: "supporting";
      dependency_strength: "primary";
      materiality_class: "tier_material";
      is_tier_material: true;
      materiality_reason_codes: string[];
      derived_from_source_polarity_cue: false;
      reason_codes: string[];
      created_by_agent_id: "trend-agent";
      reviewed_by_agent_ids: string[];
    }>;
  };
  counter_evidence_audit: {
    status: "passed" | "blocked";
    audit_request: {
      payload_schema: "audit-request.v1";
      payload_id: string;
      schema_version: "1.0.0";
      run_id: string;
      window_start: string;
      window_end: string;
      source_message_id: string;
      claim_candidate_batch_ref: string;
      claim_evidence_link_batch_ref: string;
      normalized_event_batch_ref: string;
      registry_review_result_refs: string[];
      supporting_event_ids: string[];
      counter_event_ids: string[];
      fact_resolution_audit_ref: string;
      claim_admission_assessment_ref: string;
      runtime_budget_profile_id: string;
      cost_budget_profile_id: string;
      critical_path_class: "same_run";
      estimated_cost_units: number;
    };
    audit_result: {
      payload_schema: "audit-result.v1";
      payload_id: string;
      schema_version: "1.0.0";
      run_id: string;
      window_start: string;
      window_end: string;
      source_message_id: string;
      counter_evidence_audit_ref: string;
      audited_claim_candidate_ids: string[];
      blocking_claim_candidate_ids: string[];
      downgrade_recommendations: [];
      high_impact_unresolved_group_ids: string[];
      actual_latency_ms: number;
    };
    counter_evidence_audit: {
      schema_version: "counter-evidence-audit.v1";
      audited_by_agent_id: "audit-agent";
      audited_at: string;
      audit_mode: "same_run_closed_snapshot";
      audit_priority: "tier_blocking";
      blocking_counter_evidence: [];
      counter_evidence_severity: "none";
      blocking_scopes: [];
      supporting_event_ids_reviewed: string[];
      reviewed_claim_evidence_link_ids: string[];
      unchecked_supporting_event_ids: [];
      sampling_reason_codes: string[];
      counter_event_ids: string[];
      missing_axis_keys: [];
      source_bias_notes: [];
      conflict_groups: [];
      decision_state: "passed" | "blocked";
      contested_by_agent_ids: [];
      escalation_reason_codes: [];
      unresolved_questions: [];
    };
  };
  tier_decision_prep: {
    status: "ready_to_start" | "blocked";
    blocked_until: "tier_decision_and_weekly_packaging";
    missing_required_group_params: string[];
  };
  recent_7d_evidence_window: {
    status: "ok" | "partial" | "missing" | "failed";
    required_dates: string[];
    present_daily_pack_refs: string[];
    missing_daily_pack_dates: string[];
    usable_day_count: number;
    missing_day_count: number;
    recent_3d_usable_day_count: number;
  };
  tier_profile_rules: {
    status: "ready";
    profile_refs: string[];
  };
  decision_context_artifact: {
    status: "ready";
    artifact: {
      context_id: string;
      schema_version: "decision-context-artifact.v1";
      run_id: string;
      claim_id: string;
      candidate_group_id: string;
      claim_candidate_batch_ref: string;
      claim_evidence_link_batch_ref: string;
      merge_audit_ref: string;
      fact_resolution_audit_ref: string;
      registry_review_result_refs: string[];
      audit_result_refs: string[];
      evidence_gap_result_refs: string[];
      tool_coverage_report_refs: string[];
      agent_contribution_refs: string[];
      capacity_reservation_refs: string[];
      missing_context_reason_codes: string[];
      context_snapshot_cutoff_at: string;
    };
  };
  tier_decision_input: {
    status: "ready" | "blocked";
    payload: {
      payload_schema: "trend-decision-input.v1";
      payload_id: string;
      schema_version: "1.0.0";
      run_id: string;
      window_start: string;
      window_end: string;
      source_message_id: string;
      claim_candidate_batch_ref: string;
      claim_evidence_link_batch_ref: string;
      decision_context_artifact_ref: string;
      missing_context_reason_codes: string[];
      project_weekly_artifact_refs: string[];
    };
  };
  weekly_packaging: {
    status: "ready" | "blocked";
    internal_weekly_section: {
      section_id: string;
      schema_version: "weekly-industry-trend-section.v2";
      window_start: string;
      window_end: string;
      evidence_window_status: {
        status: "ok" | "partial" | "missing" | "failed";
        usable_day_count: number;
        missing_day_count: number;
        recent_3d_usable_day_count: number;
        missing_day_dates: string[];
        notes_cn: string[];
      };
      publication_readiness_status: {
        status: "ready" | "partial_blocked" | "blocked";
        blocked_card_count: number;
        blocked_public_artifact_count: number;
        blocking_reason_codes: string[];
        notes_cn: string[];
      };
      governance_load_status: {
        status: "nominal" | "stressed" | "saturated";
        degraded_axis_count: number;
        budget_exceeded_axis_count: number;
        review_backlog_p1_or_higher: number;
      };
      industry_window_status: {
        status: "ok" | "partial" | "missing" | "failed";
        reason_codes: string[];
      };
      run_snapshot: {
        fact_partition_snapshot_refs: string[];
        audit_result_refs: string[];
        publication_cutoff_at: string;
      };
      display_index: {
        headline_core_card_ids: string[];
        provisional_core_watchlist_card_ids: string[];
        needs_review_card_ids: string[];
        blocked_public_output_card_ids: string[];
        suppressed_card_ids: string[];
      };
      lineage_refs: {
        daily_pack_refs: string[];
        rolling_evidence_snapshot_ref: string;
        claim_candidate_batch_ref: string;
        audit_result_refs: string[];
        trend_decision_input_ref: string;
        claim_ledger_refs: string[];
      };
    };
    consumer_view: {
      view_id: string;
      schema_version: "consumer-weekly-industry-view.v1";
      source_weekly_section_ref: string;
      visible_card_ids: string[];
      headline_card_ids: string[];
      watchlist_card_ids: string[];
      needs_review_card_ids: string[];
      hidden_card_ids: string[];
      ordering_basis: string[];
      card_projection_refs: string[];
      blocked_reason_codes: string[];
    };
    public_projection: {
      projection_id: string;
      schema_version: "public-weekly-industry-projection.v1";
      source_weekly_section_ref: string;
      headline_core_card_ids: string[];
      tier_visible_card_ids: string[];
      redacted_card_ids: string[];
      blocked_card_ids: string[];
      public_card_projection_refs: string[];
      blocked_reason_codes: string[];
    };
  };
  next_platform_actions: string[];
  reject_list: Array<{
    group: "policy_finance" | "academic" | "product_ecosystem";
    field: string;
    reason_code: string;
  }>;
};

export function buildCrossGroupIntegrationReadiness(input: {
  date: string;
  generatedAt: string;
  rootDir?: string;
  academic: {
    bundle: unknown;
    deliveryManifest: RecordLike;
    nextActions: RecordLike;
  };
  productEcosystem: {
    deliveryManifest: RecordLike;
    replayRefs: RecordLike;
  };
}): CrossGroupIntegrationReadiness {
  const rootDir = input.rootDir ?? process.cwd();
  const runtimeSummary = buildIndustryRuntimeSummaryArtifact({
    date: input.date,
    generatedAt: input.generatedAt,
    rootDir,
  });
  const academic = consumeAcademicHandoffForDryRun({ bundle: input.academic.bundle as AcademicFormalHandoffBundle });
  const product = assembleProductEcosystemPhase6Inputs({
    deliveryManifest: input.productEcosystem.deliveryManifest,
    replayRefs: input.productEcosystem.replayRefs,
    rootDir,
  });
  const dailyPack = buildDailyPackV2(input.date, input.generatedAt, runtimeSummary, academic);
  const rollingSnapshot = buildRollingSnapshot(input.date, dailyPack);
  const academicFixtureRefs = academicReplayEvalRefs(input.academic.deliveryManifest);

  const reject_list = [
    ...(runtimeSummary.policy_finance.status === "policy_finance_runtime_ready"
      ? []
      : [{ group: "policy_finance" as const, field: "policy_finance.status", reason_code: runtimeSummary.policy_finance.status }]),
    ...(academic.ok
      ? []
      : [{ group: "academic" as const, field: "academic.formal_handoff", reason_code: academic.reasonCode }]),
    ...(product.ok
      ? []
      : [{ group: "product_ecosystem" as const, field: "product_ecosystem.phase6", reason_code: product.reasonCode }]),
  ];
  const closedFactSnapshot = buildClosedFactSnapshot(input.date, rootDir, input.academic.bundle, reject_list.length === 0);
  const claimBuilder = buildClaimBuilder(input.date, closedFactSnapshot);
  const counterEvidenceAudit = buildCounterEvidenceAudit(input.date, dailyPack, closedFactSnapshot, claimBuilder);
  const tierProfileRules = buildTierProfileRules();
  const recent7dEvidenceWindow = buildRecent7dEvidenceWindow(input.date, dailyPack, rootDir);
  const tierDecisionPrep = buildTierDecisionPrep(claimBuilder, counterEvidenceAudit, recent7dEvidenceWindow);
  const decisionContextArtifact = buildDecisionContextArtifact(input.date, dailyPack, closedFactSnapshot, claimBuilder, counterEvidenceAudit, tierDecisionPrep);
  const tierDecisionInput = buildTierDecisionInput(input.date, claimBuilder, decisionContextArtifact, tierDecisionPrep);
  const weeklyPackaging = buildWeeklyPackaging(input.date, dailyPack, rollingSnapshot, claimBuilder, counterEvidenceAudit, tierDecisionInput, recent7dEvidenceWindow);
  const replayEvalBacklog = buildReplayEvalBacklog({
    academicOk: academic.ok,
    academicFixtureRefs,
    policyFinanceReady: runtimeSummary.policy_finance.status === "policy_finance_runtime_ready",
    product,
  });
  const blockedUntil =
    weeklyPackaging.public_projection.blocked_reason_codes.length > 0
      ? "public_projection_after_evidence_window_recovery"
      : "tier_decision_and_weekly_packaging";

  return {
    artifact_kind: "cross_group_integration_readiness",
    date: input.date,
    generated_at: input.generatedAt,
    status: reject_list.length ? "blocked" : tierDecisionInput.status === "ready" ? "phase5_internal_weekly_ready" : "phase3_backlog_ready",
    ready_group_count: [
      runtimeSummary.policy_finance.status === "policy_finance_runtime_ready",
      academic.ok,
      product.ok,
    ].filter(Boolean).length,
    weekly_output_ready: false,
    blocked_until: blockedUntil,
    daily_pack_v2_ready: true,
    rolling_snapshot_ready: true,
    daily_pack_v2: dailyPack,
    rolling_snapshot: rollingSnapshot,
    policy_finance: {
      status: runtimeSummary.policy_finance.status,
      candidate_pool_ready: runtimeSummary.policy_finance.status === "policy_finance_runtime_ready",
      negative_reason_code: runtimeSummary.policy_finance.negative_reason_code,
    },
    academic: {
      status: academic.ok ? academic.status : academic.reasonCode,
      formal_handoff_ready:
        input.academic.nextActions.status === "academic_formal_handoff_ready" &&
        input.academic.deliveryManifest.academic_inputs_complete_for_executor_4 === true,
      eval_backlog_ready: academic.ok,
    },
    product_ecosystem: {
      status: product.ok ? product.status : product.reasonCode,
      eval_backlog_ready: product.ok,
    },
    platform_continuation: {
      can_continue_without_more_academic_inputs:
        academic.ok &&
        input.academic.nextActions.executor_4_can_continue_phase2_partial_without_more_academic_inputs === true,
      blocked_until: blockedUntil,
      next_required_owner: "executor_4",
    },
    academic_feedback: academic.feedbackPayload,
    replay_eval_backlog: replayEvalBacklog,
    closed_fact_snapshot_prep: buildClosedFactSnapshotPrep(input.date, academic.feedbackPayload, dailyPack, reject_list.length === 0),
    closed_fact_snapshot: closedFactSnapshot,
    claim_builder: claimBuilder,
    counter_evidence_audit: counterEvidenceAudit,
    tier_decision_prep: tierDecisionPrep,
    recent_7d_evidence_window: recent7dEvidenceWindow,
    tier_profile_rules: tierProfileRules,
    decision_context_artifact: decisionContextArtifact,
    tier_decision_input: tierDecisionInput,
    weekly_packaging: weeklyPackaging,
    next_platform_actions: nextPlatformActions(product, closedFactSnapshot, tierDecisionPrep, recent7dEvidenceWindow),
    reject_list,
  };
}

export function materializeCrossGroupIntegrationArtifacts(input: {
  rootDir: string;
  artifact: CrossGroupIntegrationReadiness;
  dryRun?: boolean;
}): {
  dailyPack: { artifactRef: string; storagePath: string };
  rollingSnapshot: { artifactRef: string; storagePath: string };
} {
  const dailyPack = buildIndustryArtifactRef({
    visibility: "internal",
    date: input.artifact.date,
    schemaId: "daily-industry-evidence-pack.v2",
    artifactId: "pack-001",
  });
  const rollingSnapshot = buildIndustryArtifactRef({
    visibility: "internal",
    date: input.artifact.date,
    schemaId: "rolling-evidence-window-snapshot.v1",
    artifactId: "snapshot-001",
  });

  writeJsonFile(path.join(input.rootDir, dailyPack.storagePath), input.artifact.daily_pack_v2, input.dryRun);
  writeJsonFile(path.join(input.rootDir, rollingSnapshot.storagePath), input.artifact.rolling_snapshot, input.dryRun);

  return { dailyPack, rollingSnapshot };
}

function academicReplayEvalRefs(deliveryManifest: RecordLike): string[] {
  const supporting = record(deliveryManifest.supporting_fixture_refs);
  return [
    ...strings(supporting.positive_canonical),
    ...strings(supporting.near_boundary),
    ...strings(supporting.replay_window),
    ...strings(supporting.eval),
    ...strings(supporting.owner_boundary),
  ];
}

const POLICY_FINANCE_FIXTURE_REFS = [
  "fixtures/industry/agents/policy-agent/replay/phase1-current-bundle.json",
  "fixtures/industry/agents/policy-agent/replay/phase1-missing-stable-claim-key-bundle.json",
  "fixtures/industry/agents/policy-agent/compatibility/same-run-current-consumer.json",
  "fixtures/industry/agents/policy-agent/compatibility/same-run-missing-stable-claim-key-negative.json",
  "fixtures/industry/agents/policy-agent/replay/phase1-runtime-ready-inputs.json",
  "fixtures/industry/platform/current-consumer/phase1-runtime.json",
  "fixtures/industry/platform/negative/phase1-runtime.json",
];

function productReplayEvalRefs(product: ProductEcosystemPhase6AssemblyResult): string[] {
  return product.ok ? [...new Set([...product.supportingFixtureRefs, ...product.replayFixtureRefs])] : [];
}

function buildReplayEvalBacklog(input: {
  academicOk: boolean;
  academicFixtureRefs: string[];
  policyFinanceReady: boolean;
  product: ProductEcosystemPhase6AssemblyResult;
}): CrossGroupIntegrationReadiness["replay_eval_backlog"] {
  const policyFixtureRefs = unique(POLICY_FINANCE_FIXTURE_REFS);
  const productFixtureRefs = productReplayEvalRefs(input.product);
  const groupsReady = [
    input.academicOk && input.academicFixtureRefs.length > 0,
    input.policyFinanceReady && policyFixtureRefs.length > 0,
    input.product.ok && productFixtureRefs.length > 0,
  ];

  return {
    status: groupsReady.every(Boolean) ? "ready" : "blocked",
    group_count: groupsReady.filter(Boolean).length,
    policy_finance_fixture_refs: policyFixtureRefs,
    academic_fixture_refs: input.academicFixtureRefs,
    product_ecosystem_fixture_refs: productFixtureRefs,
    product_replay_window_ids: input.product.ok ? input.product.replayWindowIds : [],
    eval_case_coverage: buildEvalCaseCoverage(input.academicFixtureRefs, policyFixtureRefs, productFixtureRefs),
    blocked_eval_case_families: ["coverage_vs_tier_case", "counter_override_case"],
    decision_diff_audit_status: "blocked_pending_profile_change_or_replay_result",
  };
}

function buildEvalCaseCoverage(
  academicFixtureRefs: string[],
  policyFixtureRefs: string[],
  productFixtureRefs: string[],
): CrossGroupIntegrationReadiness["replay_eval_backlog"]["eval_case_coverage"] {
  const allRefs = [...academicFixtureRefs, ...policyFixtureRefs, ...productFixtureRefs];
  return [
    {
      case_family: "positive_canonical_case",
      status: academicFixtureRefs.some((ref) => ref.includes("positive-canonical")) ? "ready" : "missing",
      fixture_refs: academicFixtureRefs.filter((ref) => ref.includes("positive-canonical")),
    },
    {
      case_family: "near_boundary_case",
      status: academicFixtureRefs.some((ref) => ref.includes("near-boundary")) ? "ready" : "missing",
      fixture_refs: academicFixtureRefs.filter((ref) => ref.includes("near-boundary")),
    },
    {
      case_family: "anti_upgrade_case",
      status: allRefs.some((ref) => ref.includes("anti-upgrade")) ? "ready" : "missing",
      fixture_refs: allRefs.filter((ref) => ref.includes("anti-upgrade")),
    },
    {
      case_family: "coverage_vs_tier_case",
      status: "missing",
      fixture_refs: [],
      missing_reason_code: "requires_frozen_eval_case",
    },
    {
      case_family: "counter_override_case",
      status: "missing",
      fixture_refs: [],
      missing_reason_code: "requires_replay_eval_execution",
    },
  ];
}

function nextPlatformActions(
  product: ProductEcosystemPhase6AssemblyResult,
  closedFactSnapshot: CrossGroupIntegrationReadiness["closed_fact_snapshot"],
  tierDecisionPrep: CrossGroupIntegrationReadiness["tier_decision_prep"],
  recent7dEvidenceWindow: CrossGroupIntegrationReadiness["recent_7d_evidence_window"],
): string[] {
  if (tierDecisionPrep.status === "ready_to_start") {
    return recent7dEvidenceWindow.status === "ok"
      ? ["run_tier_decision_and_weekly_packaging"]
      : ["recover_recent_7d_daily_pack_refs_for_public_projection"];
  }
  if (closedFactSnapshot.status === "closed" && tierDecisionPrep.missing_required_group_params.length > 0) {
    return [
      ...(tierDecisionPrep.missing_required_group_params.includes("decision-context-artifact.v1")
        ? ["materialize_decision_context_artifact"]
        : []),
      ...(tierDecisionPrep.missing_required_group_params.includes("recent_7d_daily_pack_refs")
        ? ["provide_recent_7d_daily_pack_refs"]
        : []),
      ...(tierDecisionPrep.missing_required_group_params.some((param) => param.endsWith("/rules_ref"))
        ? ["publish_tier_decision_profile_rules"]
        : []),
    ];
  }
  return [
    ...(product.ok ? ["run_cross_group_replay_eval_diff_audit"] : []),
    ...(closedFactSnapshot.status === "closed"
      ? ["run_claim_builder_from_closed_fact_snapshot", "run_counter_evidence_audit_before_tier_decision"]
      : ["start_closed_fact_snapshot"]),
  ];
}

function buildDailyPackV2(
  date: string,
  generatedAt: string,
  runtimeSummary: ReturnType<typeof buildIndustryRuntimeSummaryArtifact>,
  academic: ReturnType<typeof consumeAcademicHandoffForDryRun>,
): CrossGroupIntegrationReadiness["daily_pack_v2"] {
  const academicRefs = academic.ok
    ? [
        ...academic.normalizedEventBatchRefs,
        ...academic.rejectedEventBatchRefs,
        ...academic.coverageRefs,
        ...academic.contributionRefs,
      ]
    : [];
  return {
    schema_version: "daily-industry-evidence-pack.v2",
    date,
    source_message_ids: [
      `industry://internal/${date}/policy-finance-runtime-replay`,
      ...(academic.ok ? [academic.feedbackPayload.source_message_id] : []),
      `industry://internal/${date}/product-ecosystem-phase6-replay-refs`,
    ],
    input_artifact_refs: [
      `data/reports/${date}.policy-finance-runtime-replay.json`,
      `data/reports/${date}.industry-runtime-summary.json`,
      ...academicRefs,
    ],
    normalized_event_batch_ref: `industry://internal/${date}/daily-industry-evidence-pack.v2/normalized-ref-index`,
    rejected_event_batch_ref: `industry://internal/${date}/daily-industry-evidence-pack.v2/rejected-ref-index`,
    agent_contributions: academic.ok ? academic.contributionRefs : [],
    accepted_event_count: runtimeSummary.policy_finance.runtime_consumed_same_run_messages + (academic.ok ? academic.normalizedEventBatchRefs.length : 0),
    rejected_event_count: academic.ok ? academic.rejectedEventBatchRefs.length : 0,
    registry_snapshot_ref: runtimeSummary.platform_contract.fixture_id,
    tool_registry_snapshot_ref: "industry://internal/tool-registry/cross-group-ready",
    public_projection: "blocked_until_audit",
    cost_and_degradation_summary: "ref-only aggregation; no final weekly output",
    coverage_summary: "policy-finance runtime ready; academic formal dry-run ready; product ecosystem phase6 backlog ready",
  };
}

function buildRollingSnapshot(
  date: string,
  dailyPack: CrossGroupIntegrationReadiness["daily_pack_v2"],
): CrossGroupIntegrationReadiness["rolling_snapshot"] {
  return {
    snapshot_id: `rolling-evidence-window-${date}`,
    schema_version: "rolling-evidence-window-snapshot.v1",
    window_end: `${date}T23:59:59+08:00`,
    carry_forward_horizon_days: 7,
    derived_from_daily_pack_refs: [`industry://internal/${date}/daily-industry-evidence-pack.v2/ref-only`],
    derived_from_claim_ledger_refs: [],
    carry_forward_entries: [],
    expired_entry_ids: [],
    fact_snapshot_ref: "blocked_until_closed_fact_snapshot",
    registry_snapshot_ref: dailyPack.registry_snapshot_ref,
  };
}

function buildClosedFactSnapshotPrep(
  date: string,
  academicFeedback: RecordLike,
  dailyPack: CrossGroupIntegrationReadiness["daily_pack_v2"],
  ready: boolean,
): CrossGroupIntegrationReadiness["closed_fact_snapshot_prep"] {
  return {
    status: ready ? "ready_to_start" : "blocked",
    fact_snapshot_ref: `industry://internal/${date}/fact-snapshot.v1/pending`,
    fact_resolution_audit_ref:
      text(academicFeedback.fact_resolution_audit_ref) || `industry://internal/${date}/fact-resolution-audit.v1/pending`,
    input_artifact_refs: dailyPack.input_artifact_refs,
  };
}

function buildClosedFactSnapshot(
  date: string,
  rootDir: string,
  academicBundle: unknown,
  ready: boolean,
): CrossGroupIntegrationReadiness["closed_fact_snapshot"] {
  const snapshotId = `fact-snapshot-${date}`;
  const policyBundle = readJson<FinancePolicyHandoffBundle>(rootDir, POLICY_FINANCE_FIXTURE_REFS[0]!);
  const productBundle = buildProductEcosystemFormalHandoff(buildProductEcosystemInput()).bundle;
  const assignments = ready
    ? [
        ...factAssignmentsFromBundle(policyBundle, "policy_finance_runtime_ready"),
        ...factAssignmentsFromBundle(academicBundle, "academic_formal_handoff"),
        ...factAssignmentsFromBundle(productBundle, "product_ecosystem_phase6_inputs_accepted"),
      ]
    : [];

  return {
    status: ready && assignments.length > 0 ? "closed" : "blocked",
    snapshot_id: snapshotId,
    claim_builder_input_ready: ready && assignments.length > 0,
    weekly_output_ready: false,
    fact_resolution_audit: {
      audit_id: `fact-resolution-audit-${date}`,
      schema_version: "fact-resolution-audit.v1",
      snapshot_id: snapshotId,
      event_fact_assignments: assignments,
      relation_edges: [],
      high_impact_unresolved_groups: [],
    },
  };
}

function buildClaimBuilder(
  date: string,
  closedFactSnapshot: CrossGroupIntegrationReadiness["closed_fact_snapshot"],
): CrossGroupIntegrationReadiness["claim_builder"] {
  const assignments = closedFactSnapshot.fact_resolution_audit.event_fact_assignments;
  const inputEventIds = assignments.map((assignment) => assignment.event_id);
  const generatedClaimIds = inputEventIds.map((eventId) => `claim-${eventId}`);
  return {
    status: closedFactSnapshot.claim_builder_input_ready ? "ready" : "blocked",
    candidate_batch: {
      payload_schema: "claim-candidate-batch.v1",
      payload_id: `claim-candidate-batch-${date}`,
      schema_version: "1.0.0",
      run_id: `cross-group-${date}`,
      window_start: `${date}T00:00:00+08:00`,
      window_end: `${date}T23:59:59+08:00`,
      source_message_id: `industry://internal/${date}/fact-snapshot.v1/${closedFactSnapshot.snapshot_id}`,
      claim_candidate_batch_ref: `industry://internal/${date}/claim-candidate-batch.v1/cross-group`,
      claim_evidence_link_batch_ref: `industry://internal/${date}/industry-claim-evidence-link.v1/cross-group`,
      claim_builder_audit_refs: [closedFactSnapshot.fact_resolution_audit.audit_id],
      candidate_group_ids: inputEventIds.map((eventId) => `candidate-group-${eventId}`),
      input_event_ids: inputEventIds,
      generated_claim_ids: generatedClaimIds,
      deferred_event_ids: [],
      rejected_event_ids: [],
    },
    evidence_links: inputEventIds.map((eventId) => ({
      link_id: `link-${eventId}`,
      claim_id: `claim-${eventId}`,
      event_id: eventId,
      axis: "cross_group",
      role: "supporting",
      dependency_strength: "primary",
      materiality_class: "tier_material",
      is_tier_material: true,
      materiality_reason_codes: ["closed_fact_snapshot"],
      derived_from_source_polarity_cue: false,
      reason_codes: ["accepted_event"],
      created_by_agent_id: "trend-agent",
      reviewed_by_agent_ids: ["audit-agent"],
    })),
  };
}

function buildCounterEvidenceAudit(
  date: string,
  dailyPack: CrossGroupIntegrationReadiness["daily_pack_v2"],
  closedFactSnapshot: CrossGroupIntegrationReadiness["closed_fact_snapshot"],
  claimBuilder: CrossGroupIntegrationReadiness["claim_builder"],
): CrossGroupIntegrationReadiness["counter_evidence_audit"] {
  const supportingEventIds = claimBuilder.candidate_batch.input_event_ids;
  const claimIds = claimBuilder.candidate_batch.generated_claim_ids;
  const evidenceLinkIds = claimBuilder.evidence_links.map((link) => link.link_id);
  const status = claimBuilder.status === "ready" ? "passed" : "blocked";
  return {
    status,
    audit_request: {
      payload_schema: "audit-request.v1",
      payload_id: `audit-request-${date}`,
      schema_version: "1.0.0",
      run_id: `cross-group-${date}`,
      window_start: `${date}T00:00:00+08:00`,
      window_end: `${date}T23:59:59+08:00`,
      source_message_id: `industry://internal/${date}/claim-candidate-batch.v1/cross-group#message`,
      claim_candidate_batch_ref: claimBuilder.candidate_batch.claim_candidate_batch_ref,
      claim_evidence_link_batch_ref: claimBuilder.candidate_batch.claim_evidence_link_batch_ref,
      normalized_event_batch_ref: dailyPack.normalized_event_batch_ref,
      registry_review_result_refs: [dailyPack.registry_snapshot_ref, dailyPack.tool_registry_snapshot_ref],
      supporting_event_ids: supportingEventIds,
      counter_event_ids: [],
      fact_resolution_audit_ref: closedFactSnapshot.fact_resolution_audit.audit_id,
      claim_admission_assessment_ref: `industry://internal/${date}/claim-admission-assessment.v1/cross-group`,
      runtime_budget_profile_id: "claim-runtime-budget-profile.v1/cross-group",
      cost_budget_profile_id: "claim-admission-budget-profile.v1/cross-group",
      critical_path_class: "same_run",
      estimated_cost_units: supportingEventIds.length,
    },
    audit_result: {
      payload_schema: "audit-result.v1",
      payload_id: `audit-result-${date}`,
      schema_version: "1.0.0",
      run_id: `cross-group-${date}`,
      window_start: `${date}T00:00:00+08:00`,
      window_end: `${date}T23:59:59+08:00`,
      source_message_id: `industry://internal/${date}/audit-request.v1/cross-group#message`,
      counter_evidence_audit_ref: `industry://internal/${date}/counter-evidence-audit.v1/cross-group`,
      audited_claim_candidate_ids: claimIds,
      blocking_claim_candidate_ids: [],
      downgrade_recommendations: [],
      high_impact_unresolved_group_ids: [],
      actual_latency_ms: 0,
    },
    counter_evidence_audit: {
      schema_version: "counter-evidence-audit.v1",
      audited_by_agent_id: "audit-agent",
      audited_at: `${date}T23:59:59+08:00`,
      audit_mode: "same_run_closed_snapshot",
      audit_priority: "tier_blocking",
      blocking_counter_evidence: [],
      counter_evidence_severity: "none",
      blocking_scopes: [],
      supporting_event_ids_reviewed: supportingEventIds,
      reviewed_claim_evidence_link_ids: evidenceLinkIds,
      unchecked_supporting_event_ids: [],
      sampling_reason_codes: ["full_closed_snapshot"],
      counter_event_ids: [],
      missing_axis_keys: [],
      source_bias_notes: [],
      conflict_groups: [],
      decision_state: status,
      contested_by_agent_ids: [],
      escalation_reason_codes: [],
      unresolved_questions: [],
    },
  };
}

function buildTierDecisionPrep(
  claimBuilder: CrossGroupIntegrationReadiness["claim_builder"],
  counterEvidenceAudit: CrossGroupIntegrationReadiness["counter_evidence_audit"],
  recent7dEvidenceWindow: CrossGroupIntegrationReadiness["recent_7d_evidence_window"],
): CrossGroupIntegrationReadiness["tier_decision_prep"] {
  const missing = [
    ...(claimBuilder.status === "ready" ? [] : ["claim_builder"]),
    ...(counterEvidenceAudit.status === "passed" ? [] : ["counter_evidence_audit"]),
    ...(recent7dEvidenceWindow.status === "failed" ? ["recent_7d_daily_pack_refs"] : []),
  ];
  return {
    status: missing.length ? "blocked" : "ready_to_start",
    blocked_until: "tier_decision_and_weekly_packaging",
    missing_required_group_params: missing,
  };
}

function buildRecent7dEvidenceWindow(
  date: string,
  dailyPack: CrossGroupIntegrationReadiness["daily_pack_v2"],
  rootDir: string,
): CrossGroupIntegrationReadiness["recent_7d_evidence_window"] {
  const requiredDates = previousDates(date, 6);
  const discoveredRefs = new Map(
    requiredDates.flatMap((day) => discoverDailyEvidencePackRefs(rootDir, day).map((ref) => [day, ref] as const)),
  );
  discoveredRefs.set(dailyPack.date, discoveredRefs.get(dailyPack.date) ?? `industry://internal/${date}/daily-industry-evidence-pack.v2/ref-only`);
  const missingDates = requiredDates.filter((day) => !discoveredRefs.has(day));
  const presentRefs = requiredDates.flatMap((day) => {
    const ref = discoveredRefs.get(day);
    return ref ? [ref] : [];
  });
  const recent3dDates = requiredDates.slice(-3);
  const recent3dUsableDayCount = recent3dDates.filter((day) => discoveredRefs.has(day)).length;
  const usableDayCount = presentRefs.length;
  return {
    status:
      usableDayCount >= 5 && recent3dUsableDayCount >= 2
        ? "ok"
        : usableDayCount >= 3 || recent3dUsableDayCount >= 2
          ? "partial"
          : "missing",
    required_dates: requiredDates,
    present_daily_pack_refs: presentRefs,
    missing_daily_pack_dates: missingDates,
    usable_day_count: usableDayCount,
    missing_day_count: missingDates.length,
    recent_3d_usable_day_count: recent3dUsableDayCount,
  };
}

function discoverDailyEvidencePackRefs(rootDir: string, date: string): string[] {
  const dir = path.join(rootDir, "data", "industry", "internal", date, "daily-industry-evidence-pack.v2");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((entry) => entry.endsWith(".json"))
    .flatMap((entry) => {
      const pack = JSON.parse(fs.readFileSync(path.join(dir, entry), "utf8")) as RecordLike;
      return pack.schema_version === "daily-industry-evidence-pack.v2" && pack.date === date
        ? [`industry://internal/${date}/daily-industry-evidence-pack.v2/${path.basename(entry, ".json")}`]
        : [];
    })
    .sort();
}

function buildTierProfileRules(): CrossGroupIntegrationReadiness["tier_profile_rules"] {
  return {
    status: "ready",
    profile_refs: [
      "docs/specs/design-docs/行业级Agent趋势判断设计/04-评分裁决与证据归一.md#claim-archetype-decision-profile.v1",
      "docs/specs/design-docs/行业级Agent趋势判断设计/03-数据模型契约.md#axis-status-threshold-profile.v1",
      "docs/specs/design-docs/行业级Agent趋势判断设计/04-评分裁决与证据归一.md#independence-credit-profile.v1",
    ],
  };
}

function previousDates(date: string, daysBefore: number): string[] {
  const end = new Date(`${date}T00:00:00.000Z`);
  return Array.from({ length: daysBefore + 1 }, (_, index) => {
    const day = new Date(end);
    day.setUTCDate(end.getUTCDate() - daysBefore + index);
    return day.toISOString().slice(0, 10);
  });
}

function buildTierDecisionInput(
  date: string,
  claimBuilder: CrossGroupIntegrationReadiness["claim_builder"],
  decisionContextArtifact: CrossGroupIntegrationReadiness["decision_context_artifact"],
  tierDecisionPrep: CrossGroupIntegrationReadiness["tier_decision_prep"],
): CrossGroupIntegrationReadiness["tier_decision_input"] {
  return {
    status: tierDecisionPrep.status === "blocked" ? "blocked" : "ready",
    payload: {
      payload_schema: "trend-decision-input.v1",
      payload_id: `trend-decision-input-${date}`,
      schema_version: "1.0.0",
      run_id: `cross-group-${date}`,
      window_start: `${date}T00:00:00+08:00`,
      window_end: `${date}T23:59:59+08:00`,
      source_message_id: `industry://internal/${date}/audit-result.v1/cross-group#message`,
      claim_candidate_batch_ref: claimBuilder.candidate_batch.claim_candidate_batch_ref,
      claim_evidence_link_batch_ref: claimBuilder.candidate_batch.claim_evidence_link_batch_ref,
      decision_context_artifact_ref: `industry://internal/${date}/decision-context-artifact.v1/${decisionContextArtifact.artifact.context_id}`,
      missing_context_reason_codes: tierDecisionPrep.missing_required_group_params.map(missingContextReasonCode),
      project_weekly_artifact_refs: [],
    },
  };
}

function buildDecisionContextArtifact(
  date: string,
  dailyPack: CrossGroupIntegrationReadiness["daily_pack_v2"],
  closedFactSnapshot: CrossGroupIntegrationReadiness["closed_fact_snapshot"],
  claimBuilder: CrossGroupIntegrationReadiness["claim_builder"],
  counterEvidenceAudit: CrossGroupIntegrationReadiness["counter_evidence_audit"],
  tierDecisionPrep: CrossGroupIntegrationReadiness["tier_decision_prep"],
): CrossGroupIntegrationReadiness["decision_context_artifact"] {
  return {
    status: "ready",
    artifact: {
      context_id: `decision-context-${date}`,
      schema_version: "decision-context-artifact.v1",
      run_id: `cross-group-${date}`,
      claim_id: claimBuilder.candidate_batch.generated_claim_ids[0] ?? "claim-none",
      candidate_group_id: claimBuilder.candidate_batch.candidate_group_ids[0] ?? "candidate-group-none",
      claim_candidate_batch_ref: claimBuilder.candidate_batch.claim_candidate_batch_ref,
      claim_evidence_link_batch_ref: claimBuilder.candidate_batch.claim_evidence_link_batch_ref,
      merge_audit_ref: `industry://internal/${date}/industry-merge-audit.v1/not-materialized`,
      fact_resolution_audit_ref: closedFactSnapshot.fact_resolution_audit.audit_id,
      registry_review_result_refs: [dailyPack.registry_snapshot_ref, dailyPack.tool_registry_snapshot_ref],
      audit_result_refs: [counterEvidenceAudit.audit_result.payload_id],
      evidence_gap_result_refs: [],
      tool_coverage_report_refs: [],
      agent_contribution_refs: dailyPack.agent_contributions,
      capacity_reservation_refs: [],
      missing_context_reason_codes: tierDecisionPrep.missing_required_group_params.map(missingContextReasonCode),
      context_snapshot_cutoff_at: `${date}T23:59:59+08:00`,
    },
  };
}

function buildWeeklyPackaging(
  date: string,
  dailyPack: CrossGroupIntegrationReadiness["daily_pack_v2"],
  rollingSnapshot: CrossGroupIntegrationReadiness["rolling_snapshot"],
  claimBuilder: CrossGroupIntegrationReadiness["claim_builder"],
  counterEvidenceAudit: CrossGroupIntegrationReadiness["counter_evidence_audit"],
  tierDecisionInput: CrossGroupIntegrationReadiness["tier_decision_input"],
  recent7dEvidenceWindow: CrossGroupIntegrationReadiness["recent_7d_evidence_window"],
): CrossGroupIntegrationReadiness["weekly_packaging"] {
  const candidateCardIds = claimBuilder.candidate_batch.generated_claim_ids.map((claimId) => `card-${claimId}`);
  const evidenceWindowBlocksPublic = recent7dEvidenceWindow.status !== "ok";
  const blockedCardIds = evidenceWindowBlocksPublic ? candidateCardIds : [];
  const weeklySectionRef = `industry://internal/${date}/weekly-industry-trend-section.v2/cross-group`;
  const evidenceWindowReason =
    recent7dEvidenceWindow.status === "ok" ? [] : [`evidence_window_${recent7dEvidenceWindow.status}`];
  const publicBlockReasons = evidenceWindowBlocksPublic ? ["public_blocked_until_evidence_window_recovery"] : [];
  return {
    status: tierDecisionInput.status === "ready" ? "ready" : "blocked",
    internal_weekly_section: {
      section_id: `weekly-industry-trend-section-${date}`,
      schema_version: "weekly-industry-trend-section.v2",
      window_start: `${date}T00:00:00+08:00`,
      window_end: `${date}T23:59:59+08:00`,
      evidence_window_status: {
        status: recent7dEvidenceWindow.status,
        usable_day_count: recent7dEvidenceWindow.usable_day_count,
        missing_day_count: recent7dEvidenceWindow.missing_day_count,
        recent_3d_usable_day_count: recent7dEvidenceWindow.recent_3d_usable_day_count,
        missing_day_dates: recent7dEvidenceWindow.missing_daily_pack_dates,
        notes_cn:
          recent7dEvidenceWindow.status === "ok"
            ? []
            : ["daily industry pack 缺失不阻断 internal weekly；public projection 保持阻断直到证据窗口恢复。"],
      },
      publication_readiness_status: {
        status: evidenceWindowBlocksPublic ? "blocked" : "ready",
        blocked_card_count: blockedCardIds.length,
        blocked_public_artifact_count: evidenceWindowBlocksPublic ? 1 : 0,
        blocking_reason_codes: evidenceWindowBlocksPublic ? ["missing_recent_7d_evidence_window"] : [],
        notes_cn: evidenceWindowBlocksPublic
          ? ["internal tier input is ready; public weekly projection remains blocked by the missing evidence window."]
          : [],
      },
      governance_load_status: {
        status: "nominal",
        degraded_axis_count: 0,
        budget_exceeded_axis_count: 0,
        review_backlog_p1_or_higher: 0,
      },
      industry_window_status: {
        status: recent7dEvidenceWindow.status,
        reason_codes: evidenceWindowReason,
      },
      run_snapshot: {
        fact_partition_snapshot_refs: [`industry://internal/${date}/fact-snapshot.v1/fact-snapshot-${date}`],
        audit_result_refs: [counterEvidenceAudit.audit_result.payload_id],
        publication_cutoff_at: `${date}T23:59:59+08:00`,
      },
      display_index: {
        headline_core_card_ids: [],
        provisional_core_watchlist_card_ids: [],
        needs_review_card_ids: [],
        blocked_public_output_card_ids: blockedCardIds,
        suppressed_card_ids: [],
      },
      lineage_refs: {
        daily_pack_refs: [`industry://internal/${date}/daily-industry-evidence-pack.v2/ref-only`],
        rolling_evidence_snapshot_ref: rollingSnapshot.snapshot_id,
        claim_candidate_batch_ref: claimBuilder.candidate_batch.claim_candidate_batch_ref,
        audit_result_refs: [counterEvidenceAudit.audit_result.payload_id],
        trend_decision_input_ref: tierDecisionInput.payload.payload_id,
        claim_ledger_refs: [],
      },
    },
    consumer_view: {
      view_id: `consumer-weekly-industry-view-${date}`,
      schema_version: "consumer-weekly-industry-view.v1",
      source_weekly_section_ref: weeklySectionRef,
      visible_card_ids: [],
      headline_card_ids: [],
      watchlist_card_ids: [],
      needs_review_card_ids: [],
      hidden_card_ids: blockedCardIds,
      ordering_basis: ["consumer_readiness_state", "consumer_display_priority", "decision_tier", "decision_confidence", "coverage_audit_state"],
      card_projection_refs: [],
      blocked_reason_codes: publicBlockReasons,
    },
    public_projection: {
      projection_id: `public-weekly-industry-projection-${date}`,
      schema_version: "public-weekly-industry-projection.v1",
      source_weekly_section_ref: weeklySectionRef,
      headline_core_card_ids: [],
      tier_visible_card_ids: [],
      redacted_card_ids: [],
      blocked_card_ids: blockedCardIds,
      public_card_projection_refs: [],
      blocked_reason_codes: publicBlockReasons,
    },
  };
}

function missingContextReasonCode(param: string): string {
  return (
    {
      recent_7d_daily_pack_refs: "missing_recent_7d_evidence_window",
      "claim-archetype-decision-profile.v1/rules_ref": "missing_tier_decision_profile_rules",
      "axis-status-threshold-profile.v1/rules_ref": "missing_axis_threshold_profile_rules",
      "independence-credit-profile.v1/rules_ref": "missing_independence_credit_profile_rules",
    }[param] ?? `missing_${param.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`
  );
}

function factAssignmentsFromBundle(bundle: unknown, basisCode: string): CrossGroupIntegrationReadiness["closed_fact_snapshot"]["fact_resolution_audit"]["event_fact_assignments"] {
  return eventIdsFromBundle(bundle).map((eventId) => ({
    event_id: eventId,
    fact_id: `fact-${eventId}`,
    fact_resolution_state: "canonical",
    resolution_basis_codes: [basisCode],
    confidence: "high",
    requires_manual_review: false,
  }));
}

function eventIdsFromBundle(bundle: unknown): string[] {
  const bundlePayloads = record(bundle).payloads;
  const payloads: unknown[] = Array.isArray(bundlePayloads) ? bundlePayloads : [];
  return [
    ...new Set(
      payloads
        .filter((payload) => record(payload).payload_schema === "industry-signal-event-batch.v1")
        .filter((payload) => text(record(payload).bucket) === "accepted")
        .flatMap((payload) => {
          const events = record(payload).events;
          return Array.isArray(events) ? events : [];
        })
        .map((event) => text(record(event).event_id))
        .filter((eventId): eventId is string => eventId.length > 0),
    ),
  ];
}

function readJson<T>(rootDir: string, relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8")) as T;
}

function record(value: unknown): RecordLike {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RecordLike) : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
