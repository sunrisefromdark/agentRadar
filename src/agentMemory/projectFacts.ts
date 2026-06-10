import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { listApprovedSpecPaths } from "./approvals.ts";
import { writeJsonAtomic, sha256File } from "./fs.ts";
import { buildFactId } from "./ids.ts";
import { extractRepoPathsFromText, normalizePathList, normalizeWatchPaths } from "./paths.ts";
import type {
  GateRequirement,
  ProjectFactRecord,
  ProjectFactSourceSnapshot,
  ProjectFactSourceState,
} from "./types.ts";

const FACTS_INDEX_PATH = "data/agent-memory/facts/index.json";
const FACTS_SOURCE_STATE_PATH = "data/agent-memory/facts/source-state.json";

export interface ProjectFactsBuildResult {
  records: ProjectFactRecord[];
  sourceState: ProjectFactSourceState;
}

interface ProjectFactExportBlock {
  fact_type: ProjectFactRecord["fact_type"];
  title: string;
  summary: string;
  related_paths?: string[];
  constraint_tags?: string[];
  required_gates?: GateRequirement[];
}

export function buildProjectFacts(rootDir: string, now: string): ProjectFactsBuildResult {
  const allowList = listProjectFactSources(rootDir);
  const collected = new Map<string, ProjectFactRecord>();
  const sourceSnapshots: ProjectFactSourceSnapshot[] = [];

  for (const relativePath of allowList) {
    const mergedFacts = collectFactsForSource(rootDir, relativePath, now);
    mergeFactsIntoIndex(collected, mergedFacts);
    sourceSnapshots.push(buildSourceSnapshot(rootDir, relativePath, mergedFacts, now));
  }

  return {
    records: Array.from(collected.values()).sort((left, right) => left.fact_id.localeCompare(right.fact_id)),
    sourceState: {
      generated_at: now,
      source_docs: sourceSnapshots.sort((left, right) => left.path.localeCompare(right.path)),
    },
  };
}

function listProjectFactSources(rootDir: string): string[] {
  const fixedSources = [
    "docs/specs/repo-policy.md",
    "docs/specs/agent-work/README.md",
    "docs/specs/system-spec.md",
    "docs/specs/design-docs/architecture-boundaries.md",
  ];
  return Array.from(new Set([...fixedSources, ...listApprovedSpecPaths(rootDir)])).sort((left, right) => left.localeCompare(right));
}

function collectFactsForSource(rootDir: string, relativePath: string, now: string): ProjectFactRecord[] {
  return [...loadBuiltInFacts(rootDir, relativePath), ...extractProjectFactBlocks(rootDir, relativePath)].map((fact) =>
    materializeFact(relativePath, fact, now),
  );
}

function loadBuiltInFacts(
  rootDir: string,
  relativePath: string,
): Array<Omit<ProjectFactRecord, "fact_id" | "source_doc_paths" | "watch_paths" | "updated_at">> {
  if (relativePath === "docs/specs/repo-policy.md") return extractRepoPolicyFacts();
  if (relativePath === "docs/specs/agent-work/README.md") return extractAgentWorkReadmeFacts();
  if (relativePath === "docs/specs/system-spec.md") return extractSystemSpecFacts(rootDir);
  if (relativePath === "docs/specs/design-docs/architecture-boundaries.md") return extractArchitectureFacts(rootDir);
  return [];
}

function mergeFactsIntoIndex(collected: Map<string, ProjectFactRecord>, mergedFacts: ProjectFactRecord[]): void {
  for (const record of mergedFacts) {
    const existing = collected.get(record.fact_id);
    if (!existing) {
      collected.set(record.fact_id, record);
      continue;
    }
    assertEquivalentFact(existing, record);
    existing.source_doc_paths = normalizePathList([...existing.source_doc_paths, ...record.source_doc_paths]);
    existing.watch_paths = normalizeWatchPaths([...existing.watch_paths, ...record.watch_paths]);
  }
}

function assertEquivalentFact(existing: ProjectFactRecord, candidate: ProjectFactRecord): void {
  if (
    existing.summary !== candidate.summary ||
    JSON.stringify(existing.related_paths) !== JSON.stringify(candidate.related_paths) ||
    JSON.stringify(existing.constraint_tags) !== JSON.stringify(candidate.constraint_tags) ||
    JSON.stringify(existing.required_gates) !== JSON.stringify(candidate.required_gates)
  ) {
    throw new Error(`authority conflict on ${candidate.fact_id}`);
  }
}

function buildSourceSnapshot(rootDir: string, relativePath: string, mergedFacts: ProjectFactRecord[], now: string): ProjectFactSourceSnapshot {
  return {
    path: relativePath,
    content_sha256: sha256File(rootDir, relativePath),
    observed_at: now,
    derived_fact_ids: mergedFacts.map((record) => record.fact_id).sort((left, right) => left.localeCompare(right)),
  };
}

export function writeProjectFactsFiles(rootDir: string, facts: ProjectFactsBuildResult): void {
  writeJsonAtomic(rootDir, FACTS_INDEX_PATH, facts.records);
  writeJsonAtomic(rootDir, FACTS_SOURCE_STATE_PATH, facts.sourceState);
}

function materializeFact(sourceDocPath: string, input: Omit<ProjectFactRecord, "fact_id" | "source_doc_paths" | "watch_paths" | "updated_at">, now: string): ProjectFactRecord {
  const relatedPaths = normalizePathList(input.related_paths);
  return {
    ...input,
    fact_id: buildFactId(input.fact_type, relatedPaths, input.title),
    source_doc_paths: [sourceDocPath],
    related_paths: relatedPaths,
    watch_paths: normalizeWatchPaths([sourceDocPath, ...relatedPaths]),
    updated_at: now,
  };
}

function extractRepoPolicyFacts(): Omit<ProjectFactRecord, "fact_id" | "source_doc_paths" | "watch_paths" | "updated_at">[] {
  const relatedStaticPaths = ["docs/specs/repo-policy.md", "package.json", "src/", "app/", "scripts/", "tsconfig.json", "config.yaml"];
  return [
    {
      title: "agent-radar-project-runtime",
      fact_type: "repo-policy",
      summary:
        "如果 Agent 需要运行 pnpm test、pnpm typecheck、pnpm run-daily、pnpm run-weekly 或 pnpm build-kb，MUST 先进入项目对应的 Node.js / pnpm 运行环境，不能在未完成依赖安装或错误运行环境中直接执行。",
      related_paths: ["docs/specs/repo-policy.md", "package.json"],
      constraint_tags: ["repo-policy", "runtime-environment"],
      required_gates: [],
    },
    {
      title: "design-approval-before-exec-plan",
      fact_type: "repo-policy",
      summary:
        "Before the user explicitly approves a design document, do **not** create the corresponding `exec-plan`.\nOnly after the user explicitly approves the design document may the matching `docs/specs/exec-plans/*.exec-plan.md` be created or updated as the implementation plan.",
      related_paths: ["docs/specs/repo-policy.md", "docs/specs/design-docs/", "docs/specs/exec-plans/"],
      constraint_tags: ["repo-policy", "design-approval-rule"],
      required_gates: [
        {
          gate_id: "design-approved",
          gate_kind: "approval",
          gate_phase: "routing-precondition",
          evidence_source_type: "document-status",
          evidence_ref_hint: "docs/specs/design-docs/*.md",
          freshness_rule: "until-source-change",
        },
      ],
    },
    {
      title: "pnpm lint",
      fact_type: "quality-gate",
      summary: "pnpm lint",
      related_paths: relatedStaticPaths,
      constraint_tags: ["quality-gate", "repo-completion-static"],
      required_gates: [verificationGate("pnpm lint", "pnpm lint")],
    },
    {
      title: "pnpm typecheck",
      fact_type: "quality-gate",
      summary: "pnpm typecheck",
      related_paths: relatedStaticPaths,
      constraint_tags: ["quality-gate", "repo-completion-static"],
      required_gates: [verificationGate("pnpm typecheck", "pnpm typecheck")],
    },
    {
      title: "pnpm test",
      fact_type: "quality-gate",
      summary: "pnpm test",
      related_paths: relatedStaticPaths,
      constraint_tags: ["quality-gate", "repo-completion-static"],
      required_gates: [verificationGate("pnpm test", "pnpm test")],
    },
    {
      title: "pnpm run-daily -- --date <date> --dry-run",
      fact_type: "quality-gate",
      summary: "pnpm run-daily -- --date <date> --dry-run",
      related_paths: ["docs/specs/repo-policy.md", "package.json", "src/signal/", "src/filter/", "src/action/", "src/storage/", "data/reports/"],
      constraint_tags: ["quality-gate", "entrypoint-run-daily"],
      required_gates: [verificationGate("run-daily-dry-run", "pnpm run-daily -- --date <date> --dry-run")],
    },
    {
      title: "pnpm run-weekly -- --date <date> --dry-run",
      fact_type: "quality-gate",
      summary: "pnpm run-weekly -- --date <date> --dry-run",
      related_paths: ["docs/specs/repo-policy.md", "package.json", "src/action/", "src/storage/", "data/reports/"],
      constraint_tags: ["quality-gate", "entrypoint-run-weekly"],
      required_gates: [verificationGate("run-weekly-dry-run", "pnpm run-weekly -- --date <date> --dry-run")],
    },
    {
      title: "pnpm score -- --input <normalized-file>",
      fact_type: "quality-gate",
      summary: "pnpm score -- --input <normalized-file>",
      related_paths: ["docs/specs/repo-policy.md", "package.json", "src/filter/", "src/storage/", "data/normalized/", "data/scores/"],
      constraint_tags: ["quality-gate", "entrypoint-score"],
      required_gates: [verificationGate("score-dry-run", "pnpm score -- --input <normalized-file>")],
    },
    {
      title: "pnpm build-kb -- --since <date>",
      fact_type: "quality-gate",
      summary: "pnpm build-kb -- --since <date>",
      related_paths: ["docs/specs/repo-policy.md", "package.json", "src/action/", "src/storage/", "data/kb/"],
      constraint_tags: ["quality-gate", "entrypoint-build-kb"],
      required_gates: [verificationGate("build-kb-dry-run", "pnpm build-kb -- --since <date>")],
    },
  ];
}

function extractAgentWorkReadmeFacts(): Omit<ProjectFactRecord, "fact_id" | "source_doc_paths" | "watch_paths" | "updated_at">[] {
  return [
    taskGateFact(
      "npm run code-review:preflight",
      "代码落地审查任务的机器可检查硬约束是 `npm run code-review:preflight`，不通过就不得继续进入正式 code review 结论输出。",
      "code-review-preflight",
      "task-completion",
    ),
    taskGateFact(
      "npm run design-review:preflight",
      "design-doc review 任务在输出结论前必须先通过 `npm run design-review:preflight`。",
      "design-review-preflight",
      "task-completion",
    ),
    taskGateFact(
      "npm run exec-plan:review:preflight",
      "exec-plan review 任务在输出结论前必须先通过 `npm run exec-plan:review:preflight`。",
      "exec-plan-review-preflight",
      "task-completion",
    ),
    taskGateFact(
      "npm run code-implementation:preflight",
      "如果任务属于“根据 exec-plan 实施代码落地”，必须先读取 `CodeImplementation_Skill.md` 并通过 `npm run code-implementation:preflight`。",
      "code-implementation-preflight",
      "routing-precondition",
    ),
    taskGateFact(
      "npm run testing-skill:preflight",
      "如果任务属于测试设计、补测、回归验证，必须先读取 `TestingSkill.md` 并通过 `npm run testing-skill:preflight`。",
      "testing-skill-preflight",
      "routing-precondition",
    ),
  ];
}

function extractSystemSpecFacts(rootDir: string): Omit<ProjectFactRecord, "fact_id" | "source_doc_paths" | "watch_paths" | "updated_at">[] {
  const content = fs.readFileSync(path.join(rootDir, "docs/specs/system-spec.md"), "utf-8").replace(/\r\n/g, "\n");
  const results: Omit<ProjectFactRecord, "fact_id" | "source_doc_paths" | "watch_paths" | "updated_at">[] = [];

  const runtimeSection = content.match(/## 运行面\n\n\|[\s\S]*?\n\n## /);
  if (runtimeSection) {
    const rows = runtimeSection[0]
      .split("\n")
      .filter((line) => /^\|/.test(line) && !/---/.test(line))
      .slice(1);
    for (const row of rows) {
      const cells = row
        .split("|")
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0);
      if (cells.length < 4) continue;
      results.push({
        title: cells[1]!,
        fact_type: "stable-entrypoint",
        summary: `${cells[2]} ${cells[3]}`.trim(),
        related_paths: extractRepoPathsFromText(row),
        constraint_tags: ["stable-entrypoint"],
        required_gates: [],
      });
    }
  }

  const stableSection = content.match(/### 稳定\n\n([\s\S]*?)\n\n### /);
  if (stableSection?.[1]) {
    const bullets = stableSection[1].split("\n").map((line) => line.trim()).filter((line) => line.startsWith("- "));
    for (const bullet of bullets) {
      const repoPaths = extractRepoPathsFromText(bullet).filter((candidate) => candidate.startsWith("data/"));
      if (repoPaths.length === 0) continue;
      results.push({
        title: repoPaths[0]!,
        fact_type: "data-contract",
        summary: bullet.slice(2).trim(),
        related_paths: repoPaths,
        constraint_tags: ["data-contract"],
        required_gates: [],
      });
    }
  }

  return results;
}

function extractArchitectureFacts(rootDir: string): Omit<ProjectFactRecord, "fact_id" | "source_doc_paths" | "watch_paths" | "updated_at">[] {
  const content = fs.readFileSync(path.join(rootDir, "docs/specs/design-docs/architecture-boundaries.md"), "utf-8").replace(/\r\n/g, "\n");
  const allowed = new Map([
    ["独立趋势决策系统", "module-boundary"],
    ["rules-first scoring", "repo-policy"],
    ["Trendshift connector 可插拔", "module-boundary"],
    ["data/ 文件系统优先", "data-contract"],
  ] as const);
  const results: Omit<ProjectFactRecord, "fact_id" | "source_doc_paths" | "watch_paths" | "updated_at">[] = [];

  for (const [title, factType] of allowed.entries()) {
    const section = content.match(new RegExp(`## 决策：${escapeRegExp(title)}\\n\\n([\\s\\S]*?)(?:\\n\\n## |$)`));
    if (!section?.[1]) continue;
    const summary = section[1].trim();
    const constraintTags = [factType];
    results.push({
      title,
      fact_type: factType,
      summary,
      related_paths: extractRepoPathsFromText(summary),
      constraint_tags: constraintTags,
      required_gates: [],
    });
  }

  return results;
}

function extractProjectFactBlocks(rootDir: string, relativePath: string): Omit<ProjectFactRecord, "fact_id" | "source_doc_paths" | "watch_paths" | "updated_at">[] {
  const content = fs.readFileSync(path.join(rootDir, relativePath), "utf-8").replace(/\r\n/g, "\n");
  const matches = Array.from(content.matchAll(/```project-fact\n([\s\S]*?)\n```/g));
  return matches.map((match) => {
    const block = yaml.load(match[1] ?? "") as ProjectFactExportBlock;
    if (!block || typeof block !== "object") {
      throw new Error(`invalid project-fact block in ${relativePath}`);
    }
    assertValidProjectFactBlock(block, relativePath);
    const relatedPaths = normalizePathList(block.related_paths ?? []);
    return {
      title: block.title,
      fact_type: block.fact_type,
      summary: block.summary,
      related_paths: relatedPaths,
      constraint_tags: block.constraint_tags ?? [],
      required_gates: block.required_gates ?? [],
    };
  });
}

function verificationGate(gateId: string, command: string): GateRequirement {
  return {
    gate_id: gateId,
    gate_kind: "verification-command",
    gate_phase: "task-completion",
    evidence_source_type: "command-exit",
    evidence_ref_hint: command,
    freshness_rule: "per-task",
  };
}

function assertValidProjectFactBlock(block: ProjectFactExportBlock, relativePath: string): void {
  if (!isValidFactType(block.fact_type)) {
    throw new Error(`invalid project-fact block in ${relativePath}: invalid fact_type`);
  }
  assertRequiredNonEmptyString(block.title, "title", relativePath);
  assertRequiredNonEmptyString(block.summary, "summary", relativePath);
  assertOptionalStringArray(block.related_paths, "related_paths", relativePath);
  assertOptionalStringArray(block.constraint_tags, "constraint_tags", relativePath);
  assertOptionalGateRequirements(block.required_gates, relativePath);
}

function isValidFactType(value: unknown): value is ProjectFactRecord["fact_type"] {
  return ["module-boundary", "stable-entrypoint", "quality-gate", "data-contract", "repo-policy"].includes(String(value));
}

function isValidGateRequirement(value: unknown): value is GateRequirement {
  if (!value || typeof value !== "object") return false;
  const gate = value as Partial<GateRequirement>;
  return (
    typeof gate.gate_id === "string" &&
    ["approval", "preflight", "verification-command", "repo-policy"].includes(String(gate.gate_kind)) &&
    ["routing-precondition", "task-completion"].includes(String(gate.gate_phase)) &&
    ["root-rule", "project-fact", "document-status", "task-receipt", "command-exit"].includes(String(gate.evidence_source_type)) &&
    typeof gate.evidence_ref_hint === "string" &&
    ["per-task", "until-source-change", "until-replaced"].includes(String(gate.freshness_rule))
  );
}

function assertRequiredNonEmptyString(value: unknown, fieldName: string, relativePath: string): void {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`invalid project-fact block in ${relativePath}: missing ${fieldName}`);
  }
}

function assertOptionalStringArray(value: unknown, fieldName: string, relativePath: string): void {
  if (value !== undefined && !Array.isArray(value)) {
    throw new Error(`invalid project-fact block in ${relativePath}: ${fieldName} must be array`);
  }
}

function assertOptionalGateRequirements(value: unknown, relativePath: string): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    throw new Error(`invalid project-fact block in ${relativePath}: required_gates must be array`);
  }
  for (const gate of value) {
    if (!isValidGateRequirement(gate)) {
      throw new Error(`invalid project-fact block in ${relativePath}: invalid gate requirement`);
    }
  }
}

function taskGateFact(title: string, summary: string, gateId: string, gatePhase: GateRequirement["gate_phase"]): Omit<ProjectFactRecord, "fact_id" | "source_doc_paths" | "watch_paths" | "updated_at"> {
  return {
    title,
    fact_type: "quality-gate",
    summary,
    related_paths: ["docs/specs/agent-work/README.md", "package.json"],
    constraint_tags: ["quality-gate"],
    required_gates: [
      {
        gate_id: gateId,
        gate_kind: "preflight",
        gate_phase: gatePhase,
        evidence_source_type: "command-exit",
        evidence_ref_hint: title,
        freshness_rule: "per-task",
      },
    ],
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
