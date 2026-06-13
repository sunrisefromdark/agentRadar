import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { SourceConfig } from "../config.ts";
import { buildObserverIncubatorArtifacts } from "../signal/ecosystemFocusObserver.ts";
import type { EcosystemObserverArtifact, EcosystemObserverEntry } from "../types.ts";

function makeWorkspaceRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "observer-incubator-"));
}

function writeObserverArtifact(root: string, artifact: EcosystemObserverArtifact): void {
  const dir = path.join(root, "data", "observer", "ecosystem-focus");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${artifact.date}.json`), JSON.stringify(artifact, null, 2));
}

function makeEntry(ecosystem: string, repoFullName: string): EcosystemObserverEntry {
  return {
    repo_full_name: repoFullName,
    repo_url: `https://github.com/${repoFullName}`,
    observed_at: "2026-06-12T08:00:00.000Z",
    ecosystems: [ecosystem],
    matched_by: {
      keywords: ["multi-agent"],
      topic_hints: ["swarm"],
      repo_seeds: [],
      org_seeds: [],
    },
    source_notes: ["candidate_pool=github-search"],
    stars: 120,
    forks: 8,
    issues: 2,
    PR: 1,
  };
}

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("buildObserverIncubatorArtifacts", () => {
  it("promotes only directions that satisfy all frozen gates", () => {
    const workspaceRoot = makeWorkspaceRoot();
    roots.push(workspaceRoot);

    const config = {
      enabled: true,
      mode: "github-search",
      recentDays: 7,
      perEcosystemLimit: 10,
      maxTotalCandidates: 20,
      historicalPrecisionDays: 7,
      judgeTopN: 5,
      priorityEntities: { builders: [], companies: [], engineers: [] },
      entityTiers: {
        core: { builders: [], companies: [], engineers: [] },
        proven: { builders: [], companies: [], engineers: [] },
        watch: { builders: [], companies: [], engineers: [] },
      },
      ecosystems: [
        {
          name: "multi-agent-coordination",
          enabled: true,
          keywords: ["multi-agent", "coordination", "workflow"],
          topicHints: ["swarm", "multi-agent"],
          repoSeeds: [],
          orgSeeds: [],
          negativeKeywords: [],
        },
      ],
    } satisfies SourceConfig["ecosystemFocus"];

    for (const date of ["2026-06-10", "2026-06-11"]) {
      writeObserverArtifact(workspaceRoot, {
        scope: "ecosystem-focus",
        date,
        generated_at: `${date}T08:00:00.000Z`,
        status: "active",
        candidate_count: 1,
        ecosystem_counts: { "multi-agent-coordination": 1 },
        incubating_directions: [],
        promotion_candidates: [],
        notes: [],
        entries: [makeEntry("multi-agent-coordination", `acme/swarm-${date}`)],
      });
    }

    const result = buildObserverIncubatorArtifacts({
      date: "2026-06-12",
      config,
      entries: [makeEntry("multi-agent-coordination", "acme/swarm-today")],
      workspaceRoot,
      gapPressureStates: {
        "workflow-automation-agent": {
          pressure_state: "pressurized",
          counts: { search_zero_result: 2 },
        },
      },
    });

    expect(result.incubatingDirections).toHaveLength(1);
    expect(result.incubatingDirections[0]?.observer_hits_7d).toBe(3);
    expect(result.incubatingDirections[0]?.promotion_candidate).toBe(true);
    expect(result.incubatingDirections[0]?.unmet_gates).toEqual([]);
    expect(result.promotionCandidates.map((item) => item.direction_key)).toEqual(["multi-agent-coordination"]);
  });

  it("lists unmet gates instead of silently auto-promoting duplicate observer directions", () => {
    const workspaceRoot = makeWorkspaceRoot();
    roots.push(workspaceRoot);

    const config = {
      enabled: true,
      mode: "github-search",
      recentDays: 7,
      perEcosystemLimit: 10,
      maxTotalCandidates: 20,
      historicalPrecisionDays: 7,
      judgeTopN: 5,
      priorityEntities: { builders: [], companies: [], engineers: [] },
      entityTiers: {
        core: { builders: [], companies: [], engineers: [] },
        proven: { builders: [], companies: [], engineers: [] },
        watch: { builders: [], companies: [], engineers: [] },
      },
      ecosystems: [
        {
          name: "coding-agents",
          enabled: true,
          keywords: ["claude code", "codex"],
          topicHints: ["coding-agent"],
          repoSeeds: [],
          orgSeeds: [],
          negativeKeywords: [],
        },
      ],
    } satisfies SourceConfig["ecosystemFocus"];

    const result = buildObserverIncubatorArtifacts({
      date: "2026-06-12",
      config,
      entries: [makeEntry("coding-agents", "openai/codex-fork")],
      workspaceRoot,
      gapPressureStates: {},
    });

    expect(result.incubatingDirections).toHaveLength(1);
    expect(result.incubatingDirections[0]?.promotion_candidate).toBe(false);
    expect(result.incubatingDirections[0]?.unmet_gates).toEqual(
      expect.arrayContaining([
        "observer_hits_7d<3",
        "duplicate_must_cover_direction",
        "missing_gap_pressure_or_feedback",
      ]),
    );
    expect(result.promotionCandidates).toEqual([]);
  });
});
