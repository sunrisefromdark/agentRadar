import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildAcademicHandoffBundle,
  buildAcademicPrepBundle,
} from "../../../../industry/agents/academic-agent/handoff.ts";
import type { ReplayWindowFixture } from "../../../../industry/agents/academic-agent/types.ts";
import { validateAcademicHandoff } from "../../../../industry/platform/contracts/academicHandoff.ts";
import { loadIndustrySchemaRegistry } from "../../../../industry/platform/contracts/schemaRegistry.ts";

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
}

describe("academic-agent contract", () => {
  it("produces Phase 1A-ready academic handoff artifacts", () => {
    const fixture = readJson<ReplayWindowFixture>(
      "fixtures/industry/agents/academic-agent/replay/academic-replay-window.json",
    );
    const bundle = buildAcademicPrepBundle(fixture);

    expect(bundle.event_batches).toHaveLength(8);
    expect(bundle.coverage_reports).toHaveLength(2);
    expect(bundle.contributions).toHaveLength(2);
    expect(bundle.events.every((event) => event.execution_context.primary_responsibility_id === event.responsibility_id)).toBe(true);
    expect(bundle.daily_input.payload.coverage_refs).toHaveLength(2);
    expect(bundle.daily_input.payload.contribution_refs).toHaveLength(2);
    expect(bundle.daily_input.payload.normalized_event_batch_refs).toHaveLength(2);
    expect(bundle.event_batches[0]?.payload.payload_schema).toBe("industry-signal-event-batch.v1");
    expect(bundle.event_batches[0]?.payload.schema_version).toBe("1.0.0");
    expect(bundle.daily_input.payload.payload_schema).toBe("daily-industry-evidence-pack-input.v1");
    expect(bundle.contributions[0]?.payload.payload_schema).toBe("industry-agent-contribution.v1");
    for (const artifact of bundle.event_batches) {
      expect(artifact.ref).toMatch(/^industry:\/\/internal\//);
      expect(artifact.payload.agent_contribution_ref).toMatch(/^industry:\/\/internal\//);
      expect(artifact.payload.tool_status_report_refs).toHaveLength(1);
      expect(artifact.payload.events_ref).toBe(artifact.ref);
    }

    for (const artifact of bundle.contributions) {
      expect(artifact.payload.event_count).toBe(
        artifact.payload.accepted_event_count +
          artifact.payload.rejected_event_count +
          artifact.payload.counter_event_count,
      );
      expect(artifact.payload.actual_agent_id).toBe("academic-agent");
    }
  });

  it("wraps the academic artifacts as a formal bundle middle-platform can dry-run directly", () => {
    const fixture = readJson<ReplayWindowFixture>(
      "fixtures/industry/agents/academic-agent/replay/academic-replay-window.json",
    );
    const bundle = buildAcademicHandoffBundle(fixture);

    expect(bundle.messages).toHaveLength(13);
    expect(bundle.manifests).toHaveLength(13);
    expect(bundle.payloads).toHaveLength(13);
    expect(bundle.artifactRefs).toHaveLength(13);
    expect(bundle.replayFixtureRefs).toEqual([
      "fixtures/industry/agents/academic-agent/replay/academic-replay-window.json",
    ]);
    expect(bundle.evalFixtureRefs).toEqual([
      "fixtures/industry/agents/academic-agent/eval/anti-upgrade-preprint.json",
    ]);
    expect(bundle.ownerBoundaryFixtureRefs).toEqual([
      "fixtures/industry/agents/academic-agent/owner-boundary/news-relays-paper.json",
    ]);
    expect(validateAcademicHandoff(loadIndustrySchemaRegistry(), bundle)).toEqual({
      ok: true,
      status: "accepted_for_dry_run",
    });
  });

  it("changes artifact refs when payload content changes within the same run", () => {
    const fixture = readJson<ReplayWindowFixture>(
      "fixtures/industry/agents/academic-agent/replay/academic-replay-window.json",
    );
    const changedFixture: ReplayWindowFixture = {
      ...fixture,
      paper_seeds: fixture.paper_seeds.map((seed, index) =>
        index === 0
          ? {
              ...seed,
              summary_cn: `${seed.summary_cn}（回归测试内容变更）`,
            }
          : seed,
      ),
    };

    const baseline = buildAcademicPrepBundle(fixture);
    const changed = buildAcademicPrepBundle(changedFixture);
    const baselineAccepted = baseline.event_batches.find(
      (artifact) => artifact.payload.axis === "research_paper" && artifact.payload.bucket === "accepted",
    );
    const changedAccepted = changed.event_batches.find(
      (artifact) => artifact.payload.axis === "research_paper" && artifact.payload.bucket === "accepted",
    );

    expect(changedAccepted?.ref).not.toBe(baselineAccepted?.ref);
    expect(changed.contributions[0]?.ref).not.toBe(baseline.contributions[0]?.ref);
    expect(changed.daily_input.ref).not.toBe(baseline.daily_input.ref);
  });
});
