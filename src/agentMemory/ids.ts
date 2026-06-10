import fs from "node:fs";
import path from "node:path";
import { sha256Text } from "./fs.ts";
import { normalizePathList, primaryScopeSlug, slugify } from "./paths.ts";
import type { ArtifactType, Domain, Subdomain, TaskKind } from "./types.ts";

export interface TaskIdAllocationInput {
  rootDir: string;
  taskDate: string;
  domain: Domain | null;
  taskKind: TaskKind | null;
  targetPaths: string[];
}

export interface TaskReuseDescriptor {
  domain: Domain | null;
  taskKind: TaskKind | null;
  artifactTypes: ArtifactType[];
  targetPaths: string[];
  deliveryIntent: string;
}

export interface SkillIdInput {
  origin: "manual" | "learned";
  domain: Domain;
  subdomain: Subdomain;
  taskKinds: TaskKind[];
  artifactTypes: ArtifactType[];
  targetPaths: string[];
  goalTerms: string[];
  existingSkillIds: Set<string>;
}

export function allocateNextTaskId(input: TaskIdAllocationInput): string {
  const compactDate = input.taskDate.replace(/-/g, "");
  const domainPart = input.domain ?? "unspecified";
  const taskKindPart = input.taskKind ?? "unspecified";
  const pathSlug = slugify(normalizePathList(input.targetPaths)[0] ?? "no-path");
  const prefix = `task-${compactDate}-${domainPart}-${taskKindPart}-${pathSlug}-`;
  const pattern = new RegExp(`^${escapeRegExp(prefix)}(\\d+)(?:\\.json)?$`);
  let maxSequence = 0;

  for (const relativeDir of [`data/agent-memory/routing/${input.taskDate}`, `data/agent-memory/tasks/${input.taskDate}`]) {
    const fullDir = path.join(input.rootDir, relativeDir);
    if (!fs.existsSync(fullDir)) continue;
    for (const entry of fs.readdirSync(fullDir)) {
      const match = entry.match(pattern);
      if (!match) continue;
      maxSequence = Math.max(maxSequence, Number.parseInt(match[1] ?? "0", 10));
    }
  }

  return `${prefix}${String(maxSequence + 1).padStart(2, "0")}`;
}

export function claimNextTaskId<T>(input: TaskIdAllocationInput, attempt: (taskId: string) => T): T {
  for (let tries = 0; tries < 1024; tries += 1) {
    const taskId = allocateNextTaskId(input);
    try {
      return attempt(taskId);
    } catch (error) {
      if (isAlreadyExistsError(error)) continue;
      throw error;
    }
  }
  throw new Error("task-id-allocation-exhausted");
}

export function shouldReuseTaskId(previousTask: TaskReuseDescriptor, currentTask: TaskReuseDescriptor): boolean {
  if (previousTask.domain !== currentTask.domain) return false;
  if (previousTask.taskKind !== currentTask.taskKind) return false;

  const previousArtifacts = stableKey(previousTask.artifactTypes);
  const currentArtifacts = stableKey(currentTask.artifactTypes);
  if (previousArtifacts !== currentArtifacts) return false;

  const previousPaths = stableKey(normalizePathList(previousTask.targetPaths));
  const currentPaths = stableKey(normalizePathList(currentTask.targetPaths));
  if (previousPaths !== currentPaths) return false;

  return true;
}

export function buildSkillId(input: SkillIdInput): string {
  const primaryGoal = [...input.goalTerms].sort((left, right) => left.localeCompare(right))[0];
  const intentSource = primaryGoal ?? `${input.taskKinds[0] ?? "generic"}-${input.artifactTypes[0] ?? "generic"}`;
  const base = `${input.origin}.${input.domain}.${input.subdomain}.${slugify(intentSource)}`;
  if (!input.existingSkillIds.has(base)) return base;

  const scopeHash8 = sha256Text(
    JSON.stringify({
      domain: input.domain,
      subdomain: input.subdomain,
      task_kinds: [...input.taskKinds].sort((left, right) => left.localeCompare(right)),
      artifact_types: [...input.artifactTypes].sort((left, right) => left.localeCompare(right)),
      target_paths: normalizePathList(input.targetPaths),
      goal_terms: [...input.goalTerms].sort((left, right) => left.localeCompare(right)),
    }),
  ).slice(0, 8);

  return `${base}.${scopeHash8}`;
}

export function buildFactId(factType: string, relatedPaths: string[], title: string): string {
  const scopeSlug = primaryScopeSlug(relatedPaths);
  return `${factType}.${scopeSlug}.${slugify(title)}`;
}

export function allocateNextEventId(rootDir: string, eventDate: string, skillId: string): string {
  const lifecycleDir = path.join(rootDir, "data", "agent-memory", "lifecycle", eventDate);
  const pattern = new RegExp(`^${escapeRegExp(skillId)}\\.evt-(\\d+)\\.json$`);
  let maxSequence = 0;

  if (fs.existsSync(lifecycleDir)) {
    for (const entry of fs.readdirSync(lifecycleDir)) {
      const match = entry.match(pattern);
      if (!match) continue;
      maxSequence = Math.max(maxSequence, Number.parseInt(match[1] ?? "0", 10));
    }
  }

  return `${skillId}.evt-${String(maxSequence + 1).padStart(4, "0")}`;
}

export function claimNextEventId<T>(rootDir: string, eventDate: string, skillId: string, attempt: (eventId: string) => T): T {
  for (let tries = 0; tries < 1024; tries += 1) {
    const eventId = allocateNextEventId(rootDir, eventDate, skillId);
    try {
      return attempt(eventId);
    } catch (error) {
      if (isAlreadyExistsError(error)) continue;
      throw error;
    }
  }
  throw new Error(`event-id-allocation-exhausted:${skillId}`);
}

function stableKey(values: string[]): string {
  return JSON.stringify([...values].sort((left, right) => left.localeCompare(right)));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isAlreadyExistsError(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(error && typeof error === "object" && "code" in error && (error as NodeJS.ErrnoException).code === "EEXIST");
}
