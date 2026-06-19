import { describe, expect, it } from "vitest";

import { planAgentReachSearchJobs } from "../agentReach/searchPlanner.ts";
import { AGENT_REACH_QUERY_PACK } from "../agentReach/queryPack.ts";
import { AGENT_REACH_DEFAULT_QUALITY_POLICY } from "../agentReach/qualityPolicy.ts";
import { AGENT_REACH_PROVIDER_REGISTRY } from "../agentReach/providerRegistry.ts";

describe("AgentReach search planner", () => {
  it("plans only search-backed providers in canonical provider and query order", () => {
    const plan = planAgentReachSearchJobs({
      providers: AGENT_REACH_PROVIDER_REGISTRY,
      selected_provider_ids: ["hacker-news", "official-web", "external-import"],
      query_pack: AGENT_REACH_QUERY_PACK.slice(0, 2),
      provider_configs: {
        "official-web": {
          live: {
            query_limit: 1,
          },
        },
        "hacker-news": {
          live: {
            query_limit: 1,
          },
        },
      },
      quality_policy: AGENT_REACH_DEFAULT_QUALITY_POLICY,
    });

    expect(plan.jobs.map((job) => job.provider_id)).toEqual([
      "official-web",
      "official-web",
      "official-web",
      "hacker-news",
      "hacker-news",
      "hacker-news",
    ]);
    expect([...new Set(plan.jobs.map((job) => job.query_entry_id))]).toEqual([
      "research-agent",
    ]);
    expect(plan.jobs.map((job) => job.term)).toEqual([
      "research agent",
      "ai research assistant",
      "scientific agent",
      "research agent",
      "ai research assistant",
      "scientific agent",
    ]);
    expect(plan.jobs[0]).toMatchObject({
      job_id: "official-web:research-agent:research-agent",
      direction_labels: ["research-agent"],
      tags: ["research"],
      max_items: AGENT_REACH_DEFAULT_QUALITY_POLICY.max_items_per_query,
    });
    expect(plan.summary).toEqual({
      job_count: 6,
      provider_count: 2,
      query_entry_count: 1,
      reserved_provider_count: 0,
      max_items_per_query: AGENT_REACH_DEFAULT_QUALITY_POLICY.max_items_per_query,
      provider_job_counts: {
        "official-web": 3,
        "hacker-news": 3,
      },
    });
  });

  it("does not create jobs for import or reserved manual-only providers", () => {
    const plan = planAgentReachSearchJobs({
      providers: AGENT_REACH_PROVIDER_REGISTRY,
      selected_provider_ids: ["external-import", "x_twitter", "reddit"],
      query_pack: AGENT_REACH_QUERY_PACK,
      provider_configs: {},
      quality_policy: AGENT_REACH_DEFAULT_QUALITY_POLICY,
    });

    expect(plan.jobs).toEqual([]);
    expect(plan.summary).toEqual({
      job_count: 0,
      provider_count: 0,
      query_entry_count: 0,
      reserved_provider_count: 2,
      max_items_per_query: AGENT_REACH_DEFAULT_QUALITY_POLICY.max_items_per_query,
      provider_job_counts: {},
    });
  });

  it("uses deterministic fallback job ids when terms slug to the same value", () => {
    const plan = planAgentReachSearchJobs({
      providers: AGENT_REACH_PROVIDER_REGISTRY,
      selected_provider_ids: ["rss-blog"],
      query_pack: [
        {
          id: "punctuation",
          terms: ["Agent!!!", "agent"],
          direction_labels: ["research-agent"],
        },
      ],
      provider_configs: {},
      quality_policy: AGENT_REACH_DEFAULT_QUALITY_POLICY,
    });

    expect(plan.jobs.map((job) => job.job_id)).toEqual([
      "rss-blog:punctuation:agent",
      "rss-blog:punctuation:agent-2",
    ]);
  });
});
