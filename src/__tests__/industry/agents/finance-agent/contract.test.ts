import { describe, expect, it } from "vitest";
import { buildCapitalFinanceHandoff } from "../../../../industry/agents/finance-agent/handoff.ts";
import { assertConsumableEnvelope } from "../../../../industry/agents/policy-agent/groupProtocol.ts";
import currentConsumerFixture from "../../../../../fixtures/industry/agents/finance-agent/compatibility/current-consumer.json";
import previousCompatibleFixture from "../../../../../fixtures/industry/agents/finance-agent/compatibility/previous-compatible-consumer.json";
import missingRequiredRefFixture from "../../../../../fixtures/industry/agents/finance-agent/compatibility/missing-required-ref-negative.json";
import unknownHigherMajorFixture from "../../../../../fixtures/industry/agents/finance-agent/compatibility/unknown-higher-major-negative.json";

describe("finance-agent compatibility contract", () => {
  it("matches current and previous compatible consumer expectations", () => {
    const result = buildCapitalFinanceHandoff({
      runId: "run-finance-contract-1",
      threadId: "thread-finance-contract-1",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T16:00:00+08:00",
      availableToolIds: ["sec-edgar-api"],
      canonicalSourceAvailable: true,
      sources: [
        {
          sourceId: "sec-filing",
          displayName: "SEC Filing",
          sourceType: "financial_filing",
          authorityTier: "core",
          primarySourceDistance: "primary",
          bucket: "accepted",
          title: "官方融资文件",
          summaryCn: "finance official-first 主证。",
          agentRelevanceScore: 0.93,
          agentRelevanceReasons: ["capital-core"],
        },
      ],
    });

    expect(result.accepted.envelope.schema_version).toBe(currentConsumerFixture.schema_version);
    expect(result.accepted.manifest.schema_version).toBe(currentConsumerFixture.manifest_schema_version);
    expect(assertConsumableEnvelope(result.accepted.envelope, result.accepted.manifest.schema_version)).toEqual({ ok: true });

    expect(result.accepted.envelope.schema_version).toBe(previousCompatibleFixture.schema_version);
    expect(result.accepted.manifest.schema_version).toBe(previousCompatibleFixture.manifest_schema_version);
    expect(assertConsumableEnvelope(result.accepted.envelope, result.accepted.manifest.schema_version)).toEqual({ ok: true });
  });

  it("rejects malformed and higher major compatibility fixtures", () => {
    const result = buildCapitalFinanceHandoff({
      runId: "run-finance-contract-2",
      threadId: "thread-finance-contract-2",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T16:05:00+08:00",
      availableToolIds: ["sec-edgar-api"],
      canonicalSourceAvailable: true,
      sources: [],
    });

    const malformed = {
      ...result.accepted.envelope,
      schema_version: missingRequiredRefFixture.schema_version,
      payload_ref: missingRequiredRefFixture.payload_ref,
      output_artifact_refs: [],
    };
    const higherMajor = {
      ...result.accepted.envelope,
      schema_version: unknownHigherMajorFixture.schema_version as "industry-agent-message.v2",
    };

    expect(assertConsumableEnvelope(malformed, result.accepted.manifest.schema_version)).toEqual({
      ok: false,
      reason: missingRequiredRefFixture.expected_reason,
    });
    expect(assertConsumableEnvelope(higherMajor, result.accepted.manifest.schema_version)).toEqual({
      ok: false,
      reason: unknownHigherMajorFixture.expected_reason,
    });
  });
});
