import type { DailyRunSummaryExternalDiscovery } from "../types.ts";
import type {
  DailyExternalAggregate,
  ExternalActorTier,
  ExternalActorType,
  ExternalBindingConfidence,
  ExternalCandidateQualification,
  ExternalCandidateExplanation,
  ExternalCandidateExplanationArtifact,
  ExternalCoverageStatus,
  ExternalDiscoveryCoverage,
  ExternalEvidence,
  ExternalEvidenceSource,
  ExternalNamedRegistryActor,
  ExternalPlatform,
  ExternalPublicActor,
  ExternalProviderStatus,
  ExternalRawEventKind,
  ExternalTargetType,
  ObservationCandidate,
} from "../externalDiscovery/types.ts";
import type {
  AgentReachCandidateCardViewModel,
  AgentReachChipTone,
  AgentReachCoverageViewModel,
  AgentReachDataSourceKind,
  AgentReachDirectionSnapshotViewModel,
  AgentReachEvidenceSourceViewModel,
  AgentReachEvidenceViewModel,
  AgentReachFilterViewModel,
  AgentReachNamedActorViewModel,
  AgentReachPublicActorViewModel,
  AgentReachStatusViewModel,
  AgentReachSummaryCardViewModel,
} from "./types.ts";

export interface BuildAgentReachDisplayModelInput {
  aggregate: DailyExternalAggregate | null;
  candidateExplanations?: ExternalCandidateExplanationArtifact | null;
  candidateExplanationsReadStatus?: "ok" | "not_found" | "parse_error" | "unsupported_context";
  candidateExplanationsPath?: string | null;
  dailySection?: DailyExternalDiscoverySection | null;
  runSummary?: DailyRunSummaryExternalDiscovery | null;
  aggregatePath?: string | null;
  aggregateReadStatus?: "ok" | "not_found" | "parse_error" | "unsupported_context";
}

interface DailyExternalDiscoverySection {
  external_layer_status: {
    status: ExternalProviderStatus;
    status_reason?: string;
    accepted_event_count: number;
    rejected_event_count: number;
  };
  direction_label_counts: Partial<Record<string, number>>;
  external_audit_summary: {
    coverage?: ExternalDiscoveryCoverage;
    warnings: string[];
  };
  external_observation_candidates: ObservationCandidate[];
  external_project_evidence_summaries: ExternalEvidence[];
}

export interface AgentReachDisplayModel {
  status: AgentReachStatusViewModel;
  summary_cards: AgentReachSummaryCardViewModel[];
  filters: AgentReachFilterViewModel;
  candidates: AgentReachCandidateCardViewModel[];
  evidence_by_id: Record<string, AgentReachEvidenceViewModel>;
  sources_by_event_id: Record<string, AgentReachEvidenceSourceViewModel[]>;
  coverage: AgentReachCoverageViewModel[];
  direction_snapshot: AgentReachDirectionSnapshotViewModel;
  warnings: string[];
  generated_at: string | null;
  source_health: string;
}

type ResolvedExternalInput = {
  dataSource: AgentReachDataSourceKind;
  providerStatus: ExternalProviderStatus | "missing";
  statusReason: string | null;
  aggregatePath: string | null;
  generatedAt: string | null;
  acceptedEventCount: number;
  rejectedEventCount: number;
  platformCounts: Partial<Record<ExternalPlatform, number>>;
  directionLabelCounts: Partial<Record<string, number>>;
  coverage: ExternalDiscoveryCoverage | null;
  warnings: string[];
  candidates: ObservationCandidate[];
  projectEvidence: ExternalEvidence[];
  directionEvidence: ExternalEvidence[];
  evidenceSources: ExternalEvidenceSource[];
  sourceDetailsAvailable: boolean;
};

type AgentReachCandidateCardBase = Omit<
  AgentReachCandidateCardViewModel,
  "intro_line" | "appearance_reason" | "why_watch_reasons" | "confirmation_gaps"
>;

type CandidateExplanationIndex = {
  byCandidateKey: Map<string, ExternalCandidateExplanation>;
  uniqueByTargetKey: Map<string, ExternalCandidateExplanation>;
  duplicateTargetKeys: Set<string>;
  warnings: string[];
};

const PLATFORM_ORDER: ExternalPlatform[] = ["x_twitter", "reddit", "hacker_news", "official_web", "official_blog"];
const TYPE_CHIP_ORDER = ["new_discovery", "project_evidence", "direction_watch", "official_signal", "needs_confirmation"] as const;
const SOURCE_CHIP_ORDER = ["x_twitter", "reddit", "hacker_news", "official"] as const;
const DIRECTION_TITLE_CLUSTER_TOKEN_COUNT = 5;
const DIRECTION_TITLE_CLUSTER_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "best",
  "blew",
  "blow",
  "blown",
  "for",
  "from",
  "github",
  "had",
  "has",
  "have",
  "in",
  "is",
  "new",
  "of",
  "on",
  "or",
  "save",
  "saved",
  "saving",
  "that",
  "the",
  "these",
  "this",
  "those",
  "to",
  "today",
  "top",
  "up",
  "was",
  "week",
  "weekly",
  "were",
  "with",
  "without",
  "worth",
]);

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function warningText(value: string | { reason_code?: string; reason_detail?: string } | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  return [value.reason_code, value.reason_detail].filter(Boolean).join(": ") || null;
}

function sumRecordValues(values: Partial<Record<string, number>> | undefined): number {
  return Object.values(values ?? {}).reduce<number>((sum, value) => sum + Number(value ?? 0), 0);
}

function providerStatusLabel(status: ExternalProviderStatus | "missing"): string {
  switch (status) {
    case "ok":
      return "ok";
    case "partial":
      return "partial";
    case "failed":
      return "failed";
    case "skipped":
      return "skipped";
    default:
      return "missing";
  }
}

function providerStatusTone(status: ExternalProviderStatus | "missing"): AgentReachChipTone {
  switch (status) {
    case "ok":
      return "good";
    case "partial":
      return "warn";
    case "failed":
      return "bad";
    default:
      return "neutral";
  }
}

function coverageStatusLabel(status: ExternalCoverageStatus | "missing"): string {
  switch (status) {
    case "ok":
      return "正常";
    case "partial":
      return "部分可用";
    case "zero_relevant_results":
      return "已执行但无相关结果";
    case "not_configured":
      return "未配置";
    case "manual_import_only":
      return "仅手动导入";
    case "unavailable":
      return "不可用";
    case "failed":
      return "失败";
    default:
      return "未返回";
  }
}

function coverageTone(status: ExternalCoverageStatus | "missing"): AgentReachChipTone {
  switch (status) {
    case "ok":
      return "good";
    case "partial":
      return "warn";
    case "failed":
    case "unavailable":
      return "bad";
    default:
      return "neutral";
  }
}

export function platformLabel(platform: string): string {
  switch (platform) {
    case "x_twitter":
      return "X";
    case "reddit":
      return "Reddit";
    case "hacker_news":
      return "HN";
    case "official_web":
      return "官方网页";
    case "official_blog":
      return "官方博客";
    case "official":
      return "官方";
    default:
      return platform || "未知来源";
  }
}

function platformGroup(platform: string): string {
  return platform === "official_web" || platform === "official_blog" ? "official" : platform;
}

function targetTypeLabel(type: ExternalTargetType | undefined): string {
  switch (type) {
    case "project":
      return "项目";
    case "paper":
      return "论文";
    case "product":
      return "产品";
    case "topic":
      return "方向";
    default:
      return "对象";
  }
}

function rawEventKindLabel(kind: ExternalRawEventKind | string): string {
  switch (kind) {
    case "mention":
      return "提及";
    case "discussion":
      return "讨论";
    case "official_release":
      return "官方发布";
    case "blog_post":
      return "博客更新";
    case "question":
      return "问题";
    case "showcase":
      return "展示";
    default:
      return "未知事件";
  }
}

function actorTypeLabel(type: ExternalActorType | string): string {
  switch (type) {
    case "institution":
      return "机构";
    case "team":
      return "团队";
    case "person":
      return "个人";
    case "community":
      return "社区";
    default:
      return "未识别";
  }
}

function actorTierLabel(tier: ExternalActorTier | string): string {
  switch (tier) {
    case "core":
      return "核心名单";
    case "proven":
      return "已验证";
    case "watch":
      return "观察名单";
    case "ordinary":
      return "普通来源";
    default:
      return "未识别";
  }
}

function registryTierRank(tier: string): number {
  switch (tier) {
    case "core":
      return 0;
    case "proven":
      return 1;
    case "watch":
      return 2;
    default:
      return 3;
  }
}

function namedActorView(actor: ExternalNamedRegistryActor): AgentReachNamedActorViewModel {
  return {
    entity_id: actor.entity_id,
    display_name: actor.display_name,
    actor_type: actor.actor_type,
    actor_type_label: actorTypeLabel(actor.actor_type),
    registry_tier: actor.registry_tier,
    registry_tier_label: actorTierLabel(actor.registry_tier),
    event_count: actor.event_count,
    platforms: actor.platforms,
    platform_labels: actor.platforms.map(platformLabel),
    first_seen_at: actor.first_seen_at ?? null,
    last_seen_at: actor.last_seen_at ?? null,
  };
}

function publicActorSourceKindLabel(kind: string): string {
  switch (kind) {
    case "x_handle":
      return "X account";
    case "reddit_community":
      return "Reddit community";
    case "reddit_user":
      return "Reddit user";
    case "hn_user":
      return "HN user";
    case "github_owner":
      return "GitHub owner";
    case "official_domain":
      return "Official domain";
    default:
      return "Public source";
  }
}

function publicActorView(actor: ExternalPublicActor): AgentReachPublicActorViewModel {
  return {
    actor_id: actor.public_actor_id,
    display_name: actor.display_name,
    actor_type: actor.actor_type,
    actor_type_label: actorTypeLabel(actor.actor_type),
    source_kind: actor.source_kind,
    source_kind_label: publicActorSourceKindLabel(actor.source_kind),
    event_count: actor.event_count,
    platforms: actor.platforms,
    platform_labels: actor.platforms.map(platformLabel),
    first_seen_at: actor.first_seen_at ?? null,
    last_seen_at: actor.last_seen_at ?? null,
  };
}

function parseHttpUrl(value: string | null | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function pathParts(url: URL): string[] {
  return url.pathname.split("/").map((part) => part.trim()).filter(Boolean);
}

function isSafePublicToken(value: string | undefined): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_.-]{2,80}$/.test(value);
}

function sourcePublicActor(
  source: AgentReachEvidenceSourceViewModel,
): AgentReachPublicActorViewModel | null {
  const sourceUrl = parseHttpUrl(source.source_url);
  const targetUrl = parseHttpUrl(source.target_url);
  const url = sourceUrl ?? (source.platform === "official_web" || source.platform === "official_blog" ? targetUrl : null);
  if (!url) return null;

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = pathParts(url);
  const base = {
    actor_type: source.actor_type,
    actor_type_label: actorTypeLabel(source.actor_type),
    event_count: 1,
    platforms: [source.platform],
    platform_labels: [platformLabel(source.platform)],
    first_seen_at: source.observed_at,
    last_seen_at: source.observed_at,
  };

  if (hostname === "x.com" || hostname === "twitter.com") {
    const handle = parts[0];
    if (isSafePublicToken(handle) && !["i", "intent", "search", "explore", "home", "share"].includes(handle.toLowerCase())) {
      return {
        ...base,
        actor_id: `x:${handle.toLowerCase()}`,
        display_name: `@${handle}`,
        actor_type: source.actor_type === "unknown" ? "person" : source.actor_type,
        actor_type_label: actorTypeLabel(source.actor_type === "unknown" ? "person" : source.actor_type),
        source_kind: "x_handle",
        source_kind_label: publicActorSourceKindLabel("x_handle"),
      };
    }
  }

  if (hostname === "reddit.com" || hostname.endsWith(".reddit.com")) {
    const [kind, value] = parts;
    if (kind?.toLowerCase() === "r" && isSafePublicToken(value)) {
      return {
        ...base,
        actor_id: `reddit:r:${value.toLowerCase()}`,
        display_name: `r/${value}`,
        actor_type: "community",
        actor_type_label: actorTypeLabel("community"),
        source_kind: "reddit_community",
        source_kind_label: publicActorSourceKindLabel("reddit_community"),
      };
    }
    if ((kind?.toLowerCase() === "user" || kind?.toLowerCase() === "u") && isSafePublicToken(value)) {
      return {
        ...base,
        actor_id: `reddit:u:${value.toLowerCase()}`,
        display_name: `u/${value}`,
        actor_type: "person",
        actor_type_label: actorTypeLabel("person"),
        source_kind: "reddit_user",
        source_kind_label: publicActorSourceKindLabel("reddit_user"),
      };
    }
  }

  if (hostname === "news.ycombinator.com" && parts[0] === "user") {
    const user = url.searchParams.get("id") ?? undefined;
    if (isSafePublicToken(user)) {
      return {
        ...base,
        actor_id: `hn:${user.toLowerCase()}`,
        display_name: `HN ${user}`,
        actor_type: "person",
        actor_type_label: actorTypeLabel("person"),
        source_kind: "hn_user",
        source_kind_label: publicActorSourceKindLabel("hn_user"),
      };
    }
  }

  if (hostname === "github.com") {
    const owner = parts[0];
    if (isSafePublicToken(owner) && !["features", "marketplace", "topics", "trending", "explore", "login"].includes(owner.toLowerCase())) {
      return {
        ...base,
        actor_id: `github:${owner.toLowerCase()}`,
        display_name: `GitHub ${owner}`,
        actor_type: source.actor_type === "person" ? "person" : "team",
        actor_type_label: actorTypeLabel(source.actor_type === "person" ? "person" : "team"),
        source_kind: "github_owner",
        source_kind_label: publicActorSourceKindLabel("github_owner"),
      };
    }
  }

  if ((source.platform === "official_web" || source.platform === "official_blog") && hostname.length > 0) {
    return {
      ...base,
      actor_id: `domain:${hostname}`,
      display_name: hostname,
      actor_type: source.actor_type === "unknown" || source.actor_type === "community" ? "team" : source.actor_type,
      actor_type_label: actorTypeLabel(source.actor_type === "unknown" || source.actor_type === "community" ? "team" : source.actor_type),
      source_kind: "official_domain",
      source_kind_label: publicActorSourceKindLabel("official_domain"),
    };
  }

  return null;
}

function mergePublicActors(actors: AgentReachPublicActorViewModel[]): AgentReachPublicActorViewModel[] {
  const byId = new Map<string, AgentReachPublicActorViewModel>();
  for (const actor of actors) {
    const existing = byId.get(actor.actor_id);
    if (!existing) {
      byId.set(actor.actor_id, { ...actor, platforms: [...actor.platforms], platform_labels: [...actor.platform_labels] });
      continue;
    }
    const platforms = uniqueStrings([...existing.platforms, ...actor.platforms]);
    existing.event_count += actor.event_count;
    existing.platforms = platforms;
    existing.platform_labels = platforms.map(platformLabel);
    existing.first_seen_at = earliestTime(existing.first_seen_at, actor.first_seen_at);
    existing.last_seen_at = latestTime(existing.last_seen_at, actor.last_seen_at);
  }
  return Array.from(byId.values()).sort(
    (left, right) => right.event_count - left.event_count || left.display_name.localeCompare(right.display_name),
  );
}

function mergeNamedActors(evidence: AgentReachEvidenceViewModel[]): AgentReachNamedActorViewModel[] {
  const byEntity = new Map<string, AgentReachNamedActorViewModel>();
  for (const item of evidence) {
    for (const actor of item.named_registry_actors) {
      const existing = byEntity.get(actor.entity_id);
      if (!existing) {
        byEntity.set(actor.entity_id, { ...actor, platforms: [...actor.platforms], platform_labels: [...actor.platform_labels] });
        continue;
      }
      const platforms = uniqueStrings([...existing.platforms, ...actor.platforms]);
      existing.event_count += actor.event_count;
      existing.platforms = platforms;
      existing.platform_labels = platforms.map(platformLabel);
      existing.first_seen_at = earliestTime(existing.first_seen_at, actor.first_seen_at);
      existing.last_seen_at = latestTime(existing.last_seen_at, actor.last_seen_at);
    }
  }
  return Array.from(byEntity.values()).sort(
    (left, right) =>
      registryTierRank(left.registry_tier) - registryTierRank(right.registry_tier) ||
      right.event_count - left.event_count ||
      left.display_name.localeCompare(right.display_name),
  );
}

function earliestTime(left: string | null, right: string | null): string | null {
  if (!left) return right;
  if (!right) return left;
  return left <= right ? left : right;
}

function latestTime(left: string | null, right: string | null): string | null {
  if (!left) return right;
  if (!right) return left;
  return left >= right ? left : right;
}

function qualificationLabel(value: ExternalCandidateQualification | string): string {
  switch (value) {
    case "observe":
      return "观察";
    case "needs_primary_confirmation":
      return "需主源确认";
    case "supporting_evidence_only":
      return "仅外部补证";
    default:
      return value || "待确认";
  }
}

function bindingConfidenceLabel(value: ExternalBindingConfidence): string {
  switch (value) {
    case "high":
      return "高";
    case "medium":
      return "中";
    case "low":
      return "低";
    case "unbound":
      return "未绑定";
    default:
      return "未知";
  }
}

function typeKeyFromCandidate(candidate: ObservationCandidate): (typeof TYPE_CHIP_ORDER)[number] {
  if (candidate.display_bucket === "official_releases") return "official_signal";
  if (candidate.candidate_kind === "direction_watch" || candidate.display_bucket === "direction_observations") return "direction_watch";
  if (candidate.candidate_kind === "external_evidence_boost" || candidate.display_bucket === "project_evidence") return "project_evidence";
  if (candidate.candidate_kind === "needs_confirmation" || candidate.display_bucket === "needs_followup") return "needs_confirmation";
  return "new_discovery";
}

function typeLabelFromKey(key: string): string {
  switch (key) {
    case "new_discovery":
      return "新发现";
    case "project_evidence":
      return "外部补证";
    case "direction_watch":
      return "方向观察";
    case "official_signal":
      return "官方信号";
    case "needs_confirmation":
      return "待确认";
    default:
      return "待确认";
  }
}

function metricEntries(metrics: ExternalEvidenceSource["metrics"]): AgentReachEvidenceSourceViewModel["metrics"] {
  if (!metrics) return [];
  return [
    ["likes", "likes", metrics.likes],
    ["reposts", "转发", metrics.reposts],
    ["comments", "comments", metrics.comments],
    ["upvotes", "upvotes", metrics.upvotes],
    ["replies", "replies", metrics.replies],
  ]
    .filter((entry): entry is [string, string, number] => typeof entry[2] === "number")
    .map(([key, label, value]) => ({ key, label, value }));
}

function countRecordToItems(
  values: Partial<Record<string, number>> | undefined,
  labeler: (value: string) => string,
): Array<{ key: string; label: string; count: number }> {
  return Object.entries(values ?? {})
    .filter(([, count]) => Number(count ?? 0) > 0)
    .sort((left, right) => Number(right[1] ?? 0) - Number(left[1] ?? 0) || left[0].localeCompare(right[0]))
    .map(([key, count]) => ({ key, label: labeler(key), count: Number(count ?? 0) }));
}

function mergeCountItems(
  evidence: AgentReachEvidenceViewModel[],
  key: "actor_types" | "actor_tiers",
): Array<{ key: string; label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of evidence) {
    for (const entry of item[key]) {
      counts.set(entry.key, (counts.get(entry.key) ?? 0) + entry.count);
    }
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([entryKey, count]) => ({
      key: entryKey,
      label: key === "actor_types" ? actorTypeLabel(entryKey) : actorTierLabel(entryKey),
      count,
    }));
}

function sourceView(source: ExternalEvidenceSource): AgentReachEvidenceSourceViewModel {
  const title = source.source_title?.trim() || `${platformLabel(source.platform)} ${rawEventKindLabel(source.raw_event_kind)}`;
  return {
    source_id: source.source_id,
    event_id: source.event_id,
    platform: source.platform,
    platform_label: platformLabel(source.platform),
    title,
    source_url: source.source_url ?? null,
    raw_event_kind: source.raw_event_kind,
    raw_event_kind_label: rawEventKindLabel(source.raw_event_kind),
    target_name: source.target_name,
    target_url: source.target_url ?? null,
    source_published_at: source.source_published_at ?? null,
    observed_at: source.observed_at ?? null,
    metrics: metricEntries(source.metrics),
    actor_type: source.actor_type,
    actor_type_label: actorTypeLabel(source.actor_type),
    actor_tier: source.actor_tier,
    actor_tier_label: actorTierLabel(source.actor_tier),
  };
}

function evidenceView(
  evidence: ExternalEvidence,
  sourcesByEventId: Record<string, AgentReachEvidenceSourceViewModel[]>,
): AgentReachEvidenceViewModel {
  const sourceCards = evidence.event_ids.flatMap((eventId) => sourcesByEventId[eventId] ?? []);
  const publicActors = mergePublicActors([
    ...(evidence.public_actors ?? []).map(publicActorView),
    ...sourceCards.map(sourcePublicActor).filter((actor): actor is AgentReachPublicActorViewModel => Boolean(actor)),
  ]);
  return {
    evidence_id: evidence.evidence_id,
    target_key: evidence.target_key,
    event_ids: evidence.event_ids,
    platforms: evidence.platforms,
    platform_labels: evidence.platforms.map(platformLabel),
    mention_count: evidence.mention_count,
    distinct_actor_count: evidence.distinct_actor_count,
    first_seen_at: evidence.first_seen_at ?? null,
    last_seen_at: evidence.last_seen_at ?? null,
    active_day_count: evidence.active_day_count ?? 1,
    cross_platform: evidence.cross_platform ?? evidence.platforms.length > 1,
    named_registry_actors: (evidence.named_registry_actors ?? []).map(namedActorView),
    public_actors: publicActors,
    actor_types: countRecordToItems(evidence.actor_types, actorTypeLabel),
    actor_tiers: countRecordToItems(evidence.actor_tiers, actorTierLabel),
    authority_summary_cn: evidence.authority_summary_cn ?? "暂无具名高权威来源命中，先按外部讨论信号观察。",
    intensity_summary_cn: evidence.intensity_summary_cn ?? `共 ${evidence.mention_count} 条外部证据，来自 ${evidence.platforms.length} 个来源平台。`,
    persistence_summary_cn: evidence.persistence_summary_cn ?? "当前按单日外部发现展示，持续性仍需多日观察。",
    caveats: evidence.caveats ?? [],
    source_cards: sourceCards,
  };
}

function resolveInput(input: BuildAgentReachDisplayModelInput): ResolvedExternalInput {
  const aggregate = input.aggregate;
  if (aggregate) {
    const evidenceSources = Array.isArray(aggregate.evidence_sources) ? aggregate.evidence_sources : [];
    const candidates = aggregate.observation_candidates.length > 0
      ? aggregate.observation_candidates
      : candidatesFromEvidence([...aggregate.project_evidence, ...aggregate.direction_evidence]);
    return {
      dataSource: "aggregate",
      providerStatus: aggregate.status,
      statusReason: aggregate.status_reason ?? null,
      aggregatePath: input.aggregatePath ?? null,
      generatedAt: aggregate.generated_at,
      acceptedEventCount: aggregate.accepted_event_count,
      rejectedEventCount: aggregate.rejected_event_count,
      platformCounts: aggregate.platform_counts,
      directionLabelCounts: aggregate.direction_label_counts ?? {},
      coverage: aggregate.audit.coverage ?? null,
      warnings: aggregate.audit.warnings.map(warningText).filter((value): value is string => Boolean(value)),
      candidates,
      projectEvidence: aggregate.project_evidence,
      directionEvidence: aggregate.direction_evidence,
      evidenceSources,
      sourceDetailsAvailable: evidenceSources.length > 0,
    };
  }

  const daily = input.dailySection;
  if (daily) {
    return {
      dataSource: "daily-section",
      providerStatus: daily.external_layer_status.status,
      statusReason: daily.external_layer_status.status_reason ?? null,
      aggregatePath: input.aggregatePath ?? null,
      generatedAt: null,
      acceptedEventCount: daily.external_layer_status.accepted_event_count,
      rejectedEventCount: daily.external_layer_status.rejected_event_count,
      platformCounts: {},
      directionLabelCounts: daily.direction_label_counts,
      coverage: daily.external_audit_summary.coverage ?? null,
      warnings: ["来源明细不可用：当前页面使用 daily external_discovery fallback。", ...daily.external_audit_summary.warnings],
      candidates: daily.external_observation_candidates,
      projectEvidence: daily.external_project_evidence_summaries,
      directionEvidence: [],
      evidenceSources: [],
      sourceDetailsAvailable: false,
    };
  }

  const summary = input.runSummary;
  if (summary) {
    return {
      dataSource: "run-summary",
      providerStatus: summary.aggregate_status,
      statusReason: summary.aggregate_status_reason ?? null,
      aggregatePath: input.aggregatePath ?? null,
      generatedAt: null,
      acceptedEventCount: summary.accepted_event_count,
      rejectedEventCount: summary.rejected_event_count,
      platformCounts: {},
      directionLabelCounts: {},
      coverage: null,
      warnings: ["只读取到 run summary 外部发现摘要，候选与来源明细不可用。", ...summary.warnings],
      candidates: [],
      projectEvidence: [],
      directionEvidence: [],
      evidenceSources: [],
      sourceDetailsAvailable: false,
    };
  }

  const missingReason =
    input.aggregateReadStatus === "parse_error"
      ? "DailyExternalAggregate 解析失败"
      : input.aggregateReadStatus === "unsupported_context"
        ? "DailyExternalAggregate 日期上下文不可用"
        : "DailyExternalAggregate 未生成";
  return {
    dataSource: "missing",
    providerStatus: "missing",
    statusReason: missingReason,
    aggregatePath: input.aggregatePath ?? null,
    generatedAt: null,
    acceptedEventCount: 0,
    rejectedEventCount: 0,
    platformCounts: {},
    directionLabelCounts: {},
    coverage: null,
    warnings: [missingReason],
    candidates: [],
    projectEvidence: [],
    directionEvidence: [],
    evidenceSources: [],
    sourceDetailsAvailable: false,
  };
}

function statusView(resolved: ResolvedExternalInput): AgentReachStatusViewModel {
  return {
    provider_status: resolved.providerStatus,
    label: providerStatusLabel(resolved.providerStatus),
    reason: resolved.statusReason ?? "外部层已执行",
    tone: providerStatusTone(resolved.providerStatus),
    data_source: resolved.dataSource,
    aggregate_path: resolved.aggregatePath,
  };
}

function buildCoverage(coverage: ExternalDiscoveryCoverage | null): AgentReachCoverageViewModel[] {
  return PLATFORM_ORDER.map((platform) => {
    const item = coverage?.[platform];
    const status = item?.status ?? "missing";
    return {
      platform,
      platform_label: platformLabel(platform),
      status,
      status_label: coverageStatusLabel(status),
      reason: item?.reason ?? "",
      warnings: item?.warnings ?? [],
      tone: coverageTone(status),
    };
  });
}

function buildSummaryCards(
  resolved: ResolvedExternalInput,
  candidates: AgentReachCandidateCardViewModel[],
  officialCount: number,
): AgentReachSummaryCardViewModel[] {
  const newDiscoveryCount = candidates.filter((candidate) => candidate.type_key === "new_discovery").length;
  const projectEvidenceCount = candidates.filter((candidate) => candidate.type_key === "project_evidence").length;
  const directionCount =
    resolved.directionEvidence.length || candidates.filter((candidate) => candidate.type_key === "direction_watch").length;

  return [
    {
      key: "overview",
      label: "总览",
      value: resolved.acceptedEventCount,
      body: "不同来源的外部信号总览，包括发现、补证与方向观察。",
      tone: "accent",
    },
    {
      key: "new_discoveries",
      label: "新发现候选",
      value: newDiscoveryCount,
      body: "外部层发现但仍需主源确认的项目或对象。",
      tone: "good",
    },
    {
      key: "project_evidence",
      label: "已有候选补证",
      value: projectEvidenceCount,
      body: "对已有候选提供外部讨论补充。",
      tone: "neutral",
    },
    {
      key: "direction_observations",
      label: "方向观察",
      value: directionCount,
      body: "方向级线索，只能作为今日快照。",
      tone: "warn",
    },
    {
      key: "official_releases",
      label: "官方确认",
      value: officialCount,
      body: "官方来源信号，不等于主榜结论。",
      tone: "good",
    },
  ];
}

function buildFilters(
  candidates: AgentReachCandidateCardViewModel[],
  coverage: AgentReachCoverageViewModel[],
): AgentReachFilterViewModel {
  return {
    type_chips: TYPE_CHIP_ORDER.map((key) => ({
      key,
      label: typeLabelFromKey(key),
      count: candidates.filter((candidate) => candidate.type_key === key).length,
      tone: key === "needs_confirmation" ? "warn" : "neutral",
    })),
    source_chips: SOURCE_CHIP_ORDER.map((key) => ({
      key,
      label: platformLabel(key),
      count: candidates.filter((candidate) => candidate.platforms.map(platformGroup).includes(key)).length,
      tone: "neutral",
    })),
    sort_options: [
      { key: "attention", label: "关注排序" },
      { key: "time", label: "时间排序" },
      { key: "evidence", label: "证据排序" },
    ],
    status_chips: coverage.map((item) => ({
      key: `${item.platform}:${item.status}`,
      label: `${item.platform_label} ${item.status_label}`,
      tone: item.tone,
      readonly: true,
    })),
  };
}

function githubRepoUrlFromTargetKey(candidate: ObservationCandidate): string | null {
  if (candidate.scope !== "project" || candidate.target_type !== "project") return null;
  const key = candidate.target_key.trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(key)) return null;
  return `https://github.com/${key}`;
}

function candidateUrl(candidate: ObservationCandidate): string | null {
  return candidate.target_url ?? candidate.repo_url ?? candidate.paper_url ?? githubRepoUrlFromTargetKey(candidate);
}

function latestEvidenceTime(evidence: AgentReachEvidenceViewModel[]): string | null {
  return evidence
    .map((item) => item.last_seen_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;
}

function confidenceRank(value: ExternalBindingConfidence): number {
  switch (value) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    case "unbound":
      return 0;
    default:
      return 0;
  }
}

function isOfficialCandidate(candidate: ObservationCandidate, evidenceCards: AgentReachEvidenceViewModel[]): boolean {
  if (candidate.display_bucket === "official_releases") return true;
  return evidenceCards.some((evidence) =>
    evidence.source_cards.some((source) => source.raw_event_kind === "official_release" || source.raw_event_kind === "blog_post"),
  );
}

function isGithubUrl(value: string | null | undefined): boolean {
  return Boolean(value && /^https?:\/\/github\.com\//i.test(value));
}

function sourcePlatformText(candidate: Pick<AgentReachCandidateCardBase, "platform_labels">): string {
  return candidate.platform_labels.length > 0 ? candidate.platform_labels.join(" / ") : "外部来源";
}

function isDirectionSignal(candidate: Pick<AgentReachCandidateCardBase, "scope" | "binding_confidence" | "target_url">): boolean {
  return candidate.scope === "direction" || (candidate.binding_confidence === "unbound" && !candidate.target_url);
}

function boundObjectText(candidate: Pick<AgentReachCandidateCardBase, "target_type_label" | "target_url">): string {
  if (candidate.target_type_label === "项目" && isGithubUrl(candidate.target_url)) return "GitHub repo";
  return `${candidate.target_type_label}对象`;
}

function hasConfirmedBinding(candidate: Pick<AgentReachCandidateCardBase, "target_url" | "binding_confidence">): boolean {
  return Boolean(candidate.target_url && candidate.binding_confidence !== "unbound");
}

function uniqueLimited(values: Array<string | null | undefined>, limit: number): string[] {
  return uniqueStrings(values).slice(0, limit);
}

function emptyCandidateExplanationIndex(): CandidateExplanationIndex {
  return {
    byCandidateKey: new Map(),
    uniqueByTargetKey: new Map(),
    duplicateTargetKeys: new Set(),
    warnings: [],
  };
}

function candidatesFromEvidence(evidence: ExternalEvidence[]): ObservationCandidate[] {
  return evidence.map((item): ObservationCandidate => {
    const isDirection = item.scope === "direction";
    const signalKinds = new Set(item.derived_signal_kinds ?? []);
    const isDiscoveryOnly = !isDirection && signalKinds.has("discovery") && !signalKinds.has("evidence");
    const candidateKind = isDirection
      ? "direction_watch"
      : isDiscoveryOnly
        ? "new_external_discovery"
        : "external_evidence_boost";
    const displayBucket = isDirection
      ? "direction_observations"
      : isDiscoveryOnly
        ? "new_discoveries"
        : "project_evidence";
    const externalAttentionScore = item.mention_count + item.distinct_actor_count + item.platforms.length * 2;
    return {
      candidate_id: `evidence:${item.evidence_id}`,
      scope: item.scope,
      candidate_kind: candidateKind,
      target_type: isDirection ? "topic" : "project",
      target_key: item.target_key,
      display_name: item.target_key,
      topic_key: isDirection ? item.target_key : undefined,
      direction_labels: [],
      binding_confidence: isDirection ? "unbound" : "medium",
      evidence_ids: [item.evidence_id],
      evidence_summary_cn: isDirection ? "方向级外部讨论线索" : "已有对象获得外部讨论补证",
      qualification: "supporting_evidence_only",
      can_enter_daily: item.mention_count > 0,
      can_enter_weekly: item.platforms.length > 1,
      cannot_be_primary_conclusion: true,
      caveats: ["外部层仅作为次级证据，仍需主链路确认"],
      external_attention_score: externalAttentionScore,
      attention_score_components: {
        relevance: item.mention_count,
        binding: isDirection ? 0 : 1,
        platform_weight: item.platforms.length,
        engagement: item.mention_count,
        freshness: 1,
        persistence: 1,
        authority: Number((item as { top_tier_actor_count?: number }).top_tier_actor_count ?? 0),
      },
      display_reasons: [isDirection ? "方向观察" : "外部补证"],
      display_bucket: displayBucket,
    };
  });
}

function candidateExplanationKindForKey(
  candidate: Pick<AgentReachCandidateCardBase, "scope" | "binding_confidence" | "target_url" | "target_type">,
): ExternalCandidateExplanation["candidate_kind"] {
  if (isDirectionSignal(candidate) || candidate.target_type === "topic") return "direction";
  if (candidate.target_type === "paper") return "paper";
  if (candidate.target_type === "product") return "product";
  return "project";
}

function candidateExplanationKey(
  candidate: Pick<AgentReachCandidateCardBase, "scope" | "binding_confidence" | "target_url" | "target_type" | "target_key">,
): string {
  return `${candidateExplanationKindForKey(candidate)}:${candidate.target_key}`;
}

function warningFromExplanationAudit(warning: string | { reason_code?: string; reason_detail?: string }): string {
  if (typeof warning === "string") return warning;
  return [warning.reason_code, warning.reason_detail].filter(Boolean).join(": ");
}

function cleanExplanationText(value: string | null | undefined): string | null {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : null;
}

function cleanExplanationList(values: Array<string | null | undefined> | undefined, limit: number): string[] {
  return uniqueLimited(values?.map((value) => cleanExplanationText(value)) ?? [], limit);
}

function isCandidateExplanationScopeCompatible(
  candidate: Pick<AgentReachCandidateCardBase, "scope" | "binding_confidence" | "target_url">,
  explanation: ExternalCandidateExplanation,
): boolean {
  const directionSignal = isDirectionSignal(candidate);
  if (directionSignal) return explanation.explanation_scope === "direction_signal";
  return explanation.explanation_scope !== "direction_signal";
}

function buildCandidateExplanationIndex(
  aggregate: DailyExternalAggregate | null,
  artifact: ExternalCandidateExplanationArtifact | null | undefined,
): CandidateExplanationIndex {
  const index = emptyCandidateExplanationIndex();
  if (!aggregate || !artifact) return index;

  const warnings = index.warnings;
  if (artifact.schema_version !== "external-discovery.candidate-explanations.v1") {
    warnings.push("candidate explanations ignored: schema_version mismatch");
    return index;
  }
  if (artifact.public_safe !== true || artifact.contains_raw_text !== false || artifact.contains_profile_urls !== false) {
    warnings.push("candidate explanations ignored: public-safe flags mismatch");
    return index;
  }
  if (artifact.date !== aggregate.date) {
    warnings.push(`candidate explanations ignored: date mismatch (${artifact.date} != ${aggregate.date})`);
    return index;
  }
  if (artifact.aggregate_source_input_hash !== aggregate.source_input_hash) {
    warnings.push("candidate explanations ignored: aggregate source hash mismatch");
    return index;
  }
  if (artifact.status === "failed") {
    warnings.push(`candidate explanations ignored: ${artifact.status_reason ?? "artifact status failed"}`);
    return index;
  }
  if (!Array.isArray(artifact.explanations)) {
    warnings.push("candidate explanations ignored: explanations is not an array");
    return index;
  }

  for (const auditWarning of artifact.audit?.warnings ?? []) {
    const warning = warningFromExplanationAudit(auditWarning);
    if (warning) warnings.push(`candidate explanations warning: ${warning}`);
  }

  const byTargetKey = new Map<string, ExternalCandidateExplanation[]>();
  for (const explanation of artifact.explanations) {
    const candidateKey = cleanExplanationText(explanation.candidate_key);
    const targetKey = cleanExplanationText(explanation.target_key);
    if (!candidateKey || !targetKey) {
      warnings.push("candidate explanations skipped: missing candidate_key or target_key");
      continue;
    }
    if (!cleanExplanationText(explanation.what_it_is_cn) && !cleanExplanationText(explanation.why_watch_cn)) {
      warnings.push(`candidate explanations skipped: empty text for ${candidateKey}`);
      continue;
    }
    if (!index.byCandidateKey.has(candidateKey)) {
      index.byCandidateKey.set(candidateKey, explanation);
    } else {
      warnings.push(`candidate explanations skipped duplicate candidate_key: ${candidateKey}`);
    }
    byTargetKey.set(targetKey, [...(byTargetKey.get(targetKey) ?? []), explanation]);
  }

  for (const [targetKey, explanations] of byTargetKey) {
    if (explanations.length === 1 && explanations[0]) {
      index.uniqueByTargetKey.set(targetKey, explanations[0]);
    } else {
      index.duplicateTargetKeys.add(targetKey);
    }
  }

  return index;
}

function resolveCandidateExplanation(
  candidate: AgentReachCandidateCardBase,
  index: CandidateExplanationIndex,
): ExternalCandidateExplanation | null {
  const direct = index.byCandidateKey.get(candidateExplanationKey(candidate));
  if (direct && isCandidateExplanationScopeCompatible(candidate, direct)) return direct;

  if (index.duplicateTargetKeys.has(candidate.target_key)) return null;
  const fallback = index.uniqueByTargetKey.get(candidate.target_key);
  if (fallback && isCandidateExplanationScopeCompatible(candidate, fallback)) return fallback;
  return null;
}

function buildCandidateExplanations(candidate: AgentReachCandidateCardBase): Pick<
  AgentReachCandidateCardViewModel,
  "intro_line" | "appearance_reason" | "why_watch_reasons" | "confirmation_gaps"
> {
  const platformText = sourcePlatformText(candidate);
  const directionSignal = isDirectionSignal(candidate);
  const boundObject = boundObjectText(candidate);

  const introLine = directionSignal
    ? `方向线索，尚未绑定明确 GitHub 项目；来自 ${platformText} 的外部讨论。`
    : candidate.type_key === "project_evidence"
      ? `已有候选获得外部补证，已绑定${boundObject}；来自 ${platformText} 的外部讨论。`
      : candidate.type_key === "official_signal"
        ? `官方来源出现发布或更新信号，${hasConfirmedBinding(candidate) ? `已绑定${boundObject}` : `发现到 ${boundObject} URL，绑定仍待确认`}。`
        : `${boundObject} 候选，${hasConfirmedBinding(candidate) ? "已绑定对象" : `发现到 ${boundObject} URL，绑定仍待主源确认`}；来自 ${platformText} 的外部讨论。`;

  const appearanceReason = directionSignal
    ? `${platformText} 出现方向级讨论，当前作为外部层方向线索进入观察。`
    : candidate.type_key === "project_evidence"
      ? `${platformText} 出现已有候选相关讨论，当前作为外部补证进入观察。`
      : candidate.type_key === "official_signal"
        ? `${platformText} 出现官方发布或更新信号，当前作为官方信号进入观察。`
        : `${platformText} 出现该对象讨论，当前作为外部层候选进入观察。`;

  const whyWatchReasons = uniqueLimited(
    [
      candidate.external_attention_score !== null ? `外部关注度 ${candidate.external_attention_score}` : null,
      candidate.type_key === "official_signal" ? "官方来源出现发布或更新信号" : `${platformText} 出现外部讨论`,
      candidate.cross_platform ? "跨平台出现，噪声风险低于单平台讨论" : null,
      directionSignal ? "方向线索可用于后续趋势观察" : hasConfirmedBinding(candidate) ? `已绑定明确 ${boundObject}` : `发现到 ${boundObject} URL`,
      candidate.can_enter_daily ? "可进入日报作为次级证据" : null,
      candidate.can_enter_weekly ? "可进入周报作为次级证据" : null,
      candidate.named_actor_count > 0
        ? `命中 ${candidate.named_actor_count} 个具名讨论来源`
        : candidate.distinct_actor_count > 0
          ? `确认 ${candidate.distinct_actor_count} 个脱敏独立来源`
          : null,
    ],
    5,
  );

  const confirmationGaps = uniqueLimited(
    [
      directionSignal ? "尚未绑定明确 GitHub 项目或论文" : null,
      candidate.qualification === "needs_primary_confirmation" ? "仍需 GitHub / Trendshift 主链路确认" : null,
      candidate.target_url && candidate.binding_confidence === "unbound" ? "对象绑定可信度仍待确认" : null,
      candidate.cannot_be_primary_conclusion ? "不能作为主榜结论" : null,
      !candidate.cross_platform ? "仍需跨平台或连续多日确认" : null,
      candidate.named_actor_count === 0 ? "暂未命中具名讨论来源" : null,
    ],
    4,
  );

  return {
    intro_line: introLine,
    appearance_reason: appearanceReason,
    why_watch_reasons: whyWatchReasons.length > 0 ? whyWatchReasons : ["先查看证据来源，再决定是否进入后续观察。"],
    confirmation_gaps: confirmationGaps.length > 0 ? confirmationGaps : ["暂无额外确认项"],
  };
}

function mergeCandidateExplanations(
  candidate: AgentReachCandidateCardBase,
  index: CandidateExplanationIndex,
): Pick<AgentReachCandidateCardViewModel, "intro_line" | "appearance_reason" | "why_watch_reasons" | "confirmation_gaps"> {
  const fallback = buildCandidateExplanations(candidate);
  const explanation = resolveCandidateExplanation(candidate, index);
  if (!explanation) return fallback;

  const whatItIs = cleanExplanationText(explanation.what_it_is_cn);
  const whyWatch = cleanExplanationText(explanation.why_watch_cn);
  const caveats = cleanExplanationList(explanation.caveats, 4);
  const whyWatchReasons = uniqueLimited([whyWatch, ...fallback.why_watch_reasons], 5);
  const confirmationGaps = uniqueLimited([...caveats, ...fallback.confirmation_gaps], 4);

  return {
    intro_line: whatItIs ?? fallback.intro_line,
    appearance_reason: whyWatch ?? fallback.appearance_reason,
    why_watch_reasons: whyWatchReasons.length > 0 ? whyWatchReasons : fallback.why_watch_reasons,
    confirmation_gaps: confirmationGaps.length > 0 ? confirmationGaps : fallback.confirmation_gaps,
  };
}

function candidateView(
  candidate: ObservationCandidate,
  evidenceById: Record<string, AgentReachEvidenceViewModel>,
  explanationIndex: CandidateExplanationIndex,
): AgentReachCandidateCardViewModel {
  const fallbackEvidenceIds = Object.values(evidenceById)
    .filter((item) => item.target_key === candidate.target_key)
    .map((item) => item.evidence_id);
  const evidenceIds = candidate.evidence_ids ?? fallbackEvidenceIds;
  const evidenceCards = evidenceIds.map((id) => evidenceById[id]).filter((item): item is AgentReachEvidenceViewModel => Boolean(item));
  const platforms = uniqueStrings(evidenceCards.flatMap((item) => item.platforms.length > 0 ? item.platforms : item.source_cards.map((source) => source.platform)));
  const sourceCards = evidenceCards.flatMap((item) => item.source_cards);
  const typeKey = isOfficialCandidate(candidate, evidenceCards) ? "official_signal" : typeKeyFromCandidate(candidate);
  const distinctActorCount = evidenceCards.reduce((max, item) => Math.max(max, item.distinct_actor_count), 0);
  const namedActors = mergeNamedActors(evidenceCards);
  const publicActors = mergePublicActors(evidenceCards.flatMap((item) => item.public_actors));
  const inferredScope = candidate.scope ?? (candidate.candidate_kind === "direction" || candidate.target_type === "topic" ? "direction" : "project");
  const targetType = candidate.target_type ?? (inferredScope === "direction" ? "topic" : "project");
  const bindingConfidence = candidate.binding_confidence ?? (inferredScope === "direction" ? "unbound" : "medium");
  const displayName = candidate.display_name ?? candidate.target_key;
  const tags = uniqueStrings([
    evidenceCards.some((item) => item.cross_platform) ? "cross-platform" : null,
    candidate.cannot_be_primary_conclusion ? "observe-only" : null,
    typeKey === "official_signal" ? "official-signal" : null,
  ]);

  const card: AgentReachCandidateCardBase = {
    candidate_id: candidate.candidate_id ?? `${candidate.candidate_kind}:${candidate.target_key}`,
    scope: inferredScope,
    candidate_kind: candidate.candidate_kind,
    display_name: displayName,
    type_key: typeKey,
    type_label: typeLabelFromKey(typeKey),
    target_type: targetType ?? "unknown",
    target_type_label: targetTypeLabel(targetType),
    target_key: candidate.target_key,
    target_url: candidateUrl(candidate),
    object_label: `${targetTypeLabel(targetType)} · ${inferredScope === "direction" ? "方向级" : "项目级"}`,
    external_attention_score: typeof candidate.external_attention_score === "number" ? candidate.external_attention_score : null,
    external_attention_label:
      typeof candidate.external_attention_score === "number" ? String(candidate.external_attention_score) : "待评估",
    evidence_count: evidenceIds.length,
    evidence_ids: evidenceIds,
    platforms,
    platform_labels: platforms.map(platformLabel),
    source_count: sourceCards.length,
    distinct_actor_count: distinctActorCount,
    binding_confidence: bindingConfidence,
    binding_confidence_label: bindingConfidenceLabel(bindingConfidence),
    named_registry_actors: namedActors,
    public_actors: publicActors,
    named_actor_count: namedActors.length,
    actor_types: mergeCountItems(evidenceCards, "actor_types"),
    actor_tiers: mergeCountItems(evidenceCards, "actor_tiers"),
    cross_platform: evidenceCards.some((item) => item.cross_platform),
    qualification: candidate.qualification,
    qualification_label: qualificationLabel(candidate.qualification),
    can_enter_daily: candidate.can_enter_daily,
    can_enter_weekly: candidate.can_enter_weekly,
    cannot_be_primary_conclusion: candidate.cannot_be_primary_conclusion,
    caveats: candidate.caveats ?? [],
    summary: candidate.evidence_summary_cn || candidate.display_reasons?.join("；") || "暂无补充摘要",
    display_reasons: candidate.display_reasons ?? [],
    tags,
    last_seen_at: latestEvidenceTime(evidenceCards),
    evidence_cards: evidenceCards,
    source_cards: sourceCards,
  };

  return {
    ...card,
    ...mergeCandidateExplanations(card, explanationIndex),
  };
}

function mergeCandidateKey(candidate: AgentReachCandidateCardViewModel): string {
  const directionTitleKey = directionTitleClusterKey(candidate);
  if (directionTitleKey) return directionTitleKey;
  return [candidate.scope, candidate.target_key, candidate.type_key].join("\u0000");
}

function isUnboundDirectionCandidate(candidate: AgentReachCandidateCardViewModel): boolean {
  return candidate.scope === "direction" && candidate.target_type === "topic" && !candidate.target_url;
}

function directionTitleTokens(title: string): string[] {
  return title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !/^\d+$/.test(token) && !DIRECTION_TITLE_CLUSTER_STOPWORDS.has(token));
}

function directionTitleClusterKey(candidate: AgentReachCandidateCardViewModel): string | null {
  if (!isUnboundDirectionCandidate(candidate)) return null;

  const title = candidate.display_name.toLowerCase();
  const looksLikeListicle =
    /\b(repo|repos|repositories|projects|tools)\b/.test(title) &&
    (/\b(open source|week|weekly|top|best)\b/.test(title) || /\b\d+\s+(repo|repos|repositories|projects|tools)\b/.test(title));
  if (!looksLikeListicle) return null;

  const tokens = directionTitleTokens(candidate.display_name);
  if (tokens.length < DIRECTION_TITLE_CLUSTER_TOKEN_COUNT) return null;
  return ["direction-title", candidate.type_key, tokens.slice(0, DIRECTION_TITLE_CLUSTER_TOKEN_COUNT).join("-")].join("\u0000");
}

function uniqueBy<T>(items: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = keyOf(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function mergeCandidateCards(
  candidates: AgentReachCandidateCardViewModel[],
  explanationIndex: CandidateExplanationIndex,
): AgentReachCandidateCardViewModel[] {
  const grouped = new Map<string, AgentReachCandidateCardViewModel[]>();
  for (const candidate of candidates) {
    const key = mergeCandidateKey(candidate);
    grouped.set(key, [...(grouped.get(key) ?? []), candidate]);
  }

  return Array.from(grouped.values()).map((items) => {
    const base = items[0];
    if (!base || items.length === 1) return base;

    const evidenceCards = uniqueBy(items.flatMap((item) => item.evidence_cards), (item) => item.evidence_id);
    const sourceCards = uniqueBy(items.flatMap((item) => item.source_cards), (item) => item.source_id);
    const platforms = uniqueStrings(evidenceCards.flatMap((item) => item.platforms.length > 0 ? item.platforms : item.source_cards.map((source) => source.platform)));
    const evidenceIds = evidenceCards.map((item) => item.evidence_id);
    const bestConfidence = items
      .map((item) => item.binding_confidence)
      .sort((left, right) => confidenceRank(right) - confidenceRank(left))[0] ?? base.binding_confidence;
    const bestAttention = items
      .map((item) => item.external_attention_score)
      .filter((value): value is number => typeof value === "number")
      .sort((left, right) => right - left)[0] ?? null;
    const namedActors = mergeNamedActors(evidenceCards);
    const publicActors = mergePublicActors(evidenceCards.flatMap((item) => item.public_actors));

    const merged: AgentReachCandidateCardBase = {
      ...base,
      candidate_id: `${base.candidate_id}:merged-${items.length}`,
      external_attention_score: bestAttention,
      external_attention_label: bestAttention === null ? base.external_attention_label : String(bestAttention),
      evidence_count: evidenceIds.length,
      evidence_ids: evidenceIds,
      platforms,
      platform_labels: platforms.map(platformLabel),
      source_count: sourceCards.length,
      distinct_actor_count: evidenceCards.reduce((sum, item) => sum + item.distinct_actor_count, 0),
      binding_confidence: bestConfidence,
      binding_confidence_label: bindingConfidenceLabel(bestConfidence),
      named_registry_actors: namedActors,
      public_actors: publicActors,
      named_actor_count: namedActors.length,
      actor_types: mergeCountItems(evidenceCards, "actor_types"),
      actor_tiers: mergeCountItems(evidenceCards, "actor_tiers"),
      cross_platform: platforms.length > 1 || evidenceCards.some((item) => item.cross_platform),
      can_enter_daily: items.some((item) => item.can_enter_daily),
      can_enter_weekly: items.some((item) => item.can_enter_weekly),
      cannot_be_primary_conclusion: items.every((item) => item.cannot_be_primary_conclusion),
      caveats: uniqueStrings(items.flatMap((item) => item.caveats)),
      display_reasons: uniqueStrings(items.flatMap((item) => item.display_reasons)),
      tags: uniqueStrings([...items.flatMap((item) => item.tags), "merged-evidence"]),
      last_seen_at: latestEvidenceTime(evidenceCards),
      evidence_cards: evidenceCards,
      source_cards: sourceCards,
    };

    return {
      ...merged,
      ...mergeCandidateExplanations(merged, explanationIndex),
    };
  });
}

function buildDirectionSnapshot(
  resolved: ResolvedExternalInput,
  candidates: AgentReachCandidateCardViewModel[],
  coverage: AgentReachCoverageViewModel[],
): AgentReachDirectionSnapshotViewModel {
  const directionCandidateCount = candidates.filter((candidate) => candidate.scope === "direction").length;
  return {
    direction_evidence_count: resolved.directionEvidence.length,
    direction_candidate_count: directionCandidateCount,
    direction_label_counts: Object.entries(resolved.directionLabelCounts)
      .filter(([, count]) => Number(count ?? 0) > 0)
      .sort((left, right) => Number(right[1] ?? 0) - Number(left[1] ?? 0) || left[0].localeCompare(right[0]))
      .map(([key, count]) => ({ key, label: key, count: Number(count ?? 0) })),
    pending_external_signal_count: Math.max(0, resolved.acceptedEventCount - candidates.length),
    zero_relevant_results_count: coverage.filter((item) => item.status === "zero_relevant_results").length,
    not_configured_count: coverage.filter((item) => item.status === "not_configured").length,
    partial_count: coverage.filter((item) => item.status === "partial").length,
  };
}

export function buildAgentReachDisplayModel(input: BuildAgentReachDisplayModelInput): AgentReachDisplayModel {
  const resolved = resolveInput(input);
  const explanationIndex = buildCandidateExplanationIndex(input.aggregate, input.candidateExplanations);
  const sourceViews = resolved.evidenceSources.map(sourceView);
  const sourcesByEventId = sourceViews.reduce<Record<string, AgentReachEvidenceSourceViewModel[]>>((accumulator, source) => {
    accumulator[source.event_id] ??= [];
    accumulator[source.event_id].push(source);
    return accumulator;
  }, {});
  const allEvidence = [...resolved.projectEvidence, ...resolved.directionEvidence];
  const evidenceCards = allEvidence.map((item) => evidenceView(item, sourcesByEventId));
  const evidenceById = Object.fromEntries(evidenceCards.map((item) => [item.evidence_id, item]));
  const candidates = mergeCandidateCards(
    resolved.candidates.map((candidate) => candidateView(candidate, evidenceById, explanationIndex)),
    explanationIndex,
  );
  const officialCount = candidates.filter((candidate) => candidate.type_key === "official_signal").length;
  const coverage = buildCoverage(resolved.coverage);
  const fallbackWarnings = resolved.sourceDetailsAvailable ? [] : ["来源明细不可用"];
  const aggregateWarnings =
    input.aggregateReadStatus && input.aggregateReadStatus !== "ok" && resolved.dataSource !== "aggregate"
      ? [`aggregate 读取状态：${input.aggregateReadStatus}`]
      : [];
  const explanationReadWarnings =
    input.candidateExplanationsReadStatus &&
    input.candidateExplanationsReadStatus !== "ok" &&
    input.candidateExplanationsReadStatus !== "not_found"
      ? [`candidate explanations 读取状态：${input.candidateExplanationsReadStatus}`]
      : [];
  const warnings = uniqueStrings([
    ...aggregateWarnings,
    ...explanationReadWarnings,
    ...explanationIndex.warnings,
    ...fallbackWarnings,
    ...resolved.warnings,
  ]);

  return {
    status: statusView(resolved),
    summary_cards: buildSummaryCards(resolved, candidates, officialCount),
    filters: buildFilters(candidates, coverage),
    candidates,
    evidence_by_id: evidenceById,
    sources_by_event_id: sourcesByEventId,
    coverage,
    direction_snapshot: buildDirectionSnapshot(resolved, candidates, coverage),
    warnings,
    generated_at: resolved.generatedAt,
    source_health: `status=${providerStatusLabel(resolved.providerStatus)}, accepted=${resolved.acceptedEventCount}, rejected=${resolved.rejectedEventCount}, platforms=${sumRecordValues(resolved.platformCounts)}`,
  };
}
