import type { RawSignal } from "../types.ts";
import { extractGitHubRepoFullName } from "./githubMetrics.ts";
import { inferTags } from "./parse.ts";

interface TrendshiftRepoPayload {
  repo_url: string;
  project_name?: string;
  date?: string;
  stars?: number;
  star_delta?: number;
  forks?: number;
  issues?: number;
  PR?: number;
  description?: string;
  tags?: string[];
}

function htmlDecode(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanText(text: string): string {
  return htmlDecode(text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function decodeEscapedText(text: string | undefined): string {
  if (!text) return "";
  return text
    .replace(/\\u([\da-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\"/g, '"')
    .replace(/\\n/g, " ")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\\\/g, "\\")
    .replace(/\\\//g, "/");
}

function parseMetricValue(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const match = trimmed.match(/^([\d,.]+)\s*([kKmM])?$/);
  if (!match?.[1]) return undefined;

  const base = Number.parseFloat(match[1].replace(/,/g, ""));
  if (!Number.isFinite(base)) return undefined;
  const suffix = match[2]?.toLowerCase();
  if (suffix === "k") return Math.round(base * 1_000);
  if (suffix === "m") return Math.round(base * 1_000_000);
  return Math.round(base);
}

function buildRawSignal(payload: TrendshiftRepoPayload, timestamp: string): RawSignal | undefined {
  const repoFullName = extractGitHubRepoFullName(payload.repo_url);
  if (!repoFullName) return undefined;

  const description = payload.description?.trim();
  const textForTags = [description ?? "", ...(payload.tags ?? [])].join(" ");
  const tags = [...new Set([...(payload.tags ?? []), ...inferTags(textForTags)])];

  return {
    project_name: payload.project_name?.trim() || repoFullName,
    repo_url: `https://github.com/${repoFullName}`,
    source: "trendshift",
    timestamp: payload.date?.trim() || timestamp,
    stars: payload.stars,
    star_delta: payload.star_delta,
    forks: payload.forks,
    issues: payload.issues,
    PR: payload.PR,
    tags,
    description,
  };
}

function parseScriptPayload(html: string, timestamp: string): RawSignal[] {
  const rows: RawSignal[] = [];
  const scriptMatch = html.match(/<script[^>]*id=["']__TRENDshift_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!scriptMatch?.[1]) return rows;

  let parsed: unknown;
  try {
    parsed = JSON.parse(htmlDecode(scriptMatch[1]));
  } catch {
    return rows;
  }

  const repos = Array.isArray((parsed as { repos?: unknown[] })?.repos)
    ? ((parsed as { repos: unknown[] }).repos as TrendshiftRepoPayload[])
    : [];

  for (const repo of repos) {
    const signal = buildRawSignal(repo, timestamp);
    if (signal) rows.push(signal);
  }

  return rows;
}

function parseArticleCards(html: string, timestamp: string): RawSignal[] {
  const rows: RawSignal[] = [];
  const articleRe = /<article\b([^>]*)data-repo-url=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/article>/gi;

  for (const match of html.matchAll(articleRe)) {
    const attributes = `${match[1] ?? ""} ${match[3] ?? ""}`;
    const repoUrl = match[2];
    const body = match[4] ?? "";
    const descriptionMatch = body.match(/<p\b[^>]*class=["'][^"']*description[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
    const projectNameMatch = body.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i);
    const starsAttr = attributes.match(/data-stars=["']([^"']+)["']/i)?.[1];
    const starDeltaAttr = attributes.match(/data-star-delta=["']([^"']+)["']/i)?.[1];
    const forksAttr = attributes.match(/data-forks=["']([^"']+)["']/i)?.[1];
    const issuesAttr = attributes.match(/data-issues=["']([^"']+)["']/i)?.[1];
    const prAttr = attributes.match(/data-pr=["']([^"']+)["']/i)?.[1];
    const tagsAttr = attributes.match(/data-tags=["']([^"']+)["']/i)?.[1];

    const description = descriptionMatch?.[1] ? cleanText(descriptionMatch[1]) : undefined;
    const projectName = projectNameMatch?.[1] ? cleanText(projectNameMatch[1]) : undefined;
    const tags = tagsAttr
      ?.split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const signal = buildRawSignal(
      {
        repo_url: repoUrl,
        project_name: projectName,
        stars: parseMetricValue(starsAttr),
        star_delta: parseMetricValue(starDeltaAttr),
        forks: parseMetricValue(forksAttr),
        issues: parseMetricValue(issuesAttr),
        PR: parseMetricValue(prAttr),
        description,
        tags,
      },
      timestamp,
    );
    if (signal) rows.push(signal);
  }

  return rows;
}

function flightBlockWindow(html: string, matchIndex: number): string {
  const start = Math.max(0, html.lastIndexOf('\\"id\\":', matchIndex));
  const socialMentionsIndex = html.indexOf('\\"social_mention_platforms\\":[', matchIndex);
  const end = socialMentionsIndex === -1 ? Math.min(html.length, matchIndex + 1800) : socialMentionsIndex;
  return html.slice(start, end);
}

function extractFlightTags(block: string): string[] {
  const tagsBlock = block.match(/\\"tags\\":\[(.*?)\],?$/s)?.[1] ?? "";
  return [...tagsBlock.matchAll(/\\"name\\":\\"([^\\"]+)\\"/g)]
    .map((item) => decodeEscapedText(item[1]).trim())
    .filter(Boolean);
}

function flightMetric(block: string, field: "repository_stars" | "repository_forks"): number | undefined {
  const raw = Number.parseInt(block.match(new RegExp(`\\\\"${field}\\\\":(\\d+)`))?.[1] ?? "", 10);
  return Number.isFinite(raw) ? raw : undefined;
}

function buildFlightSignal(fullName: string, block: string, timestamp: string): RawSignal | undefined {
  const repoDate = decodeEscapedText(block.match(/\\"date\\":\\"([^\\"]+)\\"/)?.[1]);
  const description = decodeEscapedText(
    block.match(/\\"repository_description\\":\\"([\s\S]*?)\\",\\"repository_created_at\\":/)?.[1],
  ).trim();
  return buildRawSignal(
    {
      repo_url: `https://github.com/${fullName}`,
      project_name: fullName,
      date: repoDate || timestamp,
      stars: flightMetric(block, "repository_stars"),
      forks: flightMetric(block, "repository_forks"),
      description,
      tags: extractFlightTags(block),
    },
    timestamp,
  );
}

function parseNextFlightPayload(html: string, timestamp: string): RawSignal[] {
  const rowsByRepo = new Map<string, RawSignal>();
  const fullNameRe = /\\"full_name\\":\\"([^\\"]+)\\"/g;

  for (const match of html.matchAll(fullNameRe)) {
    const fullName = decodeEscapedText(match[1]);
    const block = flightBlockWindow(html, match.index ?? 0);
    const signal = buildFlightSignal(fullName, block, timestamp);

    if (signal) rowsByRepo.set(signal.repo_url.toLowerCase(), signal);
  }

  return [...rowsByRepo.values()];
}

export function parseTrendshiftSignals(html: string, timestamp: string): RawSignal[] {
  const fromNextFlight = parseNextFlightPayload(html, timestamp);
  if (fromNextFlight.length > 0) return fromNextFlight;
  const fromScript = parseScriptPayload(html, timestamp);
  if (fromScript.length > 0) return fromScript;
  return parseArticleCards(html, timestamp);
}
