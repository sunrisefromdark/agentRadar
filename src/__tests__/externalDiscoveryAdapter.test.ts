import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { loadAgentReachProviderArtifact } from "../externalDiscovery/agentReachProvider.ts";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-reach-provider-"));
  tempDirs.push(dir);
  return dir;
}

function writeJsonArtifact(value: unknown): string {
  const filePath = path.join(makeTempDir(), "agent-reach.json");
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
  return filePath;
}

function makeArtifact(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    provider: "agent-reach",
    schema_version: "agent-reach.external-discovery.v1",
    provider_run_id: "agent-reach-run-1",
    generated_at: "2026-06-14T00:00:00.000Z",
    query: { terms: ["agent workflow verification"] },
    platforms: ["official_blog"],
    status: "ok",
    items: [
      {
        raw_ref: "agent-reach:item-1",
        platform: "official_blog",
        raw_event_kind: "official_release",
        derived_signal_kinds: ["discovery", "evidence"],
        source_published_at: "2026-06-13T23:00:00.000Z",
        observed_at: "2026-06-14T00:00:00.000Z",
        url: "https://example.com/release",
        title: "Agent workflow verification launch",
        text: "raw provider text must stay out of canonical output",
        actor: {
          display_name: "Example Team",
          handle: "@example_team",
          profile_url: "https://example.com/profile/example-team",
          type_hint: "team",
          tier_hint: "core",
        },
        target: {
          name: "Example Project",
          repo_url: "https://github.com/example/project",
        },
        metrics: { likes: 12, reposts: 2, comments: 1 },
        tags: ["agent-workflow"],
      },
    ],
    diagnostics: {
      warnings: [],
    },
    ...overrides,
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("AgentReach local provider adapter", () => {
  it("loads an ok local artifact into canonical events without copying raw public-unsafe fields", () => {
    const inputPath = writeJsonArtifact(makeArtifact());

    const result = loadAgentReachProviderArtifact({ date: "2026-06-14", inputPath });

    expect(result.status).toBe("ok");
    expect(result.status_reason).toBe("ok");
    expect(result.provider).toBe("agent-reach");
    expect(result.schema_version).toBe("agent-reach.external-discovery.v1");
    expect(result.provider_run_id).toBe("agent-reach-run-1");
    expect(result.source_input_ref).toBe(inputPath);
    expect(result.source_input_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(result.events).toHaveLength(1);
    expect(result.rejected_events).toEqual([]);

    const event = result.events[0];
    expect(event.provider).toBe("agent-reach");
    expect(event.platform).toBe("official_blog");
    expect(event.raw_event_kind).toBe("official_release");
    expect(event.derived_signal_kinds).toEqual(["discovery", "evidence"]);
    expect(event.source_published_at).toBe("2026-06-13T23:00:00.000Z");
    expect(event.observed_at).toBe("2026-06-14T00:00:00.000Z");
    expect(event.ingested_at).toBe("2026-06-14T00:00:00.000Z");
    expect(event.event_url).toBe("https://example.com/release");
    expect(event.content_title).toBe("Agent workflow verification launch");
    expect(event).not.toHaveProperty("content_text");
    expect(event.actor.actor_type).toBe("team");
    expect(event.actor.provider_tier_hint).toBe("core");
    expect(event.actor.effective_tier).toBe("unknown");
    expect(event.actor.effective_tier).not.toMatch(/^(core|proven|watch)$/);
    expect(event.actor).not.toHaveProperty("handle");
    expect(event.actor).not.toHaveProperty("platform_profile_url");
    expect(event.target.target_type).toBe("project");
    expect(event.target.repo_url).toBe("https://github.com/example/project");
    expect(event.direction_labels).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("raw provider text must stay out");
    expect(JSON.stringify(result)).not.toContain("@example_team");
    expect(JSON.stringify(result)).not.toContain("profile/example-team");
  });

  it("canonicalizes provider direction labels and warns when invalid labels are dropped", () => {
    const inputPath = writeJsonArtifact(
      makeArtifact({
        items: [
          {
            raw_ref: "agent-reach:item-direction-labels",
            platform: "official_blog",
            observed_at: "2026-06-14T00:00:00.000Z",
            url: "https://example.com/research-office-agent",
            target: { name: "Research office assistant", topic_hint: "Research Office Agent" },
            direction_labels: [
              "research-agent",
              "office assistant",
              "office-agent",
              "mcp",
              "browser-agent",
            ],
            tags: ["mcp", "browser-agent"],
          },
        ],
      }),
    );

    const result = loadAgentReachProviderArtifact({ date: "2026-06-14", inputPath });

    expect(result.status).toBe("ok");
    expect(result.events[0]?.direction_labels).toEqual([
      "research-agent",
      "personal-assistant-agent",
      "office-agent",
    ]);
    expect(result.events[0]?.tags).toEqual(["mcp", "browser-agent"]);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        "dropped_direction_label:mcp",
        "dropped_direction_label:browser-agent",
      ]),
    );
  });

  it("falls back only for invalid canonical classification hints", () => {
    const inputPath = writeJsonArtifact(
      makeArtifact({
        items: [
          {
            raw_ref: "agent-reach:item-invalid-hints",
            platform: "official_blog",
            raw_event_kind: "video",
            derived_signal_kinds: ["unsupported"],
            observed_at: "2026-06-14T00:00:00.000Z",
            url: "https://example.com/release",
            actor: {
              display_name: "Unknown Actor",
              type_hint: "bot",
              tier_hint: "core",
            },
            target: { name: "Invalid hints" },
          },
        ],
      }),
    );

    const result = loadAgentReachProviderArtifact({ date: "2026-06-14", inputPath });

    expect(result.status).toBe("ok");
    expect(result.events[0]?.raw_event_kind).toBe("unknown");
    expect(result.events[0]?.derived_signal_kinds).toEqual(["discovery"]);
    expect(result.events[0]?.actor.actor_type).toBe("unknown");
    expect(result.events[0]?.actor.provider_tier_hint).toBe("core");
    expect(result.events[0]?.actor.effective_tier).toBe("unknown");
  });

  it("returns skipped when the default local input is missing", () => {
    const result = loadAgentReachProviderArtifact({ date: "2099-01-01" });

    expect(result.status).toBe("skipped");
    expect(result.status_reason).toBe("input_missing");
    expect(result.events).toEqual([]);
    expect(result.rejected_events).toEqual([]);
    expect(result.source_input_ref).toBe(
      "data/raw/external-discovery/2099-01-01.agent-reach.json",
    );
  });

  it("returns failed when an explicit local input path is missing", () => {
    const missingPath = path.join(makeTempDir(), "missing.json");

    const result = loadAgentReachProviderArtifact({
      date: "2026-06-14",
      inputPath: missingPath,
    });

    expect(result.status).toBe("failed");
    expect(result.status_reason).toBe("input_missing");
    expect(result.events).toEqual([]);
    expect(result.rejected_events[0]?.reason_code).toBe("input_missing");
  });

  it.each([
    ["failed", "provider_status_failed"],
    ["skipped", "provider_status_skipped"],
  ])("does not consume items when provider status is %s", (status, statusReason) => {
    const inputPath = writeJsonArtifact(makeArtifact({ status }));

    const result = loadAgentReachProviderArtifact({ date: "2026-06-14", inputPath });

    expect(result.status).toBe(status);
    expect(result.status_reason).toBe(statusReason);
    expect(result.events).toEqual([]);
    expect(result.rejected_events).toEqual([]);
  });

  it("returns failed for JSON parse errors without leaking raw file content", () => {
    const inputPath = path.join(makeTempDir(), "broken.json");
    fs.writeFileSync(inputPath, "{ raw provider text with token=secret", "utf-8");

    const result = loadAgentReachProviderArtifact({ date: "2026-06-14", inputPath });

    expect(result.status).toBe("failed");
    expect(result.status_reason).toBe("json_parse_error");
    expect(JSON.stringify(result)).not.toContain("token=secret");
  });

  it.each([
    ["provider", { provider: "not-agent-reach" }],
    ["schema_version", { schema_version: "wrong.v1" }],
    ["provider_run_id", { provider_run_id: undefined }],
    ["generated_at", { generated_at: undefined }],
    ["query", { query: undefined }],
    ["platforms", { platforms: undefined }],
    ["status", { status: undefined }],
    ["items", { items: undefined }],
    ["diagnostics.warnings", { diagnostics: { warnings: undefined } }],
  ])("returns failed for invalid top-level schema: %s", (_field, override) => {
    const inputPath = writeJsonArtifact(makeArtifact(override));

    const result = loadAgentReachProviderArtifact({ date: "2026-06-14", inputPath });

    expect(result.status).toBe("failed");
    expect(result.status_reason).toBe("schema_invalid");
    expect(result.events).toEqual([]);
    expect(result.rejected_events[0]?.reason_code).toBe("schema_invalid");
  });

  it("returns partial when unsupported platform items are rejected but valid items continue", () => {
    const inputPath = writeJsonArtifact(
      makeArtifact({
        items: [
          {
            raw_ref: "agent-reach:item-valid",
            platform: "official_blog",
            observed_at: "2026-06-14T00:00:00.000Z",
            url: "https://example.com/release",
            target: { name: "Example Project", repo_url: "https://github.com/example/project" },
          },
          {
            raw_ref: "agent-reach:item-invalid-platform",
            platform: "youtube",
            observed_at: "2026-06-14T00:00:00.000Z",
            url: "https://example.com/video",
            target: { name: "Video-only source" },
          },
        ],
      }),
    );

    const result = loadAgentReachProviderArtifact({ date: "2026-06-14", inputPath });

    expect(result.status).toBe("partial");
    expect(result.status_reason).toBe("partial_events_rejected");
    expect(result.events).toHaveLength(1);
    expect(result.rejected_events).toEqual([
      expect.objectContaining({
        raw_ref: "agent-reach:item-invalid-platform",
        reason_code: "unsupported_platform",
      }),
    ]);
  });

  it("keeps provider partial status when all partial artifact items are accepted", () => {
    const inputPath = writeJsonArtifact(makeArtifact({ status: "partial" }));

    const result = loadAgentReachProviderArtifact({ date: "2026-06-14", inputPath });

    expect(result.status).toBe("partial");
    expect(result.status_reason).toBe("partial");
    expect(result.events).toHaveLength(1);
    expect(result.rejected_events).toEqual([]);
  });

  it("rejects items missing both url and raw_ref", () => {
    const inputPath = writeJsonArtifact(
      makeArtifact({
        items: [
          {
            platform: "official_blog",
            observed_at: "2026-06-14T00:00:00.000Z",
            target: { name: "No traceable reference" },
          },
        ],
      }),
    );

    const result = loadAgentReachProviderArtifact({ date: "2026-06-14", inputPath });

    expect(result.status).toBe("partial");
    expect(result.events).toEqual([]);
    expect(result.rejected_events[0]?.reason_code).toBe("missing_trace_ref");
  });

  it("rejects items missing observed_at", () => {
    const inputPath = writeJsonArtifact(
      makeArtifact({
        items: [
          {
            raw_ref: "agent-reach:item-missing-observed-at",
            platform: "official_blog",
            url: "https://example.com/release",
            target: { name: "Missing observed time" },
          },
        ],
      }),
    );

    const result = loadAgentReachProviderArtifact({ date: "2026-06-14", inputPath });

    expect(result.status).toBe("partial");
    expect(result.events).toEqual([]);
    expect(result.rejected_events[0]?.reason_code).toBe("missing_observed_at");
  });

  it("maps a single provider time field to observed_at without inventing source_published_at", () => {
    const inputPath = writeJsonArtifact(
      makeArtifact({
        items: [
          {
            raw_ref: "agent-reach:item-time",
            platform: "official_blog",
            observed_at: "2026-06-14T00:00:00.000Z",
            url: "https://example.com/release",
            target: { name: "Single time field", topic_hint: "agent-workflow" },
          },
        ],
      }),
    );

    const result = loadAgentReachProviderArtifact({ date: "2026-06-14", inputPath });

    expect(result.status).toBe("ok");
    expect(result.events[0]?.observed_at).toBe("2026-06-14T00:00:00.000Z");
    expect(result.events[0]).not.toHaveProperty("source_published_at");
  });

  it("does not call network APIs or use credential env while loading a local artifact", () => {
    const inputPath = writeJsonArtifact(makeArtifact());
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = (() => {
      fetchCalled = true;
      throw new Error("network access should not be used by adapter");
    }) as typeof fetch;
    const originalOpenAiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "secret-env-key";

    try {
      const result = loadAgentReachProviderArtifact({ date: "2026-06-14", inputPath });

      expect(result.status).toBe("ok");
      expect(fetchCalled).toBe(false);
      expect(JSON.stringify(result)).not.toContain("secret-env-key");
    } finally {
      globalThis.fetch = originalFetch;
      if (originalOpenAiKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = originalOpenAiKey;
      }
    }
  });
});
