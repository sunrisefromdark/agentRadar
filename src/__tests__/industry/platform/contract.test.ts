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

describe("industry platform contracts", () => {
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
    expect(registry.compatibility.entries.map((entry) => entry.schema_id)).not.toContain("tool-status-report.v1");
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
  });
});
