import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { writeAgentReachArtifact } from "../agentReach/artifactWriter.ts";
import { createCompleteCoverage } from "../agentReach/coverageAudit.ts";
import { EXTERNAL_PLATFORMS } from "../externalDiscovery/types.ts";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-reach-producer-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("AgentReach artifact writer", () => {
  it("writes a dated provider artifact with complete public-safe coverage", () => {
    const outputPath = path.join(makeTempDir(), "2026-06-18.agent-reach.json");
    const coverage = createCompleteCoverage({
      activePlatforms: ["official_blog"],
      reservedPlatforms: ["x_twitter", "reddit"],
      providerCoverage: {
        official_blog: { status: "ok" },
      },
    });

    const result = writeAgentReachArtifact({
      date: "2026-06-18",
      outputPath,
      providerRunId: "agentreach-2026-06-18",
      generatedAt: "2026-06-18T00:00:00.000Z",
      query: { terms: ["research agent"] },
      platforms: ["official_blog"],
      status: "ok",
      diagnostics: { warnings: [] },
      items: [],
      coverage,
    });

    expect(result.dry_run).toBe(false);
    expect(result.output_path).toBe(outputPath);
    expect(fs.existsSync(outputPath)).toBe(true);

    const artifact = JSON.parse(fs.readFileSync(outputPath, "utf-8")) as Record<string, unknown>;
    expect(artifact).toMatchObject({
      provider: "agent-reach",
      schema_version: "agent-reach.external-discovery.v1",
      provider_run_id: "agentreach-2026-06-18",
      generated_at: "2026-06-18T00:00:00.000Z",
      query: { terms: ["research agent"] },
      platforms: ["official_blog"],
      status: "ok",
      diagnostics: { warnings: [] },
      items: [],
    });
    expect(Object.keys(artifact.coverage as Record<string, unknown>).sort()).toEqual(
      [...EXTERNAL_PLATFORMS].sort(),
    );
    expect(JSON.stringify(artifact)).not.toContain("latest.agent-reach");
  });

  it("does not write an artifact during dry-run", () => {
    const outputPath = path.join(makeTempDir(), "2026-06-18.agent-reach.json");

    const result = writeAgentReachArtifact({
      date: "2026-06-18",
      outputPath,
      dryRun: true,
      providerRunId: "agentreach-2026-06-18",
      generatedAt: "2026-06-18T00:00:00.000Z",
      query: { terms: [] },
      platforms: [],
      status: "ok",
      diagnostics: { warnings: [] },
      items: [],
      coverage: createCompleteCoverage({ activePlatforms: [], reservedPlatforms: [] }),
    });

    expect(result.dry_run).toBe(true);
    expect(result.output_path).toBe(outputPath);
    expect(result.artifact.coverage.official_blog.status).toBe("not_configured");
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it("fails before writing when coverage contains private text", () => {
    const outputPath = path.join(makeTempDir(), "2026-06-18.agent-reach.json");

    expect(() =>
      writeAgentReachArtifact({
        date: "2026-06-18",
        outputPath,
        providerRunId: "agentreach-2026-06-18",
        generatedAt: "2026-06-18T00:00:00.000Z",
        query: { terms: [] },
        platforms: [],
        status: "ok",
        diagnostics: { warnings: [] },
        items: [],
        coverage: createCompleteCoverage({
          activePlatforms: [],
          reservedPlatforms: [],
          providerCoverage: {
            official_web: { status: "failed", reason: "OAuth token expired" },
          },
        }),
      }),
    ).toThrow(/public-safe/);
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it("fails before writing incomplete coverage or sensitive diagnostics", () => {
    const incompletePath = path.join(makeTempDir(), "incomplete.agent-reach.json");
    expect(() =>
      writeAgentReachArtifact({
        date: "2026-06-18",
        outputPath: incompletePath,
        providerRunId: "agentreach-2026-06-18",
        generatedAt: "2026-06-18T00:00:00.000Z",
        query: { terms: [] },
        platforms: [],
        status: "ok",
        diagnostics: { warnings: [] },
        items: [],
        coverage: {
          official_blog: { status: "ok" },
        } as never,
      }),
    ).toThrow(/complete coverage/);
    expect(fs.existsSync(incompletePath)).toBe(false);

    const diagnosticsPath = path.join(makeTempDir(), "diagnostics.agent-reach.json");
    expect(() =>
      writeAgentReachArtifact({
        date: "2026-06-18",
        outputPath: diagnosticsPath,
        providerRunId: "agentreach-2026-06-18",
        generatedAt: "2026-06-18T00:00:00.000Z",
        query: { terms: [] },
        platforms: [],
        status: "failed",
        diagnostics: { warnings: ["OAuth token expired"] },
        items: [],
        coverage: createCompleteCoverage({ activePlatforms: [], reservedPlatforms: [] }),
      }),
    ).toThrow(/public-safe/);
    expect(fs.existsSync(diagnosticsPath)).toBe(false);
  });
});
