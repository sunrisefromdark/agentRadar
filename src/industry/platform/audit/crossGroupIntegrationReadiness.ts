import type { AcademicFormalHandoffBundle } from "../contracts/academicHandoff.ts";
import { consumeAcademicHandoffForDryRun } from "../normalization/academicDryRun.ts";
import { buildIndustryRuntimeSummaryArtifact } from "../normalization/industryRuntimeSummary.ts";
import {
  assembleProductEcosystemPhase6Inputs,
  type ProductEcosystemPhase6AssemblyResult,
} from "./productEcosystemPhase6Assembly.ts";

type RecordLike = Record<string, unknown>;

export type CrossGroupIntegrationReadiness = {
  artifact_kind: "cross_group_integration_readiness";
  date: string;
  generated_at: string;
  status: "phase3_backlog_ready" | "blocked";
  ready_group_count: number;
  weekly_output_ready: false;
  blocked_until: "closed_fact_snapshot_and_audit";
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

  return {
    artifact_kind: "cross_group_integration_readiness",
    date: input.date,
    generated_at: input.generatedAt,
    status: reject_list.length ? "blocked" : "phase3_backlog_ready",
    ready_group_count: [
      runtimeSummary.policy_finance.status === "policy_finance_runtime_ready",
      academic.ok,
      product.ok,
    ].filter(Boolean).length,
    weekly_output_ready: false,
    blocked_until: "closed_fact_snapshot_and_audit",
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
    next_platform_actions: nextPlatformActions(product),
    reject_list,
  };
}

function nextPlatformActions(product: ProductEcosystemPhase6AssemblyResult): string[] {
  return [
    ...(product.ok ? ["assemble_cross_group_replay_eval_backlog"] : []),
    "start_closed_fact_snapshot",
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
