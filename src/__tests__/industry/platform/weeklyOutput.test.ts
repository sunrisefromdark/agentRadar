import { describe, expect, it } from "vitest";
import academicBundle from "../../../../fixtures/industry/agents/academic-agent/replay/phase1-current-bundle.json" with { type: "json" };
import policyBundle from "../../../../fixtures/industry/agents/policy-agent/replay/phase1-current-bundle.json" with { type: "json" };
import { buildProductEcosystemFormalHandoff } from "../../../industry/agents/community-news-agent/formalHandoff.ts";
import { buildCounterEvidenceAudit } from "../../../industry/platform/audit/counterEvidenceAudit.ts";
import { buildClosedFactSnapshot } from "../../../industry/platform/normalization/factSnapshot.ts";
import { buildProductEcosystemInput } from "../../../industry/platform/normalization/industryRuntimeSummary.ts";
import { buildConsumerWeeklyIndustryView } from "../../../industry/platform/output/consumerProjection.ts";
import { buildPublicWeeklyIndustryProjection } from "../../../industry/platform/output/publicProjection.ts";
import { buildWeeklyIndustryTrendSection } from "../../../industry/platform/output/weeklySection.ts";
import { buildClaimCandidateBatch } from "../../../industry/platform/trend/claimBuilder.ts";
import { buildTierDecisionInput, decideClaimLedger } from "../../../industry/platform/trend/tierDecision.ts";

describe("industry platform weekly packaging", () => {
  it("materializes separated internal, consumer, and public weekly artifacts from claim ledger", () => {
    const claimLedger = claimLedgerResult();
    if (!claimLedger.ok) throw new Error(claimLedger.message);

    const section = buildWeeklyIndustryTrendSection({
      date: "2026-06-26",
      claimLedger,
    });
    const consumer = buildConsumerWeeklyIndustryView({
      date: "2026-06-26",
      section,
    });
    const publicProjection = buildPublicWeeklyIndustryProjection({
      date: "2026-06-26",
      section,
    });

    expect(section).toMatchObject({
      schema_version: "weekly-industry-trend-section.v2",
      publication_readiness_status: "blocked_public_output",
      core_industry_trends: [],
      lineage_refs: {
        claim_ledger_refs: expect.any(Array),
      },
    });
    expect(consumer).toMatchObject({
      schema_version: "consumer-weekly-industry-view.v1",
      view_scope: "internal-product",
    });
    expect(publicProjection).toMatchObject({
      schema_version: "public-weekly-industry-projection.v1",
      headline_core_card_ids: [],
      tier_visible_card_ids: [],
      blocked_reason_codes: ["no_public_ready_cards"],
    });
    expect(consumer.visible_card_ids.length).toBe(section.observing_industry_trends.length + section.insufficient_evidence_directions.length);
    expect(publicProjection.blocked_card_ids.length).toBe(section.observing_industry_trends.length + section.insufficient_evidence_directions.length);
  });
});

function claimLedgerResult() {
  const { bundle: productBundle } = buildProductEcosystemFormalHandoff(buildProductEcosystemInput());
  const snapshot = buildClosedFactSnapshot({
    date: "2026-06-26",
    bundles: [
      { group: "policy_finance", bundle: policyBundle },
      { group: "academic", bundle: academicBundle },
      { group: "product_ecosystem", bundle: productBundle },
    ],
  });
  const claimBatch = buildClaimCandidateBatch({
    date: "2026-06-26",
    snapshot,
  });
  const audit = buildCounterEvidenceAudit({
    date: "2026-06-26",
    claimBatch,
  });
  const decisionInput = buildTierDecisionInput({
    date: "2026-06-26",
    claimBatch,
    audit,
  });
  return decideClaimLedger({
    date: "2026-06-26",
    decisionInput,
    claimBatch,
    audit,
  });
}
