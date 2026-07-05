import type { CommunityAxisSeedConfig } from "./groupProtocol.ts";

export const newsNarrativeSeed: CommunityAxisSeedConfig = {
  agent_id: "community-news-agent",
  responsibility_id: "news-pr",
  axis: "news_pr_narrative",
  primary: [{ tool_id: "news-pr-narrative-index", source_class: "news_or_press_release" }],
  secondary: [{ tool_id: "press-release-wire-monitor", source_class: "news_or_press_release" }],
  fallback: [{ tool_id: "media-context-search", source_class: "community_search" }],
  last_resort: [{ tool_id: "manual-news-pr-triage", source_class: "manual_or_local_only" }],
  registry_snapshot_ref: "registry://industry/source-authority/news-pr/v1",
  tool_registry_snapshot_ref: "registry://industry/tool-catalog/news-pr/v1",
};
