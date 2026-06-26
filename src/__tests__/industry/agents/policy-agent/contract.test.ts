import { describe, expect, it } from "vitest";
import {
  assertConsumableEnvelope,
  assertCurrentAndCompatibleFixtures,
  buildPolicyFinanceGroupHandoff,
} from "../../../../industry/agents/policy-agent/handoff.ts";

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
            authorityTier: "core",
            primarySourceDistance: "primary",
            bucket: "accepted",
            title: "融资文件",
            summaryCn: "官方 filing 作为主证。",
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
            authorityTier: "core",
            primarySourceDistance: "primary",
            bucket: "accepted",
            title: "监管发布 Agent 指引",
            summaryCn: "监管公告作为 policy_regulatory 主证。",
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
            authorityTier: "proven",
            primarySourceDistance: "primary",
            bucket: "accepted",
            title: "智库发布政策观察",
            summaryCn: "智库报告作为 thinktank 轴主证。",
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
    expect(result.dailyInput.envelope.payload_schema).toBe("daily-industry-evidence-pack-input.v1");
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
});
