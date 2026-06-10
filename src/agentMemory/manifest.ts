import fs from "node:fs";
import path from "node:path";
import { readJsonFile, sha256File, writeJsonAtomic } from "./fs.ts";
import { listFiles } from "./fs.ts";
import { validateManualRegistryFreshness } from "./manualRegistry.ts";
import { detectInvalidRouteableSkillIds } from "./skillValidation.ts";
import type {
  LearnedSkillMetadata,
  ManifestInputSnapshot,
  ManualSkillMetadata,
  RoutingManifest,
  SkillRoutingIndexEntry,
  ProjectFactRecord,
  ManifestInputKind,
  SkillReuseReceipt,
} from "./types.ts";

const FACTS_INDEX_PATH = "data/agent-memory/facts/index.json";
const FACTS_SOURCE_STATE_PATH = "data/agent-memory/facts/source-state.json";
const MANUAL_SKILL_INDEX_PATH = "docs/specs/agent-work/manual-skill-index.json";
const MANUAL_SKILL_SOURCE_STATE_PATH = "docs/specs/agent-work/manual-skill-source-state.json";
const MANIFEST_PATH = "data/agent-memory/manifests/latest.json";
const RECENT_REUSE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export interface ManifestFreshnessResult {
  status: "fresh" | "stale";
  reasons: string[];
}

export function buildRoutingManifest(rootDir: string, now: string): RoutingManifest {
  const registry = validateManualRegistryFreshness(rootDir);
  if (registry.status !== "available" || !registry.sourceState) {
    throw new Error(`manual registry unavailable: ${registry.reasons.join(", ")}`);
  }

  if (!fs.existsSync(path.join(rootDir, FACTS_INDEX_PATH)) || !fs.existsSync(path.join(rootDir, FACTS_SOURCE_STATE_PATH))) {
    throw new Error("project facts are missing");
  }

  const facts = readJsonFile<ProjectFactRecord[]>(rootDir, FACTS_INDEX_PATH);
  const learnedStore = inspectLearnedSkillStore(rootDir);
  const routeableManualSkills = registry.metadata.filter((skill) => skill.lifecycle_status !== "retired");
  const invalidSkillIds = detectInvalidRouteableSkillIds([...routeableManualSkills, ...learnedStore.learnedSkills.filter((skill) => skill.lifecycle_status !== "retired")]);
  const routeableLearnedSkills = learnedStore.learnedSkills.filter(
    (skill) => skill.lifecycle_status !== "retired" && !invalidSkillIds.has(skill.skill_id),
  );
  const recentSuccessfulReuseCounts = collectRecentSuccessfulReuseCounts(rootDir, now);
  const routeableSkills = [
    ...routeableManualSkills
      .filter((skill) => !invalidSkillIds.has(skill.skill_id))
      .map((skill) => manualSkillToRoutingEntry(skill, recentSuccessfulReuseCounts.get(skill.skill_id) ?? 0)),
    ...routeableLearnedSkills.map((skill) => learnedSkillToRoutingEntry(skill, recentSuccessfulReuseCounts.get(skill.skill_id) ?? 0)),
  ];
  const inputSnapshots = collectManifestInputs(
    rootDir,
    now,
    routeableManualSkills.filter((skill) => !invalidSkillIds.has(skill.skill_id)).map((skill) => skill.source_doc_path),
    routeableLearnedSkills,
  );

  return {
    generated_at: now,
    input_snapshots: inputSnapshots,
    routing_index: routeableSkills,
    routeable_skill_ids: routeableSkills.map((entry) => entry.skill_id),
  };
}

export function validateManifestFreshness(rootDir: string): ManifestFreshnessResult {
  const manifestPath = path.join(rootDir, MANIFEST_PATH);
  if (!fs.existsSync(manifestPath)) {
    return {
      status: "stale",
      reasons: ["manifest-missing"],
    };
  }

  const registry = validateManualRegistryFreshness(rootDir);
  if (registry.status !== "available" || !registry.sourceState) {
    return {
      status: "stale",
      reasons: registry.reasons,
    };
  }

  let manifest: RoutingManifest;
  try {
    manifest = readJsonFile<RoutingManifest>(rootDir, MANIFEST_PATH);
  } catch {
    return {
      status: "stale",
      reasons: ["manifest-json-invalid"],
    };
  }
  const learnedStore = inspectLearnedSkillStore(rootDir);
  const routeableManualSkills = registry.metadata.filter((skill) => skill.lifecycle_status !== "retired");
  const invalidSkillIds = detectInvalidRouteableSkillIds([...routeableManualSkills, ...learnedStore.learnedSkills.filter((skill) => skill.lifecycle_status !== "retired")]);
  const routeableLearnedSkills = learnedStore.learnedSkills.filter(
    (skill) => skill.lifecycle_status !== "retired" && !invalidSkillIds.has(skill.skill_id),
  );
  const expectedInputs = collectManifestInputs(
    rootDir,
    manifest.generated_at,
    routeableManualSkills.filter((skill) => !invalidSkillIds.has(skill.skill_id)).map((skill) => skill.source_doc_path),
    routeableLearnedSkills,
  );
  const actualByPath = new Map(manifest.input_snapshots.map((entry) => [entry.path, entry]));
  const reasons: string[] = [...learnedStore.staleReasons];

  for (const expected of expectedInputs) {
    const existing = actualByPath.get(expected.path);
    if (!existing) {
      reasons.push(`manifest-missing-input-snapshot:${expected.path}`);
      continue;
    }
    if (existing.content_sha256 !== expected.content_sha256) {
      reasons.push(`manifest-hash-mismatch:${expected.path}`);
    }
  }

  for (const entry of manifest.input_snapshots) {
    if (!expectedInputs.some((candidate) => candidate.path === entry.path)) {
      reasons.push(`manifest-unexpected-input-snapshot:${entry.path}`);
    }
  }

  return {
    status: reasons.length > 0 ? "stale" : "fresh",
    reasons: Array.from(new Set(reasons)).sort((left, right) => left.localeCompare(right)),
  };
}

export function writeRoutingManifest(rootDir: string, manifest: RoutingManifest): void {
  writeJsonAtomic(rootDir, MANIFEST_PATH, manifest);
}

function collectManifestInputs(
  rootDir: string,
  observedAt: string,
  manualSourceDocs: string[],
  learnedSkills: LearnedSkillMetadata[],
): ManifestInputSnapshot[] {
  const inputs: ManifestInputSnapshot[] = [
    snapshot(rootDir, MANUAL_SKILL_INDEX_PATH, "manual-skill-index", observedAt),
    snapshot(rootDir, MANUAL_SKILL_SOURCE_STATE_PATH, "manual-skill-source-state", observedAt),
    snapshot(rootDir, FACTS_INDEX_PATH, "project-facts-index", observedAt),
    snapshot(rootDir, FACTS_SOURCE_STATE_PATH, "project-facts-source-state", observedAt),
  ];

  for (const sourceDocPath of manualSourceDocs) {
    inputs.push(snapshot(rootDir, sourceDocPath, "manual-skill-source-doc", observedAt));
  }

  for (const skill of learnedSkills) {
    const jsonPath = `data/agent-memory/learned/${skill.domain}/${skill.skill_id}.json`;
    const markdownPath = `data/agent-memory/learned/${skill.domain}/${skill.skill_id}.md`;
    inputs.push(snapshot(rootDir, jsonPath, "learned-skill-json", observedAt, skill.skill_id));
    inputs.push(snapshot(rootDir, markdownPath, "learned-skill-markdown", observedAt, skill.skill_id));
  }

  return inputs.sort((left, right) => left.path.localeCompare(right.path));
}

function readLearnedSkills(rootDir: string): LearnedSkillMetadata[] {
  const jsonPaths = listFiles(rootDir, "data/agent-memory/learned", [".json"]);
  return jsonPaths.map((relativePath) => readJsonFile<LearnedSkillMetadata>(rootDir, relativePath));
}

function inspectLearnedSkillStore(rootDir: string): {
  learnedSkills: LearnedSkillMetadata[];
  staleReasons: string[];
} {
  const learnedJsons = listFiles(rootDir, "data/agent-memory/learned", [".json"]);
  const learnedMarkdowns = new Set(listFiles(rootDir, "data/agent-memory/learned", [".md"]));
  const learnedSkills: LearnedSkillMetadata[] = [];
  const staleReasons: string[] = [];

  for (const jsonPath of learnedJsons) {
    const markdownPath = jsonPath.replace(/\.json$/, ".md");
    if (!learnedMarkdowns.has(markdownPath)) {
      staleReasons.push(`manifest-learned-sidecar-missing:${markdownPath}`);
      continue;
    }

    let skill: LearnedSkillMetadata;
    try {
      skill = readJsonFile<LearnedSkillMetadata>(rootDir, jsonPath);
    } catch {
      staleReasons.push(`manifest-learned-json-invalid:${jsonPath}`);
      continue;
    }
    const expectedDomainDir = jsonPath.split("/")[3];
    if (expectedDomainDir !== skill.domain) {
      staleReasons.push(`manifest-learned-domain-mismatch:${jsonPath}`);
      continue;
    }

    learnedSkills.push(skill);
  }

  for (const markdownPath of learnedMarkdowns) {
    const jsonPath = markdownPath.replace(/\.md$/, ".json");
    if (!fs.existsSync(path.join(rootDir, jsonPath))) {
      staleReasons.push(`manifest-learned-sidecar-missing:${jsonPath}`);
    }
  }

  return {
    learnedSkills,
    staleReasons: Array.from(new Set(staleReasons)).sort((left, right) => left.localeCompare(right)),
  };
}

function manualSkillToRoutingEntry(skill: ManualSkillMetadata, recentSuccessfulReuseCount: number): SkillRoutingIndexEntry {
  return {
    skill_id: skill.skill_id,
    trust_tier: "manual",
    lifecycle_status: "stable",
    drift_status: skill.drift_status,
    domain: skill.domain,
    task_kinds: skill.task_kinds,
    artifact_types: skill.artifact_types,
    target_paths: skill.target_paths,
    constraint_tags: skill.constraint_tags,
    goal_terms: skill.goal_terms,
    required_gates: skill.required_gates,
    successful_reuse_count: recentSuccessfulReuseCount,
  };
}

function learnedSkillToRoutingEntry(skill: LearnedSkillMetadata, recentSuccessfulReuseCount: number): SkillRoutingIndexEntry {
  return {
    skill_id: skill.skill_id,
    trust_tier: skill.trust_tier,
    lifecycle_status: skill.lifecycle_status,
    drift_status: skill.drift_status,
    domain: skill.domain,
    task_kinds: skill.task_kinds,
    artifact_types: skill.artifact_types,
    target_paths: skill.target_paths,
    constraint_tags: skill.constraint_tags,
    goal_terms: skill.goal_terms,
    required_gates: skill.required_gates,
    last_verified_at: skill.last_verified_at,
    successful_reuse_count: recentSuccessfulReuseCount,
  };
}

function snapshot(rootDir: string, relativePath: string, inputKind: ManifestInputKind, observedAt: string, skillId?: string): ManifestInputSnapshot {
  return {
    path: relativePath,
    input_kind: inputKind,
    content_sha256: sha256File(rootDir, relativePath),
    observed_at: observedAt,
    ...(skillId ? { skill_id: skillId } : {}),
  };
}

function collectRecentSuccessfulReuseCounts(rootDir: string, now: string): Map<string, number> {
  const cutoffMs = parseRecentReuseCutoffMs(now);
  if (cutoffMs === null) return new Map();
  const counts = new Map<string, number>();
  for (const relativePath of listFiles(rootDir, "data/agent-memory/reuse", [".json"])) {
    const receipt = readReuseReceipt(rootDir, relativePath);
    if (!receipt) continue;
    const recentSuccessfulAttempts = countRecentSuccessfulAttempts(receipt, cutoffMs);
    if (recentSuccessfulAttempts === 0) continue;
    counts.set(receipt.skill_id, (counts.get(receipt.skill_id) ?? 0) + recentSuccessfulAttempts);
  }
  return counts;
}

function parseRecentReuseCutoffMs(now: string): number | null {
  const cutoffMs = Date.parse(now) - RECENT_REUSE_WINDOW_MS;
  return Number.isNaN(cutoffMs) ? null : cutoffMs;
}

function readReuseReceipt(rootDir: string, relativePath: string): SkillReuseReceipt | null {
  try {
    return readJsonFile<SkillReuseReceipt>(rootDir, relativePath);
  } catch {
    return null;
  }
}

function countRecentSuccessfulAttempts(receipt: SkillReuseReceipt, cutoffMs: number): number {
  return receipt.attempts.filter((attempt) => isRecentSuccessfulReuseAttempt(attempt, cutoffMs)).length;
}

function isRecentSuccessfulReuseAttempt(attempt: SkillReuseReceipt["attempts"][number], cutoffMs: number): boolean {
  const attemptedAtMs = Date.parse(attempt.attempted_at);
  return !Number.isNaN(attemptedAtMs)
    && attemptedAtMs >= cutoffMs
    && attempt.execution_result === "success"
    && attempt.verification_result === "passed"
    && !attempt.fallback_used;
}
