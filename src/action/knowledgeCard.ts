import type { KnowledgeCard, ScoredProject } from "../types.ts";

const HUMAN_SECTION_HEADERS = ["## 人工判断", "## Review Notes"] as const;

function formatTrustScore(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

export function knowledgeCardSlug(projectName: string): string {
  return projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function findSectionStart(markdown: string, header: string): number {
  const patterns = [`\n${header}\n`, `${header}\n`];
  for (const pattern of patterns) {
    const index = markdown.indexOf(pattern);
    if (index >= 0) return pattern.startsWith("\n") ? index + 1 : index;
  }
  return -1;
}

function extractSection(markdown: string, header: string): string | undefined {
  const start = findSectionStart(markdown, header);
  if (start < 0) return undefined;
  const afterHeader = markdown.indexOf("\n", start);
  if (afterHeader < 0) return `${header}\n`;

  const remainder = markdown.slice(afterHeader + 1);
  const nextHeaderOffset = remainder.search(/\n##\s+/);
  if (nextHeaderOffset < 0) return markdown.slice(start).trimEnd();
  return markdown.slice(start, afterHeader + 1 + nextHeaderOffset).trimEnd();
}

function extractHumanSections(existingMarkdown: string): string[] {
  return HUMAN_SECTION_HEADERS.map((header) => extractSection(existingMarkdown, header)).filter(
    (section): section is string => Boolean(section),
  );
}

export function buildKnowledgeCard(item: ScoredProject, updatedAt: string): KnowledgeCard {
  const project = item.project;
  const antiNoiseFlags = item.score.anti_noise_flags ?? [];
  const confidence = item.score.confidence ?? "medium";
  const antiNoise = antiNoiseFlags.length > 0 ? antiNoiseFlags.join(", ") : "none";
  const dailyDelta = project.star_delta_daily ?? "unavailable";
  const weeklyDelta = project.star_delta_weekly ?? "unavailable";
  return {
    project_name: project.project_name,
    repo_url: project.repo_url,
    summary: project.description || `${project.project_name} appeared in ${project.sources.join(", ")}.`,
    star_growth: `stars=${project.stars}, daily_delta=${dailyDelta}, delta_source=${project.star_delta_source ?? "unavailable"}, weekly_delta=${weeklyDelta}, persistence=${project.persistence_state}`,
    why_it_matters: `Score ${item.score.total_score} (${confidence} confidence, trust=${item.score.data_trust}/${formatTrustScore(item.score.trust_score)}). Paradigm signal: ${item.score.paradigm}. Anti-noise flags: ${antiNoise}.`,
    paradigm: item.score.paradigm,
    risks: item.score.risks,
    next_actions: item.score.next_actions,
    updated_at: updatedAt,
  };
}

function renderMachineSections(card: KnowledgeCard): string[] {
  return [
    `# ${card.project_name}`,
    "",
    `Repo: ${card.repo_url}`,
    "",
    "## Machine Summary",
    "",
    "## Summary",
    "",
    card.summary,
    "",
    "## Star Growth",
    "",
    card.star_growth,
    "",
    "## Why It Matters",
    "",
    card.why_it_matters,
    "",
    "## Paradigm",
    "",
    card.paradigm,
    "",
    "## Risks",
    "",
    ...card.risks.map((risk) => `- ${risk}`),
    "",
    "## Next Actions",
    "",
    ...card.next_actions.map((action) => `- ${action}`),
    "",
  ];
}

function defaultHumanSections(): string[] {
  return [
    "## 人工判断",
    "",
    "_待人工补充_",
    "",
    "## Review Notes",
    "",
    "_Add manual validation notes here._",
  ];
}

export function renderKnowledgeCard(card: KnowledgeCard, existingMarkdown?: string): string {
  const humanSections = existingMarkdown ? extractHumanSections(existingMarkdown) : [];

  return [
    ...renderMachineSections(card),
    ...(humanSections.length > 0 ? humanSections : defaultHumanSections()),
    "",
  ].join("\n");
}
