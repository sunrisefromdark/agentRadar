import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../config.ts";

const tempDirs: string[] = [];

function makeTempConfig(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-radar-config-"));
  tempDirs.push(dir);
  const filePath = path.join(dir, "config.yaml");
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

function withEnv(vars: Record<string, string | undefined>, fn: () => void): void {
  const saved: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(vars)) {
    saved[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("loadConfig", () => {
  it("throws when semantic classification is enabled without a real provider", () => {
    const configPath = makeTempConfig(`
llm:
  enabled: true
  mode: semantic-classification
  provider: none
`);

    expect(() => loadConfig(configPath)).toThrow(/llm\.provider must not be "none"/);
  });

  it("accepts a configured provider for semantic classification", () => {
    const configPath = makeTempConfig(`
llm:
  enabled: true
  mode: semantic-classification
  provider: openai
sources:
  user_interest_profile:
    enabled: true
    topics:
      - name: agent-runtime
        weight: 0.4
      - name: memory
        weight: 0.2
`);

    const config = loadConfig(configPath);

    expect(config.llm.enabled).toBe(true);
    expect(config.llm.mode).toBe("semantic-classification");
    expect(config.llm.provider).toBe("openai");
    expect(config.sources.userInterestProfile).toEqual({
      enabled: true,
      topics: [
        { name: "agent-runtime", weight: 0.4 },
        { name: "memory", weight: 0.2 },
      ],
    });
  });

  it("promotes LLM_PROVIDER from env into semantic-classification mode", () => {
    const configPath = makeTempConfig(`
llm:
  enabled: false
  mode: rules-only
  provider: none
`);

    withEnv({ LLM_PROVIDER: "deepseek" }, () => {
      const config = loadConfig(configPath);

      expect(config.llm.enabled).toBe(true);
      expect(config.llm.mode).toBe("semantic-classification");
      expect(config.llm.provider).toBe("deepseek");
    });
  });

  it("auto-enables semantic classification when a supported API key is present", () => {
    const configPath = makeTempConfig(`
llm:
  enabled: false
  mode: rules-only
  provider: none
`);

    withEnv({ OPENAI_API_KEY: "test-openai-key", LLM_PROVIDER: undefined }, () => {
      const config = loadConfig(configPath);

      expect(config.llm.enabled).toBe(true);
      expect(config.llm.mode).toBe("semantic-classification");
      expect(config.llm.provider).toBe("openai");
    });
  });

  it("keeps rules-only mode when no provider env or API keys are present", () => {
    const configPath = makeTempConfig(`
llm:
  enabled: false
  mode: rules-only
  provider: none
`);

    withEnv(
      {
        LLM_PROVIDER: undefined,
        ANTHROPIC_API_KEY: undefined,
        OPENAI_API_KEY: undefined,
        DEEPSEEK_API_KEY: undefined,
        OPENROUTER_API_KEY: undefined,
        MINIMAX_API_KEY: undefined,
      },
      () => {
        const config = loadConfig(configPath);

        expect(config.llm.enabled).toBe(false);
        expect(config.llm.mode).toBe("rules-only");
        expect(config.llm.provider).toBe("none");
      },
    );
  });

  it("uses the current public defaults for agents-radar paths", () => {
    const config = loadConfig(makeTempConfig(""));

    expect(config.sources.agentsRadar.mode).toBe("github-http");
    expect(config.sources.agentsRadar.localPath).toBe("data/upstream/agents-radar-source");
    expect(config.sources.agentsRadar.manifestPath).toBe("data/upstream/agents-radar-source/manifest.json");
  });

  it("allows env overrides to switch agents-radar into local mode", () => {
    const configPath = makeTempConfig(`
sources:
  agents_radar:
    enabled: true
    mode: github-http
    local_path: data/upstream/agents-radar-source
    manifest_path: data/upstream/agents-radar-source/manifest.json
    repo_url: https://example.invalid/agents-radar
    refresh_timeout_ms: 300000
`);

    withEnv(
      {
        AGENT_TREND_RADAR_AGENTS_RADAR_MODE: "local",
        AGENT_TREND_RADAR_AGENTS_RADAR_LOCAL_PATH: "custom/local-path",
        AGENT_TREND_RADAR_AGENTS_RADAR_MANIFEST_PATH: "custom/manifest.json",
        AGENT_TREND_RADAR_AGENTS_RADAR_REPO_URL: "https://example.invalid/custom",
        AGENT_TREND_RADAR_AGENTS_RADAR_REFRESH_TIMEOUT_MS: "600000",
      },
      () => {
        const config = loadConfig(configPath);

        expect(config.sources.agentsRadar.mode).toBe("local");
        expect(config.sources.agentsRadar.localPath).toBe("custom/local-path");
        expect(config.sources.agentsRadar.manifestPath).toBe("custom/manifest.json");
        expect(config.sources.agentsRadar.repoUrl).toBe("https://example.invalid/custom");
        expect(config.sources.agentsRadar.refreshTimeoutMs).toBe(600000);
      },
    );
  });

  it("rejects unknown user interest profile fields", () => {
    const configPath = makeTempConfig(`
sources:
  user_interest_profile:
    enabled: false
    topics: []
    extra_flag: true
`);

    expect(() => loadConfig(configPath)).toThrow(/user_interest_profile contains unknown field\(s\): extra_flag/);
  });

  it("provides the default ecosystem focus observer config", () => {
    const config = loadConfig(makeTempConfig(""));

    expect(config.sources.ecosystemFocus.enabled).toBe(true);
    expect(config.sources.ecosystemFocus.mode).toBe("github-search");
    expect(config.sources.ecosystemFocus.recentDays).toBe(7);
    expect(config.sources.ecosystemFocus.ecosystems.map((item) => item.name)).toEqual([
      "coding-agents",
      "agent-runtime",
      "skills-tools-mcp",
      "memory-knowledge",
      "browser-computer-use",
      "eval-observability-governance",
      "multi-agent-coordination",
      "agent-ui-workbench",
      "agentic-rl",
    ]);
  });
});
