import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildPaperCitationTrace } from "../../../../industry/agents/academic-agent/paperCitationTrace.ts";
import { assessPaperFreshness } from "../../../../industry/agents/academic-agent/paperFreshness.ts";
import { buildConferenceEvent } from "../../../../industry/agents/academic-agent/conferenceEventBuilder.ts";
import type { ConferenceSeed, PaperSeed } from "../../../../industry/agents/academic-agent/types.ts";

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
}

describe("academic-agent unit", () => {
  it("builds citation trace for papers", () => {
    const seeds = readJson<PaperSeed[]>("data/industry-seeds/agents/academic-agent/paper.seeds.json");
    const trace = buildPaperCitationTrace(seeds[0]!);

    expect(trace.status).toBe("complete");
    expect(trace.citation_refs[0]).toContain("arxiv:");
  });

  it("keeps paper freshness separate from scrape time", () => {
    const freshness = assessPaperFreshness("first_release", "2026-06-18T00:00:00.000Z", "2026-06-20T00:00:00.000Z");
    expect(freshness.profile_id).toBe("academic.paper.first_release");
    expect(freshness.state).toBe("fresh");
  });

  it("distinguishes conference official material from weak venue records", () => {
    const seeds = readJson<ConferenceSeed[]>("data/industry-seeds/agents/academic-agent/conference.seeds.json");
    const accepted = buildConferenceEvent(seeds[0]!);
    const rejected = buildConferenceEvent(seeds[2]!);

    expect(accepted.audit.bucket).toBe("accepted");
    expect(rejected.audit.bucket).toBe("rejected");
    expect(rejected.audit.reason_codes).toContain("missing_canonical_venue");
  });
});
