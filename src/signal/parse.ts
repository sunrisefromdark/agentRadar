import type { RawSignal, SignalSource } from "../types.ts";
import { extractGitHubRepoFullName } from "./githubMetrics.ts";

const GITHUB_URL_RE = /https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/g;

const KEYWORD_TAGS: Array<[RegExp, string]> = [
  [/agent|autonomous|swarm|workflow|copilot|assistant|智能体|助手|代理|多智能体|自主/i, "agent"],
  [/runtime|orchestrat|scheduler|sandbox|编排|调度|执行引擎|运行时|沙箱/i, "agent-runtime"],
  [/memory|remember|persistent|context|记忆|上下文|长期记忆/i, "memory"],
  [/skill|tool|mcp|plugin|extension|工具|技能|插件|函数调用/i, "tool-use"],
  [/infra|observability|eval|gateway|router|framework|sdk|基础设施|可观测|评估|网关|框架/i, "infra"],
  [/rag|retrieval|vector|embedding|knowledge|检索增强|向量|嵌入|知识库/i, "knowledge"],
  [/self[-\s]?improv|learn|feedback|reflection|自我改进|反馈|反思|学习闭环/i, "self-improving"],
  [/automation|automated|hands[-\s]?off|自动化|全自动|无人值守/i, "automation"],
];

function cleanRepoUrl(url: string): string {
  return url.replace(/[.,;:!?]+$/g, "");
}

export function inferTags(text: string): string[] {
  const tags = new Set<string>();
  for (const [pattern, tag] of KEYWORD_TAGS) {
    if (pattern.test(text)) tags.add(tag);
  }
  return [...tags];
}

export function inferStarDelta(text: string): number | undefined {
  const plusToday = text.match(/\+([\d,]+)\s*(?:today|stars?\s+today)?/i);
  if (plusToday?.[1]) return Number.parseInt(plusToday[1].replace(/,/g, ""), 10);

  const starsToday = text.match(/([\d,]+)\s+stars?\s+today/i);
  if (starsToday?.[1]) return Number.parseInt(starsToday[1].replace(/,/g, ""), 10);

  return undefined;
}

function lineEvidenceScore(line: string, tags: string[], starDelta: number | undefined): number {
  const urlCount = (line.match(GITHUB_URL_RE) ?? []).length;
  let score = line.trim().length;
  if (starDelta !== undefined) score += 40;
  score += tags.length * 15;
  if (/^\s*\|/.test(line)) score += 25;
  if (urlCount > 1) score -= (urlCount - 1) * 60;
  return score;
}

export function signalsFromMarkdown(markdown: string, source: SignalSource, timestamp: string): RawSignal[] {
  const rowsByRepo = new Map<string, RawSignal & { __score: number }>();

  for (const line of markdown.split(/\r?\n/)) {
    const urls = line.match(GITHUB_URL_RE) ?? [];
    for (const rawUrl of urls) {
      const repo_url = cleanRepoUrl(rawUrl);
      const repo_full_name = extractGitHubRepoFullName(repo_url);
      if (!repo_full_name) continue;
      const tags = inferTags(line);
      const star_delta = inferStarDelta(line);
      const candidate = {
        project_name: repo_full_name,
        repo_url,
        source,
        timestamp,
        star_delta,
        tags,
        description: line.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim(),
        __score: lineEvidenceScore(line, tags, star_delta),
      } satisfies RawSignal & { __score: number };

      const existing = rowsByRepo.get(repo_url);
      if (!existing || candidate.__score > existing.__score) {
        rowsByRepo.set(repo_url, candidate);
      }
    }
  }

  return [...rowsByRepo.values()].map(({ __score: _score, ...row }) => row);
}
