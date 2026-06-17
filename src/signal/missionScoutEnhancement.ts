import fs from "node:fs";
import path from "node:path";
import { parseJsonObjectFromText } from "../jsonObject.ts";
import { callLlm } from "../llm.ts";
import { DIRECTION_CATALOG } from "./directionCatalog.ts";
import type { RawSignal } from "../types.ts";

export interface MissionScoutProjectEnhancement {
  repo_full_name: string;
  project_brief_cn: string;
  why_today_cn: string;
  source: "agent";
  provider: "deepseek";
  generated_at: string;
}

export interface MissionScoutEnhancementArtifact {
  date: string;
  generated_at: string;
  provider: "deepseek";
  entries: MissionScoutProjectEnhancement[];
}

type EnhancementDraft = {
  projects?: Array<{
    repo_full_name?: string;
    project_brief_cn?: string;
    why_today_cn?: string;
  }>;
};

const ENHANCEMENT_DIR = path.join("data", "discovery", "mission-scout-enhancements");

function repoFullNameFromUrl(repoUrl: string): string {
  return repoUrl.replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "");
}

function repoKey(signal: RawSignal): string {
  return repoFullNameFromUrl(signal.repo_url).toLowerCase();
}

function containsChineseText(value: string | undefined): boolean {
  return /[\u3400-\u9fff]/.test(value ?? "");
}

function compactTextLength(value: string): number {
  return value.replace(/\s+/g, "").length;
}

function directionDisplayNames(signal: RawSignal): string[] {
  const haystack = [signal.project_name, signal.repo_url, signal.description, ...signal.tags].join(" ").toLowerCase();
  return DIRECTION_CATALOG.filter((direction) => {
    if (haystack.includes(direction.direction_key.toLowerCase())) return true;
    return direction.query_packs.some((pack) =>
      pack.templates.some((template) =>
        template
          .toLowerCase()
          .split(/\s+/)
          .filter((token) => token.length >= 4)
          .some((token) => haystack.includes(token)),
      ),
    );
  })
    .map((direction) => direction.display_name_cn)
    .slice(0, 3);
}

function validateDraftText(value: string | undefined, min: number, max: number): value is string {
  if (!value?.trim()) return false;
  if (!containsChineseText(value)) return false;
  const length = compactTextLength(value);
  return length >= min && length <= max && !/https?:\/\//i.test(value);
}

function buildMissionScoutEnhancementPrompt(signals: RawSignal[]): string {
  return [
    "你是 agent-radar 的项目研究编辑。请为 mission scout 候选项目生成中文介绍。",
    "这些项目虽然仍是待确认候选，但只要可能出现在项目库里，就必须和正式上榜项目一样有清楚、具体、中文的说明。",
    "只根据输入证据写，不要编造不存在的功能、客户、融资或性能数字。",
    "返回 exactly one JSON object and nothing else，不要 markdown。",
    "",
    "每个项目输出：",
    "- repo_full_name: 原样返回。",
    "- project_brief_cn: 50-90 个中文字符，说明它是什么、主要帮用户做什么，优先写具体能力和使用场景。",
    "- why_today_cn: 35-90 个中文字符，说明为什么作为候选值得继续观察，必须体现“待确认/候选观察”的边界。",
    "",
    JSON.stringify({
      projects: signals.map((signal) => ({
        repo_full_name: repoFullNameFromUrl(signal.repo_url),
        project_name: signal.project_name,
        repo_url: signal.repo_url,
        description: signal.description ?? "",
        tags: signal.tags,
        stars: signal.stars ?? null,
        star_delta: signal.star_delta ?? null,
        source: signal.source,
        direction_hints_cn: directionDisplayNames(signal),
      })),
    }),
  ].join("\n");
}

function parseDraft(text: string): EnhancementDraft {
  return parseJsonObjectFromText<EnhancementDraft>(text);
}

async function parseDraftWithRepair(text: string, parseError: unknown): Promise<EnhancementDraft> {
  const repaired = await callLlm(
    [
      "Rewrite the previous answer into valid JSON only.",
      "Return exactly one JSON object and nothing else.",
      "Do not use markdown fences.",
      "Escape any quotes inside JSON string values.",
      `Parse failure: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
      "",
      "Previous answer:",
      text,
    ].join("\n"),
    {
      providerName: "deepseek",
      maxTokens: 2600,
    },
  );
  return parseDraft(repaired);
}

function readExistingArtifact(date: string): MissionScoutEnhancementArtifact | null {
  const filepath = missionScoutEnhancementPath(date);
  if (!fs.existsSync(filepath)) return null;
  return JSON.parse(fs.readFileSync(filepath, "utf8")) as MissionScoutEnhancementArtifact;
}

function mergeEnhancements(
  date: string,
  existing: MissionScoutEnhancementArtifact | null,
  nextEntries: MissionScoutProjectEnhancement[],
): MissionScoutEnhancementArtifact {
  const byRepo = new Map<string, MissionScoutProjectEnhancement>();
  for (const entry of existing?.entries ?? []) byRepo.set(entry.repo_full_name.toLowerCase(), entry);
  for (const entry of nextEntries) byRepo.set(entry.repo_full_name.toLowerCase(), entry);
  return {
    date,
    generated_at: new Date().toISOString(),
    provider: "deepseek",
    entries: [...byRepo.values()].sort((left, right) => left.repo_full_name.localeCompare(right.repo_full_name)),
  };
}

export function missionScoutEnhancementPath(date: string): string {
  return path.join(ENHANCEMENT_DIR, `${date}.json`);
}

export async function generateMissionScoutEnhancements(args: {
  date: string;
  signals: RawSignal[];
  limit?: number;
  batchSize?: number;
}): Promise<MissionScoutEnhancementArtifact> {
  const existing = readExistingArtifact(args.date);
  const existingRepos = new Set((existing?.entries ?? []).map((entry) => entry.repo_full_name.toLowerCase()));
  const uniqueSignals = new Map<string, RawSignal>();
  for (const signal of args.signals) {
    const key = repoKey(signal);
    if (!existingRepos.has(key) && !uniqueSignals.has(key)) uniqueSignals.set(key, signal);
  }

  const limit = Math.max(0, args.limit ?? uniqueSignals.size);
  const batchSize = Math.max(1, args.batchSize ?? 8);
  const pendingSignals = [...uniqueSignals.values()].slice(0, limit);
  const generated: MissionScoutProjectEnhancement[] = [];

  const processBatch = async (batch: RawSignal[]): Promise<void> => {
    const response = await callLlm(buildMissionScoutEnhancementPrompt(batch), {
      providerName: "deepseek",
      maxTokens: 2600,
    });
    let draft: EnhancementDraft;
    try {
      draft = parseDraft(response);
    } catch (parseError) {
      try {
        draft = await parseDraftWithRepair(response, parseError);
      } catch (repairError) {
        if (batch.length > 1) {
          for (const signal of batch) {
            try {
              await processBatch([signal]);
            } catch {
              // Keep the rest of the visible project pool moving even when one
              // project repeatedly produces malformed JSON.
            }
          }
          return;
        }
        throw repairError;
      }
    }
    const draftByRepo = new Map((draft.projects ?? []).map((item) => [String(item.repo_full_name ?? "").toLowerCase(), item] as const));
    const generatedAt = new Date().toISOString();

    for (const signal of batch) {
      const repoFullName = repoFullNameFromUrl(signal.repo_url);
      const item = draftByRepo.get(repoFullName.toLowerCase());
      if (!validateDraftText(item?.project_brief_cn, 30, 110) || !validateDraftText(item?.why_today_cn, 20, 110)) {
        continue;
      }
      generated.push({
        repo_full_name: repoFullName,
        project_brief_cn: item.project_brief_cn.trim(),
        why_today_cn: item.why_today_cn.trim(),
        source: "agent",
        provider: "deepseek",
        generated_at: generatedAt,
      });
    }
  };

  for (let index = 0; index < pendingSignals.length; index += batchSize) {
    const batch = pendingSignals.slice(index, index + batchSize);
    await processBatch(batch);
  }

  const artifact = mergeEnhancements(args.date, existing, generated);
  fs.mkdirSync(ENHANCEMENT_DIR, { recursive: true });
  fs.writeFileSync(missionScoutEnhancementPath(args.date), `${JSON.stringify(artifact, null, 2)}\n`);
  return artifact;
}
