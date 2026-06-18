import type { AgentReachQueryEntry } from "./queryPack.ts";
import type {
  AgentReachProviderId,
  AgentReachProviderItem,
  AgentReachQualityPolicy,
} from "./types.ts";

export interface AgentReachQualityResult {
  items: AgentReachProviderItem[];
  warnings: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

const AGENT_MARKERS = new Set([
  "agent",
  "agents",
  "assistant",
  "assistants",
  "copilot",
  "autonomous",
]);

const GENERIC_QUERY_TOKENS = new Set([
  "ai",
  "agent",
  "agents",
  "assistant",
  "assistants",
]);

const TRACKING_QUERY_KEYS = new Set(["fbclid", "gclid", "ref", "ref_src"]);

function normalizedWords(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function safeUrlPathname(value: string | undefined): string {
  if (!value) return "";
  try {
    return new URL(value).pathname;
  } catch {
    return "";
  }
}

function searchableText(item: AgentReachProviderItem): string {
  return [
    item.title,
    item.target?.name,
    item.target?.topic_hint,
    safeUrlPathname(item.url),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}

function uniqueMerge<T extends string>(
  existing: readonly T[] | undefined,
  incoming: readonly T[] | undefined,
): T[] | undefined {
  const merged: T[] = [];
  for (const value of [...(existing ?? []), ...(incoming ?? [])]) {
    if (!merged.includes(value)) merged.push(value);
  }
  return merged.length > 0 ? merged : undefined;
}

function queryEntryHasExactMatch(entry: AgentReachQueryEntry, text: string): boolean {
  const itemWords = normalizedWords(text);
  const normalizedText = itemWords.join(" ");

  for (const term of entry.terms) {
    const termWords = normalizedWords(term);
    if (termWords.length === 0) continue;
    if (normalizedText.includes(termWords.join(" "))) return true;
  }
  return false;
}

function queryEntryHasFallbackMatch(entry: AgentReachQueryEntry, text: string): boolean {
  const itemWords = normalizedWords(text);
  const itemWordSet = new Set(itemWords);
  const hasAgentMarker = itemWords.some((word) => AGENT_MARKERS.has(word));
  if (!hasAgentMarker) return false;
  const parentLabelWords = new Set(
    entry.direction_labels
      .filter((label) => label !== entry.id)
      .flatMap((label) => normalizedWords(label)),
  );
  const specificTokens = new Set(
    [
      ...normalizedWords(entry.id).filter((word) => !parentLabelWords.has(word)),
      ...entry.terms.flatMap((term) =>
        normalizedWords(term).filter((word) => !parentLabelWords.has(word)),
      ),
    ].filter((word) => !GENERIC_QUERY_TOKENS.has(word)),
  );

  for (const term of entry.terms) {
    const termWords = normalizedWords(term);
    if (
      termWords.some((word) => specificTokens.has(word) && itemWordSet.has(word))
    ) {
      return true;
    }
  }
  return false;
}

export function enrichLiveAgentReachItem(input: {
  item: AgentReachProviderItem;
  queryPack: readonly AgentReachQueryEntry[];
}): AgentReachProviderItem | undefined {
  const text = searchableText(input.item);
  let directionLabels = input.item.direction_labels;
  let tags = input.item.tags;
  const exactMatches = input.queryPack.filter((entry) =>
    queryEntryHasExactMatch(entry, text),
  );
  const matches =
    exactMatches.length > 0
      ? exactMatches
      : input.queryPack.filter((entry) => queryEntryHasFallbackMatch(entry, text));

  for (const entry of matches) {
    directionLabels = uniqueMerge(directionLabels, entry.direction_labels);
    tags = uniqueMerge(tags, entry.tags);
  }

  if (matches.length === 0) return undefined;
  return {
    ...input.item,
    ...(directionLabels ? { direction_labels: directionLabels } : {}),
    ...(tags ? { tags } : {}),
  };
}

function parseRequiredDate(value: string, label: string): number {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error(`${label} must be a valid ISO date`);
  return time;
}

function optionalDate(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : undefined;
}

export function canonicalizeAgentReachUrl(value: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return undefined;
  }

  parsed.hash = "";
  parsed.username = "";
  parsed.password = "";
  const keptParams = [...parsed.searchParams.entries()]
    .filter(([key]) => {
      const normalizedKey = key.toLowerCase();
      return (
        !normalizedKey.startsWith("utm_") &&
        !TRACKING_QUERY_KEYS.has(normalizedKey)
      );
    })
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey === rightKey
        ? leftValue.localeCompare(rightValue)
        : leftKey.localeCompare(rightKey),
    );

  const search =
    keptParams.length > 0
      ? `?${keptParams
          .map(
            ([key, value]) =>
              `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
          )
          .join("&")}`
      : "";

  return `${parsed.origin}${parsed.pathname}${search}`;
}

function sortTimestamp(item: AgentReachProviderItem): number | undefined {
  return optionalDate(item.source_published_at);
}

function metric(item: AgentReachProviderItem, key: string): number {
  const value = item.metrics?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stableSortItems(
  items: readonly AgentReachProviderItem[],
): AgentReachProviderItem[] {
  return [...items].sort((left, right) => {
    const leftTime = sortTimestamp(left);
    const rightTime = sortTimestamp(right);
    if (leftTime !== undefined && rightTime !== undefined && leftTime !== rightTime) {
      return rightTime - leftTime;
    }
    if (leftTime !== undefined && rightTime === undefined) return -1;
    if (leftTime === undefined && rightTime !== undefined) return 1;

    const pointsDiff = metric(right, "points") - metric(left, "points");
    if (pointsDiff !== 0) return pointsDiff;

    const commentsDiff = metric(right, "comments") - metric(left, "comments");
    if (commentsDiff !== 0) return commentsDiff;

    const leftKey = canonicalizeAgentReachUrl(left.url ?? "") ?? left.raw_ref ?? "";
    const rightKey = canonicalizeAgentReachUrl(right.url ?? "") ?? right.raw_ref ?? "";
    return leftKey.localeCompare(rightKey);
  });
}

function dedupeKey(
  item: AgentReachProviderItem,
  index: number,
): string {
  if (item.platform === "hacker_news" && item.raw_ref) {
    return `${item.platform}:raw_ref:${item.raw_ref}`;
  }

  const canonicalUrl = item.url ? canonicalizeAgentReachUrl(item.url) : undefined;
  if (canonicalUrl) return `${item.platform}:url:${canonicalUrl}`;
  if (item.raw_ref) return `${item.platform}:raw_ref:${item.raw_ref}`;
  return `${item.platform}:unique:${index}`;
}

function mergeMetrics(
  left: Record<string, number> | undefined,
  right: Record<string, number> | undefined,
): Record<string, number> | undefined {
  const merged: Record<string, number> = {};
  for (const [key, value] of Object.entries(left ?? {})) {
    if (Number.isFinite(value)) merged[key] = value;
  }
  for (const [key, value] of Object.entries(right ?? {})) {
    if (!Number.isFinite(value)) continue;
    merged[key] = Math.max(merged[key] ?? value, value);
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergeItems(
  base: AgentReachProviderItem,
  duplicate: AgentReachProviderItem,
): AgentReachProviderItem {
  const directionLabels = uniqueMerge(
    base.direction_labels,
    duplicate.direction_labels,
  );
  const tags = uniqueMerge(base.tags, duplicate.tags);
  const derivedSignalKinds = uniqueMerge(
    base.derived_signal_kinds,
    duplicate.derived_signal_kinds,
  );
  const metrics = mergeMetrics(base.metrics, duplicate.metrics);
  const actor = { ...(duplicate.actor ?? {}), ...(base.actor ?? {}) };
  const target = { ...(duplicate.target ?? {}), ...(base.target ?? {}) };
  return {
    ...base,
    ...(Object.keys(actor).length > 0 ? { actor } : {}),
    ...(Object.keys(target).length > 0 ? { target } : {}),
    ...(derivedSignalKinds ? { derived_signal_kinds: derivedSignalKinds } : {}),
    ...(directionLabels ? { direction_labels: directionLabels } : {}),
    ...(tags ? { tags } : {}),
    ...(metrics ? { metrics } : {}),
  };
}

function deduplicateItems(input: {
  items: readonly AgentReachProviderItem[];
}): { items: AgentReachProviderItem[]; duplicateCount: number } {
  const byKey = new Map<string, AgentReachProviderItem>();
  let duplicateCount = 0;
  input.items.forEach((item, index) => {
    const key = dedupeKey(item, index);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      return;
    }
    duplicateCount += 1;
    byKey.set(key, mergeItems(existing, item));
  });
  return { items: [...byKey.values()], duplicateCount };
}

function truncateItems(input: {
  items: readonly AgentReachProviderItem[];
  maxItems: number;
}): { items: AgentReachProviderItem[]; truncatedCount: number } {
  if (input.items.length <= input.maxItems) {
    return { items: [...input.items], truncatedCount: 0 };
  }
  return {
    items: input.items.slice(0, input.maxItems),
    truncatedCount: input.items.length - input.maxItems,
  };
}

export function applyAgentReachProviderQuality(input: {
  providerId: AgentReachProviderId;
  items: readonly AgentReachProviderItem[];
  queryPack: readonly AgentReachQueryEntry[];
  generatedAt: string;
  policy: AgentReachQualityPolicy;
  liveEnabled: boolean;
}): AgentReachQualityResult {
  const generatedAtMs = parseRequiredDate(input.generatedAt, "generatedAt");
  const cutoffMs = generatedAtMs - input.policy.lookback_days * DAY_MS;
  const counts = {
    irrelevant: 0,
    stale: 0,
    future: 0,
    invalidTimestamp: 0,
  };

  let items: AgentReachProviderItem[] = [];
  for (const item of input.items) {
    let candidate = item;
    if (input.liveEnabled) {
      const enriched = enrichLiveAgentReachItem({
        item: candidate,
        queryPack: input.queryPack,
      });
      if (!enriched) {
        counts.irrelevant += 1;
        continue;
      }
      candidate = enriched;

      if (candidate.source_published_at) {
        const publishedAtMs = optionalDate(candidate.source_published_at);
        if (publishedAtMs === undefined) {
          counts.invalidTimestamp += 1;
          continue;
        }
        if (publishedAtMs > generatedAtMs) {
          counts.future += 1;
          continue;
        }
        if (publishedAtMs < cutoffMs) {
          counts.stale += 1;
          continue;
        }
      }
    }
    items.push(candidate);
  }

  items = stableSortItems(items);
  const deduplicated = deduplicateItems({ items });
  items = stableSortItems(deduplicated.items);
  const truncated = truncateItems({
    items,
    maxItems: input.policy.max_items_per_provider,
  });

  const warnings = [
    counts.irrelevant > 0
      ? `quality_filtered_irrelevant:${input.providerId}:${counts.irrelevant}`
      : undefined,
    counts.stale > 0
      ? `quality_filtered_stale:${input.providerId}:${counts.stale}`
      : undefined,
    counts.future > 0
      ? `quality_filtered_future:${input.providerId}:${counts.future}`
      : undefined,
    counts.invalidTimestamp > 0
      ? `quality_filtered_invalid_timestamp:${input.providerId}:${counts.invalidTimestamp}`
      : undefined,
    deduplicated.duplicateCount > 0
      ? `quality_deduplicated:${input.providerId}:${deduplicated.duplicateCount}`
      : undefined,
    truncated.truncatedCount > 0
      ? `quality_truncated:${input.providerId}:${truncated.truncatedCount}`
      : undefined,
  ].filter((warning): warning is string => Boolean(warning));

  return {
    items: truncated.items,
    warnings,
  };
}

export function finalizeAgentReachProducerItems(input: {
  items: readonly AgentReachProviderItem[];
  maxItemsTotal: number;
}): AgentReachQualityResult {
  let items = stableSortItems(input.items);
  const deduplicated = deduplicateItems({ items });
  items = stableSortItems(deduplicated.items);
  const truncated = truncateItems({
    items,
    maxItems: input.maxItemsTotal,
  });
  const warnings = [
    deduplicated.duplicateCount > 0
      ? `quality_deduplicated:producer:${deduplicated.duplicateCount}`
      : undefined,
    truncated.truncatedCount > 0
      ? `quality_truncated:producer:${truncated.truncatedCount}`
      : undefined,
  ].filter((warning): warning is string => Boolean(warning));

  return {
    items: truncated.items,
    warnings,
  };
}
