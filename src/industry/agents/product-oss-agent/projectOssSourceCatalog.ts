import type { ProductAxisSeedConfig } from "./groupProtocol.ts";

export const projectOssSeed: ProductAxisSeedConfig = {
  agent_id: "product-oss-agent",
  responsibility_id: "project-oss",
  axis: "project_open_source",
  primary: [
    { tool_id: "github-release-feed", source_class: "repository_release_feed" },
    { tool_id: "package-registry-version-feed", source_class: "repository_release_feed" },
  ],
  secondary: [{ tool_id: "model-card-diff-feed", source_class: "repository_release_feed" }],
  fallback: [{ tool_id: "maintainer-blog-monitor", source_class: "community_or_news_context" }],
  last_resort: [{ tool_id: "manual-oss-release-triage", source_class: "manual_or_local_only" }],
  registry_snapshot_ref: "registry://industry/source-authority/project-oss/v1",
  tool_registry_snapshot_ref: "registry://industry/tool-catalog/project-oss/v1",
};
