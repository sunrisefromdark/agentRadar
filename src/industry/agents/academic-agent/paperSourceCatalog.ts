export const paperSourceCatalog = {
  arxiv: {
    display_name: "arXiv",
    source_type: "paper",
    authority_tier: "core",
    primary_source_distance: "primary",
    tool_ids: ["arxiv-official", "paper-metadata-resolver"],
  },
  openreview: {
    display_name: "OpenReview",
    source_type: "paper",
    authority_tier: "core",
    primary_source_distance: "primary",
    tool_ids: ["openreview-official", "paper-metadata-resolver"],
  },
  proceedings: {
    display_name: "Official Proceedings",
    source_type: "paper",
    authority_tier: "core",
    primary_source_distance: "primary",
    tool_ids: ["proceedings-catalog", "paper-metadata-resolver"],
  },
  benchmark: {
    display_name: "Benchmark or Dataset",
    source_type: "paper",
    authority_tier: "proven",
    primary_source_distance: "near_primary",
    tool_ids: ["benchmark-tracker", "paper-metadata-resolver"],
  },
  code: {
    display_name: "Replication or Code Release",
    source_type: "paper",
    authority_tier: "proven",
    primary_source_distance: "near_primary",
    tool_ids: ["repo-source-check", "paper-metadata-resolver"],
  },
} as const;

export type PaperSourceKey = keyof typeof paperSourceCatalog;

export function getPaperSource(sourceKey: string) {
  return paperSourceCatalog[(sourceKey in paperSourceCatalog ? sourceKey : "arxiv") as PaperSourceKey];
}
