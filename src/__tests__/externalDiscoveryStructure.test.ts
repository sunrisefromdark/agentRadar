import fs from "node:fs";
import { describe, expect, it } from "vitest";

function read(filepath: string): string {
  return fs.readFileSync(filepath, "utf-8");
}

describe("external discovery structure boundaries", () => {
  it("keeps AgentReach raw input local-only and public aggregates explicit", () => {
    const gitignore = read(".gitignore");
    const dataReadme = read("data/README.md");

    expect(gitignore).toContain("data/raw/external-discovery/**");
    expect(gitignore).toContain("!data/raw/external-discovery/fixtures/**");
    expect(gitignore).toContain("data/external-discovery/*.candidate-explanations.json");
    expect(dataReadme).toContain("data/raw/external-discovery/");
    expect(dataReadme).toContain("local-only");
    expect(dataReadme).toContain("data/external-discovery/*.aggregate.json");
    expect(dataReadme).toContain("data/external-discovery/*.candidate-explanations.json");
    expect(dataReadme).toContain("no public `*.events.jsonl` default artifact");
  });

  it("does not upload external raw input in GitHub Actions", () => {
    const dailyWorkflow = read(".github/workflows/trend-radar-daily.yml");
    const weeklyWorkflow = read(".github/workflows/trend-radar-weekly.yml");

    expect(dailyWorkflow).not.toContain("data/raw/external-discovery");
    expect(weeklyWorkflow).not.toContain("data/raw/external-discovery");
    expect(dailyWorkflow).toContain("data/external-discovery/${{ steps.options.outputs.target_date }}.aggregate.json");
    expect(dailyWorkflow).toContain("data/external-discovery/latest.aggregate.json");
  });

  it("documents OSS no-account external discovery boundaries", () => {
    const readme = read("README.md");
    const readmeEn = read("README.en.md");

    expect(readme).toContain("开源版只消费本地 AgentReach JSON artifact");
    expect(readme).toContain("cookie、session、OAuth");
    expect(readmeEn).toContain("only consumes local AgentReach JSON artifacts");
    expect(readmeEn).toContain("cookies, sessions, OAuth");
  });
});
