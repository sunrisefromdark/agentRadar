import { normalizePathList } from "./paths.ts";
import type { LearnedSkillMetadata, ManualSkillMetadata, ManualSkillRegistrySourceState } from "./types.ts";

export type DriftEvent =
  | {
      kind: "global-root";
    }
  | {
      kind: "manual-source";
      changed_paths: string[];
    }
  | {
      kind: "failure-sequence";
      skill_id: string;
      consecutive_failures?: number;
      consecutive_timeouts?: number;
    }
  | {
      kind: "fact-source";
      changed_fact_ids: string[];
      changed_paths: string[];
      constraint_tags: string[];
      gate_ids: string[];
      related_paths: string[];
    }
  | {
      kind: "skill-self";
      skill_id: string;
    }
  | {
      kind: "script-runtime";
      changed_paths: string[];
    };

export interface DriftScanInput {
  now: string;
  manualSkills: ManualSkillMetadata[];
  learnedSkills: LearnedSkillMetadata[];
  manualSourceState: ManualSkillRegistrySourceState;
  events: DriftEvent[];
}

export interface DriftScanReceipt {
  scan_id: string;
  created_at: string;
  scope: "targeted" | "global-root";
  affected_skill_ids: string[];
  reasons: string[];
}

export function scanDriftImpacts(input: DriftScanInput): DriftScanReceipt {
  const routeable = [...input.manualSkills, ...input.learnedSkills].filter((skill) => skill.lifecycle_status !== "retired");
  const allSkillIds = routeable.map((skill) => skill.skill_id).sort((left, right) => left.localeCompare(right));
  const affected = new Set<string>();
  const reasons = new Set<string>();
  let global = false;

  for (const event of input.events) {
    const outcome = applyDriftEvent(event, input);
    if (outcome.scope === "global-root") {
      global = true;
    } else {
      for (const skillId of outcome.affected_skill_ids) affected.add(skillId);
    }
    for (const reason of outcome.reasons) reasons.add(reason);
  }

  return {
    scan_id: `drift-${input.now.replace(/[-:.TZ]/g, "").slice(0, 14)}`,
    created_at: input.now,
    scope: global ? "global-root" : "targeted",
    affected_skill_ids: (global ? allSkillIds : Array.from(affected)).sort((left, right) => left.localeCompare(right)),
    reasons: Array.from(reasons).sort((left, right) => left.localeCompare(right)),
  };
}

function applyDriftEvent(
  event: DriftEvent,
  input: DriftScanInput,
): { scope: "targeted" | "global-root"; affected_skill_ids: string[]; reasons: string[] } {
  if (event.kind === "global-root") {
    return { scope: "global-root", affected_skill_ids: [], reasons: ["global-root"] };
  }
  if (event.kind === "manual-source") {
    return resolveManualSourceImpact(event.changed_paths, input);
  }
  if (event.kind === "failure-sequence") {
    return resolveFailureSequenceImpact(event, input);
  }
  if (event.kind === "fact-source") {
    return resolveFactSourceImpact(event, input);
  }
  if (event.kind === "skill-self") {
    return resolveSkillSelfImpact(event.skill_id, input);
  }
  if (event.kind === "script-runtime") {
    return resolveScriptRuntimeImpact(event.changed_paths, input);
  }
  return { scope: "global-root", affected_skill_ids: [], reasons: ["unresolved-event-kind"] };
}

function resolveManualSourceSkillIds(changedPaths: string[], sourceState: ManualSkillRegistrySourceState): string[] {
  const matches = sourceState.source_docs.filter((snapshot) => changedPaths.includes(snapshot.path));
  if (matches.length !== 1) return [];
  const skillIds = matches[0]?.skill_ids ?? [];
  if (skillIds.length === 0) return [];
  return [...skillIds].sort((left, right) => left.localeCompare(right));
}

function collectLearnedDescendants(skills: LearnedSkillMetadata[], rootSkillIds: string[]): Set<string> {
  const descendants = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const skill of skills) {
      if (!skill.parent_skill_id) continue;
      if (rootSkillIds.includes(skill.parent_skill_id) || descendants.has(skill.parent_skill_id)) {
        if (!descendants.has(skill.skill_id)) {
          descendants.add(skill.skill_id);
          changed = true;
        }
      }
    }
  }
  return descendants;
}

function resolveManualSourceImpact(
  changedPaths: string[],
  input: DriftScanInput,
): { scope: "targeted" | "global-root"; affected_skill_ids: string[]; reasons: string[] } {
  const manualSkillIds = resolveManualSourceSkillIds(changedPaths, input.manualSourceState);
  if (manualSkillIds.length === 0) {
    return { scope: "global-root", affected_skill_ids: [], reasons: ["manual-source-unresolved"] };
  }
  const affected = new Set<string>(manualSkillIds);
  const manualSkills = input.manualSkills.filter((skill) => manualSkillIds.includes(skill.skill_id));
  const manualDomains = new Set(manualSkills.map((skill) => `${skill.domain}::${skill.subdomain}`));
  const descendants = collectLearnedDescendants(input.learnedSkills, manualSkillIds);

  for (const learned of input.learnedSkills) {
    if (manualDomains.has(`${learned.domain}::${learned.subdomain}`)) affected.add(learned.skill_id);
    if (descendants.has(learned.skill_id)) affected.add(learned.skill_id);
    if (learned.replacement_skill_id && manualSkillIds.includes(learned.replacement_skill_id)) affected.add(learned.skill_id);
    if (learned.conflict_with_skill_ids.some((skillId) => manualSkillIds.includes(skillId))) affected.add(learned.skill_id);
    if (manualSkills.some((manual) => manual.supersedes_learned_skill_ids?.includes(learned.skill_id))) affected.add(learned.skill_id);
  }

  return {
    scope: "targeted",
    affected_skill_ids: Array.from(affected).sort((left, right) => left.localeCompare(right)),
    reasons: ["manual-source"],
  };
}

function resolveFailureSequenceImpact(
  event: Extract<DriftEvent, { kind: "failure-sequence" }>,
  input: DriftScanInput,
): { scope: "targeted" | "global-root"; affected_skill_ids: string[]; reasons: string[] } {
  const shouldAffectSelf = (event.consecutive_failures ?? 0) >= 2 || (event.consecutive_timeouts ?? 0) >= 2;
  const exists = [...input.manualSkills, ...input.learnedSkills].some((skill) => skill.skill_id === event.skill_id);
  if (!shouldAffectSelf || !exists) {
    return { scope: "global-root", affected_skill_ids: [], reasons: ["failure-sequence-unresolved"] };
  }
  return {
    scope: "targeted",
    affected_skill_ids: [event.skill_id],
    reasons: ["failure-sequence"],
  };
}

function resolveFactSourceImpact(
  event: Extract<DriftEvent, { kind: "fact-source" }>,
  input: DriftScanInput,
): { scope: "targeted" | "global-root"; affected_skill_ids: string[]; reasons: string[] } {
  if (event.changed_fact_ids.length === 0) {
    return { scope: "global-root", affected_skill_ids: [], reasons: ["fact-source-unresolved"] };
  }

  const changedPaths = normalizePathList([...event.changed_paths, ...event.related_paths]);
  const changedGateIds = new Set(event.gate_ids);
  const changedTags = new Set(event.constraint_tags);
  const affected = new Set<string>();

  for (const skill of [...input.manualSkills, ...input.learnedSkills]) {
    if (skill.lifecycle_status === "retired") continue;
    const pathHit = hasPathOverlap(skill.watch_paths, changedPaths) || hasPathOverlap(skill.target_paths, changedPaths);
    const tagHit = skill.constraint_tags.some((tag) => changedTags.has(tag));
    const gateHit = skill.required_gates.some(
      (gate) => changedGateIds.has(gate.gate_id) || changedGateIds.has(gate.evidence_ref_hint),
    );
    if (pathHit || tagHit || gateHit) {
      affected.add(skill.skill_id);
    }
  }

  if (affected.size === 0) {
    return { scope: "global-root", affected_skill_ids: [], reasons: ["fact-source-unresolved"] };
  }
  return {
    scope: "targeted",
    affected_skill_ids: Array.from(affected).sort((left, right) => left.localeCompare(right)),
    reasons: ["fact-source"],
  };
}

function resolveSkillSelfImpact(
  skillId: string,
  input: DriftScanInput,
): { scope: "targeted" | "global-root"; affected_skill_ids: string[]; reasons: string[] } {
  const learned = input.learnedSkills.find((skill) => skill.skill_id === skillId);
  if (!learned) {
    return skillId.length > 0
      ? {
          scope: "targeted",
          affected_skill_ids: [skillId],
          reasons: ["skill-self"],
        }
      : { scope: "global-root", affected_skill_ids: [], reasons: ["skill-self-unresolved"] };
  }

  const affected = new Set<string>([skillId]);
  for (const skill of input.learnedSkills) {
    if (skill.parent_skill_id === skillId) affected.add(skill.skill_id);
    if (skill.replacement_skill_id === skillId) affected.add(skill.skill_id);
    if (skill.conflict_with_skill_ids.includes(skillId)) affected.add(skill.skill_id);
  }

  return {
    scope: "targeted",
    affected_skill_ids: Array.from(affected).sort((left, right) => left.localeCompare(right)),
    reasons: ["skill-self"],
  };
}

function resolveScriptRuntimeImpact(
  changedPaths: string[],
  input: DriftScanInput,
): { scope: "targeted" | "global-root"; affected_skill_ids: string[]; reasons: string[] } {
  const normalizedChangedPaths = normalizePathList(changedPaths);
  if (normalizedChangedPaths.length === 0) {
    return { scope: "global-root", affected_skill_ids: [], reasons: ["script-runtime-unresolved"] };
  }

  const runtimeConfigChanged = normalizedChangedPaths.some((currentPath) => currentPath === "package.json" || currentPath === "config.yaml");
  const affected = new Set<string>();
  for (const skill of [...input.manualSkills, ...input.learnedSkills]) {
    if (skill.lifecycle_status === "retired") continue;
    const scriptHit = hasScriptRuntimePathHit(skill, normalizedChangedPaths);
    const runtimeHit = runtimeConfigChanged && isRuntimeSensitiveSkill(skill);
    if (scriptHit || runtimeHit) {
      affected.add(skill.skill_id);
    }
  }

  if (affected.size === 0) {
    return { scope: "global-root", affected_skill_ids: [], reasons: ["script-runtime-unresolved"] };
  }
  return {
    scope: "targeted",
    affected_skill_ids: Array.from(affected).sort((left, right) => left.localeCompare(right)),
    reasons: ["script-runtime"],
  };
}

function hasPathOverlap(left: string[], right: string[]): boolean {
  const normalizedLeft = normalizePathList(left);
  const normalizedRight = normalizePathList(right);
  return normalizedLeft.some((leftPath) =>
    normalizedRight.some((rightPath) => leftPath === rightPath || (leftPath.endsWith("/") && rightPath.startsWith(leftPath)) || (rightPath.endsWith("/") && leftPath.startsWith(rightPath))),
  );
}

function hasScriptRuntimePathHit(skill: ManualSkillMetadata | LearnedSkillMetadata, normalizedChangedPaths: string[]): boolean {
  return hasPathOverlap(skill.script_refs, normalizedChangedPaths) || hasPathOverlap(skill.watch_paths, normalizedChangedPaths);
}

function isRuntimeSensitiveSkill(skill: ManualSkillMetadata | LearnedSkillMetadata): boolean {
  return skill.script_refs.length > 0 || skill.constraint_tags.includes("repo-completion-static") || hasRuntimeSensitiveGate(skill);
}

function hasRuntimeSensitiveGate(skill: ManualSkillMetadata | LearnedSkillMetadata): boolean {
  return skill.required_gates.some((gate) =>
    ["run-daily-dry-run", "run-weekly-dry-run", "score-dry-run", "build-kb-dry-run"].includes(gate.gate_id),
  );
}
