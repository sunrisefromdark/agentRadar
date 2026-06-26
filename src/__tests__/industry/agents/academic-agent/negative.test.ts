import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildPaperEvent } from "../../../../industry/agents/academic-agent/paperEventBuilder.ts";
import type { OwnerBoundaryFixture, PaperSeed } from "../../../../industry/agents/academic-agent/types.ts";

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
}

describe("academic-agent negative fixtures", () => {
  it("guards against upgrading a lone preprint into core evidence", () => {
    const seed = readJson<PaperSeed>("fixtures/industry/agents/academic-agent/eval/anti-upgrade-preprint.json");
    const event = buildPaperEvent(seed);

    expect(event.audit.anti_upgrade_guard).toBe("single_preprint_not_core");
    expect(event.audit.bucket).toBe("accepted");
  });

  it("keeps academic as the direct owner when news relays a paper fact", () => {
    const fixture = readJson<OwnerBoundaryFixture>(
      "fixtures/industry/agents/academic-agent/owner-boundary/news-relays-paper.json",
    );

    expect(fixture.direct_owner_axis).toBe("research_paper");
    expect(fixture.direct_owner_agent_id).toBe("academic-agent");
    expect(fixture.relayed_by_axis).toBe("news_pr_narrative");
  });
});
