import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildAcademicPrepBundle } from "../../../../industry/agents/academic-agent/handoff.ts";
import type { ReplayWindowFixture } from "../../../../industry/agents/academic-agent/types.ts";

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
}

describe("academic-agent contract", () => {
  it("produces canonical event batches plus explicit local seams for the unfinished handoff pieces", () => {
    const fixture = readJson<ReplayWindowFixture>(
      "fixtures/industry/agents/academic-agent/replay/academic-replay-window.json",
    );
    const bundle = buildAcademicPrepBundle(fixture);

    expect(bundle.event_batches).toHaveLength(8);
    expect(bundle.coverage_reports).toHaveLength(2);
    expect(bundle.contributions).toHaveLength(2);
    expect(bundle.daily_input.payload.coverage_refs).toHaveLength(2);
    expect(bundle.daily_input.payload.contribution_refs).toHaveLength(2);
    expect(bundle.daily_input.payload.normalized_event_batch_refs).toHaveLength(2);
    expect(bundle.event_batches[0]?.payload.schema_version).toBe("event-batch.v1");
    expect(bundle.daily_input.payload.upstream_payload_schema).toBe("daily-industry-evidence-pack-input.v1");
    expect(bundle.contributions[0]?.payload.upstream_payload_schema).toBe("industry-agent-contribution.v1");
    for (const artifact of bundle.event_batches) {
      expect(artifact.payload.agent_contribution_ref).toMatch(/^artifact:\/\/academic-agent\//);
      expect(artifact.payload.tool_status_report_refs).toHaveLength(1);
    }

    for (const artifact of bundle.contributions) {
      expect(artifact.payload.event_count).toBe(
        artifact.payload.accepted_event_count +
          artifact.payload.rejected_event_count +
          artifact.payload.counter_event_count,
      );
    }
  });
});
