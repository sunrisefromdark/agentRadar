import fs from "node:fs";
import path from "node:path";
import { buildSkillId } from "./ids.ts";
import { sha256File, writeJsonAtomic } from "./fs.ts";
import { normalizePathList, normalizeWatchPaths } from "./paths.ts";
import type {
  ManualSkillMetadata,
  ManualSkillRegistrySourceState,
  ManualSkillSourceSnapshot,
  GateRequirement,
} from "./types.ts";

const MANUAL_SKILL_INDEX_PATH = "docs/specs/agent-work/manual-skill-index.json";
const MANUAL_SKILL_SOURCE_STATE_PATH = "docs/specs/agent-work/manual-skill-source-state.json";

interface ManualSkillSeed {
  title: string;
  source_doc_path: string;
  domain: ManualSkillMetadata["domain"];
  subdomain: ManualSkillMetadata["subdomain"];
  task_kinds: ManualSkillMetadata["task_kinds"];
  artifact_types: ManualSkillMetadata["artifact_types"];
  target_paths: string[];
  constraint_tags: string[];
  goal_terms: string[];
  required_gates: GateRequirement[];
}

const MANUAL_SKILL_SEEDS: ManualSkillSeed[] = [
  {
    title: "Code Implementation Skill",
    source_doc_path: "docs/specs/agent-work/CodeImplementation_Skill.md",
    domain: "code-implementation",
    subdomain: "feature-delivery",
    task_kinds: ["implement"],
    artifact_types: ["source-code", "test-code", "config"],
    target_paths: ["docs/specs/exec-plans/", "src/", "src/__tests__/"],
    constraint_tags: ["quality-gate", "exec-plan-implementation"],
    goal_terms: ["根据 exec-plan 实施代码落地"],
    required_gates: [
      {
        gate_id: "code-implementation-preflight",
        gate_kind: "preflight",
        gate_phase: "routing-precondition",
        evidence_source_type: "command-exit",
        evidence_ref_hint: "npm run code-implementation:preflight",
        freshness_rule: "per-task",
      },
    ],
  },
  {
    title: "Testing Skill",
    source_doc_path: "docs/specs/agent-work/TestingSkill.md",
    domain: "testing",
    subdomain: "regression-validation",
    task_kinds: ["draft", "revise", "verify"],
    artifact_types: ["test-code", "audit-receipt"],
    target_paths: ["src/__tests__/", "docs/specs/agent-work/TestingSkill.md"],
    constraint_tags: ["quality-gate", "testing-workflow"],
    goal_terms: ["测试设计", "补测", "回归验证"],
    required_gates: [
      {
        gate_id: "testing-skill-preflight",
        gate_kind: "preflight",
        gate_phase: "routing-precondition",
        evidence_source_type: "command-exit",
        evidence_ref_hint: "npm run testing-skill:preflight",
        freshness_rule: "per-task",
      },
    ],
  },
  {
    title: "Code Review Skill",
    source_doc_path: "docs/specs/agent-work/codeReviewSkill.md",
    domain: "artifact-review",
    subdomain: "code-review",
    task_kinds: ["review"],
    artifact_types: ["source-code", "test-code", "config"],
    target_paths: ["src/", "src/__tests__/", "config.yaml"],
    constraint_tags: ["quality-gate", "code-review"],
    goal_terms: ["code review"],
    required_gates: [
      {
        gate_id: "code-review-preflight",
        gate_kind: "preflight",
        gate_phase: "task-completion",
        evidence_source_type: "command-exit",
        evidence_ref_hint: "npm run code-review:preflight",
        freshness_rule: "per-task",
      },
    ],
  },
];

export interface ManualRegistryBuildResult {
  metadata: ManualSkillMetadata[];
  sourceState: ManualSkillRegistrySourceState;
}

export interface ManualRegistryValidationResult {
  status: "available" | "manual-registry-unavailable";
  reasons: string[];
  metadata: ManualSkillMetadata[];
  sourceState: ManualSkillRegistrySourceState | null;
}

export function buildInitialManualRegistry(rootDir: string, now: string): ManualRegistryBuildResult {
  const existingIds = new Set<string>();
  const metadata = MANUAL_SKILL_SEEDS.map((seed) => {
    const sourceHash = sha256File(rootDir, seed.source_doc_path);
    const skillId = buildSkillId({
      origin: "manual",
      domain: seed.domain,
      subdomain: seed.subdomain,
      taskKinds: seed.task_kinds,
      artifactTypes: seed.artifact_types,
      targetPaths: seed.target_paths,
      goalTerms: seed.goal_terms,
      existingSkillIds: existingIds,
    });
    existingIds.add(skillId);
    const watchPaths = normalizeWatchPaths([seed.source_doc_path, ...seed.target_paths]);

    return {
      skill_id: skillId,
      title: seed.title,
      origin: "manual" as const,
      trust_tier: "manual" as const,
      lifecycle_status: "stable" as const,
      drift_status: "trusted" as const,
      source_doc_path: seed.source_doc_path,
      source_doc_sha256: sourceHash,
      domain: seed.domain,
      subdomain: seed.subdomain,
      task_kinds: seed.task_kinds,
      artifact_types: seed.artifact_types,
      target_paths: seed.target_paths,
      constraint_tags: seed.constraint_tags,
      goal_terms: seed.goal_terms,
      required_gates: seed.required_gates,
      script_refs: [],
      watch_paths: watchPaths,
      updated_at: now,
    };
  });

  const sourceDocs: ManualSkillSourceSnapshot[] = metadata.map((item) => ({
    path: item.source_doc_path,
    content_sha256: item.source_doc_sha256,
    observed_at: now,
    skill_ids: [item.skill_id],
  }));

  return {
    metadata,
    sourceState: {
      generated_at: now,
      source_docs: sourceDocs,
    },
  };
}

export function writeManualRegistryFiles(rootDir: string, registry: ManualRegistryBuildResult): void {
  writeJsonAtomic(rootDir, MANUAL_SKILL_INDEX_PATH, registry.metadata);
  writeJsonAtomic(rootDir, MANUAL_SKILL_SOURCE_STATE_PATH, registry.sourceState);
}

export function validateManualRegistryFreshness(rootDir: string): ManualRegistryValidationResult {
  if (!fs.existsSync(path.join(rootDir, MANUAL_SKILL_INDEX_PATH)) || !fs.existsSync(path.join(rootDir, MANUAL_SKILL_SOURCE_STATE_PATH))) {
    return {
      status: "manual-registry-unavailable",
      reasons: ["manual-registry-files-missing"],
      metadata: [],
      sourceState: null,
    };
  }

  let metadata: ManualSkillMetadata[];
  let sourceState: ManualSkillRegistrySourceState;
  try {
    metadata = JSON.parse(fs.readFileSync(path.join(rootDir, MANUAL_SKILL_INDEX_PATH), "utf-8")) as ManualSkillMetadata[];
    sourceState = JSON.parse(
      fs.readFileSync(path.join(rootDir, MANUAL_SKILL_SOURCE_STATE_PATH), "utf-8"),
    ) as ManualSkillRegistrySourceState;
  } catch {
    return {
      status: "manual-registry-unavailable",
      reasons: ["manual-registry-json-invalid"],
      metadata: [],
      sourceState: null,
    };
  }
  const reasons = [
    ...validateMetadataEntries(rootDir, metadata, sourceState),
    ...validateSourceStateCoverage(metadata, sourceState),
    ...detectSourceDocConflicts(metadata),
  ];

  return {
    status: reasons.length > 0 ? "manual-registry-unavailable" : "available",
    reasons: Array.from(new Set(reasons)).sort((left, right) => left.localeCompare(right)),
    metadata,
    sourceState,
  };
}

function validateMetadataEntries(rootDir: string, metadata: ManualSkillMetadata[], sourceState: ManualSkillRegistrySourceState): string[] {
  const reasons: string[] = [];
  const sourceStateByPath = new Map(sourceState.source_docs.map((entry) => [entry.path, entry]));
  const metadataBySkillId = new Map<string, ManualSkillMetadata>();

  for (const item of metadata) {
    if (metadataBySkillId.has(item.skill_id)) {
      reasons.push(`duplicate-skill-id:${item.skill_id}`);
      continue;
    }
    metadataBySkillId.set(item.skill_id, item);

    reasons.push(...validateManualRootContract(item));
    reasons.push(...validateManualSourceBinding(rootDir, item, sourceStateByPath.get(item.source_doc_path)));
    reasons.push(...validateManualPathContracts(rootDir, item));
  }
  return reasons;
}

function validateSourceStateCoverage(metadata: ManualSkillMetadata[], sourceState: ManualSkillRegistrySourceState): string[] {
  const reasons: string[] = [];
  const metadataBySkillId = new Set(metadata.map((item) => item.skill_id));
  for (const snapshot of sourceState.source_docs) {
    for (const skillId of snapshot.skill_ids) {
      if (!metadataBySkillId.has(skillId)) {
        reasons.push(`manual-source-state-extra-skill:${snapshot.path}`);
      }
    }
  }
  return reasons;
}

function detectSourceDocConflicts(metadata: ManualSkillMetadata[]): string[] {
  const reasons: string[] = [];
  const sourceDocs = new Map<string, ManualSkillMetadata[]>();
  for (const item of metadata) {
    const group = sourceDocs.get(item.source_doc_path) ?? [];
    group.push(item);
    sourceDocs.set(item.source_doc_path, group);
  }

  for (const [sourceDocPath, items] of sourceDocs) {
    if (items.length < 2) continue;
    const scopeKeys = new Set(items.map((item) => JSON.stringify({
      domain: item.domain,
      task_kinds: item.task_kinds,
      artifact_types: item.artifact_types,
      required_gates: item.required_gates,
    })));
    if (scopeKeys.size > 1) {
      reasons.push(`manual-registry-conflict:${sourceDocPath}`);
    }
  }
  return reasons;
}

function validateManualRootContract(item: ManualSkillMetadata): string[] {
  const reasons: string[] = [];
  if (item.origin !== "manual" || item.trust_tier !== "manual") {
    reasons.push(`manual-root-contract-violation:${item.skill_id}`);
  }
  if (item.parent_skill_id !== undefined) {
    reasons.push(`manual-parent-skill-not-allowed:${item.skill_id}`);
  }
  return reasons;
}

function validateManualSourceBinding(
  rootDir: string,
  item: ManualSkillMetadata,
  sourceSnapshot: ManualSkillSourceSnapshot | undefined,
): string[] {
  const reasons: string[] = [];
  if (!sourceSnapshot) {
    reasons.push(`manual-source-state-missing:${item.source_doc_path}`);
    return reasons;
  }
  if (!sourceSnapshot.skill_ids.includes(item.skill_id)) {
    reasons.push(`manual-source-state-skill-mismatch:${item.source_doc_path}`);
  }
  if (sourceSnapshot.content_sha256 !== item.source_doc_sha256) {
    reasons.push(`manual-source-hash-mismatch:${item.source_doc_path}`);
  }
  if (!fs.existsSync(path.join(rootDir, item.source_doc_path))) {
    reasons.push(`manual-source-doc-missing:${item.source_doc_path}`);
    return reasons;
  }
  if (sha256File(rootDir, item.source_doc_path) !== item.source_doc_sha256) {
    reasons.push(`manual-source-hash-mismatch:${item.source_doc_path}`);
  }
  return reasons;
}

function validateManualPathContracts(rootDir: string, item: ManualSkillMetadata): string[] {
  const reasons: string[] = [];
  if (item.script_refs.some((scriptRef) => !fs.existsSync(path.join(rootDir, scriptRef)))) {
    reasons.push(`manual-script-ref-missing:${item.skill_id}`);
  }
  const expectedWatchPaths = normalizeWatchPaths([item.source_doc_path, ...normalizePathList(item.target_paths), ...normalizePathList(item.script_refs)]);
  if (JSON.stringify(expectedWatchPaths) !== JSON.stringify(normalizeWatchPaths(item.watch_paths))) {
    reasons.push(`manual-watch-paths-mismatch:${item.skill_id}`);
  }
  return reasons;
}
