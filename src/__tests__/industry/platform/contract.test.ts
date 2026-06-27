import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getPayloadSchemaIds,
  loadIndustrySchemaRegistry,
  validatePayloadSchema,
} from "../../../industry/platform/contracts/schemaRegistry.ts";
import { canConsumePayloadSchema } from "../../../industry/platform/contracts/payloadRegistry.ts";
import { buildIndustryArtifactRef } from "../../../industry/platform/contracts/artifactPaths.ts";
import {
  validateFinancePolicyHandoff,
  type FinancePolicyHandoffBundle,
} from "../../../industry/platform/contracts/financePolicyHandoff.ts";
import { buildAcademicPrepBundle } from "../../../industry/agents/academic-agent/handoff.ts";
import type { ReplayWindowFixture } from "../../../industry/agents/academic-agent/types.ts";
import { reviewAcademicPreparatoryHandoff } from "../../../industry/platform/contracts/academicHandoff.ts";
import {
  PHASE1_FEEDBACK_PAYLOAD_SCHEMA_IDS,
  PHASE1_SHARED_GOVERNANCE_PROFILE_IDS,
  resolveSharedGovernanceProfile,
  validateSharedGovernanceBaseline,
} from "../../../industry/platform/contracts/sharedGovernance.ts";
import { validateDispatchRuntimeGate } from "../../../industry/platform/contracts/dispatchRuntime.ts";
import {
  validateExecutionContext,
  validateSameRunConsumerRefs,
} from "../../../industry/platform/contracts/consumerFixtures.ts";

describe("industry platform contracts", () => {
  function buildAcademicReplayBundle() {
    const fixture = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), "fixtures/industry/agents/academic-agent/replay/academic-replay-window.json"),
        "utf-8",
      ),
    ) as ReplayWindowFixture;
    return buildAcademicPrepBundle(fixture);
  }

  it("keeps the parallel worktree skeleton frozen under the agreed roots", () => {
    const root = process.cwd();
    const platformStages = ["contracts", "registry", "normalization", "audit", "trend", "output"];
    const agents = [
      "finance-agent",
      "policy-agent",
      "academic-agent",
      "product-oss-agent",
      "community-news-agent",
      "registry-agent",
      "normalization-agent",
      "audit-agent",
      "trend-agent",
    ];

    for (const stage of platformStages) {
      expect(fs.existsSync(path.join(root, "src/industry/platform", stage))).toBe(true);
    }
    for (const agent of agents) {
      expect(fs.existsSync(path.join(root, "src/industry/agents", agent))).toBe(true);
      expect(fs.existsSync(path.join(root, "fixtures/industry/agents", agent))).toBe(true);
      expect(fs.existsSync(path.join(root, "data/industry-seeds/agents", agent))).toBe(true);
    }
    for (const forbidden of platformStages) {
      expect(fs.existsSync(path.join(root, "src/industry", forbidden))).toBe(false);
    }
  });

  it("loads the frozen schema registries from the single source of truth", () => {
    const registry = loadIndustrySchemaRegistry();

    expect(registry.canonical.bundle_id).toBe("industry-canonical-schema");
    expect(registry.compatibility.schema_version).toBe("compatibility-matrix.v1");
    expect(registry.reasonCodes.schema_version).toBe("reason-code-registry.v1");
    expect(registry.stateTransitions.schema_version).toBe("state-transition-registry.v1");
    expect(getPayloadSchemaIds(registry)).toContain("industry-signal-event-batch.v1");
    expect(
      registry.compatibility.entries
        .every((entry) => registry.canonical.entries.some((schema) => schema.schema_id === entry.schema_id)),
    ).toBe(true);
  });

  it("rejects informal payload names before other groups build producer payloads", () => {
    const registry = loadIndustrySchemaRegistry();
    const payloadSchemaIds = getPayloadSchemaIds(registry);

    expect(validatePayloadSchema(registry, "industry-signal-event-batch.v1")).toEqual({
      ok: true,
      schemaId: "industry-signal-event-batch.v1",
    });
    expect(payloadSchemaIds).not.toContain("event-batch.v1");
    expect(registry.compatibility.entries.map((entry) => entry.schema_id)).not.toContain("event-batch.v1");
    expect(validatePayloadSchema(registry, "event-batch.v1")).toEqual({
      ok: false,
      reasonCode: "schema_mismatch",
      message: "Unsupported payload_schema: event-batch.v1",
    });
  });

  it("uses the compatibility matrix to accept same-major payloads and reject higher major payloads", () => {
    const registry = loadIndustrySchemaRegistry();

    expect(canConsumePayloadSchema(registry, "industry-signal-event-batch.v1", "1.0.0")).toEqual({
      ok: true,
      schemaId: "industry-signal-event-batch.v1",
      version: "1.0.0",
    });
    expect(canConsumePayloadSchema(registry, "industry-signal-event-batch.v1", "2.0.0")).toEqual({
      ok: false,
      reasonCode: "unsupported_version",
      message: "Unsupported major version for industry-signal-event-batch.v1: 2.0.0",
    });
  });

  it("builds canonical refs without letting callers invent storage paths", () => {
    expect(
      buildIndustryArtifactRef({
        visibility: "internal",
        date: "2026-06-25",
        schemaId: "daily-industry-evidence-pack.v2",
        artifactId: "pack-001",
      }),
    ).toEqual({
      artifactRef: "industry://internal/2026-06-25/daily-industry-evidence-pack.v2/pack-001",
      storagePath: "data/industry/internal/2026-06-25/daily-industry-evidence-pack.v2/pack-001.json",
    });
  });

  it("publishes Phase 1 current and negative fixtures for other groups to consume", () => {
    const root = process.cwd();
    const current = JSON.parse(
      fs.readFileSync(path.join(root, "fixtures/industry/platform/current-consumer/phase1-runtime.json"), "utf-8"),
    ) as {
      dispatch_gate: { high_cost_requires_reservation_state: string };
      event_consumer_gate: { takeover_requires_takeover_audit_ref: boolean };
      feedback_payload_schemas: string[];
      handoff_payload_schemas: string[];
      shared_governance_profile_ids: string[];
    };
    const negative = JSON.parse(
      fs.readFileSync(path.join(root, "fixtures/industry/platform/negative/phase1-runtime.json"), "utf-8"),
    ) as { cases: Array<{ expected_reason_code: string }> };

    expect(current.handoff_payload_schemas).toContain("daily-industry-evidence-pack-input.v1");
    expect(current.shared_governance_profile_ids).toEqual([...PHASE1_SHARED_GOVERNANCE_PROFILE_IDS]);
    expect(current.feedback_payload_schemas).toEqual([...PHASE1_FEEDBACK_PAYLOAD_SCHEMA_IDS]);
    expect(current.dispatch_gate.high_cost_requires_reservation_state).toBe("granted");
    expect(current.event_consumer_gate.takeover_requires_takeover_audit_ref).toBe(true);
    expect(negative.cases.map((item) => item.expected_reason_code)).toContain("dispatch_context_missing");
    expect(fs.existsSync(path.join(root, "data/industry-seeds/platform/schema-change-note.template.json"))).toBe(true);
  });

  it("publishes the Phase 1 shared governance baseline without adding a governance engine", () => {
    const registry = loadIndustrySchemaRegistry();
    const result = validateSharedGovernanceBaseline(loadIndustrySchemaRegistry());

    for (const schemaId of [...PHASE1_SHARED_GOVERNANCE_PROFILE_IDS, ...PHASE1_FEEDBACK_PAYLOAD_SCHEMA_IDS]) {
      expect(registry.canonical.entries.some((entry) => entry.schema_id === schemaId)).toBe(true);
      expect(registry.compatibility.entries.some((entry) => entry.schema_id === schemaId)).toBe(true);
    }
    expect(result).toMatchObject({ ok: true, status: "shared_governance_published" });
    if (result.ok) {
      expect(result.profileIds).toContain("field-ownership-policy.v1");
      expect(result.profileIds).toContain("axis-activation-policy.v1");
      expect(result.profileIds).toContain("canonical-fetch-stop-policy.v1");
      expect(result.profileIds).toContain("same-run-review-availability-policy.v1");
    }
  });

  it("resolves policy-finance governance profile ids through the shared registry", () => {
    const registry = loadIndustrySchemaRegistry();

    expect(resolveSharedGovernanceProfile(registry, "axis-runtime-budget-profile.v1/capital_finance")).toEqual({
      ok: true,
      schemaId: "axis-runtime-budget-profile.v1",
      profileId: "axis-runtime-budget-profile.v1/capital_finance",
      version: "1.0.0",
    });
    expect(resolveSharedGovernanceProfile(registry, "unknown-profile.v1/capital_finance")).toMatchObject({
      ok: false,
      reasonCode: "schema_mismatch",
    });
  });

  it("gates same-run and high-cost actions on dispatch, reservation, and budget refs", () => {
    const accepted = {
      message: {
        dispatch_context_ref: "industry://internal/2026-06-25/same-run-dispatch-context.v1/dispatch-001",
        scheduling_key: "claim:abc",
        candidate_group_id: "candidate:abc",
        claim_admission_assessment_ref: "industry://internal/2026-06-25/claim-admission-assessment.v1/admit-001",
        capacity_reservation_refs: ["industry://internal/2026-06-25/capacity-reservation.v1/res-001"],
      },
      dispatchContext: { scheduling_key: "claim:abc" },
      reservations: [{ reservation_state: "granted" }],
      budgetArbitration: { decision: "approved" },
      requiresCapacityReservation: true,
    };

    expect(validateDispatchRuntimeGate(accepted)).toEqual({ ok: true, status: "accepted_for_dispatch" });
    expect(validateDispatchRuntimeGate({ message: accepted.message, dispatchContext: accepted.dispatchContext })).toEqual({
      ok: true,
      status: "accepted_for_dispatch",
    });
    expect(validateDispatchRuntimeGate({ ...accepted, dispatchContext: {} })).toMatchObject({
      ok: false,
      reasonCode: "dispatch_context_missing",
    });
    expect(validateDispatchRuntimeGate({ ...accepted, message: {} })).toMatchObject({
      ok: false,
      reasonCode: "dispatch_context_missing",
    });
    expect(
      validateDispatchRuntimeGate({
        ...accepted,
        message: { ...accepted.message, candidate_group_id: undefined },
      }),
    ).toMatchObject({
      ok: false,
      reasonCode: "dispatch_context_missing",
    });
    expect(validateDispatchRuntimeGate({ ...accepted, reservations: [{ reservation_state: "requested" }] })).toMatchObject({
      ok: false,
      reasonCode: "reservation_missing",
    });
    expect(
      validateDispatchRuntimeGate({
        ...accepted,
        message: { ...accepted.message, capacity_reservation_refs: [] },
      }),
    ).toMatchObject({
      ok: false,
      reasonCode: "reservation_missing",
    });
    expect(
      validateDispatchRuntimeGate({
        ...accepted,
        requiresSameRunReview: true,
        reviewAvailability: { review_execution_mode: "async_only" },
      }),
    ).toMatchObject({
      ok: false,
      reasonCode: "reservation_missing",
    });
    expect(validateDispatchRuntimeGate({ ...accepted, budgetArbitration: { decision: "rejected" } })).toMatchObject({
      ok: false,
      reasonCode: "budget_exceeded",
    });
  });

  it("validates Phase 1 current consumer collaboration fields", () => {
    const event = {
      responsibility_id: "capital-finance",
      execution_context: {
        primary_responsibility_id: "capital-finance",
        operational_executor_id: "finance-agent",
        takeover_mode: "none",
      },
    };
    const sameRunMessage = {
      dispatch_context_ref: "industry://internal/2026-06-25/same-run-dispatch-context.v1/dispatch-001",
      scheduling_key: "claim:abc",
      candidate_group_id: "candidate:abc",
      claim_admission_assessment_ref: "industry://internal/2026-06-25/claim-admission-assessment.v1/admit-001",
      capacity_reservation_refs: ["industry://internal/2026-06-25/capacity-reservation.v1/res-001"],
    };

    expect(validateExecutionContext(event)).toEqual({ ok: true, status: "current_consumer_ready" });
    expect(
      validateExecutionContext({
        ...event,
        execution_context: { ...event.execution_context, primary_responsibility_id: "policy-regulatory" },
      }),
    ).toMatchObject({ ok: false, reasonCode: "schema_mismatch" });
    expect(
      validateExecutionContext({
        ...event,
        execution_context: { ...event.execution_context, takeover_mode: "delegated_execution" },
      }),
    ).toMatchObject({ ok: false, reasonCode: "schema_mismatch" });
    expect(validateSameRunConsumerRefs(sameRunMessage)).toEqual({ ok: true, status: "current_consumer_ready" });
    expect(validateSameRunConsumerRefs({ ...sameRunMessage, candidate_group_id: undefined })).toMatchObject({
      ok: false,
      reasonCode: "dispatch_context_missing",
    });
    expect(validateSameRunConsumerRefs({ ...sameRunMessage, capacity_reservation_refs: [] })).toMatchObject({
      ok: false,
      reasonCode: "dispatch_context_missing",
    });
  });

  it("keeps the main coordinator as a boundary, not a new agent or hot-file owner", () => {
    const root = process.cwd();
    const agents = fs
      .readdirSync(path.join(root, "src/industry/agents"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    expect(agents).not.toContain("main-coordinator");
    for (const file of ["src/types.ts", "src/cli.ts"]) {
      expect(fs.readFileSync(path.join(root, file), "utf-8")).not.toContain("main-coordinator");
    }
  });

  describe("finance policy handoff gate", () => {
    const baseBundle = (): FinancePolicyHandoffBundle => ({
      messages: [
        message("industry-signal-event-batch.v1", "industry://internal/2026-06-25/events/capital"),
        message("axis-tool-coverage-report.v1", "industry://internal/2026-06-25/coverage/policy"),
        message("industry-agent-contribution.v1", "industry://internal/2026-06-25/contribution/thinktank"),
        message("daily-industry-evidence-pack-input.v1", "industry://internal/2026-06-25/daily/input"),
      ],
      manifests: [
        { artifact_ref: "industry://internal/2026-06-25/events/capital" },
        { artifact_ref: "industry://internal/2026-06-25/coverage/policy" },
        { artifact_ref: "industry://internal/2026-06-25/contribution/thinktank" },
        { artifact_ref: "industry://internal/2026-06-25/daily/input" },
      ],
      payloads: [
        payload("industry-signal-event-batch.v1", { responsibility_id: "capital-finance" }),
        payload("industry-signal-event-batch.v1", { responsibility_id: "policy-regulatory" }),
        payload("industry-signal-event-batch.v1", { responsibility_id: "policy-research-thinktank" }),
        payload("daily-industry-evidence-pack-input.v1", {
          normalized_event_batch_refs: ["a", "b", "c"],
          source_message_ids: ["m1"],
          coverage_refs: ["c1", "c2", "c3"],
          contribution_refs: ["r1", "r2", "r3"],
        }),
      ],
      artifactRefs: [
        "industry://internal/2026-06-25/events/capital",
        "industry://internal/2026-06-25/coverage/policy",
        "industry://internal/2026-06-25/contribution/thinktank",
        "industry://internal/2026-06-25/daily/input",
      ],
    });

    function message(payloadSchema: string, payloadRef: string): Record<string, unknown> {
      return {
        kind:
          payloadSchema === "industry-signal-event-batch.v1"
            ? "evidence_batch"
            : payloadSchema === "axis-tool-coverage-report.v1"
              ? "tool_status_report"
              : payloadSchema === "industry-agent-contribution.v1"
                ? "industry_agent_contribution"
                : "daily_industry_evidence_pack_input",
        from_agent_id: "finance-agent",
        to_agent_id: "normalization-agent",
        payload_schema: payloadSchema,
        payload_ref: payloadRef,
      };
    }

    function payload(payload_schema: string, extra: Record<string, unknown>): Record<string, unknown> {
      return { payload_schema, schema_version: "1.0.0", ...extra };
    }

    it("accepts a complete finance policy handoff for dry-run", () => {
      expect(validateFinancePolicyHandoff(loadIndustrySchemaRegistry(), baseBundle())).toEqual({
        ok: true,
        status: "accepted_for_dry_run",
      });
    });

    it("rejects informal payload names", () => {
      const bundle = baseBundle();
      bundle.messages[0].payload_schema = "event-batch";

      expect(validateFinancePolicyHandoff(loadIndustrySchemaRegistry(), bundle)).toMatchObject({
        ok: false,
        reasonCode: "schema_mismatch",
      });
    });

    it("rejects schemas outside the finance policy handoff set", () => {
      const bundle = baseBundle();
      bundle.messages[0].payload_schema = "industry-claim.v1";

      expect(validateFinancePolicyHandoff(loadIndustrySchemaRegistry(), bundle)).toMatchObject({
        ok: false,
        reasonCode: "schema_mismatch",
      });
    });

    it("rejects kind and payload schema mismatches", () => {
      const bundle = baseBundle();
      bundle.messages[3].kind = "evidence_batch";

      expect(validateFinancePolicyHandoff(loadIndustrySchemaRegistry(), bundle)).toMatchObject({
        ok: false,
        reasonCode: "schema_mismatch",
      });
    });

    it("rejects payload refs missing from manifest and artifact refs", () => {
      const bundle = baseBundle();
      bundle.manifests = bundle.manifests.filter(
        (manifest) => manifest.artifact_ref !== "industry://internal/2026-06-25/coverage/policy",
      );
      bundle.artifactRefs = bundle.artifactRefs.filter(
        (artifactRef) => artifactRef !== "industry://internal/2026-06-25/coverage/policy",
      );

      expect(validateFinancePolicyHandoff(loadIndustrySchemaRegistry(), bundle)).toMatchObject({
        ok: false,
        reasonCode: "lineage_failed",
      });
    });

    it("rejects higher major payload versions", () => {
      const bundle = baseBundle();
      bundle.payloads[0].schema_version = "2.0.0";

      expect(validateFinancePolicyHandoff(loadIndustrySchemaRegistry(), bundle)).toMatchObject({
        ok: false,
        reasonCode: "unsupported_version",
      });
    });

    it("rejects missing payload refs", () => {
      const bundle = baseBundle();
      delete bundle.messages[0].payload_ref;

      expect(validateFinancePolicyHandoff(loadIndustrySchemaRegistry(), bundle)).toMatchObject({
        ok: false,
        reasonCode: "lineage_failed",
      });
    });

    it("rejects wrong daily coverage and contribution cardinality", () => {
      const bundle = baseBundle();
      const daily = bundle.payloads[3];
      daily.coverage_refs = ["c1"];

      expect(validateFinancePolicyHandoff(loadIndustrySchemaRegistry(), bundle)).toMatchObject({
        ok: false,
        reasonCode: "lineage_failed",
      });

      daily.coverage_refs = ["c1", "c2", "c3"];
      daily.contribution_refs = ["r1"];

      expect(validateFinancePolicyHandoff(loadIndustrySchemaRegistry(), bundle)).toMatchObject({
        ok: false,
        reasonCode: "lineage_failed",
      });
    });

    it("rejects daily input that embeds event objects", () => {
      const bundle = baseBundle();
      bundle.payloads[3].accepted_events = [{ event_id: "e1" }];

      expect(validateFinancePolicyHandoff(loadIndustrySchemaRegistry(), bundle)).toMatchObject({
        ok: false,
        reasonCode: "lineage_failed",
      });
    });

    it("rejects claim-critical messages without dispatch context", () => {
      const bundle = baseBundle();
      bundle.messages[0].capability_class = "claim-critical";

      expect(validateFinancePolicyHandoff(loadIndustrySchemaRegistry(), bundle)).toMatchObject({
        ok: false,
        reasonCode: "dispatch_context_missing",
      });
    });

    it("accepts claim-critical messages only when same-run refs are complete", () => {
      const bundle = baseBundle();
      bundle.messages[0] = {
        ...bundle.messages[0],
        capability_class: "claim-critical",
        dispatch_context_ref: "industry://internal/2026-06-25/same-run-dispatch-context.v1/dispatch-001",
        scheduling_key: "claim:abc",
        candidate_group_id: "candidate:abc",
        claim_admission_assessment_ref: "industry://internal/2026-06-25/claim-admission-assessment.v1/admit-001",
        capacity_reservation_refs: ["industry://internal/2026-06-25/capacity-reservation.v1/res-001"],
      };

      expect(validateFinancePolicyHandoff(loadIndustrySchemaRegistry(), bundle)).toEqual({
        ok: true,
        status: "accepted_for_dry_run",
      });
    });
  });

  describe("academic preparatory handoff gate", () => {
    it("accepts academic preparatory refs for dry-run review without promoting them to frozen handoff", () => {
      expect(reviewAcademicPreparatoryHandoff(loadIndustrySchemaRegistry(), buildAcademicReplayBundle())).toEqual({
        ok: true,
        status: "preparatory_review_ready",
        promotionReady: false,
      });
    });

    it("rejects academic daily refs that do not resolve to preparatory artifacts", () => {
      const bundle = buildAcademicReplayBundle();
      bundle.daily_input.payload.coverage_refs = ["artifact://academic-agent/missing/coverage.json", bundle.daily_input.payload.coverage_refs[1]!];

      expect(reviewAcademicPreparatoryHandoff(loadIndustrySchemaRegistry(), bundle)).toMatchObject({
        ok: false,
        reasonCode: "lineage_failed",
      });
    });
  });
});
