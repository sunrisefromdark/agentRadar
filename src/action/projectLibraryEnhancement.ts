import path from "node:path";
import type { AppConfig } from "../config.ts";
import { callStructuredEnhancement, isEnhancementEnabled } from "./enhancementLlm.ts";
import { validateProjectBriefSpecificity } from "./projectBriefs.ts";
import { writeJsonFile } from "../storage/files.ts";
import type {
  EcosystemObserverEntry,
  ProjectLibraryEnhancementArtifact,
  ProjectLibraryEnhancementEntry,
  ScoredProject,
} from "../types.ts";

type ProjectLibraryEnhancementDraft = {
  projects?: Array<{
    repo_full_name?: string;
    project_brief_cn?: string;
  }>;
};

type ParsedProjectLibraryEnhancementDraft = {
  projects: Array<{
    repo_full_name: string;
    project_brief_cn?: string;
  }>;
};

function distinct<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function chunkItems<T>(items: T[], chunkSize: number): T[][] {
  const normalizedChunkSize = Math.max(1, chunkSize);
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += normalizedChunkSize) {
    chunks.push(items.slice(index, index + normalizedChunkSize));
  }
  return chunks;
}

function compactTextLength(value: string): number {
  return value.replace(/\s+/g, "").length;
}

function containsChineseText(value: string | undefined): boolean {
  return /[\u3400-\u9fff]/.test(value ?? "");
}

function normalizeBriefForComparison(value: string): string {
  return value.replace(/\s+/g, "").replace(/[，。、“”"'；：:,.!?！？()（）\-\s]/g, "").toLowerCase();
}

function projectLibraryEnhancementPath(date: string): string {
  return path.join("data", "reports", `${date}.project-library.json`);
}

function latestProjectLibraryEnhancementPath(): string {
  return path.join("data", "reports", "latest.project-library.json");
}

function buildObserverReuseEntries(observerEntries: EcosystemObserverEntry[]): Map<string, ProjectLibraryEnhancementEntry> {
  const byRepo = new Map<string, ProjectLibraryEnhancementEntry>();
  for (const entry of observerEntries) {
    const brief = typeof entry.project_brief_cn === "string" ? entry.project_brief_cn.trim() : "";
    if (!brief) continue;
    byRepo.set(entry.repo_full_name.toLowerCase(), {
      repo_full_name: entry.repo_full_name,
      project_brief_cn: brief,
      source: "observer",
      provider: entry.summary_source ?? "observer",
      generated_at: entry.observed_at,
    });
  }
  return byRepo;
}

function buildProjectLibraryEnhancementPrompt(batch: ScoredProject[]): string {
  return [
    "你是一个资深 AI / Agent 生态研究员。",
    "请根据下面的仓库证据，为项目库生成和 observer 页面同标准的中文项目简介。",
    "返回 exactly one JSON object and nothing else。",
    "不要使用 markdown，不要解释，不要输出多余字段。",
    "",
    "JSON schema:",
    "{",
    '  "projects": [',
    "    {",
    '      "repo_full_name": string,',
    '      "project_brief_cn": string',
    "    }",
    "  ]",
    "}",
    "",
    "要求:",
    '- project_brief_cn: 用通俗中文说明这项目到底在做什么，最好写成“它是什么 + 大家通常拿它来干什么”。',
    "- project_brief_cn: 优先使用 description、repo 名称语义、tag、score evidence、usage surface 线索，不要只写抽象范式词。",
    '- project_brief_cn: 除非现有输入真的无法判断项目用途，否则不要写“当前项目信息不足”或“缺少明确的功能描述”。',
    '- project_brief_cn: 不要机械改写 description，要总结成普通人更容易读懂的话。',
    "- project_brief_cn: 保持 50-100 个中文字符，优先写具体能力、对象和常见用法。",
    "- 不同项目不要复用同一句泛化文案。",
    "",
    JSON.stringify({
      projects: batch.map((project) => ({
        repo_full_name: project.project.repo_full_name,
        project_name: project.project.project_name,
        repo_url: project.project.repo_url,
        description: project.project.description,
        tags: project.project.tags,
        paradigm: project.score.paradigm,
        stars: project.project.stars,
        star_delta_daily: project.project.star_delta_daily ?? null,
        persistence_state: project.project.persistence_state,
        sources: project.project.sources,
        trust_flags: project.project.trust_flags,
        risks: project.score.risks,
        component_evidence: project.score.components.flatMap((component) => component.evidence).slice(0, 8),
        raw_signal_descriptions: distinct(
          project.project.raw_signals.map((signal) => signal.description?.trim() ?? "").filter((item) => item.length > 0),
        ).slice(0, 4),
        raw_signal_tags: distinct(project.project.raw_signals.flatMap((signal) => signal.tags ?? [])).slice(0, 12),
      })),
    }),
  ].join("\n");
}

function buildProjectLibraryEnhancementDraft(raw: unknown): ParsedProjectLibraryEnhancementDraft | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;
  const projects = Array.isArray(record.projects)
    ? record.projects
        .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : undefined))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item) => ({
          repo_full_name: typeof item.repo_full_name === "string" ? item.repo_full_name.trim() : "",
          project_brief_cn: typeof item.project_brief_cn === "string" ? item.project_brief_cn.trim() : undefined,
        }))
        .filter((item) => item.repo_full_name.length > 0)
    : [];

  return projects.length > 0 ? { projects } : undefined;
}

function validateEnhancedProjectBrief(project: ScoredProject, value: string | undefined): value is string {
  if (!value?.trim()) return false;
  if (!containsChineseText(value)) return false;
  const compactLength = compactTextLength(value);
  if (compactLength < 30 || compactLength > 120) return false;
  if (/https?:\/\//i.test(value) || /\[[^\]]+\]\([^)]+\)/.test(value)) return false;

  return (
    !validateProjectBriefSpecificity(
      {
        project_name: project.project.project_name,
        repo_full_name: project.project.repo_full_name,
        description: project.project.description,
        tags: project.project.tags,
        paradigm: project.score.paradigm,
        evidence: project.score.components.flatMap((component) => component.evidence),
        source_descriptions: distinct(
          project.project.raw_signals.map((signal) => signal.description?.trim() ?? "").filter((item) => item.length > 0),
        ),
        source_tags: distinct(project.project.raw_signals.flatMap((signal) => signal.tags ?? []).filter((item) => item.trim().length > 0)),
      },
      value,
    )
  );
}

async function generateBatchEnhancements(
  batch: ScoredProject[],
  config: AppConfig,
  acceptedBriefs: Map<string, string>,
): Promise<ProjectLibraryEnhancementEntry[]> {
  const raw = await callStructuredEnhancement<unknown>(buildProjectLibraryEnhancementPrompt(batch), config, {
    maxTokens: 2800,
  });
  const draft = buildProjectLibraryEnhancementDraft(raw);
  if (!draft?.projects.length) {
    if (batch.length <= 1) return [];
    const nested = await Promise.all(batch.map((project) => generateBatchEnhancements([project], config, acceptedBriefs)));
    return nested.flat();
  }

  const draftProjects = draft.projects;
  const draftByRepo = new Map(draftProjects.map((item) => [item.repo_full_name.toLowerCase(), item] as const));
  const generatedAt = new Date().toISOString();
  const accepted: ProjectLibraryEnhancementEntry[] = [];

  for (const project of batch) {
    const item = draftByRepo.get(project.project.repo_full_name.toLowerCase());
    if (!validateEnhancedProjectBrief(project, item?.project_brief_cn)) continue;
    const normalizedBrief = normalizeBriefForComparison(item.project_brief_cn);
    const duplicateRepo = acceptedBriefs.get(normalizedBrief);
    if (duplicateRepo && duplicateRepo !== project.project.repo_full_name.toLowerCase()) continue;
    acceptedBriefs.set(normalizedBrief, project.project.repo_full_name.toLowerCase());
    accepted.push({
      repo_full_name: project.project.repo_full_name,
      project_brief_cn: item.project_brief_cn.trim(),
      source: "agent",
      provider: config.llm.provider,
      generated_at: generatedAt,
    });
  }

  return accepted;
}

export async function generateProjectLibraryEnhancements(args: {
  date: string;
  scored: ScoredProject[];
  config: AppConfig;
  observerEntries?: EcosystemObserverEntry[];
  dryRun?: boolean;
}): Promise<ProjectLibraryEnhancementArtifact | null> {
  if (!isEnhancementEnabled(args.config) || args.scored.length === 0) return null;

  const batchSize = Math.max(1, Number.parseInt(process.env.PROJECT_LIBRARY_ENHANCEMENT_BATCH_SIZE ?? "6", 10) || 6);
  const acceptedBriefs = new Map<string, string>();
  const entries: ProjectLibraryEnhancementEntry[] = [];
  const observerReuseByRepo = buildObserverReuseEntries(args.observerEntries ?? []);

  for (const entry of observerReuseByRepo.values()) {
    const normalizedBrief = normalizeBriefForComparison(entry.project_brief_cn);
    if (!acceptedBriefs.has(normalizedBrief)) {
      acceptedBriefs.set(normalizedBrief, entry.repo_full_name.toLowerCase());
      entries.push(entry);
    }
  }

  const remainingScored = args.scored.filter((project) => !observerReuseByRepo.has(project.project.repo_full_name.toLowerCase()));

  for (const batch of chunkItems(remainingScored, batchSize)) {
    const generated = await generateBatchEnhancements(batch, args.config, acceptedBriefs);
    entries.push(...generated);
  }

  const artifact: ProjectLibraryEnhancementArtifact = {
    date: args.date,
    generated_at: new Date().toISOString(),
    provider: args.config.llm.provider,
    entries: entries.sort((left, right) => left.repo_full_name.localeCompare(right.repo_full_name)),
  };

  writeJsonFile(projectLibraryEnhancementPath(args.date), artifact, args.dryRun);
  writeJsonFile(latestProjectLibraryEnhancementPath(), artifact, args.dryRun);
  return artifact;
}
