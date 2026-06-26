import type { ProductAxisSeedConfig } from "./groupProtocol.ts";

export const productPlatformSeed: ProductAxisSeedConfig = {
  agent_id: "product-oss-agent",
  responsibility_id: "product-platform",
  axis: "product_vendor_release",
  primary: [
    { tool_id: "vendor-release-notes-feed", source_class: "official_owned_feed_or_doc" },
    { tool_id: "vendor-api-docs-diff", source_class: "official_owned_feed_or_doc" },
  ],
  secondary: [{ tool_id: "vendor-customer-story-index", source_class: "official_owned_feed_or_doc" }],
  fallback: [{ tool_id: "vendor-blog-monitor", source_class: "community_or_news_context" }],
  last_resort: [{ tool_id: "manual-product-release-triage", source_class: "manual_or_local_only" }],
  registry_snapshot_ref: "registry://industry/source-authority/product-platform/v1",
  tool_registry_snapshot_ref: "registry://industry/tool-catalog/product-platform/v1",
};
