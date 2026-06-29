import { describe, expect, it } from "vitest";
import {
  assertConsumableEnvelope,
  assertCurrentAndCompatibleFixtures,
  buildPolicyFinanceHandoffBundle,
  buildPolicyFinanceGroupHandoff,
} from "../../../../industry/agents/policy-agent/handoff.ts";
import { policyRegulatorySeed } from "../../../../industry/agents/policy-agent/regulatorySourceCatalog.ts";
import { policyThinktankSeed } from "../../../../industry/agents/policy-agent/thinktankSourceCatalog.ts";
import { validateDispatchRuntimeGate } from "../../../../industry/platform/contracts/dispatchRuntime.ts";
import { validateFinancePolicyHandoff } from "../../../../industry/platform/contracts/financePolicyHandoff.ts";
import { validateSameRunConsumerRefs } from "../../../../industry/platform/contracts/consumerFixtures.ts";
import { loadIndustrySchemaRegistry } from "../../../../industry/platform/contracts/schemaRegistry.ts";
import sameRunCurrentFixture from "../../../../../fixtures/industry/agents/policy-agent/compatibility/same-run-current-consumer.json" with { type: "json" };
import regulatorySourceCatalogFixture from "../../../../../data/industry-seeds/agents/policy-agent/regulatory-source-catalog.json" with { type: "json" };
import thinktankSourceCatalogFixture from "../../../../../data/industry-seeds/agents/policy-agent/thinktank-source-catalog.json" with { type: "json" };

describe("policy-finance group handoff", () => {
  it("builds daily evidence pack input with three coverage refs and three contribution refs", () => {
    const result = buildPolicyFinanceGroupHandoff({
      runId: "run-group-1",
      threadId: "thread-group-1",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T13:00:00+08:00",
      finance: {
        runId: "run-group-1",
        threadId: "thread-group-1",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T13:00:00+08:00",
        availableToolIds: ["sec-edgar-api"],
        canonicalSourceAvailable: true,
        sources: [
          {
            sourceId: "filing-1",
            displayName: "SEC Filing",
            sourceType: "financial_filing",
            sourceFamily: "finance_sec_filing",
            authorityTier: "core",
            primarySourceDistance: "primary",
            accessMode: "api",
            costTier: "free",
            reviewStatus: "active",
            namedSource: "SEC EDGAR",
            bucket: "accepted",
            title: "融资文件",
            summaryCn: "官方 filing 作为主证。",
            financeSignalKind: "capital_allocation",
            agentRelevanceScore: 0.9,
            agentRelevanceReasons: ["capital-core"],
          },
        ],
      },
      regulatory: {
        runId: "run-group-1",
        threadId: "thread-group-1",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T13:00:00+08:00",
        availableToolIds: ["official-regulator-rss"],
        canonicalSourceAvailable: true,
        sources: [
          {
            sourceId: "policy-1",
            displayName: "监管公告",
            sourceType: "policy",
            sourceFamily: "policy_government_announcement",
            authorityTier: "core",
            primarySourceDistance: "primary",
            accessMode: "public",
            costTier: "free",
            reviewStatus: "active",
            namedSource: "Federal Register",
            bucket: "accepted",
            title: "监管发布 Agent 指引",
            summaryCn: "监管公告作为 policy_regulatory 主证。",
            policySignalKind: "official_support",
            agentRelevanceScore: 0.92,
            agentRelevanceReasons: ["regulator-core"],
          },
        ],
      },
      thinktank: {
        runId: "run-group-1",
        threadId: "thread-group-1",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T13:00:00+08:00",
        availableToolIds: ["thinktank-report-registry"],
        canonicalSourceAvailable: true,
        sources: [
          {
            sourceId: "thinktank-1",
            displayName: "智库报告",
            sourceType: "thinktank_report",
            sourceFamily: "thinktank_stanford_ai_index",
            authorityTier: "proven",
            primarySourceDistance: "primary",
            accessMode: "public",
            costTier: "free",
            reviewStatus: "active",
            namedSource: "Stanford AI Index",
            bucket: "accepted",
            title: "智库发布政策观察",
            summaryCn: "智库报告作为 thinktank 轴主证。",
            policySignalKind: "thinktank_viewpoint",
            agentRelevanceScore: 0.8,
            agentRelevanceReasons: ["research-brief"],
          },
        ],
      },
    });

    expect(result.dailyInput.payload.coverage_refs).toHaveLength(3);
    expect(result.dailyInput.payload.contribution_refs).toHaveLength(3);
    expect(result.dailyInput.payload.normalized_event_batch_refs).toEqual([
      result.finance.accepted.manifest.artifact_ref,
      result.regulatory.accepted.manifest.artifact_ref,
      result.thinktank.accepted.manifest.artifact_ref,
    ]);
    expect(result.finance.accepted.payload.events_ref).toBe(result.finance.accepted.manifest.artifact_ref);
    expect(result.finance.accepted.payload.agent_contribution_ref).toBe(result.finance.contribution.manifest.artifact_ref);
    expect(result.finance.accepted.payload.tool_status_report_refs).toEqual([result.finance.coverage.manifest.artifact_ref]);
    expect(result.finance.accepted.payload.source_message_id).toBe(result.finance.accepted.envelope.message_id);
    expect(result.finance.contribution.payload.source_message_id).toBe(result.finance.contribution.envelope.message_id);
    expect(result.dailyInput.payload.source_message_id).toBe(result.dailyInput.envelope.message_id);
    expect(result.dailyInput.envelope.payload_schema).toBe("daily-industry-evidence-pack-input.v1");
    expect(result.finance.coverage.payload.report.primary_tool_ids).toEqual(
      expect.arrayContaining(["sec-edgar-api", "public-company-filings"]),
    );
    expect(result.regulatory.coverage.payload.report.primary_tool_ids).toEqual(
      expect.arrayContaining(["official-regulator-rss", "standards-body-docs", "public-procurement-notices"]),
    );
    expect(result.thinktank.coverage.payload.report.primary_tool_ids).toEqual(
      expect.arrayContaining(["oecd-ai-policy-observatory", "stanford-ai-index", "rand-ai-research"]),
    );
    expect(result.thinktank.coverage.payload.report.named_sources_present).toEqual(["Stanford AI Index"]);
  });

  it("accepts current and previous compatible fixtures but rejects malformed and higher major envelopes", () => {
    const result = buildPolicyFinanceGroupHandoff({
      runId: "run-group-2",
      threadId: "thread-group-2",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T14:00:00+08:00",
      finance: {
        runId: "run-group-2",
        threadId: "thread-group-2",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T14:00:00+08:00",
        availableToolIds: ["sec-edgar-api"],
        canonicalSourceAvailable: true,
        sources: [],
      },
      regulatory: {
        runId: "run-group-2",
        threadId: "thread-group-2",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T14:00:00+08:00",
        availableToolIds: ["official-regulator-rss"],
        canonicalSourceAvailable: true,
        sources: [],
      },
      thinktank: {
        runId: "run-group-2",
        threadId: "thread-group-2",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T14:00:00+08:00",
        availableToolIds: ["thinktank-report-registry"],
        canonicalSourceAvailable: true,
        sources: [],
      },
    });

    const compatibility = assertCurrentAndCompatibleFixtures(result.finance.accepted, result.regulatory.accepted);
    expect(compatibility.current.ok).toBe(true);
    expect(compatibility.previous.ok).toBe(true);

    const malformed = {
      ...result.finance.accepted.envelope,
      payload_ref: "",
    };
    const higherMajor = {
      ...result.finance.accepted.envelope,
      schema_version: "industry-agent-message.v2" as const,
    };

    expect(assertConsumableEnvelope(malformed, result.finance.accepted.manifest.schema_version)).toEqual({
      ok: false,
      reason: "missing_required_artifact_ref",
    });
    expect(assertConsumableEnvelope(higherMajor, result.finance.accepted.manifest.schema_version)).toEqual({
      ok: false,
      reason: "unknown_higher_major",
    });
  });

  it("passes the platform finance-policy handoff gate with canonical payload names and refs", () => {
    const result = buildPolicyFinanceGroupHandoff({
      runId: "run-group-3",
      threadId: "thread-group-3",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T18:00:00+08:00",
      finance: {
        runId: "run-group-3",
        threadId: "thread-group-3",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T18:00:00+08:00",
        availableToolIds: ["sec-edgar-api"],
        canonicalSourceAvailable: true,
        sources: [],
      },
      regulatory: {
        runId: "run-group-3",
        threadId: "thread-group-3",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T18:00:00+08:00",
        availableToolIds: ["official-regulator-rss"],
        canonicalSourceAvailable: true,
        sources: [],
      },
      thinktank: {
        runId: "run-group-3",
        threadId: "thread-group-3",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T18:00:00+08:00",
        availableToolIds: ["thinktank-report-registry"],
        canonicalSourceAvailable: true,
        sources: [],
      },
    });

    const bundle = buildPolicyFinanceHandoffBundle(result);
    expect(validateFinancePolicyHandoff(loadIndustrySchemaRegistry(), bundle)).toEqual({
      ok: true,
      status: "accepted_for_dry_run",
    });
  });

  it("carries complete same-run refs for claim-critical handoff messages", () => {
    const runtimeContext = {
      capabilityClass: sameRunCurrentFixture.capability_class as "claim-critical",
      dispatchContextRef: sameRunCurrentFixture.dispatch_context_ref,
      schedulingKey: sameRunCurrentFixture.scheduling_key,
      candidateGroupId: sameRunCurrentFixture.candidate_group_id,
      claimAdmissionAssessmentRef: sameRunCurrentFixture.claim_admission_assessment_ref,
      capacityReservationRefs: sameRunCurrentFixture.capacity_reservation_refs,
    };
    const result = buildPolicyFinanceGroupHandoff({
      runId: "run-group-4",
      threadId: "thread-group-4",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T19:00:00+08:00",
      finance: {
        runId: "run-group-4",
        threadId: "thread-group-4",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T19:00:00+08:00",
        availableToolIds: ["sec-edgar-api"],
        canonicalSourceAvailable: true,
        runtimeContext,
        sources: [],
      },
      regulatory: {
        runId: "run-group-4",
        threadId: "thread-group-4",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T19:00:00+08:00",
        availableToolIds: ["official-regulator-rss"],
        canonicalSourceAvailable: true,
        sources: [],
      },
      thinktank: {
        runId: "run-group-4",
        threadId: "thread-group-4",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T19:00:00+08:00",
        availableToolIds: ["thinktank-report-registry"],
        canonicalSourceAvailable: true,
        sources: [],
      },
    });

    expect(validateSameRunConsumerRefs(result.finance.accepted.envelope)).toEqual({
      ok: true,
      status: sameRunCurrentFixture.expected.consumer_gate,
    });
    expect(
      validateDispatchRuntimeGate({
        message: result.finance.accepted.envelope,
        dispatchContext: sameRunCurrentFixture.dispatch_context,
        reservations: sameRunCurrentFixture.reservations,
        budgetArbitration: sameRunCurrentFixture.budget_arbitration,
        requiresCapacityReservation: true,
      }),
    ).toEqual({
      ok: true,
      status: sameRunCurrentFixture.expected.dispatch_gate,
    });
    expect(validateFinancePolicyHandoff(loadIndustrySchemaRegistry(), buildPolicyFinanceHandoffBundle(result))).toEqual({
      ok: true,
      status: sameRunCurrentFixture.expected.handoff_gate,
    });
  });

  it("keeps regulatory and thinktank TS seeds aligned with the machine-readable source catalogs", () => {
    expect(regulatorySourceCatalogFixture).toEqual({
      agent_id: policyRegulatorySeed.agent_id,
      responsibility_id: policyRegulatorySeed.responsibility_id,
      axis: policyRegulatorySeed.axis,
      official_first: true,
      primary_tool_ids: policyRegulatorySeed.primary.map((tool) => tool.tool_id),
      secondary_tool_ids: policyRegulatorySeed.secondary.map((tool) => tool.tool_id),
      fallback_tool_ids: policyRegulatorySeed.fallback.map((tool) => tool.tool_id),
      last_resort_tool_ids: policyRegulatorySeed.last_resort.map((tool) => tool.tool_id),
    });
    expect(thinktankSourceCatalogFixture).toEqual({
      agent_id: policyThinktankSeed.agent_id,
      responsibility_id: policyThinktankSeed.responsibility_id,
      axis: policyThinktankSeed.axis,
      official_first: true,
      primary_tool_ids: policyThinktankSeed.primary.map((tool) => tool.tool_id),
      secondary_tool_ids: policyThinktankSeed.secondary.map((tool) => tool.tool_id),
      fallback_tool_ids: policyThinktankSeed.fallback.map((tool) => tool.tool_id),
      last_resort_tool_ids: policyThinktankSeed.last_resort.map((tool) => tool.tool_id),
    });
  });
});
