import type { ProductAxisSeedConfig } from "./groupProtocol.ts";

export const developerStudioSeed: ProductAxisSeedConfig = {
  agent_id: "product-oss-agent",
  responsibility_id: "developer-studio",
  axis: "developer_studio",
  primary: [
    { tool_id: "developer-docs-changelog", source_class: "developer_platform_docs" },
    { tool_id: "sdk-release-feed", source_class: "developer_platform_docs" },
  ],
  secondary: [{ tool_id: "console-update-feed", source_class: "developer_platform_docs" }],
  fallback: [{ tool_id: "developer-forum-release-notes", source_class: "community_or_news_context" }],
  last_resort: [{ tool_id: "manual-developer-studio-triage", source_class: "manual_or_local_only" }],
  registry_snapshot_ref: "registry://industry/source-authority/developer-studio/v1",
  tool_registry_snapshot_ref: "registry://industry/tool-catalog/developer-studio/v1",
};
