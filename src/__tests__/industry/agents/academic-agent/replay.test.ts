import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildAcademicPrepBundle } from "../../../../industry/agents/academic-agent/handoff.ts";
import type { ReplayWindowFixture } from "../../../../industry/agents/academic-agent/types.ts";

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
}

describe("academic-agent replay", () => {
  it("replays a historical window into daily handoff inputs", () => {
    const fixture = readJson<ReplayWindowFixture>(
      "fixtures/industry/agents/academic-agent/replay/academic-replay-window.json",
    );
    const bundle = buildAcademicPrepBundle(fixture);

    expect(bundle.events.length).toBeGreaterThanOrEqual(4);
    expect(bundle.daily_input.payload.source_message_ids).toHaveLength(8);
    expect(bundle.daily_input.manifest.summary_cn).toContain("daily");
  });
});
