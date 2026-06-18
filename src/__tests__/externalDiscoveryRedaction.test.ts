import { describe, expect, it } from "vitest";
import {
  assertPublicSafeAggregate,
  containsForbiddenPublicArtifactText,
  stableSourceInputHash,
} from "../externalDiscovery/redaction.ts";
import type { DailyExternalAggregate } from "../externalDiscovery/types.ts";

function makeSanitizedAggregate(
  overrides: Partial<DailyExternalAggregate> = {},
): DailyExternalAggregate {
  return {
    schema_version: "external-discovery.aggregate.v1",
    date: "2026-06-14",
    generated_at: "2026-06-14T00:00:00.000Z",
    provider: "agent-reach",
    provider_run_id: "agent-reach-run-1",
    status: "ok",
    source_input_ref: "data/raw/external-discovery/2026-06-14.agent-reach.json",
    source_input_hash: "sha256:fixture-source-input",
    public_safe: true,
    redaction_policy_version: "external-discovery-redaction.v1",
    contains_raw_text: false,
    contains_profile_urls: false,
    event_count: 1,
    accepted_event_count: 1,
    rejected_event_count: 0,
    platform_counts: { official_blog: 1 },
    derived_signal_kind_counts: { discovery: 1, evidence: 1 },
    direction_label_counts: {},
    project_evidence: [],
    direction_evidence: [],
    observation_candidates: [],
    audit: {
      rejected_events: [],
      warnings: [],
    },
    ...overrides,
  };
}

describe("external discovery public-safe redaction", () => {
  it("accepts a sanitized public aggregate with required public-safe fields", () => {
    const result = assertPublicSafeAggregate(makeSanitizedAggregate());

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it.each([
    ["content_text", { content_text: "raw social text" }],
    ["provider raw text", { text: "raw provider text" }],
    ["profile_url", { actor: { profile_url: "https://example.com/profile/raw" } }],
    ["profile_urls", { actor: { profile_urls: ["https://example.com/profile/raw"] } }],
    ["unsanitized handle", { actor: { handle: "@raw_handle" } }],
    ["private diagnostics", { private_diagnostics: { raw_payload_ref: "local-debug" } }],
  ])("rejects %s in public aggregates", (_label, forbiddenFragment) => {
    const aggregate = {
      ...makeSanitizedAggregate(),
      project_evidence: [
        {
          evidence_id: "ev-1",
          event_ids: ["evt-1"],
          scope: "project",
          target_key: "repo:example/project",
          derived_signal_kinds: ["evidence"],
          direction_labels: [],
          platforms: ["official_blog"],
          actor_tiers: { unknown: 1 },
          actor_types: { team: 1 },
          mention_count: 1,
          distinct_actor_count: 1,
          first_seen_at: "2026-06-14T00:00:00.000Z",
          last_seen_at: "2026-06-14T00:00:00.000Z",
          active_day_count: 1,
          cross_platform: false,
          authority_summary_cn: "脱敏摘要",
          intensity_summary_cn: "脱敏摘要",
          persistence_summary_cn: "脱敏摘要",
          caveats: [],
          ...forbiddenFragment,
        },
      ],
    };

    const result = assertPublicSafeAggregate(aggregate);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/forbidden/i);
  });

  it.each(["(@raw_handle)", "/@raw_handle", "by:@raw_handle"])(
    "rejects unsanitized handle with punctuation prefix %s",
    (handleText) => {
      const aggregate = makeSanitizedAggregate({
        audit: {
          rejected_events: [],
          warnings: [`redacted actor reference ${handleText}`],
        },
      });

      expect(containsForbiddenPublicArtifactText(aggregate)).toBe(true);
      expect(assertPublicSafeAggregate(aggregate).ok).toBe(false);
    },
  );

  it.each(["cookie", "session", "token", "password", "OAuth"])(
    "rejects sensitive marker %s in public aggregate text",
    (marker) => {
      const aggregate = makeSanitizedAggregate({
        audit: {
          rejected_events: [],
          warnings: [`redacted ${marker} should never be public`],
        },
      });

      expect(containsForbiddenPublicArtifactText(aggregate)).toBe(true);
      expect(assertPublicSafeAggregate(aggregate).ok).toBe(false);
    },
  );

  it("rejects missing or false public-safe contract fields", () => {
    const result = assertPublicSafeAggregate({
      ...makeSanitizedAggregate(),
      public_safe: false,
      contains_raw_text: true,
      contains_profile_urls: true,
      redaction_policy_version: "",
      source_input_hash: "",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "public_safe must be true",
        "contains_raw_text must be false",
        "contains_profile_urls must be false",
        "redaction_policy_version is required",
        "source_input_hash is required",
      ]),
    );
  });

  it.each([
    [
      "direction_label_counts",
      (aggregate: Record<string, unknown>) => {
        aggregate.direction_label_counts = { "cool-agent": 1 };
      },
    ],
    [
      "project evidence direction_labels",
      (aggregate: Record<string, unknown>) => {
        aggregate.project_evidence = [{ direction_labels: ["research-agent", "cool-agent"] }];
      },
    ],
    [
      "direction evidence direction_labels",
      (aggregate: Record<string, unknown>) => {
        aggregate.direction_evidence = [{ direction_labels: ["mcp"] }];
      },
    ],
    [
      "observation candidate direction_labels",
      (aggregate: Record<string, unknown>) => {
        aggregate.observation_candidates = [{ direction_labels: ["browser-agent"] }];
      },
    ],
  ])("rejects invalid %s in public aggregates", (_label, mutate) => {
    const aggregate = makeSanitizedAggregate() as unknown as Record<string, unknown>;
    mutate(aggregate);

    const result = assertPublicSafeAggregate(aggregate);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/invalid direction label/i);
  });

  it("computes a stable source input hash without leaking raw input", () => {
    const rawInput = "raw provider text with token=secret";
    const hashA = stableSourceInputHash(rawInput);
    const hashB = stableSourceInputHash(Buffer.from(rawInput));

    expect(hashA).toBe(hashB);
    expect(hashA).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(hashA).not.toContain("secret");
    expect(hashA).not.toContain(rawInput);
  });
});
