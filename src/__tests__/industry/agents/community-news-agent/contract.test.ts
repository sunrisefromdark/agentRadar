import { describe, expect, it } from "vitest";
import {
  buildProductEcosystemFormalHandoff,
  type ProductEcosystemFormalHandoffBundle,
  validateProductEcosystemFormalHandoff,
} from "../../../../industry/agents/community-news-agent/formalHandoff.ts";
import { buildProductEcosystemHandoff } from "../../../../industry/agents/community-news-agent/handoff.ts";
import { loadIndustrySchemaRegistry } from "../../../../industry/platform/contracts/schemaRegistry.ts";

function buildContractInput() {
  const base = {
    runId: "run-ecosystem-contract",
    threadId: "thread-ecosystem-contract",
    windowStart: "2026-06-20T00:00:00+08:00",
    windowEnd: "2026-06-26T23:59:59+08:00",
    now: "2026-06-26T17:30:00+08:00",
    canonicalSourceAvailable: true,
  };
  return {
    ...base,
    productPlatform: {
      ...base,
      availableToolIds: ["vendor-release-notes-feed"],
      sources: [
        {
          sourceId: "vendor-release",
          displayName: "Release Notes",
          sourceType: "vendor_release" as const,
          authorityTier: "core" as const,
          primarySourceDistance: "primary" as const,
          bucket: "accepted" as const,
          title: "Product release",
          summary: "Official product release.",
        },
      ],
    },
    developerStudio: {
      ...base,
      availableToolIds: ["developer-docs-changelog"],
      sources: [
        {
          sourceId: "sdk-release",
          displayName: "SDK Feed",
          sourceType: "sdk_release" as const,
          authorityTier: "core" as const,
          primarySourceDistance: "primary" as const,
          bucket: "accepted" as const,
          title: "SDK release",
          summary: "Developer studio release.",
        },
      ],
    },
    projectOss: {
      ...base,
      availableToolIds: ["github-release-feed"],
      sources: [
        {
          sourceId: "repo-release",
          displayName: "GitHub Releases",
          sourceType: "repo_release" as const,
          authorityTier: "core" as const,
          primarySourceDistance: "primary" as const,
          bucket: "accepted" as const,
          title: "Repo release",
          summary: "Open source release.",
        },
      ],
    },
    cnCommunity: {
      ...base,
      responsibilityId: "cn-community" as const,
      availableToolIds: ["cn-community-original-thread-index"],
      sources: [
        {
          sourceId: "cn-thread",
          displayName: "CN Community",
          sourceType: "forum_post" as const,
          authorityTier: "proven" as const,
          primarySourceDistance: "primary" as const,
          language: "zh" as const,
          region: "cn",
          bucket: "accepted" as const,
          title: "CN community practice",
          summary: "Original CN community signal.",
        },
      ],
    },
    globalCommunity: {
      ...base,
      responsibilityId: "global-community" as const,
      availableToolIds: ["global-community-original-thread-index"],
      sources: [
        {
          sourceId: "global-issue",
          displayName: "Global Issue",
          sourceType: "issue" as const,
          authorityTier: "proven" as const,
          primarySourceDistance: "primary" as const,
          language: "en" as const,
          region: "global",
          bucket: "accepted" as const,
          title: "Global community issue",
          summary: "Original global community signal.",
        },
      ],
    },
    newsPr: {
      ...base,
      availableToolIds: ["news-pr-narrative-index"],
      sources: [
        {
          sourceId: "news-context",
          displayName: "Media",
          sourceType: "media_report" as const,
          authorityTier: "ordinary" as const,
          primarySourceDistance: "secondary" as const,
          language: "en" as const,
          region: "global",
          bucket: "diagnostic" as const,
          title: "News narrative context",
          summary: "News narrative stays as context.",
        },
      ],
    },
  };
}

describe("product ecosystem handoff draft", () => {
  it("builds five coverage refs, six contribution refs, and light daily input", () => {
    const result = buildProductEcosystemHandoff(buildContractInput());
    const daily = result.dailyInput.payload;

    expect(daily.coverage_refs).toHaveLength(5);
    expect(daily.contribution_refs).toHaveLength(6);
    expect(daily.normalized_event_batch_refs).toHaveLength(6);
    expect(daily.rejected_event_batch_refs).toHaveLength(6);
    expect(daily.normalized_event_batch_refs).toContain(result.cnCommunity.accepted.manifest.artifact_ref);
    expect(daily.normalized_event_batch_refs).toContain(result.globalCommunity.accepted.manifest.artifact_ref);
    expect(daily.source_message_ids).toContain(result.newsPr.diagnostic.envelope.message_id);
    expect(daily.source_message_ids).toContain(result.newsPr.counter.envelope.message_id);
    expect(daily).not.toHaveProperty("events");
    expect(result.communityDiscussion.coverage.payload.report.accepted_ref_count).toBe(2);
    expect(result.newsPr.accepted.payload.events).toHaveLength(0);
    expect(result.newsPr.diagnostic.payload.events).toHaveLength(1);
  });
});

describe("product ecosystem formal handoff freeze", () => {
  it("accepts the current formal bundle for dry-run consumption", () => {
    const { bundle } = buildProductEcosystemFormalHandoff(buildContractInput());
    const daily = bundle.payloads.find((payload) => payload.payload_schema === "daily-industry-evidence-pack-input.v1");

    expect(validateProductEcosystemFormalHandoff(loadIndustrySchemaRegistry(), bundle)).toEqual({
      ok: true,
      status: "accepted_for_dry_run",
    });
    expect(bundle.messages.every((message) => typeof message.payload_ref === "string" && message.payload_ref.startsWith("industry://internal/"))).toBe(true);
    expect(bundle.payloads.filter((payload) => payload.payload_schema === "axis-tool-coverage-report.v1")).toHaveLength(5);
    expect(bundle.payloads.filter((payload) => payload.payload_schema === "industry-agent-contribution.v1")).toHaveLength(6);
    expect(daily?.coverage_refs).toHaveLength(5);
    expect(daily?.contribution_refs).toHaveLength(6);
    expect(daily).not.toHaveProperty("events");
    expect(daily).not.toHaveProperty("accepted_events");
    expect(daily).not.toHaveProperty("rejected_events");
  });

  it("accepts previous compatible same-major producer versions", () => {
    const { bundle } = buildProductEcosystemFormalHandoff(buildContractInput());
    const registry = clone(loadIndustrySchemaRegistry());
    const formalSchemas = new Set([
      "industry-signal-event-batch.v1",
      "axis-tool-coverage-report.v1",
      "industry-agent-contribution.v1",
      "daily-industry-evidence-pack-input.v1",
    ]);

    for (const entry of registry.compatibility.entries) {
      if (formalSchemas.has(entry.schema_id)) entry.current_version = "1.1.0";
    }

    expect(validateProductEcosystemFormalHandoff(registry, bundle)).toEqual({
      ok: true,
      status: "accepted_for_dry_run",
    });
  });

  it("rejects unknown higher-major producer versions", () => {
    const { bundle } = buildProductEcosystemFormalHandoff(buildContractInput());
    const higherMajorBundle = clone(bundle);
    higherMajorBundle.payloads[0].schema_version = "2.0.0";

    expect(validateProductEcosystemFormalHandoff(loadIndustrySchemaRegistry(), higherMajorBundle)).toMatchObject({
      ok: false,
      reasonCode: "unsupported_version",
    });
  });

  it("rejects daily refs that are missing from manifest and artifact refs", () => {
    const { bundle } = buildProductEcosystemFormalHandoff(buildContractInput());
    const missingRefBundle = clone(bundle);
    const daily = missingRefBundle.payloads.find((payload) => payload.payload_schema === "daily-industry-evidence-pack-input.v1");
    const missingRef = Array.isArray(daily?.coverage_refs) ? daily.coverage_refs[0] : "";

    missingRefBundle.manifests = missingRefBundle.manifests.filter((manifest) => manifest.artifact_ref !== missingRef);
    missingRefBundle.artifactRefs = missingRefBundle.artifactRefs.filter((artifactRef) => artifactRef !== missingRef);

    expect(validateProductEcosystemFormalHandoff(loadIndustrySchemaRegistry(), missingRefBundle)).toMatchObject({
      ok: false,
      reasonCode: "lineage_failed",
    });
  });

  it("rejects formal bundles with a missing payload", () => {
    const { bundle } = buildProductEcosystemFormalHandoff(buildContractInput());
    const missingPayloadBundle: ProductEcosystemFormalHandoffBundle = {
      ...clone(bundle),
      payloads: bundle.payloads.slice(1),
    };

    expect(validateProductEcosystemFormalHandoff(loadIndustrySchemaRegistry(), missingPayloadBundle)).toMatchObject({
      ok: false,
      reasonCode: "lineage_failed",
    });
  });
});

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
