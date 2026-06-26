import { describe, expect, it } from "vitest";
import { renderObserverView } from "../visualConsole/render.ts";
import type { ObserverViewModel } from "../visualConsole/types.ts";

describe("renderObserverView", () => {
  it("shows incubating directions and promotion candidates without changing the observer artifact contract", () => {
    const model: ObserverViewModel = {
      context: {
        mode: "daily",
        selected_date: "2026-06-12",
        selected_window: null,
        entry_kind: "explicit-date",
        resolved_artifacts: [],
        generated_at: "2026-06-12T08:00:00.000Z",
        stale: false,
      },
      banner: {
        title: "Observer",
        context_label: "2026-06-12",
        generated_at: "2026-06-12T08:00:00.000Z",
        enhancement_status: "rules-only",
        mode_label: "rules-only",
        github_enrichment_status: "github-search",
        source_health: "ecosystems=1, candidates=1, incubating=1, promotions=1",
        notes: [],
      },
      state: {
        status: "ready",
        reasons: [],
      },
      time_navigator: {
        mode: "daily",
        current_key: "2026-06-12",
        latest_key: "2026-06-12",
        previous_key: null,
        next_key: null,
        current_label: "2026-06-12",
        stale: false,
        window: {
          current: "2026-06-12",
          previous: null,
          next: null,
          latest: "2026-06-12",
          index: 0,
          total: 1,
        },
        previews: [],
      },
      route_frame: {
        route: "observer",
        hero: null,
        stage: [],
        rail: [],
        strip: [],
        dock: null,
        reader: null,
        audit: [],
      },
      artifact: {
        scope: "ecosystem-focus",
        date: "2026-06-12",
        generated_at: "2026-06-12T08:00:00.000Z",
        status: "active",
        candidate_count: 1,
        ecosystem_counts: {
          "multi-agent-coordination": 1,
        },
        incubating_directions: [
          {
            direction_key: "multi-agent-coordination",
            display_name_cn: "多代理协作生态",
            status: "incubating-active",
            observer_hits_7d: 3,
            candidate_repo_count: 1,
            related_ecosystems: ["multi-agent-coordination"],
            related_catalog_direction_keys: ["workflow-automation-agent"],
            related_gap_pressure_states: ["pressurized"],
            representative_repos: [
              {
                repo_full_name: "acme/swarm-today",
                repo_url: "https://github.com/acme/swarm-today",
              },
            ],
            evidence: ["observer_hits_7d=3", "gap_pressure=pressurized"],
            unmet_gates: [],
            promotion_candidate: true,
            review_queue: "observer promotion review",
          },
        ],
        promotion_candidates: [
          {
            direction_key: "multi-agent-coordination",
            display_name_cn: "多代理协作生态",
            evidence: ["observer_hits_7d=3", "gap_pressure=pressurized"],
            unmet_gates: [],
          },
        ],
        notes: [],
        entries: [
          {
            repo_full_name: "acme/swarm-today",
            repo_url: "https://github.com/acme/swarm-today",
            observed_at: "2026-06-12T08:00:00.000Z",
            observer_rank: 1,
            observer_score: 87,
            ecosystems: ["multi-agent-coordination"],
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
          },
        ],
      },
    };

    const rendered = renderObserverView(model);
    expect(rendered).toContain("## Incubating Directions");
    expect(rendered).toContain("multi-agent-coordination: status=incubating-active");
    expect(rendered).toContain("## Promotion Review");
    expect(rendered).toContain("display_name=多代理协作生态");
  });

  it("stays compatible with legacy observer artifacts that do not yet include incubating fields", () => {
    const model: ObserverViewModel = {
      context: {
        mode: "daily",
        selected_date: "2026-06-11",
        selected_window: null,
        entry_kind: "explicit-date",
        resolved_artifacts: [],
        generated_at: "2026-06-11T08:00:00.000Z",
        stale: false,
      },
      banner: {
        title: "Observer",
        context_label: "2026-06-11",
        generated_at: "2026-06-11T08:00:00.000Z",
        enhancement_status: "rules-only",
        mode_label: "rules-only",
        github_enrichment_status: "github-search",
        source_health: "ecosystems=1, candidates=1, incubating=0, promotions=0",
        notes: [],
      },
      state: {
        status: "ready",
        reasons: [],
      },
      time_navigator: {
        mode: "daily",
        current_key: "2026-06-11",
        latest_key: "2026-06-11",
        previous_key: null,
        next_key: null,
        current_label: "2026-06-11",
        stale: false,
        window: {
          current: "2026-06-11",
          previous: null,
          next: null,
          latest: "2026-06-11",
          index: 0,
          total: 1,
        },
        previews: [],
      },
      route_frame: {
        route: "observer",
        hero: null,
        stage: [],
        rail: [],
        strip: [],
        dock: null,
        reader: null,
        audit: [],
      },
      artifact: {
        scope: "ecosystem-focus",
        date: "2026-06-11",
        generated_at: "2026-06-11T08:00:00.000Z",
        status: "active",
        candidate_count: 1,
        ecosystem_counts: {
          "coding-agents": 1,
        },
        notes: [],
        entries: [
          {
            repo_full_name: "openai/codex",
            repo_url: "https://github.com/openai/codex",
            observed_at: "2026-06-11T08:00:00.000Z",
            ecosystems: ["coding-agents"],
            matched_by: {
              keywords: ["codex"],
              topic_hints: ["coding-agent"],
              repo_seeds: [],
              org_seeds: [],
            },
            source_notes: ["candidate_pool=github-search"],
          },
        ],
      } as unknown as ObserverViewModel["artifact"],
    };

    const rendered = renderObserverView(model);
    expect(rendered).toContain("## Incubating Directions");
    expect(rendered).toContain("- no incubating directions");
    expect(rendered).toContain("## Promotion Review");
    expect(rendered).toContain("- no promotion candidates");
  });
});
