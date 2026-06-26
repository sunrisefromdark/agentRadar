import type { CommunityAxisSeedConfig, CommunityNewsResponsibilityId } from "./groupProtocol.ts";

export function communityDiscussionSeed(responsibilityId: Extract<CommunityNewsResponsibilityId, "cn-community" | "global-community">): CommunityAxisSeedConfig {
  const isCn = responsibilityId === "cn-community";
  return {
    agent_id: "community-news-agent",
    responsibility_id: responsibilityId,
    axis: "community_discussion",
    primary: [{ tool_id: isCn ? "cn-community-original-thread-index" : "global-community-original-thread-index", source_class: "community_original_thread" }],
    secondary: [{ tool_id: isCn ? "cn-issue-and-forum-search" : "global-issue-and-forum-search", source_class: "community_search" }],
    fallback: [{ tool_id: isCn ? "cn-community-manual-sample" : "global-community-manual-sample", source_class: "manual_or_local_only" }],
    last_resort: [{ tool_id: "manual-community-noise-triage", source_class: "manual_or_local_only" }],
    registry_snapshot_ref: `registry://industry/source-authority/${responsibilityId}/v1`,
    tool_registry_snapshot_ref: `registry://industry/tool-catalog/${responsibilityId}/v1`,
  };
}
