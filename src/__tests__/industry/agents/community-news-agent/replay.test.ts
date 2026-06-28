import { describe, expect, it } from "vitest";
import antiUpgradeFixture from "../../../../../fixtures/industry/agents/community-news-agent/anti-upgrade/news-pr-heat-without-core.json" with { type: "json" };
import ownerBoundaryFixture from "../../../../../fixtures/industry/agents/community-news-agent/owner-boundary/community-post-news-retell.json" with { type: "json" };
import propagationFixture from "../../../../../fixtures/industry/agents/community-news-agent/propagation/news-retells-community-thread.json" with { type: "json" };
import { buildNewsNarrativeArtifacts } from "../../../../industry/agents/community-news-agent/eventBuilder.ts";
import { buildProductEcosystemHandoff } from "../../../../industry/agents/community-news-agent/handoff.ts";

describe("product ecosystem handoff replay", () => {
  it("keeps daily draft refs stable for the same input window", () => {
    const input = {
      runId: "run-ecosystem-replay",
      threadId: "thread-ecosystem-replay",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T17:40:00+08:00",
      canonicalSourceAvailable: true,
      productPlatform: {
        runId: "run-ecosystem-replay",
        threadId: "thread-ecosystem-replay",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T17:40:00+08:00",
        canonicalSourceAvailable: true,
        availableToolIds: ["vendor-release-notes-feed"],
        sources: [],
      },
      developerStudio: {
        runId: "run-ecosystem-replay",
        threadId: "thread-ecosystem-replay",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T17:40:00+08:00",
        canonicalSourceAvailable: true,
        availableToolIds: ["developer-docs-changelog"],
        sources: [],
      },
      projectOss: {
        runId: "run-ecosystem-replay",
        threadId: "thread-ecosystem-replay",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T17:40:00+08:00",
        canonicalSourceAvailable: true,
        availableToolIds: ["github-release-feed"],
        sources: [],
      },
      cnCommunity: {
        runId: "run-ecosystem-replay",
        threadId: "thread-ecosystem-replay",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T17:40:00+08:00",
        canonicalSourceAvailable: true,
        responsibilityId: "cn-community" as const,
        availableToolIds: ["cn-community-original-thread-index"],
        sources: [],
      },
      globalCommunity: {
        runId: "run-ecosystem-replay",
        threadId: "thread-ecosystem-replay",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T17:40:00+08:00",
        canonicalSourceAvailable: true,
        responsibilityId: "global-community" as const,
        availableToolIds: ["global-community-original-thread-index"],
        sources: [],
      },
      newsPr: {
        runId: "run-ecosystem-replay",
        threadId: "thread-ecosystem-replay",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T17:40:00+08:00",
        canonicalSourceAvailable: true,
        availableToolIds: ["news-pr-narrative-index"],
        sources: [],
      },
    };

    const first = buildProductEcosystemHandoff(input);
    const second = buildProductEcosystemHandoff(input);

    expect(first.dailyInput.envelope.message_id).toBe(second.dailyInput.envelope.message_id);
    expect(first.dailyInput.manifest.artifact_ref).toBe(second.dailyInput.manifest.artifact_ref);
    expect(first.dailyInput.payload.coverage_refs).toHaveLength(5);
    expect(first.dailyInput.payload.contribution_refs).toHaveLength(6);
    expect(first.dailyInput.payload.normalized_event_batch_refs).toHaveLength(6);
  });

  it("replays Phase6 community owner-boundary, propagation, and news anti-upgrade refs", () => {
    const news = buildNewsNarrativeArtifacts({
      runId: "run-community-phase6-replay",
      threadId: "thread-community-phase6-replay",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T17:45:00+08:00",
      availableToolIds: ["news-pr-narrative-index"],
      canonicalSourceAvailable: true,
      sources: [
        {
          sourceId: "news-retell-community-thread",
          displayName: "Media Retell",
          sourceType: ownerBoundaryFixture.retell_source_type as "media_report",
          authorityTier: "ordinary" as const,
          primarySourceDistance: "secondary" as const,
          language: "zh" as const,
          region: "cn",
          bucket: "accepted" as const,
          title: "Media retells community thread",
          summary: "The media report retells an original community post.",
          retellsSourceId: "cn-thread-original",
        },
        {
          sourceId: "news-pr-heat-without-core",
          displayName: "News PR Monitor",
          sourceType: antiUpgradeFixture.source_type as "press_release",
          authorityTier: "ordinary" as const,
          primarySourceDistance: "near_primary" as const,
          language: "zh" as const,
          region: "cn",
          bucket: "diagnostic" as const,
          title: "News PR heat without core product evidence",
          summary: "The press release has narrative heat but no direct core product upgrade evidence.",
        },
      ],
    });
    const retellEvent = news.diagnostic.payload.events.find((event) => event.source.source_id === "news-retell-community-thread");
    const newsPrEvent = news.diagnostic.payload.events.find((event) => event.source.source_id === "news-pr-heat-without-core");

    expect(news.accepted.payload.events).toHaveLength(0);
    expect(retellEvent?.audit.direct_owner_responsibility_id).toBe(ownerBoundaryFixture.original_owner);
    expect(retellEvent?.audit.rejected_reason).toBe(ownerBoundaryFixture.expected_reason);
    expect(retellEvent?.audit.relation_refs[0]).toContain(propagationFixture.expected_relation_ref_prefix);
    expect(newsPrEvent?.source.source_type).toBe(antiUpgradeFixture.source_type);
    expect(newsPrEvent?.audit.direct_owner_responsibility_id).toBe("news-pr");
    expect(propagationFixture.expected_no_double_accepted).toBe(true);
    expect(antiUpgradeFixture.expected_core_upgrade_allowed).toBe(false);
    expect(antiUpgradeFixture.expected_role).toBe("narrative_context_only");
  });
});
