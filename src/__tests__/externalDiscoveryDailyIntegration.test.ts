import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runDailyExternalDiscoveryIntegration } from "../externalDiscovery/dailyIntegration.ts";
import type { AppConfig } from "../config.ts";
import type { ProjectLibraryEnhancementArtifact } from "../types.ts";

const roots: string[] = [];
const originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function setupWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "external-discovery-daily-integration-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "data", "raw", "external-discovery", "fixtures"), { recursive: true });
  process.chdir(root);
  return root;
}

function config(): AppConfig {
  return {
    llm: {
      enabled: false,
      mode: "rules-only",
      provider: "none",
    },
  } as AppConfig;
}

function writeSampleAgentReachInput(inputPath: string): void {
  fs.writeFileSync(
    inputPath,
    JSON.stringify({
      provider: "agent-reach",
      schema_version: "agent-reach.external-discovery.v1",
      provider_run_id: "run-sanitized",
      generated_at: "2026-06-30T00:00:00.000Z",
      query: { keyword: "agent sdk" },
      platforms: ["hacker_news"],
      status: "ok",
      items: [
        {
          event_id: "evt-1",
          platform: "hacker_news",
          raw_event_kind: "discussion",
          derived_signal_kinds: ["evidence"],
          scope: "project",
          target_type: "project",
          target_key: "openai/agents-sdk",
          title: "Launch HN: OpenAI Agents SDK",
          target: {
            name: "OpenAI Agents SDK",
            repo_url: "https://github.com/openai/agents-sdk",
          },
          actor: {
            actor_type: "community",
            effective_tier: "ordinary",
            tier_basis: "none",
          },
          observed_at: "2026-06-30T00:00:00.000Z",
          raw_ref: "provider:event:1",
        },
      ],
    }),
    "utf-8",
  );
}

describe("external discovery daily integration", () => {
  it("writes aggregate and candidate explanation artifacts from sanitized AgentReach input", async () => {
    const root = setupWorkspace();
    const inputPath = path.join(root, "data", "raw", "external-discovery", "fixtures", "sample.agent-reach.json");
    writeSampleAgentReachInput(inputPath);

    const result = await runDailyExternalDiscoveryIntegration({
      date: "2026-06-30",
      generatedAt: "2026-06-30T01:00:00.000Z",
      config: config(),
      inputPath,
      explicitInput: true,
      dryRun: false,
    });

    expect(result.aggregate.accepted_event_count).toBe(1);
    expect(result.input_build.eligible_count).toBe(1);
    expect(result.explanations.status).toBe("skipped");
    expect(fs.existsSync(path.join(root, "data", "external-discovery", "2026-06-30.aggregate.json"))).toBe(true);
    expect(fs.existsSync(path.join(root, "data", "external-discovery", "2026-06-30.candidate-explanations.json"))).toBe(true);
    expect(result.explanations.explanations[0]?.why_watch_cn).toContain("HN");
  });

  it("keeps daily integration non-blocking when candidate explanation build fails", async () => {
    const root = setupWorkspace();
    const inputPath = path.join(root, "data", "raw", "external-discovery", "fixtures", "sample.agent-reach.json");
    writeSampleAgentReachInput(inputPath);

    const result = await runDailyExternalDiscoveryIntegration({
      date: "2026-06-30",
      generatedAt: "2026-06-30T01:00:00.000Z",
      config: config(),
      inputPath,
      explicitInput: true,
      dryRun: false,
      projectLibraryArtifact: {
        entries: [{ repo_full_name: "openai/agents-sdk", project_brief_cn: undefined }],
      } as unknown as ProjectLibraryEnhancementArtifact,
    });

    expect(result.aggregate.accepted_event_count).toBe(1);
    expect(result.explanations.status).toBe("failed");
    expect(result.explanations.status_reason).toBe("candidate_explanation_generation_failed");
    expect(fs.existsSync(path.join(root, "data", "external-discovery", "2026-06-30.aggregate.json"))).toBe(true);
    expect(fs.existsSync(path.join(root, "data", "external-discovery", "2026-06-30.candidate-explanations.json"))).toBe(true);
  });
});
