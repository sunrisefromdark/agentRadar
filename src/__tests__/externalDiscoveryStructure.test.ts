import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { EXTERNAL_DIRECTION_LABELS } from "../externalDiscovery/types.ts";

const repoRoot = process.cwd();

function readText(...segments: string[]): string {
  return fs
    .readFileSync(path.join(repoRoot, ...segments), "utf8")
    .replace(/\r\n/g, "\n");
}

describe("external discovery OSS artifact structure", () => {
  it("keeps local external raw input out of default GitHub Actions upload paths", () => {
    const dailyWorkflow = readText(
      ".github",
      "workflows",
      "trend-radar-daily.yml",
    );
    const weeklyWorkflow = readText(
      ".github",
      "workflows",
      "trend-radar-weekly.yml",
    );

    expect(dailyWorkflow).not.toContain("data/raw/external-discovery");
    expect(weeklyWorkflow).not.toContain("data/raw/external-discovery");
    expect(dailyWorkflow).toContain(
      "data/external-discovery/${{ steps.options.outputs.target_date }}.aggregate.json",
    );
    expect(dailyWorkflow).toContain("data/external-discovery/latest.aggregate.json");
  });

  it("protects local-only external raw input in .gitignore while allowing sanitized fixtures", () => {
    const gitignore = readText(".gitignore");

    expect(gitignore).toContain("data/raw/external-discovery/**");
    expect(gitignore).toContain(
      "!data/raw/external-discovery/fixtures/*.sanitized.json",
    );
    expect(gitignore).toContain(
      "!data/raw/external-discovery/fixtures/*.sanitized.jsonl",
    );
  });

  it("documents the external discovery public artifact policy in data README", () => {
    const dataReadme = readText("data", "README.md");

    expect(dataReadme).toContain("data/raw/external-discovery/");
    expect(dataReadme).toContain("local-only");
    expect(dataReadme).toContain("sanitized fixture");
    expect(dataReadme).toContain("data/external-discovery/*.aggregate.json");
    expect(dataReadme).toContain("*.events.jsonl");
    expect(dataReadme).toContain("public_safe=true");
    expect(dataReadme).toContain("contains_raw_text=false");
    expect(dataReadme).toContain("contains_profile_urls=false");
    expect(dataReadme).toContain("source_input_hash");
  });

  it("documents OSS no-account-state external discovery in public READMEs", () => {
    const zhReadme = readText("README.md");
    const enReadme = readText("README.en.md");

    expect(zhReadme).toContain("AgentReach 外部发现原始输入边界");
    expect(zhReadme).toContain("默认不提交、不上传");
    expect(zhReadme).toContain("不保存、不读取、不暴露登录态数据");
    expect(zhReadme).toContain("[data/README.md](./data/README.md)");

    expect(enReadme).toMatch(/external discovery/i);
    expect(enReadme).toMatch(/raw input boundary/i);
    expect(enReadme).toMatch(
      /must not save, read, or expose login state, cookies, sessions, OAuth data, account settings, or platform API credentials/i,
    );
    expect(enReadme).toContain("[data/README.md](./data/README.md)");
  });

  it("keeps design and ExecPlan sync targets aligned for external artifact policy", () => {
    const design = readText(
      "docs",
      "specs",
      "design-docs",
      "agent-reach-external-discovery-and-evidence-design.md",
    );
    const execPlan = readText(
      "docs",
      "specs",
      "exec-plans",
      "agent-reach-external-discovery-and-evidence-v0.1.exec-plan.md",
    );
    const requiredSyncTargets = [
      "README.md",
      "README.en.md",
      "data/README.md",
      ".gitignore",
      ".github/workflows/trend-radar-daily.yml",
      ".github/workflows/trend-radar-weekly.yml",
      "docs/specs/services/cli-runtime.md",
      "docs/specs/constraints/structure-tests.md",
    ];

    for (const target of requiredSyncTargets) {
      expect(design).toContain(target);
      expect(execPlan).toContain(target);
    }
  });

  it("keeps Phase 8 service and constraint specs aligned with external discovery boundaries", () => {
    const specRequirements: Array<{ segments: string[]; terms: string[] }> = [
      {
        segments: ["docs", "specs", "system-spec.md"],
        terms: ["external discovery", "secondary evidence"],
      },
      {
        segments: ["docs", "specs", "services", "signal-ingestion.md"],
        terms: ["AgentReach", "local JSON artifact", "must not write RawSignal"],
      },
      {
        segments: ["docs", "specs", "services", "normalization.md"],
        terms: ["project/topic matching", "primary canonical normalization"],
      },
      {
        segments: ["docs", "specs", "services", "scoring-engine.md"],
        terms: ["total_score", "discussion_score", "ScoreComponentName"],
      },
      {
        segments: ["docs", "specs", "services", "action-output.md"],
        terms: ["external_discovery", "weekly_direction_observations", "verify-daily"],
      },
      {
        segments: ["docs", "specs", "services", "cli-runtime.md"],
        terms: ["--external-discovery-input", "--no-external-discovery", "run-weekly"],
      },
      {
        segments: ["docs", "specs", "constraints", "architecture-constraints.md"],
        terms: ["no login state", "platform API credentials", "crawler"],
      },
      {
        segments: ["docs", "specs", "constraints", "structure-tests.md"],
        terms: ["public-safe", "workflow path", "data/raw/external-discovery"],
      },
      {
        segments: ["docs", "specs", "feedback-loops", "observability-contract.md"],
        terms: ["source_input_hash", "registry miss", "provider status"],
      },
      {
        segments: ["docs", "specs", "feedback-loops", "failure-recovery-loop.md"],
        terms: ["default missing input", "skipped", "explicit input"],
      },
    ];

    for (const requirement of specRequirements) {
      const text = readText(...requirement.segments);
      for (const term of requirement.terms) {
        expect(text).toContain(term);
      }
    }
  });

  it("keeps sanitized AgentReach fixture aligned with direction label policy", () => {
    const fixture = JSON.parse(
      readText(
        "data",
        "raw",
        "external-discovery",
        "fixtures",
        "agent-reach.sample.sanitized.json",
      ),
    ) as { items?: Array<{ direction_labels?: unknown; tags?: unknown }> };
    const allowed = new Set<string>(EXTERNAL_DIRECTION_LABELS);
    const items = fixture.items ?? [];

    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(Array.isArray(item.direction_labels)).toBe(true);
      for (const label of item.direction_labels as unknown[]) {
        expect(typeof label).toBe("string");
        expect(allowed.has(label as string)).toBe(true);
      }
      expect(item.direction_labels).not.toContain("mcp");
      expect(item.direction_labels).not.toContain("browser-agent");
      expect(item.tags).toEqual(expect.arrayContaining(["agent-workflow"]));
    }
  });
});
