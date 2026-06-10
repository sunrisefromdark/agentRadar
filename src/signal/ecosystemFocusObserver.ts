import fs from "node:fs";
import path from "node:path";
import type { LlmConfig, SourceConfig } from "../config.ts";
import { buildProjectBrief } from "../action/projectBriefs.ts";
import { parseJsonObjectFromText } from "../jsonObject.ts";
import { callLlm } from "../llm.ts";
import type { NormalizedProject } from "../types.ts";
import type {
  EcosystemObserverArtifact,
  EcosystemObserverEntry,
  EcosystemObserverEntityTier,
  EcosystemObserverHistoryLabel,
  EcosystemObserverPedigree,
  EcosystemObserverMatchEvidence,
  EcosystemObserverPositionQualification,
  ObserverLlmDiagnostics,
  ObserverStatus,
} from "../types.ts";

type EcosystemConfig = SourceConfig["ecosystemFocus"]["ecosystems"][number];

interface GitHubSearchRepository {
  full_name: string;
  html_url: string;
  name: string;
  created_at?: string;
  updated_at?: string;
  description?: string | null;
  topics?: string[];
  owner?: {
    login?: string;
  };
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  pull_requests_count?: number;
}

interface ObserverOptions {
  date: string;
  generatedAt: string;
  dryRun: boolean;
  workspaceRoot?: string;
  dailyCandidateProjects?: NormalizedProject[];
  llmConfig?: LlmConfig;
}

interface ObserverCollectionResult {
  status: ObserverStatus;
  artifact: EcosystemObserverArtifact;
  used_snapshot_fallback: boolean;
}

const LONG_TAIL_STAR_CEILING = 10_000;
const BREAKOUT_STAR_CEILING = 60_000;
const BREAKOUT_RECENT_DAYS = 3;
const BREAKOUT_DAILY_DELTA_MIN = 150;

function shiftDate(date: string, deltaDays: number): string {
  const utc = new Date(`${date}T00:00:00.000Z`);
  utc.setUTCDate(utc.getUTCDate() + deltaDays);
  return utc.toISOString().slice(0, 10);
}

function dateOnly(value: string | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

function cleanText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function lowerList(values: string[] | undefined): string[] {
  return (values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function textHasKeyword(text: string, keyword: string): boolean {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) return false;
  const escaped = escapeRegExp(normalizedKeyword).replace(/\\ /g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
}

function githubApiHeaders(includeAuth: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "agent-radar/0.1",
  };
  const token = process.env["GITHUB_TOKEN"];
  if (includeAuth && token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function fetchGitHubApiWithAuthFallback(url: string): Promise<{
  response: Response;
  usedUnauthenticatedRetry: boolean;
}> {
  const first = await fetch(url, { headers: githubApiHeaders(true) });
  if (first.status !== 401 || !process.env["GITHUB_TOKEN"]) {
    return { response: first, usedUnauthenticatedRetry: false };
  }

  const second = await fetch(url, { headers: githubApiHeaders(false) });
  return { response: second, usedUnauthenticatedRetry: true };
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function uniqueCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(trimmed);
  }
  return normalized;
}

function mergeMetricValue(left: number | undefined, right: number | undefined): number | undefined {
  if (left === undefined) return right;
  if (right === undefined) return left;
  return Math.max(left, right);
}

function repoSeedMatch(repoFullName: string, repoName: string, repoSeeds: string[]): string[] {
  const repoKey = repoFullName.toLowerCase();
  const repoNameLower = repoName.toLowerCase();
  return repoSeeds.filter((seed) => {
    const normalized = seed.toLowerCase();
    const seedRepoName = normalized.split("/").at(-1) ?? normalized;
    return repoKey === normalized || repoNameLower.includes(seedRepoName) || seedRepoName.includes(repoNameLower);
  });
}

function hasAdditionalPositiveEvidence(match: EcosystemObserverMatchEvidence, repo: GitHubSearchRepository): boolean {
  if (match.keywords.length > 0 || match.topic_hints.length > 0) return true;
  const text = `${repo.name} ${cleanText(repo.description)}`.toLowerCase();
  return /\b(agent|mcp|memory|browser|runtime|workflow|eval|observability|guardrail|tool|plugin|viewer|console|workbench|reinforcement)\b/.test(
    text,
  );
}

function hasAgenticContextBeyondKeywords(repo: GitHubSearchRepository, matchedKeywords: string[]): boolean {
  let text = `${repo.name} ${cleanText(repo.description)} ${(repo.topics ?? []).join(" ")} ${repo.owner?.login ?? ""}`.toLowerCase();
  for (const keyword of matchedKeywords) {
    text = text.replace(new RegExp(escapeRegExp(keyword.toLowerCase()), "g"), " ");
  }
  return /\b(agent|agentic|ai|llm|mcp|openai|anthropic|claude|cursor|aider|browser[- ]use|computer[- ]use|rag|retrieval|guardrail|prompt|assistant|langchain|langgraph|playwright|tool[- ]use|plugin|skill|memory|workflow)\b/.test(
    text,
  );
}

function daysSince(anchorDate: string, targetDate: string | null): number | null {
  if (!targetDate) return null;
  const anchor = new Date(`${anchorDate}T00:00:00.000Z`);
  const target = new Date(`${targetDate}T00:00:00.000Z`);
  const delta = Math.round((anchor.getTime() - target.getTime()) / 86_400_000);
  return Number.isFinite(delta) ? Math.max(0, delta) : null;
}

function readJsonFile<T>(filepath: string): T | null {
  if (!fs.existsSync(filepath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filepath, "utf-8")) as T;
  } catch {
    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function truncateText(value: string | undefined, maxLength: number): string {
  const normalized = cleanText(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`;
}

function isObserverLlmEnabled(llmConfig: LlmConfig | undefined): boolean {
  return !!llmConfig && llmConfig.enabled && llmConfig.mode === "semantic-classification" && llmConfig.provider !== "none";
}

function emptyObserverLlmDiagnostics(llmConfig: LlmConfig | undefined): ObserverLlmDiagnostics {
  return {
    enabled: isObserverLlmEnabled(llmConfig),
    provider: llmConfig?.provider ?? "none",
    summary_attempt_count: 0,
    summary_success_count: 0,
    summary_failure_count: 0,
    judge_attempt_count: 0,
    judge_success_count: 0,
    judge_failure_count: 0,
  };
}

function resolveEntityTier(
  ownerLogin: string,
  tiers: SourceConfig["ecosystemFocus"]["entityTiers"],
): EcosystemObserverEntityTier {
  const owner = ownerLogin.toLowerCase();
  if (
    tiers.core.builders.some((item) => item.toLowerCase() === owner) ||
    tiers.core.companies.some((item) => item.toLowerCase() === owner) ||
    tiers.core.engineers.some((item) => item.toLowerCase() === owner)
  ) {
    return "core";
  }
  if (
    tiers.proven.builders.some((item) => item.toLowerCase() === owner) ||
    tiers.proven.companies.some((item) => item.toLowerCase() === owner) ||
    tiers.proven.engineers.some((item) => item.toLowerCase() === owner)
  ) {
    return "proven";
  }
  if (
    tiers.watch.builders.some((item) => item.toLowerCase() === owner) ||
    tiers.watch.companies.some((item) => item.toLowerCase() === owner) ||
    tiers.watch.engineers.some((item) => item.toLowerCase() === owner)
  ) {
    return "watch";
  }
  return "none";
}

function entityTierScore(tier: EcosystemObserverEntityTier): number {
  switch (tier) {
    case "core":
      return 18;
    case "proven":
      return 12;
    case "watch":
      return 6;
    default:
      return 0;
  }
}

function entityTierLabel(tier: EcosystemObserverEntityTier): string {
  return tier === "none" ? "tier:none" : `tier:${tier}`;
}

function repoAppearsInDailyProjectList(report: Record<string, unknown>, key: string, field: string): boolean {
  const list = report[field];
  if (!Array.isArray(list)) return false;
  return list.some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const record = entry as Record<string, unknown>;
    const project = record["project"];
    if (project && typeof project === "object" && project !== null) {
      return ((project as Record<string, unknown>)["repo_full_name"] as string | undefined)?.toLowerCase() === key;
    }
    return (record["repo_full_name"] as string | undefined)?.toLowerCase() === key;
  });
}

function historicalOutcomeForRepo(
  workspaceRoot: string,
  repoFullName: string,
  observedDate: string,
  anchorDate: string,
): "validated" | "mixed" | "none" {
  const key = repoFullName.toLowerCase();
  const endDate = shiftDate(observedDate, 7) < anchorDate ? shiftDate(observedDate, 7) : anchorDate;

  for (let cursor = observedDate; cursor <= endDate; cursor = shiftDate(cursor, 1)) {
    const reportPath = path.join(workspaceRoot, "data", "reports", `${cursor}.daily.json`);
    const report = readJsonFile<Record<string, unknown>>(reportPath);
    if (report) {
      if (
        repoAppearsInDailyProjectList(report, key, "today_star_projects") ||
        repoAppearsInDailyProjectList(report, key, "high_score_projects") ||
        repoAppearsInDailyProjectList(report, key, "anomaly_projects")
      ) {
        return "validated";
      }
      if (
        repoAppearsInDailyProjectList(report, key, "context_only_projects") ||
        repoAppearsInDailyProjectList(report, key, "new_projects") ||
        repoAppearsInDailyProjectList(report, key, "all_projects")
      ) {
        return "mixed";
      }
    }

    const normalizedPath = path.join(workspaceRoot, "data", "normalized", `${cursor}.json`);
    const normalized = readJsonFile<NormalizedProject[]>(normalizedPath);
    const project = normalized?.find((item) => item.repo_full_name.toLowerCase() === key);
    if (!project) continue;
    if (project.persistence_state !== "single-spike" || project.appearances >= 2) return "validated";
    if (project.appearances >= 1) return "mixed";
  }

  return "none";
}

function buildHistoricalPrecisionRegistry(
  workspaceRoot: string,
  anchorDate: string,
  lookbackDays: number,
): Map<string, { score: number; label: EcosystemObserverHistoryLabel }> {
  const registry = new Map<string, { samples: number; validated: number; mixed: number }>();
  const observerDir = path.join(workspaceRoot, "data", "observer", "ecosystem-focus");
  if (!fs.existsSync(observerDir)) return new Map();

  const earliest = shiftDate(anchorDate, -lookbackDays);
  for (const fileName of fs.readdirSync(observerDir)) {
    if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(fileName)) continue;
    const date = fileName.slice(0, 10);
    if (date >= anchorDate || date < earliest) continue;
    const artifact = readJsonFile<EcosystemObserverArtifact>(path.join(observerDir, fileName));
    if (!artifact) continue;

    for (const entry of artifact.entries) {
      const owner = ownerFromRepoFullName(entry.repo_full_name).toLowerCase();
      if (!owner) continue;
      const bucket = registry.get(owner) ?? { samples: 0, validated: 0, mixed: 0 };
      bucket.samples += 1;
      const outcome = historicalOutcomeForRepo(workspaceRoot, entry.repo_full_name, artifact.date, anchorDate);
      if (outcome === "validated") bucket.validated += 1;
      else if (outcome === "mixed") bucket.mixed += 1;
      registry.set(owner, bucket);
    }
  }

  return new Map(
    [...registry.entries()].map(([owner, bucket]) => {
      const precision = bucket.samples > 0 ? (bucket.validated + bucket.mixed * 0.5) / bucket.samples : 0;
      let label: EcosystemObserverHistoryLabel = "none";
      let score = 0;
      if (bucket.samples > 0 && precision >= 0.8) {
        label = "validated";
        score = 15;
      } else if (bucket.samples > 0 && precision >= 0.4) {
        label = "mixed";
        score = 8;
      } else if (bucket.samples > 0) {
        label = "emerging";
        score = 4;
      }
      return [owner, { score, label }];
    }),
  );
}

export function buildObserverSearchQuery(ecosystem: EcosystemConfig, date: string, recentDays: number): string {
  const since = shiftDate(date, -recentDays);
  const terms = [
    ...ecosystem.keywords.map((item) => `"${item}"`),
    ...ecosystem.topicHints.map((item) => `topic:${item}`),
    ...ecosystem.orgSeeds.map((item) => `org:${item}`),
    ...ecosystem.repoSeeds.map((item) => `"${item}"`),
  ];
  return [...terms, "archived:false", "fork:false", `pushed:>=${since}`].join(" ");
}

function buildObserverSearchQueries(
  ecosystem: EcosystemConfig,
  date: string,
  recentDays: number,
): Array<{ label: string; query: string }> {
  const since = shiftDate(date, -recentDays);
  const constraints = ["archived:false", "fork:false", `pushed:>=${since}`];
  const queries: Array<{ label: string; query: string }> = [];
  const keywordUnion = unique(ecosystem.keywords).slice(0, 4);

  const addQuery = (label: string, terms: string[]): void => {
    const filteredTerms = terms.filter(Boolean);
    if (filteredTerms.length === 0) return;
    const query = [...filteredTerms, ...constraints].join(" ");
    if (queries.some((item) => item.query === query)) return;
    queries.push({ label, query });
  };

  for (const keyword of keywordUnion) {
    addQuery(`keyword:${keyword}`, [`"${keyword}"`]);
  }

  for (const topicHint of unique(ecosystem.topicHints).slice(0, 4)) {
    addQuery(`topic:${topicHint}`, [`topic:${topicHint}`]);
  }

  const keywordGroup =
    keywordUnion.length > 0 ? `(${keywordUnion.map((item) => `"${item}"`).join(" OR ")})` : "";

  for (const orgSeed of unique(ecosystem.orgSeeds).slice(0, 3)) {
    addQuery(`org:${orgSeed}`, [keywordGroup, `org:${orgSeed}`]);
  }

  for (const repoSeed of unique(ecosystem.repoSeeds).slice(0, 3)) {
    addQuery(`repo:${repoSeed}`, [`"${repoSeed}"`]);
  }

  if (queries.length === 0) addQuery(`ecosystem:${ecosystem.name}`, constraints);
  return queries;
}

export function matchRepositoryToEcosystem(
  repo: GitHubSearchRepository,
  ecosystem: EcosystemConfig,
): EcosystemObserverEntry | null {
  const text = `${repo.name} ${cleanText(repo.description)}`.toLowerCase();
  const topics = lowerList(repo.topics);
  const keywordMatches = ecosystem.keywords.filter((item) => textHasKeyword(text, item));
  const topicMatches = ecosystem.topicHints.filter((item) => topics.includes(item.toLowerCase()));
  const orgMatches = ecosystem.orgSeeds.filter((item) => item.toLowerCase() === (repo.owner?.login ?? "").toLowerCase());
  const repoSeedMatches = repoSeedMatch(repo.full_name, repo.name, ecosystem.repoSeeds);
  const negativeMatches = ecosystem.negativeKeywords.filter((item) => text.includes(item.toLowerCase()));

  if (negativeMatches.length > 0) return null;

  const matched_by: EcosystemObserverMatchEvidence = {
    keywords: unique(keywordMatches),
    topic_hints: unique(topicMatches),
    repo_seeds: unique(repoSeedMatches),
    org_seeds: unique(orgMatches),
  };
  const keywordOnlyMatch =
    matched_by.keywords.length > 0 &&
    matched_by.topic_hints.length === 0 &&
    matched_by.repo_seeds.length === 0 &&
    matched_by.org_seeds.length === 0;
  if (keywordOnlyMatch && !hasAgenticContextBeyondKeywords(repo, matched_by.keywords)) return null;

  const strongMatch =
    matched_by.keywords.length > 0 ||
    matched_by.topic_hints.length > 0 ||
    ((matched_by.org_seeds.length > 0 || matched_by.repo_seeds.length > 0) && hasAdditionalPositiveEvidence(matched_by, repo));

  if (!strongMatch) return null;

  return {
    repo_full_name: repo.full_name,
    repo_url: repo.html_url,
    observed_at: "",
    repo_created_at: repo.created_at,
    repo_updated_at: repo.updated_at,
    ecosystems: [ecosystem.name],
    matched_by,
    description: cleanText(repo.description) || undefined,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    issues: repo.open_issues_count,
    PR: repo.pull_requests_count,
    source_notes: [],
  };
}

export function mergeObserverEntries(entries: EcosystemObserverEntry[]): EcosystemObserverEntry[] {
  const merged = new Map<string, EcosystemObserverEntry>();

  for (const entry of entries) {
    const key = entry.repo_full_name.toLowerCase();
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...entry,
        ecosystems: unique(entry.ecosystems),
        matched_by: {
          keywords: unique(entry.matched_by.keywords),
          topic_hints: unique(entry.matched_by.topic_hints),
          repo_seeds: unique(entry.matched_by.repo_seeds),
          org_seeds: unique(entry.matched_by.org_seeds),
        },
        source_notes: unique(entry.source_notes),
      });
      continue;
    }

    merged.set(key, {
      ...existing,
      observed_at: existing.observed_at || entry.observed_at,
      repo_created_at: existing.repo_created_at ?? entry.repo_created_at,
      repo_updated_at: existing.repo_updated_at ?? entry.repo_updated_at,
      ecosystems: unique([...existing.ecosystems, ...entry.ecosystems]),
      matched_by: {
        keywords: unique([...existing.matched_by.keywords, ...entry.matched_by.keywords]),
        topic_hints: unique([...existing.matched_by.topic_hints, ...entry.matched_by.topic_hints]),
        repo_seeds: unique([...existing.matched_by.repo_seeds, ...entry.matched_by.repo_seeds]),
        org_seeds: unique([...existing.matched_by.org_seeds, ...entry.matched_by.org_seeds]),
      },
      description: existing.description ?? entry.description,
      stars: mergeMetricValue(existing.stars, entry.stars),
      forks: mergeMetricValue(existing.forks, entry.forks),
      issues: mergeMetricValue(existing.issues, entry.issues),
      PR: mergeMetricValue(existing.PR, entry.PR),
      source_notes: unique([...existing.source_notes, ...entry.source_notes]),
    });
  }

  const evidenceWeight = (entry: EcosystemObserverEntry): number =>
    entry.ecosystems.length +
    entry.matched_by.keywords.length +
    entry.matched_by.topic_hints.length +
    entry.matched_by.repo_seeds.length +
    entry.matched_by.org_seeds.length;
  const longTailTier = (entry: EcosystemObserverEntry): number => ((entry.stars ?? 0) <= LONG_TAIL_STAR_CEILING ? 0 : 1);

  return [...merged.values()].sort(
    (a, b) =>
      longTailTier(a) - longTailTier(b) ||
      evidenceWeight(b) - evidenceWeight(a) ||
      (a.stars ?? 0) - (b.stars ?? 0) ||
      a.repo_full_name.localeCompare(b.repo_full_name),
  );
}

function observerArtifactPath(workspaceRoot: string, date: string): string {
  return path.join(workspaceRoot, "data", "observer", "ecosystem-focus", `${date}.json`);
}

function latestObserverArtifactPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, "data", "observer", "ecosystem-focus", "latest.json");
}

function readObserverSnapshot(filepath: string): EcosystemObserverArtifact | null {
  if (!fs.existsSync(filepath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filepath, "utf-8")) as EcosystemObserverArtifact;
  } catch {
    return null;
  }
}

async function fetchGitHubSearchResults(
  ecosystemName: string,
  queryLabel: string,
  query: string,
  perPage: number,
): Promise<{ repos: GitHubSearchRepository[]; notes: string[] }> {
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", query);
  url.searchParams.set("sort", "updated");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", String(perPage));

  const { response, usedUnauthenticatedRetry } = await fetchGitHubApiWithAuthFallback(url.toString());
  if (!response.ok) {
    throw new Error(`GitHub Search returned HTTP ${response.status} for ${ecosystemName}`);
  }

  const body = (await response.json()) as { items?: GitHubSearchRepository[] };
  return {
    repos: Array.isArray(body.items) ? body.items : [],
    notes: [
      `query ecosystem=${ecosystemName} source=${queryLabel}`,
      ...(usedUnauthenticatedRetry ? ["github api token returned 401; retried successfully without auth"] : []),
    ],
  };
}

function repoNameFromFullName(repoFullName: string): string {
  return repoFullName.split("/").at(-1) ?? repoFullName;
}

function ownerFromRepoFullName(repoFullName: string): string {
  return repoFullName.split("/")[0] ?? "";
}

function isExactSeedRepo(repoFullName: string, ecosystem: EcosystemConfig): boolean {
  const repoKey = repoFullName.toLowerCase();
  return ecosystem.repoSeeds.some((seed) => seed.toLowerCase() === repoKey);
}

function normalizedProjectToSearchRepository(project: NormalizedProject): GitHubSearchRepository {
  return {
    full_name: project.repo_full_name,
    html_url: project.repo_url,
    name: repoNameFromFullName(project.repo_full_name),
    created_at: project.first_seen,
    updated_at: project.last_seen,
    description: project.description,
    topics: project.tags,
    owner: {
      login: ownerFromRepoFullName(project.repo_full_name),
    },
    stargazers_count: project.stars,
    forks_count: project.forks,
    open_issues_count: project.issues,
    pull_requests_count: project.PR,
  };
}

function completeMetrics(
  repo: GitHubSearchRepository,
  fallbackProject: NormalizedProject | undefined,
): Pick<EcosystemObserverEntry, "stars" | "forks" | "issues" | "PR"> | null {
  const stars = repo.stargazers_count ?? fallbackProject?.stars;
  if (typeof stars !== "number" || !Number.isFinite(stars)) return null;

  return {
    stars,
    forks: repo.forks_count ?? fallbackProject?.forks ?? 0,
    issues: repo.open_issues_count ?? fallbackProject?.issues ?? 0,
    PR: repo.pull_requests_count ?? fallbackProject?.PR ?? 0,
  };
}

function findProjectByRepoFullName(projects: NormalizedProject[], repoFullName: string): NormalizedProject | undefined {
  const key = repoFullName.toLowerCase();
  return projects.find((project) => project.repo_full_name.toLowerCase() === key);
}

function isRecentDate(date: string | null, anchorDate: string, maxAgeDays: number): boolean {
  if (!date) return false;
  return date >= shiftDate(anchorDate, -maxAgeDays);
}

function isLongTailRepoCandidate(repo: GitHubSearchRepository, anchorDate: string): boolean {
  const stars = repo.stargazers_count ?? 0;
  if (stars <= LONG_TAIL_STAR_CEILING) return true;
  return stars <= BREAKOUT_STAR_CEILING && isRecentDate(dateOnly(repo.created_at), anchorDate, BREAKOUT_RECENT_DAYS);
}

function isLongTailDailyProject(project: NormalizedProject, anchorDate: string): boolean {
  if (project.stars <= LONG_TAIL_STAR_CEILING) return true;

  const isBreakoutRecent = isRecentDate(dateOnly(project.first_seen), anchorDate, BREAKOUT_RECENT_DAYS);
  const hasMomentum = (project.star_delta_daily ?? 0) >= BREAKOUT_DAILY_DELTA_MIN;
  const hasCorroboration = project.sources.length >= 2 || project.appearances >= 2;
  const notPersistentHead = project.persistence_state !== "persistent";

  return (
    project.stars <= BREAKOUT_STAR_CEILING &&
    isBreakoutRecent &&
    hasMomentum &&
    hasCorroboration &&
    notPersistentHead
  );
}

function computePedigree(
  ownerLogin: string,
  config: SourceConfig["ecosystemFocus"],
  project: NormalizedProject | undefined,
): EcosystemObserverPedigree {
  const owner = ownerLogin.toLowerCase();
  const projectTags = project?.tags.map((tag) => tag.toLowerCase()) ?? [];
  const companies = uniqueCaseInsensitive(
    [...config.priorityEntities.companies, ...projectTags.filter((tag) => tag.startsWith("watchlist:")).map((tag) => tag.replace(/^watchlist:/, ""))]
      .filter((item) => item.toLowerCase() === owner),
  );
  const builders = uniqueCaseInsensitive(config.priorityEntities.builders.filter((item) => item.toLowerCase() === owner));
  const engineers = uniqueCaseInsensitive(config.priorityEntities.engineers.filter((item) => item.toLowerCase() === owner));

  return {
    builders,
    companies,
    engineers,
  };
}

function hasPriorityPedigree(pedigree: EcosystemObserverPedigree): boolean {
  return pedigree.builders.length > 0 || pedigree.companies.length > 0 || pedigree.engineers.length > 0;
}

function pedigreeStrength(pedigree: EcosystemObserverPedigree): number {
  return pedigree.builders.length * 14 + pedigree.engineers.length * 12 + pedigree.companies.length * 8;
}

function watchReasonForEntry(
  pedigree: EcosystemObserverPedigree,
  breakout: string,
): EcosystemObserverEntry["long_tail_reason"] {
  if (pedigree.builders.length > 0) return "priority-builder";
  if (pedigree.engineers.length > 0) return "priority-engineer";
  if (pedigree.companies.length > 0) return "priority-company";
  if (breakout === "watch") return "breakout-newcomer";
  return "ecosystem-signal";
}

function watchReasonStrength(reason: EcosystemObserverEntry["long_tail_reason"]): number {
  switch (reason) {
    case "priority-builder":
      return 5;
    case "priority-engineer":
      return 4;
    case "priority-company":
      return 3;
    case "breakout-newcomer":
      return 2;
    case "ecosystem-signal":
      return 1;
    default:
      return 0;
  }
}

function ecosystemDepthStrength(depth: string | undefined): number {
  switch (depth) {
    case "cross-ecosystem":
      return 4;
    case "topic-backed":
      return 3;
    case "seed-adjacent":
      return 2;
    case "keyword-backed":
      return 1;
    default:
      return 0;
  }
}

function freshnessLabel(anchorDate: string, createdDate: string | null, updatedDate: string | null): string {
  const createdDelta = daysSince(anchorDate, createdDate);
  if (createdDelta !== null && createdDelta <= 1) return "new-24h";
  if (createdDelta !== null && createdDelta <= 3) return "new-72h";
  const updatedDelta = daysSince(anchorDate, updatedDate);
  if (updatedDelta !== null && updatedDelta <= 1) return "active-today";
  if (updatedDelta !== null && updatedDelta <= 7) return "active-week";
  return "historical";
}

function breakoutLabel(
  stars: number,
  createdDate: string | null,
  starDeltaDaily: number | undefined,
  anchorDate: string,
): string {
  if (starDeltaDaily !== undefined && starDeltaDaily >= BREAKOUT_DAILY_DELTA_MIN) return "watch";
  const createdDelta = daysSince(anchorDate, createdDate);
  if (stars > LONG_TAIL_STAR_CEILING && createdDelta !== null && createdDelta <= BREAKOUT_RECENT_DAYS) return "watch";
  return "steady";
}

function ecosystemDepthLabel(entry: EcosystemObserverEntry): string {
  if (entry.ecosystems.length >= 3) return "cross-ecosystem";
  if (entry.matched_by.topic_hints.length > 0) return "topic-backed";
  if (entry.matched_by.repo_seeds.length > 0 || entry.matched_by.org_seeds.length > 0) return "seed-adjacent";
  return "keyword-backed";
}

function observerLabels(
  entry: EcosystemObserverEntry,
  pedigree: EcosystemObserverPedigree,
  entityTier: EcosystemObserverEntityTier,
  historicalLabel: EcosystemObserverHistoryLabel,
  freshness: string,
  breakout: string,
  depth: string,
): string[] {
  return unique([
    pedigree.builders.length > 0 ? "pedigree:builder" : "",
    pedigree.companies.length > 0 ? "pedigree:company" : "",
    pedigree.engineers.length > 0 ? "pedigree:engineer" : "",
    entityTierLabel(entityTier),
    `history:${historicalLabel}`,
    `freshness:${freshness}`,
    `breakout:${breakout}`,
    `ecosystem-depth:${depth}`,
  ]);
}

function shouldRetainObserverEntry(
  entry: EcosystemObserverEntry,
  project: NormalizedProject | undefined,
  pedigree: EcosystemObserverPedigree,
  freshness: string,
): boolean {
  const stars = entry.stars;
  if (typeof stars !== "number" || !Number.isFinite(stars)) return false;
  if (stars > 0) return true;

  const corroborated = project ? project.sources.length >= 2 || project.appearances >= 2 : false;
  const seeded =
    entry.matched_by.topic_hints.length > 0 ||
    entry.matched_by.repo_seeds.length > 0 ||
    entry.matched_by.org_seeds.length > 0;
  const veryFresh = freshness === "new-24h";

  return veryFresh && seeded && (hasPriorityPedigree(pedigree) || corroborated);
}

function scoreObserverEntry(
  entry: EcosystemObserverEntry,
  project: NormalizedProject | undefined,
  anchorDate: string,
): number {
  const stars = entry.stars ?? 0;
  const freshness =
    entry.freshness_label ??
    freshnessLabel(
      anchorDate,
      dateOnly(project?.first_seen) ?? dateOnly(entry.repo_created_at),
      dateOnly(project?.last_seen) ?? dateOnly(entry.repo_updated_at) ?? dateOnly(entry.observed_at),
    );
  const breakout = entry.breakout_label ?? "steady";
  const pedigree = entry.pedigree ?? { builders: [], companies: [], engineers: [] };
  const depth = entry.ecosystem_depth_label ?? ecosystemDepthLabel(entry);
  const entityTierBonus = entityTierScore(entry.entity_tier ?? "none");
  const historicalPrecisionBonus = entry.historical_precision_score ?? 0;
  const ecosystems = Math.min(entry.ecosystems.length * 8, 20);
  const evidence = Math.min(
    entry.matched_by.keywords.length * 4 +
      entry.matched_by.topic_hints.length * 6 +
      entry.matched_by.repo_seeds.length * 5 +
      entry.matched_by.org_seeds.length * 5,
    24,
  );
  const freshnessBonus =
    freshness === "new-24h" ? 18 : freshness === "new-72h" ? 15 : freshness === "active-today" ? 12 : freshness === "active-week" ? 8 : 4;
  const breakoutBonus = breakout === "watch" ? 14 : 4;
  const corroborationBonus = project ? Math.min(project.sources.length * 3 + Math.max(project.appearances - 1, 0) * 2, 12) : 3;
  const pedigreeBonus = pedigreeStrength(pedigree);
  const depthBonus = ecosystemDepthStrength(depth) * 4;
  const maturityPenalty = stars > 20_000 ? 8 : stars > LONG_TAIL_STAR_CEILING ? 4 : 0;

  return Math.round(
    freshnessBonus +
      breakoutBonus +
      ecosystems +
      evidence +
      corroborationBonus +
      pedigreeBonus +
      depthBonus +
      entityTierBonus +
      historicalPrecisionBonus -
      maturityPenalty,
  );
}

function finalizeObserverEntries(
  entries: EcosystemObserverEntry[],
  projects: NormalizedProject[],
  config: SourceConfig["ecosystemFocus"],
  anchorDate: string,
  workspaceRoot: string,
): EcosystemObserverEntry[] {
  const historicalPrecisionRegistry = buildHistoricalPrecisionRegistry(
    workspaceRoot,
    anchorDate,
    config.historicalPrecisionDays,
  );
  const enriched = entries
    .map((entry) => {
    const project = findProjectByRepoFullName(projects, entry.repo_full_name);
    const ownerLogin = ownerFromRepoFullName(entry.repo_full_name);
    const pedigree = computePedigree(ownerLogin, config, project);
    const entityTier = resolveEntityTier(ownerLogin, config.entityTiers);
    const historicalPrecision = historicalPrecisionRegistry.get(ownerLogin.toLowerCase()) ?? {
      score: 0,
      label: "none" as EcosystemObserverHistoryLabel,
    };
    const freshness = freshnessLabel(
      anchorDate,
      dateOnly(project?.first_seen) ?? dateOnly(entry.repo_created_at),
      dateOnly(project?.last_seen) ?? dateOnly(entry.repo_updated_at) ?? dateOnly(entry.observed_at),
    );
    const breakout = breakoutLabel(
      entry.stars ?? 0,
      dateOnly(project?.first_seen) ?? dateOnly(entry.repo_created_at),
      project?.star_delta_daily,
      anchorDate,
    );
    const depth = ecosystemDepthLabel(entry);
    const labels = observerLabels(entry, pedigree, entityTier, historicalPrecision.label, freshness, breakout, depth);
    const watchReason = watchReasonForEntry(pedigree, breakout);
    const baseObserverScore = scoreObserverEntry(
      {
        ...entry,
        pedigree,
        entity_tier: entityTier,
        historical_precision_score: historicalPrecision.score,
        historical_precision_label: historicalPrecision.label,
        freshness_label: freshness,
        breakout_label: breakout,
        ecosystem_depth_label: depth,
        long_tail_reason: watchReason,
      },
      project,
      anchorDate,
    );

    return {
      ...entry,
      pedigree,
      entity_tier: entityTier,
      historical_precision_score: historicalPrecision.score,
      historical_precision_label: historicalPrecision.label,
      freshness_label: freshness,
      breakout_label: breakout,
      ecosystem_depth_label: depth,
      labels,
      long_tail_reason: watchReason,
      source_notes: unique([...entry.source_notes, `watch_reason=${watchReason}`]),
      base_observer_score: baseObserverScore,
      observer_score: baseObserverScore,
    };
    })
    .filter((entry) =>
      shouldRetainObserverEntry(
        entry,
        findProjectByRepoFullName(projects, entry.repo_full_name),
        entry.pedigree ?? { builders: [], companies: [], engineers: [] },
        entry.freshness_label ?? "historical",
      ),
    );

  const ranked = [...enriched].sort(
    (a, b) =>
      (b.observer_score ?? 0) - (a.observer_score ?? 0) ||
      watchReasonStrength(b.long_tail_reason) - watchReasonStrength(a.long_tail_reason) ||
      entityTierScore(b.entity_tier ?? "none") - entityTierScore(a.entity_tier ?? "none") ||
      (b.historical_precision_score ?? 0) - (a.historical_precision_score ?? 0) ||
      pedigreeStrength(b.pedigree ?? { builders: [], companies: [], engineers: [] }) -
        pedigreeStrength(a.pedigree ?? { builders: [], companies: [], engineers: [] }) ||
      ecosystemDepthStrength(b.ecosystem_depth_label) - ecosystemDepthStrength(a.ecosystem_depth_label) ||
      (a.stars ?? 0) - (b.stars ?? 0) ||
      a.repo_full_name.localeCompare(b.repo_full_name),
  );

  return ranked.map((entry, index) => ({
    ...entry,
    observer_rank: index + 1,
  }));
}

function collectDailyPoolMatches(
  projects: NormalizedProject[],
  ecosystem: EcosystemConfig,
  generatedAt: string,
  anchorDate: string,
): EcosystemObserverEntry[] {
  const matchedEntries: EcosystemObserverEntry[] = [];

  for (const project of projects) {
    if (!isLongTailDailyProject(project, anchorDate)) continue;
    if (isExactSeedRepo(project.repo_full_name, ecosystem)) continue;
    const matched = matchRepositoryToEcosystem(normalizedProjectToSearchRepository(project), ecosystem);
    if (!matched) continue;
    const metrics = completeMetrics(normalizedProjectToSearchRepository(project), project);
    if (!metrics) continue;
    matched.observed_at = generatedAt;
    matched.stars = metrics.stars;
    matched.forks = metrics.forks;
    matched.issues = metrics.issues;
    matched.PR = metrics.PR;
    matched.source_notes = unique([
      "candidate_pool=daily-normalized",
      `project_sources=${project.sources.join(",")}`,
      ...(project.tags.length > 0 ? [`project_tags=${project.tags.join(",")}`] : []),
    ]);
    matchedEntries.push(matched);
  }

  return matchedEntries;
}

function buildArtifact(
  date: string,
  generatedAt: string,
  status: ObserverStatus,
  entries: EcosystemObserverEntry[],
  notes: string[],
  llmDiagnostics?: ObserverLlmDiagnostics,
): EcosystemObserverArtifact {
  const ecosystemCounts = entries.reduce<Record<string, number>>((acc, entry) => {
    for (const ecosystem of entry.ecosystems) acc[ecosystem] = (acc[ecosystem] ?? 0) + 1;
    return acc;
  }, {});

  return {
    scope: "ecosystem-focus",
    date,
    generated_at: generatedAt,
    status,
    llm_diagnostics: llmDiagnostics,
    candidate_count: entries.length,
    ecosystem_counts: ecosystemCounts,
    notes,
    entries,
  };
}

function summarizePedigree(entry: EcosystemObserverEntry): string {
  const parts = [
    ...(entry.pedigree?.builders ?? []).map((item) => `builder:${item}`),
    ...(entry.pedigree?.companies ?? []).map((item) => `company:${item}`),
    ...(entry.pedigree?.engineers ?? []).map((item) => `engineer:${item}`),
  ];
  return parts.length > 0 ? parts.join(", ") : "none";
}

function observerSearchableText(entry: EcosystemObserverEntry): string {
  return [
    entry.repo_full_name,
    entry.description ?? "",
    ...entry.ecosystems,
    ...(entry.labels ?? []),
    ...(entry.matched_by.keywords ?? []),
    ...(entry.matched_by.topic_hints ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

function observerContains(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function observerIdentityLabel(searchable: string): string {
  if (observerContains(searchable, ["coding agent", "coding-agents", "ide", "editor"])) return "开源 coding agent";
  if (observerContains(searchable, ["agent-runtime", "runtime", "workflow"])) return "agent runtime 工具";
  if (observerContains(searchable, ["mcp", "tool", "connector"])) return "工具接入项目";
  if (observerContains(searchable, ["rag", "retrieval", "knowledge", "search"])) return "知识检索项目";
  return "AI 工具项目";
}

function observerPrimaryPurpose(searchable: string): string {
  if (observerContains(searchable, ["ide", "editor", "coding agent"])) return "把对话、代码编辑和工具执行串成同一条 IDE 开发闭环";
  if (observerContains(searchable, ["code edit", "edit code", "patch"])) return "协助改代码、生成补丁并推进开发任务";
  if (observerContains(searchable, ["tool execution", "tool use", "tools"])) return "把工具调用和执行步骤接进同一条工作流";
  if (observerContains(searchable, ["workflow", "runtime"])) return "组织代理运行时和多步执行链路";
  if (observerContains(searchable, ["search", "retrieval", "knowledge"])) return "承接检索、知识调用和上下文复用";
  return "把一类 AI 能力整理成可持续跟踪的产品形态";
}

function observerWatchNext(searchable: string): string {
  if (observerContains(searchable, ["ide", "editor", "coding agent"])) {
    return "继续验证真实团队接入、跨工具链集成，以及是否形成持续多源确认。";
  }
  if (observerContains(searchable, ["workflow", "runtime", "tool"])) {
    return "继续验证执行闭环是否稳定、工具接入是否扩展，以及是否出现持续多源确认。";
  }
  return "继续验证 README/代码深度、真实使用场景，以及它是否获得持续多源确认。";
}

function collectObserverFallbackTags(entry: EcosystemObserverEntry): string[] {
  return Array.from(
    new Set([
      ...entry.ecosystems,
      ...(entry.labels ?? []),
      ...(entry.matched_by.topic_hints ?? []),
      ...(entry.matched_by.keywords ?? []),
    ]),
  ).filter((item) => item.trim().length > 0);
}

function resolveObserverFallbackParadigm(searchable: string): string {
  if (observerContains(searchable, ["coding agent", "coding-agents", "ide", "editor"])) return "coding-agent";
  if (observerContains(searchable, ["agent-runtime", "runtime", "workflow"])) return "agent-runtime";
  if (observerContains(searchable, ["mcp", "tool", "connector"])) return "mcp-tooling";
  if (observerContains(searchable, ["rag", "retrieval", "knowledge", "search"])) return "rag-knowledge";
  return "ecosystem-observer";
}

export function buildObserverSummaryFallback(entry: EcosystemObserverEntry): {
  project_brief_cn: string;
  why_now_cn: string;
  watch_next_cn: string;
} {
  const ecosystems = entry.ecosystems.join("、") || "agent 生态";
  const pedigree = summarizePedigree(entry);
  const searchable = observerSearchableText(entry);
  const fallbackTags = collectObserverFallbackTags(entry);
  const fallbackParadigm = resolveObserverFallbackParadigm(searchable);
  return {
    project_brief_cn: buildProjectBrief({
      project_name: entry.repo_full_name.split("/").pop() ?? entry.repo_full_name,
      repo_full_name: entry.repo_full_name,
      description: entry.description ?? "",
      tags: fallbackTags,
      paradigm: fallbackParadigm,
      evidence: [...entry.source_notes, ...(entry.matched_by.keywords ?? []), ...(entry.matched_by.topic_hints ?? [])],
    }),
    why_now_cn: `它当前被 observer 捕获，是因为命中了 ${ecosystems} 的生态证据，主体 pedigree 为 ${pedigree}，并且新鲜度标签为 ${entry.freshness_label ?? "unknown"}。`,
    watch_next_cn: observerWatchNext(searchable),
  };
}

function buildObserverSummaryPrompt(entry: EcosystemObserverEntry, project: NormalizedProject | undefined): string {
  return [
    "你是一个资深 AI / Agent 生态研究员。",
    "请根据下面的仓库证据，用中文输出一个严格 JSON 对象，帮助 observer 页面写项目介绍。",
    "返回 exactly one JSON object and nothing else.",
    "不要使用 markdown，不要解释，不要输出多余字段。",
    "",
    "JSON schema:",
    `{`,
    `  "project_brief_cn": string,`,
    `  "why_now_cn": string,`,
    `  "watch_next_cn": string`,
    `}`,
    "",
    "要求:",
    "- project_brief_cn: 用通俗中文说明这项目到底在做什么，最好写成“它是什么 + 大家通常拿它来干什么”。",
    "- project_brief_cn: 优先使用 description、repo 名称语义、ecosystem/topic/keyword 线索，不要只写抽象范式词。",
    "- project_brief_cn: 除非现有输入真的无法判断项目用途，否则不要写“当前项目信息不足”或“缺少明确的功能描述”。",
    "- why_now_cn: 说明它为什么现在值得关注，必须结合新鲜度、生态证据、主体背景或增长迹象。",
    "- watch_next_cn: 说明下一步应该继续验证什么，强调还不确定的地方。",
    "- 不要机械改写 description，要总结成普通人更容易读懂的话。",
    "",
    "仓库上下文:",
    JSON.stringify(
      {
        repo_full_name: entry.repo_full_name,
        repo_url: entry.repo_url,
        description: entry.description ?? "",
        ecosystems: entry.ecosystems,
        labels: entry.labels ?? [],
        matched_by: entry.matched_by,
        stars: entry.stars ?? 0,
        forks: entry.forks ?? 0,
        issues: entry.issues ?? 0,
        pull_requests: entry.PR ?? 0,
        pedigree: entry.pedigree ?? { builders: [], companies: [], engineers: [] },
        entity_tier: entry.entity_tier ?? "none",
        historical_precision_label: entry.historical_precision_label ?? "none",
        freshness_label: entry.freshness_label ?? "unknown",
        breakout_label: entry.breakout_label ?? "unknown",
        ecosystem_depth_label: entry.ecosystem_depth_label ?? "unknown",
        project_context: project
          ? {
              appearances: project.appearances,
              persistence_state: project.persistence_state,
              sources: project.sources,
              tags: project.tags,
              star_delta_daily: project.star_delta_daily,
            }
          : null,
      },
      null,
      2,
    ),
  ].join("\n");
}

function buildObserverSummaryRepairPrompt(
  entry: EcosystemObserverEntry,
  project: NormalizedProject | undefined,
  rawResponse: string,
  errorMessage: string,
): string {
  return [
    "上一次回答不符合要求。",
    "请忽略上一次输出，重新生成一个严格 JSON 对象。",
    "返回 exactly one JSON object and nothing else.",
    `问题说明: ${errorMessage}`,
    "",
    buildObserverSummaryPrompt(entry, project),
    "",
    "上一次错误输出:",
    rawResponse,
  ].join("\n");
}

function parseObserverSummaryPayload(text: string): { project_brief_cn: string; why_now_cn: string; watch_next_cn: string } {
  const parsed = parseJsonObjectFromText<Record<string, unknown>>(text);
  const projectBrief = cleanText(typeof parsed["project_brief_cn"] === "string" ? parsed["project_brief_cn"] : "");
  const whyNow = cleanText(typeof parsed["why_now_cn"] === "string" ? parsed["why_now_cn"] : "");
  const watchNext = cleanText(typeof parsed["watch_next_cn"] === "string" ? parsed["watch_next_cn"] : "");
  if (projectBrief.length < 20 || whyNow.length < 12 || watchNext.length < 12) {
    throw new Error("observer summary fields are missing or too short");
  }
  return {
    project_brief_cn: projectBrief,
    why_now_cn: whyNow,
    watch_next_cn: watchNext,
  };
}

function buildObserverJudgePrompt(entries: EcosystemObserverEntry[]): string {
  return [
    "你是一个长期跟踪 agent 生态的榜单裁判。",
    "请比较下面这些 observer 候选，判断它们是否真的配站在当前的位置。",
    "返回 exactly one JSON object and nothing else.",
    "不要使用 markdown，不要输出解释性前言。",
    "",
    "JSON schema:",
    `{`,
    `  "adjustments": [`,
    `    {`,
    `      "repo_full_name": string,`,
    `      "position_qualification": "top-tier-now" | "strong-watch" | "keep-observing" | "drop",`,
    `      "score_delta": number,`,
    `      "rationale_cn": string`,
    `    }`,
    `  ]`,
    `}`,
    "",
    "裁决要求:",
    "- 你不是做语义复核，而是判断它是否真的配站在这个位置。",
    "- 如果一个项目只是品牌光环、完成度不足、内容空、或只是已有项目薄包装，可以直接给 drop。",
    "- 如果一个项目即使去掉 owner 名字仍然很强，且 why-now 明确，可以给 top-tier-now。",
    "- rationale_cn 必须点明为什么升、降、保留或淘汰。",
    "- 必须为每一个候选 repo 都返回一条 adjustment，就算只是 keep-observing 也要显式返回。",
    "",
    "候选列表:",
    JSON.stringify(
      entries.map((entry) => ({
        repo_full_name: entry.repo_full_name,
        base_rank: entry.observer_rank,
        base_observer_score: entry.base_observer_score ?? entry.observer_score ?? 0,
        observer_score: entry.observer_score ?? 0,
        stars: entry.stars ?? 0,
        forks: entry.forks ?? 0,
        ecosystems: entry.ecosystems,
        labels: entry.labels ?? [],
        pedigree: entry.pedigree ?? { builders: [], companies: [], engineers: [] },
        entity_tier: entry.entity_tier ?? "none",
        historical_precision_label: entry.historical_precision_label ?? "none",
        project_brief_cn: truncateText(entry.project_brief_cn, 140),
        why_now_cn: truncateText(entry.why_now_cn, 120),
      })),
      null,
      2,
    ),
  ].join("\n");
}

function buildObserverJudgeRepairPrompt(entries: EcosystemObserverEntry[], rawResponse: string, errorMessage: string): string {
  return [
    "上一次榜单裁决输出不是有效 JSON。",
    "请忽略上一次输出，重新生成一个严格 JSON 对象。",
    "返回 exactly one JSON object and nothing else.",
    `问题说明: ${errorMessage}`,
    "",
    buildObserverJudgePrompt(entries),
    "",
    "上一次错误输出:",
    rawResponse,
  ].join("\n");
}

function parseObserverJudgePayload(text: string): Map<
  string,
  {
    repo_full_name: string;
    position_qualification: EcosystemObserverPositionQualification;
    score_delta: number;
    rationale_cn: string;
  }
> {
  const parsed = parseJsonObjectFromText<Record<string, unknown> | Array<Record<string, unknown>>>(text);
  const candidates = Array.isArray(parsed)
    ? parsed
    : (["adjustments", "results", "rankings", "candidates", "items"]
        .map((key) => parsed[key])
        .find((value) => Array.isArray(value)) as Array<Record<string, unknown>> | undefined) ?? [];
  const normalized = candidates
    .filter((item) => typeof item === "object" && item !== null)
    .map((item) => ({
      repo_full_name: String(item.repo_full_name ?? item.repo ?? item.name ?? ""),
      position_qualification: normalizePositionQualification(
        item.position_qualification ?? item.qualification ?? item.decision ?? item.rank_fit,
      ),
      score_delta: clamp(
        typeof item.score_delta === "number"
          ? item.score_delta
          : typeof item.delta === "number"
            ? item.delta
            : typeof item.adjustment_score === "number"
              ? item.adjustment_score
              : 0,
        -50,
        25,
      ),
      rationale_cn: cleanText(
        typeof item.rationale_cn === "string"
          ? item.rationale_cn
          : typeof item.rationale === "string"
            ? item.rationale
            : typeof item.reason_cn === "string"
              ? item.reason_cn
              : typeof item.reason === "string"
                ? item.reason
                : "",
      ),
    }))
    .filter((item) => item.repo_full_name.length > 0 && item.rationale_cn.length >= 4);
  if (normalized.length === 0) {
    throw new Error("observer judge returned no usable adjustments");
  }
  return new Map(normalized.map((item) => [item.repo_full_name.toLowerCase(), item]));
}

function normalizePositionQualification(value: unknown): EcosystemObserverPositionQualification {
  if (value === "top-tier-now" || value === "strong-watch" || value === "keep-observing" || value === "drop") {
    return value;
  }
  const normalized = cleanText(typeof value === "string" ? value : "").toLowerCase().replace(/_/g, "-");
  if (normalized === "top-tier-now" || normalized === "top tier now") return "top-tier-now";
  if (normalized === "strong-watch" || normalized === "strong watch") return "strong-watch";
  if (normalized === "keep-observing" || normalized === "keep observing") return "keep-observing";
  if (normalized === "drop") return "drop";
  return "keep-observing";
}

async function enhanceObserverEntriesWithAgent(
  entries: EcosystemObserverEntry[],
  projects: NormalizedProject[],
  llmConfig: LlmConfig | undefined,
  judgeTopN: number,
): Promise<{ entries: EcosystemObserverEntry[]; diagnostics: ObserverLlmDiagnostics }> {
  const diagnostics = emptyObserverLlmDiagnostics(llmConfig);
  if (entries.length === 0 || !isObserverLlmEnabled(llmConfig)) {
    return {
      entries: entries.map((entry) => ({ ...entry, ...buildObserverSummaryFallback(entry), summary_source: "template_fallback" })),
      diagnostics,
    };
  }

  const withSummaries: EcosystemObserverEntry[] = [];
  for (const entry of entries) {
    diagnostics.summary_attempt_count += 1;
    const project = findProjectByRepoFullName(projects, entry.repo_full_name);
    try {
      const prompt = buildObserverSummaryPrompt(entry, project);
      const response = await callLlm(prompt, {
        providerName: llmConfig?.provider,
        maxTokens: 900,
      });
      let parsed = parseObserverSummaryPayload(response);
      if (!parsed.project_brief_cn || !parsed.why_now_cn || !parsed.watch_next_cn) {
        throw new Error("observer summary missing required fields");
      }
      withSummaries.push({
        ...entry,
        project_brief_cn: parsed.project_brief_cn,
        why_now_cn: parsed.why_now_cn,
        watch_next_cn: parsed.watch_next_cn,
        summary_source: "agent",
      });
      diagnostics.summary_success_count += 1;
    } catch (error) {
      try {
        const response = await callLlm(
          buildObserverSummaryRepairPrompt(
            entry,
            project,
            "",
            error instanceof Error ? error.message : String(error),
          ),
          {
            providerName: llmConfig?.provider,
            maxTokens: 900,
          },
        );
        const parsed = parseObserverSummaryPayload(response);
        withSummaries.push({
          ...entry,
          project_brief_cn: parsed.project_brief_cn,
          why_now_cn: parsed.why_now_cn,
          watch_next_cn: parsed.watch_next_cn,
          summary_source: "agent",
        });
        diagnostics.summary_success_count += 1;
      } catch (repairError) {
        diagnostics.summary_failure_count += 1;
        diagnostics.last_error = repairError instanceof Error ? repairError.message : String(repairError);
        withSummaries.push({
          ...entry,
          ...buildObserverSummaryFallback(entry),
          summary_source: "template_fallback",
        });
      }
    }
  }

  const judgeWindow = withSummaries.slice(0, Math.max(1, Math.min(withSummaries.length, judgeTopN)));
  if (judgeWindow.length === 0) {
    return { entries: withSummaries, diagnostics };
  }

  diagnostics.judge_attempt_count += 1;
  try {
    const prompt = buildObserverJudgePrompt(judgeWindow);
    const response = await callLlm(prompt, {
      providerName: llmConfig?.provider,
      maxTokens: 2200,
    });
    const adjustmentMap = parseObserverJudgePayload(response);
    diagnostics.judge_success_count += 1;

    const adjudicated = withSummaries
      .map<EcosystemObserverEntry>((entry, index) => {
        if (index >= judgeWindow.length) return entry;
        const adjustment = adjustmentMap.get(entry.repo_full_name.toLowerCase());
        if (!adjustment) {
          return {
            ...entry,
            position_qualification: "keep-observing" as const,
            position_rationale_cn: entry.watch_next_cn ?? "",
            judge_score_delta: 0,
            judge_source: "template_fallback" as const,
          };
        }
        return {
          ...entry,
          observer_score: Math.max(0, (entry.observer_score ?? 0) + adjustment.score_delta),
          position_qualification: adjustment.position_qualification,
          position_rationale_cn: adjustment.rationale_cn,
          judge_score_delta: adjustment.score_delta,
          judge_source: "agent" as const,
        };
      })
      .filter((entry) => entry.position_qualification !== "drop");

    const reranked = adjudicated.sort(
      (a, b) =>
        (b.observer_score ?? 0) - (a.observer_score ?? 0) ||
        entityTierScore(b.entity_tier ?? "none") - entityTierScore(a.entity_tier ?? "none") ||
        (b.historical_precision_score ?? 0) - (a.historical_precision_score ?? 0) ||
        (a.stars ?? 0) - (b.stars ?? 0) ||
        a.repo_full_name.localeCompare(b.repo_full_name),
    );
    return {
      entries: reranked.map((entry, index) => ({ ...entry, observer_rank: index + 1 })),
      diagnostics,
    };
  } catch (error) {
    try {
      const response = await callLlm(
        buildObserverJudgeRepairPrompt(
          judgeWindow,
          "",
          error instanceof Error ? error.message : String(error),
        ),
        {
          providerName: llmConfig?.provider,
          maxTokens: 2200,
        },
      );
      const adjustmentMap = parseObserverJudgePayload(response);
      diagnostics.judge_success_count += 1;
      const adjudicated = withSummaries
        .map<EcosystemObserverEntry>((entry, index) => {
          if (index >= judgeWindow.length) return entry;
          const adjustment = adjustmentMap.get(entry.repo_full_name.toLowerCase());
          if (!adjustment) {
            return {
              ...entry,
              position_qualification: "keep-observing" as const,
              position_rationale_cn: entry.watch_next_cn ?? "",
              judge_score_delta: 0,
              judge_source: "template_fallback" as const,
            };
          }
          return {
            ...entry,
            observer_score: Math.max(0, (entry.observer_score ?? 0) + adjustment.score_delta),
            position_qualification: adjustment.position_qualification,
            position_rationale_cn: adjustment.rationale_cn,
            judge_score_delta: adjustment.score_delta,
            judge_source: "agent" as const,
          };
        })
        .filter((entry) => entry.position_qualification !== "drop")
        .sort(
          (a, b) =>
            (b.observer_score ?? 0) - (a.observer_score ?? 0) ||
            entityTierScore(b.entity_tier ?? "none") - entityTierScore(a.entity_tier ?? "none") ||
            (b.historical_precision_score ?? 0) - (a.historical_precision_score ?? 0) ||
            (a.stars ?? 0) - (b.stars ?? 0) ||
            a.repo_full_name.localeCompare(b.repo_full_name),
        );
      return {
        entries: adjudicated.map((entry, index) => ({ ...entry, observer_rank: index + 1 })),
        diagnostics,
      };
    } catch (repairError) {
      diagnostics.judge_failure_count += 1;
      diagnostics.last_error = repairError instanceof Error ? repairError.message : String(repairError);
      return { entries: withSummaries, diagnostics };
    }
  }
}

export async function collectEcosystemFocusObserver(
  config: SourceConfig["ecosystemFocus"],
  opts: ObserverOptions,
): Promise<ObserverCollectionResult> {
  const workspaceRoot = opts.workspaceRoot ?? process.cwd();
  const llmDiagnostics = emptyObserverLlmDiagnostics(opts.llmConfig);
  if (!config.enabled) {
    return {
      status: "disabled",
      artifact: buildArtifact(opts.date, opts.generatedAt, "disabled", [], ["observer disabled by config"], llmDiagnostics),
      used_snapshot_fallback: false,
    };
  }

  const enabledEcosystems = config.ecosystems.filter((item) => item.enabled);
  if (enabledEcosystems.length === 0) {
    return {
      status: "disabled",
      artifact: buildArtifact(
        opts.date,
        opts.generatedAt,
        "disabled",
        [],
        ["no observer ecosystems enabled"],
        llmDiagnostics,
      ),
      used_snapshot_fallback: false,
    };
  }

  try {
    const collected: EcosystemObserverEntry[] = [];
    const notes: string[] = [];
    const queryFailures: string[] = [];
    let attemptedQueryCount = 0;
    let successfulQueryCount = 0;

    for (const ecosystem of enabledEcosystems) {
      for (const searchQuery of buildObserverSearchQueries(ecosystem, opts.date, config.recentDays)) {
        attemptedQueryCount += 1;
        try {
          const result = await fetchGitHubSearchResults(
            ecosystem.name,
            searchQuery.label,
            searchQuery.query,
            config.perEcosystemLimit,
          );
          successfulQueryCount += 1;
          notes.push(...result.notes);
          for (const repo of result.repos) {
            if (!isLongTailRepoCandidate(repo, opts.date)) continue;
            const matched = matchRepositoryToEcosystem(repo, ecosystem);
            if (!matched) continue;
            const project = findProjectByRepoFullName(opts.dailyCandidateProjects ?? [], repo.full_name);
            const metrics = completeMetrics(repo, project);
            if (!metrics) continue;
            matched.observed_at = opts.generatedAt;
            matched.stars = metrics.stars;
            matched.forks = metrics.forks;
            matched.issues = metrics.issues;
            matched.PR = metrics.PR;
            matched.source_notes = unique([
              `candidate_pool=github-search`,
              `query=${searchQuery.label}`,
              ...result.notes,
            ]);
            collected.push(matched);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          queryFailures.push(`query failed ecosystem=${ecosystem.name} source=${searchQuery.label}: ${message}`);
        }
      }

      const dailyPoolMatches = collectDailyPoolMatches(
        opts.dailyCandidateProjects ?? [],
        ecosystem,
        opts.generatedAt,
        opts.date,
      );
      if (dailyPoolMatches.length > 0) {
        notes.push(`daily normalized matches ecosystem=${ecosystem.name} count=${dailyPoolMatches.length}`);
        collected.push(...dailyPoolMatches);
      }
    }

    if (queryFailures.length > 0) notes.push(...queryFailures);

    const merged = finalizeObserverEntries(
      mergeObserverEntries(collected).slice(0, config.maxTotalCandidates),
      opts.dailyCandidateProjects ?? [],
      config,
      opts.date,
      workspaceRoot,
    );
    const enhanced = await enhanceObserverEntriesWithAgent(
      merged,
      opts.dailyCandidateProjects ?? [],
      opts.llmConfig,
      config.judgeTopN,
    );
    if (merged.length === 0 && successfulQueryCount === 0 && queryFailures.length > 0) {
      const snapshot = readObserverSnapshot(latestObserverArtifactPath(workspaceRoot));
      if (snapshot) {
        return {
          status: snapshot.candidate_count > 0 ? "active" : "empty",
          artifact: {
            ...snapshot,
            date: opts.date,
            generated_at: opts.generatedAt,
            notes: unique([
              ...snapshot.notes,
              ...queryFailures,
              `observer live fetch degraded across ${attemptedQueryCount} queries`,
            ]),
          },
          used_snapshot_fallback: true,
        };
      }
    }

    const status: ObserverStatus = enhanced.entries.length > 0 ? "active" : "empty";
    return {
      status,
      artifact: buildArtifact(opts.date, opts.generatedAt, status, enhanced.entries, notes, enhanced.diagnostics),
      used_snapshot_fallback: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const snapshot = readObserverSnapshot(latestObserverArtifactPath(workspaceRoot));
    if (snapshot) {
      return {
        status: snapshot.candidate_count > 0 ? "active" : "empty",
        artifact: {
          ...snapshot,
          date: opts.date,
          generated_at: opts.generatedAt,
          notes: unique([...snapshot.notes, `live observer fetch failed: ${message}`]),
        },
        used_snapshot_fallback: true,
      };
    }

    return {
      status: "failed",
      artifact: buildArtifact(
        opts.date,
        opts.generatedAt,
        "failed",
        [],
        [`live observer fetch failed: ${message}`],
        llmDiagnostics,
      ),
      used_snapshot_fallback: false,
    };
  }
}

export function writeEcosystemFocusObserverArtifact(
  artifact: EcosystemObserverArtifact,
  workspaceRoot = process.cwd(),
  dryRun = false,
): void {
  if (dryRun) return;
  const datedPath = observerArtifactPath(workspaceRoot, artifact.date);
  const latestPath = latestObserverArtifactPath(workspaceRoot);
  fs.mkdirSync(path.dirname(datedPath), { recursive: true });
  fs.writeFileSync(datedPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf-8");
  fs.writeFileSync(latestPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf-8");
}
