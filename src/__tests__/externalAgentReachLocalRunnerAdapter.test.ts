import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runExternalAgentReachLocalRunnerAdapter } from "../externalAgentReach/localRunnerAdapter.ts";
import { createExternalAgentReachProcessRunner } from "../externalAgentReach/processRunner.ts";
import { buildDailyExternalAggregate } from "../externalDiscovery/aggregate.ts";
import { loadAgentReachProviderArtifact } from "../externalDiscovery/agentReachProvider.ts";
import { buildDailyExternalEvidence } from "../externalDiscovery/dailyEvidence.ts";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "external-agentreach-adapter-"));
  tempDirs.push(dir);
  return dir;
}

function writeRunnerScript(contents: string): string {
  const runnerPath = path.join(makeTempDir(), "runner.mjs");
  fs.writeFileSync(runnerPath, contents, "utf-8");
  return runnerPath;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("external AgentReach local runner adapter", () => {
  it("writes a public-safe v1 artifact that existing externalDiscovery consumers can read", async () => {
    const outputPath = path.join(makeTempDir(), "2026-06-22.agent-reach.json");

    const result = await runExternalAgentReachLocalRunnerAdapter({
      date: "2026-06-22",
      outputPath,
      request: {
        intent: "collect_trend_signals",
        platforms: ["x_twitter", "reddit"],
        topic: "research agents",
        public_safety_mode: "public_safe_only",
      },
      runner: async () => ({
        provider_run_id: "external-agentreach-run-1",
        generated_at: "2026-06-22T00:00:00.000Z",
        gateway_status: "partial",
        configured: true,
        coverage: {
          x_twitter: { status: "ok", reason: "zero_relevant_results" },
          reddit: { status: "ok" },
        },
        observations: [
          {
            platform: "reddit",
            raw_ref: "runner:item-1",
            url: "https://www.reddit.com/r/MachineLearning/comments/example",
            observed_at: "2026-06-22T00:00:00.000Z",
            source_published_at: "2026-06-21T22:00:00.000Z",
            title: "Research agents are showing up in lab workflows",
            raw_event_kind: "discussion",
            derived_signal_kinds: ["discovery", "evidence"],
            actor: { display_name: "Research Community", type_hint: "community" },
            target: { name: "Research agents", topic_hint: "research agents" },
            direction_labels: ["research-agent"],
            tags: ["agent-workflow"],
          },
        ],
        diagnostics: { warnings: ["reddit_ok"] },
      }),
    });

    expect(result.artifact_path).toBe(outputPath);
    expect(result.status).toBe("partial");

    const providerResult = loadAgentReachProviderArtifact({
      date: "2026-06-22",
      inputPath: outputPath,
    });
    expect(providerResult.status).toBe("partial");
    expect(providerResult.coverage).toEqual({
      x_twitter: { status: "ok", reason: "zero_relevant_results" },
      reddit: { status: "ok" },
      hacker_news: { status: "not_configured", reason: "platform_not_returned_by_gateway" },
      official_web: { status: "not_configured", reason: "platform_not_returned_by_gateway" },
      official_blog: { status: "not_configured", reason: "platform_not_returned_by_gateway" },
    });
    expect(providerResult.events).toHaveLength(1);

    const dailyEvidence = buildDailyExternalEvidence({
      events: providerResult.events,
      projects: [],
      topicContext: { paradigmLabels: ["research agents"] },
    });
    expect(dailyEvidence.directionEvidence).toHaveLength(1);
    expect(dailyEvidence.observationCandidates[0]?.qualification).toBe("observe");

    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-22",
      generatedAt: "2026-06-22T00:00:00.000Z",
      providerResult,
      directionEvidence: dailyEvidence.directionEvidence,
      observationCandidates: dailyEvidence.observationCandidates,
      warnings: dailyEvidence.warnings,
    });
    expect(aggregate.audit.coverage?.reddit?.status).toBe("ok");
    expect(aggregate.direction_evidence).toHaveLength(1);
    expect(JSON.stringify(aggregate)).not.toContain("@");
  });

  it("writes an ok zero-result artifact with full coverage", async () => {
    const outputPath = path.join(makeTempDir(), "2026-06-22.agent-reach.json");

    await runExternalAgentReachLocalRunnerAdapter({
      date: "2026-06-22",
      outputPath,
      request: {
        intent: "search",
        platforms: ["x_twitter"],
        query: "office agents",
        public_safety_mode: "public_safe_only",
      },
      runner: async () => ({
        provider_run_id: "external-agentreach-run-zero",
        generated_at: "2026-06-22T00:00:00.000Z",
        gateway_status: "ok",
        configured: true,
        coverage: {
          x_twitter: { status: "ok", reason: "zero_relevant_results" },
        },
        observations: [],
      }),
    });

    const providerResult = loadAgentReachProviderArtifact({
      date: "2026-06-22",
      inputPath: outputPath,
    });

    expect(providerResult.status).toBe("ok");
    expect(providerResult.events).toEqual([]);
    expect(providerResult.coverage?.x_twitter).toEqual({
      status: "ok",
      reason: "zero_relevant_results",
    });
    expect(providerResult.coverage?.official_blog?.status).toBe("not_configured");
  });

  it("rejects unsafe runner observations without leaking raw private fields", async () => {
    const outputPath = path.join(makeTempDir(), "2026-06-22.agent-reach.json");

    await runExternalAgentReachLocalRunnerAdapter({
      date: "2026-06-22",
      outputPath,
      request: {
        intent: "search",
        platforms: ["reddit"],
        query: "agent",
        public_safety_mode: "public_safe_only",
      },
      runner: async () => ({
        gateway_status: "ok",
        configured: true,
        coverage: { reddit: { status: "ok" } },
        observations: [
          {
            platform: "reddit",
            raw_ref: "runner:unsafe",
            url: "https://www.reddit.com/r/LocalLLaMA/comments/example",
            observed_at: "2026-06-22T00:00:00.000Z",
            title: "token leaked in title",
            actor: { display_name: "Unsafe", handle: "@unsafe" },
            target: { name: "Unsafe item" },
          },
        ],
      }),
    });

    const rawArtifact = fs.readFileSync(outputPath, "utf-8");
    expect(rawArtifact).not.toContain("token leaked in title");
    expect(rawArtifact).not.toContain("@unsafe");

    const providerResult = loadAgentReachProviderArtifact({
      date: "2026-06-22",
      inputPath: outputPath,
    });
    expect(providerResult.status).toBe("ok");
    expect(providerResult.events).toEqual([]);
  });

  it("does not write public-unsafe request query fields into the artifact", async () => {
    const outputPath = path.join(makeTempDir(), "2026-06-22.agent-reach.json");

    await runExternalAgentReachLocalRunnerAdapter({
      date: "2026-06-22",
      outputPath,
      request: {
        intent: "search",
        platforms: ["reddit"],
        query: "OAuth token expired for private provider account",
        actors: [{ name: "@unsafe_actor" }],
        public_safety_mode: "public_safe_only",
      },
      runner: async () => ({
        gateway_status: "ok",
        configured: true,
        coverage: { reddit: { status: "ok", reason: "zero_relevant_results" } },
        observations: [],
      }),
    });

    const rawArtifact = fs.readFileSync(outputPath, "utf-8");
    expect(rawArtifact).not.toContain("OAuth token expired");
    expect(rawArtifact).not.toContain("@unsafe_actor");
    expect(rawArtifact).toContain("unsafe_query_fields_rejected");

    const providerResult = loadAgentReachProviderArtifact({
      date: "2026-06-22",
      inputPath: outputPath,
    });
    expect(providerResult.status).toBe("ok");
  });

  it("does not write public-unsafe runner metadata or coverage diagnostics", async () => {
    const outputPath = path.join(makeTempDir(), "2026-06-22.agent-reach.json");

    await runExternalAgentReachLocalRunnerAdapter({
      date: "2026-06-22",
      outputPath,
      generatedAt: "2026-06-22T00:00:00.000Z",
      request: {
        intent: "search",
        platforms: ["reddit"],
        query: "agent",
        public_safety_mode: "public_safe_only",
      },
      runner: async () => ({
        provider_run_id: "C:/Users/Aspetta/private-path",
        generated_at: "OAuth token leaked from runner",
        gateway_status: "ok",
        configured: true,
        coverage: {
          reddit: {
            status: "ok",
            reason: "C:/Users/Aspetta/private-path",
            warnings: ["OAuth token leaked from coverage", "safe_coverage_warning"],
          },
        },
        observations: [],
      }),
    });

    const rawArtifact = fs.readFileSync(outputPath, "utf-8");
    expect(rawArtifact).not.toContain("C:/Users/Aspetta/private-path");
    expect(rawArtifact).not.toContain("OAuth token leaked");
    expect(rawArtifact).toContain("external-agentreach:2026-06-22T00:00:00.000Z");
    expect(rawArtifact).toContain("unsafe_runner_metadata_rejected:provider_run_id");
    expect(rawArtifact).toContain("unsafe_runner_metadata_rejected:generated_at");
    expect(rawArtifact).toContain("unsafe_runner_coverage_reason_rejected");
    expect(rawArtifact).toContain("unsafe_coverage_fields_rejected:2");
    expect(rawArtifact).toContain("safe_coverage_warning");

    const providerResult = loadAgentReachProviderArtifact({
      date: "2026-06-22",
      inputPath: outputPath,
    });
    expect(providerResult.status).toBe("ok");
    expect(providerResult.provider_run_id).toBe("external-agentreach:2026-06-22T00:00:00.000Z");
    expect(providerResult.coverage?.reddit?.reason).toBe(
      "unsafe_runner_coverage_reason_rejected",
    );
  });

  it("records public-safe rejected runner items in artifact diagnostics", async () => {
    const outputPath = path.join(makeTempDir(), "2026-06-22.agent-reach.json");

    await runExternalAgentReachLocalRunnerAdapter({
      date: "2026-06-22",
      outputPath,
      request: {
        intent: "search",
        platforms: ["reddit"],
        query: "agent",
        public_safety_mode: "public_safe_only",
      },
      runner: async () => ({
        gateway_status: "partial",
        configured: true,
        coverage: { reddit: { status: "partial", reason: "unsafe_item_rejected" } },
        observations: [],
        rejected_items: [
          {
            platform: "reddit",
            reason_code: "unsafe_item",
            reason_detail: "raw_text_removed",
          },
          {
            platform: "reddit",
            reason_code: "unsafe_item",
            reason_detail: "OAuth token leaked",
          },
        ],
      }),
    });

    const rawArtifact = fs.readFileSync(outputPath, "utf-8");
    expect(rawArtifact).toContain("rejected_items:reddit:unsafe_item:raw_text_removed");
    expect(rawArtifact).toContain("rejected_items_rejected_unsafe:1");
    expect(rawArtifact).not.toContain("OAuth token leaked");

    const providerResult = loadAgentReachProviderArtifact({
      date: "2026-06-22",
      inputPath: outputPath,
    });
    expect(providerResult.status).toBe("partial");
    expect(providerResult.warnings).toEqual(
      expect.arrayContaining([
        "rejected_items:reddit:unsafe_item:raw_text_removed",
        "rejected_items_rejected_unsafe:1",
      ]),
    );
  });

  it("writes a failed public-safe artifact when the injected runner throws", async () => {
    const outputPath = path.join(makeTempDir(), "2026-06-22.agent-reach.json");

    const result = await runExternalAgentReachLocalRunnerAdapter({
      date: "2026-06-22",
      outputPath,
      request: {
        intent: "search",
        platforms: ["x_twitter", "reddit"],
        query: "agent",
        public_safety_mode: "public_safe_only",
      },
      runner: async () => {
        throw new Error("OAuth token expired at C:\\Users\\Aspetta\\private-path");
      },
    });

    expect(result.status).toBe("failed");
    const rawArtifact = fs.readFileSync(outputPath, "utf-8");
    expect(rawArtifact).toContain("runner_failed");
    expect(rawArtifact).not.toContain("OAuth token expired");
    expect(rawArtifact).not.toContain("private-path");

    const providerResult = loadAgentReachProviderArtifact({
      date: "2026-06-22",
      inputPath: outputPath,
    });
    expect(providerResult.status).toBe("failed");
    expect(providerResult.coverage?.x_twitter?.status).toBe("failed");
    expect(providerResult.coverage?.reddit?.status).toBe("failed");
    expect(providerResult.coverage?.hacker_news?.status).toBe("not_configured");
  });

  it("executes an external runner path through stdin/stdout JSON", async () => {
    const outputPath = path.join(makeTempDir(), "2026-06-22.agent-reach.json");
    const runnerPath = writeRunnerScript(`
const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const request = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  process.stdout.write(JSON.stringify({
    provider_run_id: "process-runner-1",
    gateway_status: "ok",
    configured: true,
    coverage: {
      reddit: { status: "ok" }
    },
    observations: [{
      platform: "reddit",
      raw_ref: "process:1",
      url: "https://www.reddit.com/r/MachineLearning/comments/process",
      observed_at: "2026-06-22T00:00:00.000Z",
      title: "Process runner result",
      raw_event_kind: "discussion",
      target: { name: request.topic ?? "Process runner", topic_hint: request.topic ?? "Process runner" },
      direction_labels: ["research-agent"]
    }]
  }));
});
`);

    const result = await runExternalAgentReachLocalRunnerAdapter({
      date: "2026-06-22",
      outputPath,
      request: {
        intent: "search",
        platforms: ["reddit"],
        topic: "research agents",
        public_safety_mode: "public_safe_only",
      },
      runner: createExternalAgentReachProcessRunner({ runnerPath }),
    });

    expect(result.status).toBe("ok");
    const providerResult = loadAgentReachProviderArtifact({
      date: "2026-06-22",
      inputPath: outputPath,
    });
    expect(providerResult.status).toBe("ok");
    expect(providerResult.events).toHaveLength(1);
    expect(providerResult.coverage?.reddit?.status).toBe("ok");
  });

  it("turns invalid runner stdout into a failed artifact without leaking stderr", async () => {
    const outputPath = path.join(makeTempDir(), "2026-06-22.agent-reach.json");
    const runnerPath = writeRunnerScript(`
process.stderr.write("OAuth token expired at C:/Users/Aspetta/private-path");
process.stdout.write("not-json");
`);

    const result = await runExternalAgentReachLocalRunnerAdapter({
      date: "2026-06-22",
      outputPath,
      request: {
        intent: "search",
        platforms: ["x_twitter", "reddit"],
        query: "agent",
        public_safety_mode: "public_safe_only",
      },
      runner: createExternalAgentReachProcessRunner({ runnerPath }),
    });

    expect(result.status).toBe("failed");
    const rawArtifact = fs.readFileSync(outputPath, "utf-8");
    expect(rawArtifact).toContain("runner_output_invalid_json");
    expect(rawArtifact).not.toContain("OAuth token");
    expect(rawArtifact).not.toContain("private-path");

    const providerResult = loadAgentReachProviderArtifact({
      date: "2026-06-22",
      inputPath: outputPath,
    });
    expect(providerResult.status).toBe("failed");
    expect(providerResult.coverage?.x_twitter?.reason).toBe("runner_output_invalid_json");
    expect(providerResult.coverage?.reddit?.reason).toBe("runner_output_invalid_json");
  });

  it("turns invalid runner result shape into a failed artifact", async () => {
    const outputPath = path.join(makeTempDir(), "2026-06-22.agent-reach.json");
    const runnerPath = writeRunnerScript(`
process.stdout.write(JSON.stringify({ observations: [] }));
`);

    await runExternalAgentReachLocalRunnerAdapter({
      date: "2026-06-22",
      outputPath,
      request: {
        intent: "search",
        platforms: ["reddit"],
        query: "agent",
        public_safety_mode: "public_safe_only",
      },
      runner: createExternalAgentReachProcessRunner({ runnerPath }),
    });

    const rawArtifact = fs.readFileSync(outputPath, "utf-8");
    expect(rawArtifact).toContain("runner_output_invalid_shape");

    const providerResult = loadAgentReachProviderArtifact({
      date: "2026-06-22",
      inputPath: outputPath,
    });
    expect(providerResult.status).toBe("failed");
    expect(providerResult.coverage?.reddit?.reason).toBe("runner_output_invalid_shape");
  });

  it("turns malformed runner observation fields into a failed artifact", async () => {
    const outputPath = path.join(makeTempDir(), "2026-06-22.agent-reach.json");
    const runnerPath = writeRunnerScript(`
process.stdout.write(JSON.stringify({
  gateway_status: "ok",
  observations: [{
    platform: "reddit",
    raw_ref: "bad-observation",
    observed_at: "2026-06-22T00:00:00.000Z",
    tags: {}
  }]
}));
`);

    await runExternalAgentReachLocalRunnerAdapter({
      date: "2026-06-22",
      outputPath,
      request: {
        intent: "search",
        platforms: ["reddit"],
        query: "agent",
        public_safety_mode: "public_safe_only",
      },
      runner: createExternalAgentReachProcessRunner({ runnerPath }),
    });

    const rawArtifact = fs.readFileSync(outputPath, "utf-8");
    expect(rawArtifact).toContain("runner_output_invalid_shape");

    const providerResult = loadAgentReachProviderArtifact({
      date: "2026-06-22",
      inputPath: outputPath,
    });
    expect(providerResult.status).toBe("failed");
    expect(providerResult.coverage?.reddit?.reason).toBe("runner_output_invalid_shape");
  });
});
