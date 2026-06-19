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

  it("keeps AgentReach producer isolated behind its own CLI and module root", () => {
    const packageJson = JSON.parse(readText("package.json")) as {
      scripts?: Record<string, string>;
    };
    const mainCli = readText("src", "cli.ts");
    const producerCli = readText("src", "agentReach", "cli.ts");

    expect(packageJson.scripts?.["agentreach:discover"]).toBe("tsx src/agentReach/cli.ts");
    expect(fs.existsSync(path.join(repoRoot, "src", "agentReach"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "src", "externalDiscovery"))).toBe(true);
    for (const modulePath of [
      ["src", "agentReach", "normalizer.ts"],
      ["src", "agentReach", "sanitizer.ts"],
      ["src", "agentReach", "coverageAudit.ts"],
      ["src", "agentReach", "artifactWriter.ts"],
      ["src", "agentReach", "providers", "externalImportProvider.ts"],
      ["src", "agentReach", "providers", "rssBlogProvider.ts"],
      ["src", "agentReach", "providers", "officialWebProvider.ts"],
      ["src", "agentReach", "providers", "hackerNewsProvider.ts"],
      ["src", "agentReach", "providers", "xTwitterProvider.ts"],
      ["src", "agentReach", "providers", "redditProvider.ts"],
    ]) {
      expect(fs.existsSync(path.join(repoRoot, ...modulePath))).toBe(true);
    }
    expect(mainCli).not.toContain("agentreach:discover");
    expect(producerCli).toContain("writeAgentReachArtifact");
    expect(producerCli).toContain("external-import");
  });

  it("keeps AgentReach producer docs aligned with opt-in provider boundaries", () => {
    const design = readText(
      "docs",
      "specs",
      "design-docs",
      "agent-reach-external-discovery-and-evidence-design.md",
    );
    const producerExecPlan = readText(
      "docs",
      "specs",
      "exec-plans",
      "agent-reach-artifact-producer-v0.1.exec-plan.md",
    );

    for (const text of [design, producerExecPlan]) {
      expect(text).toContain("src/agentReach/");
      expect(text).toContain("external-import");
      expect(text).toContain("rss-blog");
      expect(text).toContain("official-web");
      expect(text).toContain("hacker-news");
      expect(text).toContain("xTwitterProvider");
      expect(text).toContain("redditProvider");
      expect(text).toContain("not_configured");
      expect(text).toContain("manual_import_only");
      expect(text).toContain("coverage");
      expect(text).toContain("cookie");
      expect(text).toContain("OAuth");
    }
  });

  it("documents AgentReach provider foundation ownership boundaries", () => {
    const design = readText(
      "docs",
      "specs",
      "design-docs",
      "agent-reach-external-discovery-and-evidence-design.md",
    );
    const producerExecPlan = readText(
      "docs",
      "specs",
      "exec-plans",
      "agent-reach-artifact-producer-v0.1.exec-plan.md",
    );
    const cliRuntime = readText("docs", "specs", "services", "cli-runtime.md");
    const observability = readText(
      "docs",
      "specs",
      "feedback-loops",
      "observability-contract.md",
    );
    const recovery = readText(
      "docs",
      "specs",
      "feedback-loops",
      "failure-recovery-loop.md",
    );
    const producerCli = readText("src", "agentReach", "cli.ts");

    for (const text of [design, producerExecPlan]) {
      expect(text).toContain("AgentReachProducerProvider");
      expect(text).toContain("ProviderContext");
      expect(text).toContain("AgentReachProviderError");
      expect(text).toContain("providerRegistry.ts");
      expect(text).toContain("orchestrator.ts");
      expect(text).toContain("transport.ts");
      expect(text).toContain("createDisabledAgentReachTransport");
      expect(text).toContain("fake/in-memory transport");
      expect(text).toContain("timeout");
      expect(text).toContain("response_too_large");
    }

    expect(cliRuntime).toContain("orchestrator");
    expect(cliRuntime).toContain("provider-specific");
    expect(observability).toContain("provider_failed:<provider_id>:<safe_code>");
    expect(recovery).toContain("provider_execution_failed");
    expect(producerCli).toContain("runAgentReachProviders");
    expect(producerCli).not.toContain("function computeStatus");
    expect(producerCli).not.toContain("function runProvider");
  });

  it("documents AgentReach live provider opt-in and high-risk provider boundaries", () => {
    const design = readText(
      "docs",
      "specs",
      "design-docs",
      "agent-reach-external-discovery-and-evidence-design.md",
    );
    const producerExecPlan = readText(
      "docs",
      "specs",
      "exec-plans",
      "agent-reach-artifact-producer-v0.1.exec-plan.md",
    );
    const cliRuntime = readText("docs", "specs", "services", "cli-runtime.md");

    for (const text of [design, producerExecPlan, cliRuntime]) {
      expect(text).toContain("live.enabled");
      expect(text).toContain("allowlist URL");
      expect(text).toContain("createFetchAgentReachTransport");
      expect(text).toContain("default remains disabled");
      expect(text).toContain("run-daily --external-discovery-generate");
      expect(text).toContain("X / Twitter API");
      expect(text).toContain("Reddit API");
    }

    expect(producerExecPlan).toContain(
      "在线 RSS / Atom fetch、allowlist official page fetch、Hacker News API fetch",
    );
    expect(producerExecPlan).not.toContain(
      "- 在线 RSS / Atom fetch、official sitemap fetch、Hacker News API fetch。",
    );
  });

  it("documents AgentReach discovery quality policy and bounded output semantics", () => {
    const design = readText(
      "docs",
      "specs",
      "design-docs",
      "agent-reach-external-discovery-and-evidence-design.md",
    );
    const producerExecPlan = readText(
      "docs",
      "specs",
      "exec-plans",
      "agent-reach-artifact-producer-v0.1.exec-plan.md",
    );
    const cliRuntime = readText("docs", "specs", "services", "cli-runtime.md");
    const observability = readText(
      "docs",
      "specs",
      "feedback-loops",
      "observability-contract.md",
    );
    const recovery = readText(
      "docs",
      "specs",
      "feedback-loops",
      "failure-recovery-loop.md",
    );
    const zhReadme = readText("README.md");
    const enReadme = readText("README.en.md");

    for (const text of [
      design,
      producerExecPlan,
      cliRuntime,
      observability,
      recovery,
      zhReadme,
      enReadme,
    ]) {
      expect(text).toContain("AgentReachQualityPolicy");
      expect(text).toContain("lookback_days");
      expect(text).toContain("max_items_per_query");
      expect(text).toContain("max_items_per_provider");
      expect(text).toContain("max_items_total");
      expect(text).toContain("atomic query entry");
      expect(text).toContain("quality_filtered_irrelevant");
      expect(text).toContain("quality_filtered_invalid_timestamp");
      expect(text).toContain("quality_deduplicated");
      expect(text).toContain("zero relevant results");
      expect(text).toContain("coverage remains ok");
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

  it("keeps AgentReach acceptance smoke isolated, HN-only, and documented", () => {
    const packageJson = JSON.parse(readText("package.json")) as {
      scripts?: Record<string, string>;
    };
    const acceptance = readText("src", "agentReach", "acceptance.ts");
    const smokeCli = readText("src", "agentReach", "acceptanceCli.ts");
    const acceptanceTest = readText(
      "src",
      "__tests__",
      "agentReachAcceptance.test.ts",
    );
    const qualityFixture = readText(
      "data",
      "raw",
      "external-discovery",
      "fixtures",
      "agent-reach.quality-baseline.sanitized.json",
    );
    const hackerNewsFixture = readText(
      "data",
      "raw",
      "external-discovery",
      "fixtures",
      "agent-reach.hacker-news-response.sanitized.json",
    );
    const docs = [
      readText("README.md"),
      readText("README.en.md"),
      readText("data", "README.md"),
      readText("docs", "specs", "system-spec.md"),
      readText("docs", "specs", "services", "cli-runtime.md"),
      readText(
        "docs",
        "specs",
        "design-docs",
        "agent-reach-external-discovery-and-evidence-design.md",
      ),
      readText(
        "docs",
        "specs",
        "exec-plans",
        "agent-reach-artifact-producer-v0.1.exec-plan.md",
      ),
    ];

    expect(packageJson.scripts?.["agentreach:smoke"]).toBe(
      "tsx src/agentReach/acceptanceCli.ts",
    );
    expect(smokeCli).toContain('providers: ["hacker-news"]');
    expect(smokeCli).toContain("dryRun: true");
    expect(smokeCli).not.toContain('"reddit"');
    expect(smokeCli).not.toContain('"x_twitter"');
    expect(acceptance).toContain("required_platform_status");
    expect(acceptance).toContain("zero_relevant_results");
    expect(acceptanceTest).toContain("createInMemoryAgentReachTransport");
    expect(acceptanceTest).not.toContain("createFetchAgentReachTransport");

    for (const source of [acceptance, smokeCli]) {
      expect(source).not.toContain("RawSignal");
      expect(source).not.toContain("ScoreBreakdown");
      expect(source).not.toContain("discussion_score");
    }
    for (const fixture of [qualityFixture, hackerNewsFixture]) {
      expect(fixture).not.toMatch(
        /cookie|token|session|password|OAuth|profile_url|content_text/i,
      );
    }
    for (const text of docs) {
      expect(text).toContain("agentreach:smoke");
      expect(text).toContain("hacker-news");
      expect(text).toContain("dry-run");
    }
  });
});
