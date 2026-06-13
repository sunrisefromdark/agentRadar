import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");

function readWorkspaceFile(relativePath: string): string {
  return fs.readFileSync(path.join(workspaceRoot, relativePath), "utf-8");
}

function readIfExists(relativePath: string): string | null {
  const absolutePath = path.join(workspaceRoot, relativePath);
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf-8") : null;
}

describe("project search system redesign design contract", () => {
  it("defines the frozen direction coverage status contract in src/types.ts", () => {
    const source = readWorkspaceFile("src/types.ts");

    expect(source).toContain("interface DirectionCoverageStatus");
    expect(source).toContain('export type DirectionCoverageOutcome =');
    expect(source).toContain('| "matched"');
    expect(source).toContain('| "weak_signal"');
    expect(source).toContain('| "noise_only"');
    expect(source).toContain('| "zero_candidate"');
    expect(source).toContain('| "search_failed"');
    expect(source).toContain('| "disabled"');
    expect(source).toContain('export type DirectionSearchDepth = "scout" | "deep";');
    expect(source).toContain(
      'export type DirectionLaneType = "canonical" | "job-to-be-done" | "user-speak" | "ecosystem" | "adjacent-software";',
    );
    expect(source).toContain(
      'export type DirectionPressureState = "normal" | "pressurized" | "promoted" | "relieved";',
    );
    expect(source).toContain("query_pack_count: number;");
    expect(source).toContain("query_template_count: number;");
    expect(source).toContain("boundary_passed_hits: number;");
    expect(source).toContain("quantity_target_met: boolean;");
    expect(source).toContain("exposed_hits: number;");
    expect(source).toContain('next_action:');
    expect(source).toContain('| "keep_watching"');
    expect(source).toContain('| "upgrade_to_deep"');
    expect(source).toContain('| "wait_for_more_signal"');
    expect(source).toContain('| "needs_human_seed_refinement"');
    expect(source).toContain('| "observer_promotion_candidate"');
    expect(source).toContain("search_exhausted?: boolean;");
  });

  it("extends DailyReport with the redesign output fields and compatibility aliases", () => {
    const source = readWorkspaceFile("src/types.ts");

    expect(source).toContain("interface DailyExposureProject");
    expect(source).toContain("today_pulse_projects: Array<DailyExposureProject>;");
    expect(source).toContain("mission_match_projects: Array<DailyExposureProject>;");
    expect(source).toContain("explore_ribbon_projects?: Array<DailyExposureProject>;");
    expect(source).toContain("coverage_atlas: Array<DirectionCoverageStatus>;");
    expect(source).toContain("gap_ledger: Array<DirectionCoverageStatus>;");
    expect(source).toContain("global_hot_projects = today_pulse_projects");
    expect(source).toContain("demand_relevant_projects = mission_match_projects");
    expect(source).toContain("searched_direction_statuses = coverage_atlas");
  });

  it("adds the mission discovery modules called out by the design", () => {
    expect(fs.existsSync(path.join(workspaceRoot, "src/signal/missionScoutDiscovery.ts"))).toBe(true);
    expect(fs.existsSync(path.join(workspaceRoot, "src/signal/missionDeepDiscovery.ts"))).toBe(true);
  });

  it("renders the redesigned daily product surface instead of the legacy single-board wording", () => {
    const source = readWorkspaceFile("src/action/dailyReport.ts");

    expect(source).toContain("今日全局脉冲");
    expect(source).toContain("方向覆盖总览");
    expect(source).toContain("与你当前任务更相关");
    expect(source).toContain("方向缺口账本");
    expect(source).toContain("历史补充观察");
    expect(source).toContain("explore_ribbon_projects");
  });

  it("keeps the 16 must-cover directions frozen in the implementation catalog", () => {
    const catalogPath = path.join(workspaceRoot, "src/signal/missionCatalog.ts");
    expect(fs.existsSync(catalogPath)).toBe(true);

    const source = fs.readFileSync(catalogPath, "utf-8");
    const expectedDirectionKeys = [
      "coding-agent",
      "browser-computer-use",
      "workflow-automation-agent",
      "research-knowledge-agent",
      "shopping-commerce-agent",
      "sales-prospecting-agent",
      "customer-support-agent",
      "marketing-content-ops-agent",
      "finance-investment-research-agent",
      "data-analytics-bi-agent",
      "legal-compliance-agent",
      "security-soc-agent",
      "healthcare-ops-agent",
      "recruiting-hr-agent",
      "supply-chain-procurement-agent",
      "industrial-field-ops-agent",
    ];

    for (const directionKey of expectedDirectionKeys) {
      expect(source).toContain(directionKey);
    }
  });

  it("freezes the four families and sixteen must-cover directions without silent expansion or shrinkage", () => {
    const catalogPath = path.join(workspaceRoot, "src/signal/missionCatalog.ts");
    expect(fs.existsSync(catalogPath)).toBe(true);

    const source = fs.readFileSync(catalogPath, "utf-8");
    const familyKeys = [
      "core-agent-work",
      "revenue-commerce",
      "analysis-professional",
      "vertical-ops",
    ];
    const directionKeys = [
      "coding-agent",
      "browser-computer-use",
      "workflow-automation-agent",
      "research-knowledge-agent",
      "shopping-commerce-agent",
      "sales-prospecting-agent",
      "customer-support-agent",
      "marketing-content-ops-agent",
      "finance-investment-research-agent",
      "data-analytics-bi-agent",
      "legal-compliance-agent",
      "security-soc-agent",
      "healthcare-ops-agent",
      "recruiting-hr-agent",
      "supply-chain-procurement-agent",
      "industrial-field-ops-agent",
    ];

    for (const familyKey of familyKeys) {
      expect(source).toContain(familyKey);
    }

    const matchedDirections = directionKeys.filter((directionKey) => source.includes(directionKey));
    expect(matchedDirections).toHaveLength(16);
  });

  it("freezes the hard quantity thresholds and seat quotas in mission discovery config", () => {
    const combinedSource = [
      readIfExists("src/signal/missionCatalog.ts"),
      readIfExists("src/signal/missionScoutDiscovery.ts"),
      readIfExists("src/signal/missionDeepDiscovery.ts"),
      readIfExists("src/signal/missionDiscoveryConfig.ts"),
      readIfExists("src/action/dailyReport.ts"),
      readIfExists("src/types.ts"),
    ]
      .filter((value): value is string => value !== null)
      .join("\n");

    expect(combinedSource).toContain("3");
    expect(combinedSource).toContain("20");
    expect(combinedSource).toContain("6");
    expect(combinedSource).toContain("2");
    expect(combinedSource).toContain("300");
    expect(combinedSource).toContain("180");
    expect(combinedSource).toContain("12");
    expect(combinedSource).toContain("4");

    expect(combinedSource).toMatch(/query[_ -]?pack.*3|3.*query[_ -]?pack/i);
    expect(combinedSource).toMatch(/raw[_ -]?hits?.*20|20.*raw[_ -]?hits?/i);
    expect(combinedSource).toMatch(/normalized[_ -]?hits?.*6|6.*normalized[_ -]?hits?/i);
    expect(combinedSource).toMatch(/quality[_ -]?passed[_ -]?hits?.*2|2.*quality[_ -]?passed[_ -]?hits?/i);
    expect(combinedSource).toMatch(/300/);
    expect(combinedSource).toMatch(/180/);
    expect(combinedSource).toMatch(/12/);
    expect(combinedSource).toMatch(/anchor/i);
    expect(combinedSource).toMatch(/challenger/i);
  });

  it("guards the redesigned section quotas and prevents explore ribbon from masquerading as mission matches", () => {
    const combinedSource = [
      readIfExists("src/action/dailyReport.ts"),
      readIfExists("src/signal/missionDeepDiscovery.ts"),
      readIfExists("src/signal/missionDiscoveryConfig.ts"),
      readIfExists("src/types.ts"),
    ]
      .filter((value): value is string => value !== null)
      .join("\n");

    expect(combinedSource).toContain("today_pulse_projects");
    expect(combinedSource).toContain("mission_match_projects");
    expect(combinedSource).toContain("explore_ribbon_projects");
    expect(combinedSource).toMatch(/anchor/i);
    expect(combinedSource).toMatch(/challenger/i);
    expect(combinedSource).toMatch(/quota|seat/i);
    expect(combinedSource).not.toContain("explore_ribbon_projects = mission_match_projects");
  });

  it("freezes mission section fairness rules so one direction or family cannot dominate the task area", () => {
    const combinedSource = [
      readIfExists("src/signal/missionDeepDiscovery.ts"),
      readIfExists("src/signal/missionDiscoveryConfig.ts"),
      readIfExists("src/action/dailyReport.ts"),
      readIfExists("src/types.ts"),
    ]
      .filter((value): value is string => value !== null)
      .join("\n");

    expect(combinedSource).toContain("direction_matches");
    expect(combinedSource).toMatch(/family/i);
    expect(combinedSource).toMatch(/top.?3|first.?3|前三/i);
    expect(combinedSource).toMatch(/same.?direction|direction.*max|同一方向最多占.?1席/i);
    expect(combinedSource).toMatch(/same.?family|family.*max|同一家族.*最多占.?2席/i);
  });

  it("requires human-readable semantics for the six direction outcomes", () => {
    const combinedSource = [
      readIfExists("src/action/dailyReport.ts"),
      readIfExists("src/signal/missionScoutDiscovery.ts"),
      readIfExists("src/signal/missionDeepDiscovery.ts"),
      readIfExists("src/types.ts"),
    ]
      .filter((value): value is string => value !== null)
      .join("\n");

    expect(combinedSource).toContain("matched");
    expect(combinedSource).toContain("weak_signal");
    expect(combinedSource).toContain("noise_only");
    expect(combinedSource).toContain("zero_candidate");
    expect(combinedSource).toContain("search_failed");
    expect(combinedSource).toContain("disabled");
    expect(combinedSource).toMatch(/今天这个方向有真结果|真实命中|有真结果/);
    expect(combinedSource).toMatch(/今天看到了苗头|还不够格推荐|苗头/);
    expect(combinedSource).toMatch(/搜过了.*不是你要的|大多不是你要的那类|噪声/);
    expect(combinedSource).toMatch(/认真搜过.*没有找到候选|暂时没有找到候选/);
    expect(combinedSource).toMatch(/搜索本身失败|search failed|本次方向发现降级/);
  });

  it("locks the mission degradation semantics so failures do not get disguised as fake matches", () => {
    const combinedSource = [
      readIfExists("src/signal/missionScoutDiscovery.ts"),
      readIfExists("src/signal/missionDeepDiscovery.ts"),
      readIfExists("src/action/dailyReport.ts"),
      readIfExists("src/types.ts"),
    ]
      .filter((value): value is string => value !== null)
      .join("\n");

    expect(combinedSource).toContain("coverage_atlas");
    expect(combinedSource).toContain("gap_ledger");
    expect(combinedSource).toContain("search_exhausted");
    expect(combinedSource).toMatch(/deep attempted but failed|deep.*failed/i);
    expect(combinedSource).toMatch(/schema_stale/i);
    expect(combinedSource).toMatch(/observer/i);
    expect(combinedSource).toMatch(/context_only/i);
    expect(combinedSource).toMatch(/不允许.*伪装|不允许.*提升为需求命中|不允许.*回填旧结果/);
    expect(combinedSource).toMatch(/今日全局脉冲/);
    expect(combinedSource).toMatch(/方向覆盖总览/);
    expect(combinedSource).toMatch(/方向缺口账本/);
  });

  it("keeps dry-run mission discovery auditable without forcing live GitHub search", () => {
    const source = readWorkspaceFile("src/cli.ts");

    expect(source).toContain("allowDryRunSkipLiveDeep");
    expect(source).toContain("enableLiveSearch:");
    expect(source).toContain("dryRun && config.runtime.mission.allowDryRunSkipLiveDeep");
  });
});
