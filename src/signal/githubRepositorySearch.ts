import type { NormalizedProject, RawSignal, ScoredProject } from "../types.ts";
import type { DirectionCatalogEntry } from "./directionCatalog.ts";
import { PROJECT_SEARCH_CONSTANTS } from "./directionCatalog.ts";
import type { MissionScoutSearchResult } from "./missionScoutDiscovery.ts";
import { directionLaneHits, directionMatchesProject } from "./directionMatching.ts";
import { extractGitHubRepoFullName } from "./githubMetrics.ts";

interface GitHubSearchRepository {
  full_name?: string;
  html_url?: string;
  name?: string;
  description?: string | null;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  topics?: string[];
}

interface GitHubSearchResponse {
  items?: GitHubSearchRepository[];
}

export const MISSION_GITHUB_PER_DIRECTION_LIMIT = PROJECT_SEARCH_CONSTANTS.directionRawHitsMin;
const DIRECTION_GITHUB_QUERIES: Record<string, string> = {
  "coding-agent": "coding agent OR code agent OR ai coding",
  "browser-computer-use": "browser agent OR computer use agent OR web automation agent",
  "workflow-automation-agent": "workflow automation agent OR ai workflow automation OR workflow agent",
  "research-knowledge-agent": "research agent OR knowledge agent OR deep research agent",
  "shopping-commerce-agent": "shopping agent OR commerce agent OR ecommerce agent",
  "sales-prospecting-agent": "sales agent OR prospecting agent OR sales automation",
  "customer-support-agent": "customer support agent OR support agent OR helpdesk ai",
  "marketing-content-ops-agent": "marketing agent OR content agent OR content automation",
  "finance-investment-research-agent": "finance agent OR investment research agent OR trading agent",
  "data-analytics-bi-agent": "data analytics agent OR business intelligence agent OR bi agent",
  "legal-compliance-agent": "legal agent OR compliance agent OR contract ai",
  "security-soc-agent": "security agent OR soc agent OR cyber security agent",
  "healthcare-ops-agent": "healthcare agent OR medical agent OR clinical agent",
  "recruiting-hr-agent": "recruiting agent OR hr agent OR hiring agent",
  "supply-chain-procurement-agent": "supply chain agent OR procurement agent OR purchasing agent",
  "industrial-field-ops-agent": "industrial agent OR field operations agent OR maintenance agent",
};

const DIRECTION_GITHUB_EXTRA_QUERIES: Record<string, string[]> = {
  "industrial-field-ops-agent": [
    "field service agent OR manufacturing agent OR maintenance automation",
  ],
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function githubApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "agent-radar/0.1",
  };
  const token = process.env["GITHUB_TOKEN"];
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function timestampForDate(date: string | undefined): string {
  return `${date ?? new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
}

function repoToRawSignal(repo: GitHubSearchRepository, direction: DirectionCatalogEntry, date: string | undefined): RawSignal | undefined {
  const repoUrl = repo.html_url ?? (repo.full_name ? `https://github.com/${repo.full_name}` : undefined);
  if (!repoUrl) return undefined;
  const repoFullName = repo.full_name ?? extractGitHubRepoFullName(repoUrl);
  if (!repoFullName) return undefined;
  const topics = repo.topics ?? [];
  return {
    project_name: repo.name ?? repoFullName,
    repo_url: `https://github.com/${repoFullName}`,
    source: "mission_github_search",
    timestamp: timestampForDate(date),
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    issues: repo.open_issues_count,
    tags: [
      ...topics,
      "mission-github-search",
      `mission-direction:${direction.direction_key}`,
      direction.direction_key,
      ...direction.required_terms,
    ],
    description: repo.description ?? "",
    metrics_source: "github_api",
    metrics_trust_score: 0.85,
  };
}

export function directionGithubSearchTemplates(direction: DirectionCatalogEntry): string[] {
  return [
    ...direction.query_packs.flatMap((pack) => pack.templates),
    DIRECTION_GITHUB_QUERIES[direction.direction_key] ?? direction.query_packs[0]?.templates[0] ?? direction.direction_key,
    ...(DIRECTION_GITHUB_EXTRA_QUERIES[direction.direction_key] ?? []),
  ].filter((template, index, templates) => template.trim() && templates.indexOf(template) === index);
}

async function fetchDirectionSignalsFromGitHub(
  direction: DirectionCatalogEntry,
  date: string | undefined,
): Promise<{ signals: RawSignal[]; attemptedQueryCount: number }> {
  const seen = new Set<string>();
  const signals: RawSignal[] = [];
  const templates = directionGithubSearchTemplates(direction);
  let attemptedQueryCount = 0;

  for (const template of templates) {
    if (signals.length >= MISSION_GITHUB_PER_DIRECTION_LIMIT) break;
    attemptedQueryCount += 1;
    const url = new URL("https://api.github.com/search/repositories");
    url.searchParams.set("q", `${template} in:name,description,topics stars:>1`);
    url.searchParams.set("sort", "updated");
    url.searchParams.set("order", "desc");
    url.searchParams.set("per_page", "20");

    const response = await fetch(url, { headers: githubApiHeaders() });
    if (!process.env["GITHUB_TOKEN"]) await sleep(6500);
    if (!response.ok) {
      throw new Error(`GitHub Search returned HTTP ${response.status} for ${direction.direction_key}`);
    }
    const body = (await response.json()) as GitHubSearchResponse;
    for (const repo of body.items ?? []) {
      const signal = repoToRawSignal(repo, direction, date);
      if (!signal) continue;
      const key = extractGitHubRepoFullName(signal.repo_url).toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      signals.push(signal);
      if (signals.length >= MISSION_GITHUB_PER_DIRECTION_LIMIT) break;
    }
  }

  return { signals, attemptedQueryCount };
}

export async function searchGithubRepositoriesForDirection(input: {
  direction: DirectionCatalogEntry;
  projects: Array<NormalizedProject | ScoredProject["project"]>;
  date?: string;
  enableLiveSearch?: boolean;
}): Promise<MissionScoutSearchResult> {
  const lane_hits: MissionScoutSearchResult["lane_hits"] = {
    canonical: 0,
    "job-to-be-done": 0,
    "user-speak-or-ecosystem": 0,
    "adjacent-software": 0,
    ecosystem: 0,
    "user-speak": 0,
  };
  const repo_candidates: MissionScoutSearchResult["repo_candidates"] = [];
  const raw_signals: RawSignal[] = [];
  let rawHits = 0;
  let normalizedHits = 0;
  let qualityPassedHits = 0;
  let liveQueryCount = 0;

  for (const project of input.projects) {
    if (!directionMatchesProject(project, input.direction)) continue;
    rawHits += 1;
    normalizedHits += 1;

    const matchedLanes = directionLaneHits(project, input.direction);
    for (const lane of matchedLanes) {
      lane_hits[lane] = (lane_hits[lane] ?? 0) + 1;
    }

    qualityPassedHits += 1;
    repo_candidates.push({
      repo_full_name: project.repo_full_name,
      repo_url: project.repo_url,
    });
  }

  if (input.enableLiveSearch) {
    const liveSearch = await fetchDirectionSignalsFromGitHub(input.direction, input.date);
    liveQueryCount = liveSearch.attemptedQueryCount;
    const liveSignals = liveSearch.signals;
    for (const signal of liveSignals) {
      const repoFullName = extractGitHubRepoFullName(signal.repo_url);
      if (!repoFullName) continue;
      const key = repoFullName.toLowerCase();
      if (repo_candidates.some((candidate) => candidate.repo_full_name.toLowerCase() === key)) continue;
      rawHits += 1;
      normalizedHits += 1;
      qualityPassedHits += 1;
      raw_signals.push(signal);
      repo_candidates.push({
        repo_full_name: repoFullName,
        repo_url: signal.repo_url,
      });
    }
  }

  const quantityTargetMet =
    rawHits >= PROJECT_SEARCH_CONSTANTS.directionRawHitsMin &&
    normalizedHits >= PROJECT_SEARCH_CONSTANTS.directionNormalizedHitsMin &&
    qualityPassedHits >= PROJECT_SEARCH_CONSTANTS.directionQualityPassedHitsMin;

  return {
    status: "ok",
    raw_hits: rawHits,
    normalized_hits: normalizedHits,
    quality_passed_hits: qualityPassedHits,
    lane_hits,
    repo_candidates,
    raw_signals,
    query_count: Math.max(input.direction.query_packs.reduce((sum, pack) => sum + pack.templates.length, 0), liveQueryCount),
    search_exhausted: Boolean(input.enableLiveSearch && !quantityTargetMet),
  };
}
