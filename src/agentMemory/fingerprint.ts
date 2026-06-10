import { normalizePathList } from "./paths.ts";
import type {
  ArtifactType,
  Domain,
  FingerprintField,
  ProjectFactRecord,
  TaskFingerprint,
  TaskFingerprintEvidence,
  TaskKind,
} from "./types.ts";

const DOMAIN_TERM_MAP: Array<[Domain, string[]]> = [
  ["requirements", ["requirements", "requirement", "需求", "需求分析"]],
  ["design", ["design", "design doc", "设计", "设计文档"]],
  ["exec-plan", ["exec-plan", "execution plan", "执行计划", "实施计划"]],
  ["code-implementation", ["code implementation", "feature delivery", "bug fix", "refactor", "开发", "实现", "修复", "重构"]],
  ["artifact-review", ["artifact review", "code review", "artifact audit", "审核", "审查"]],
  ["testing", ["testing", "test", "regression", "测试", "补测", "回归"]],
  ["visual-console", ["visual console", "ui", "frontend", "视觉界面", "前端"]],
  ["automation", ["automation", "workflow", "scheduled task", "自动化", "工作流", "定时任务"]],
  ["repo-ops", ["repo ops", "repository ops", "script maintenance", "dependency ops", "仓库运维", "脚本维护", "依赖维护"]],
];

const TASK_KIND_TERM_MAP: Array<[TaskKind, string[]]> = [
  ["analyze", ["analyze", "summarize", "分析", "总结", "梳理"]],
  ["draft", ["draft", "write", "起草", "撰写"]],
  ["revise", ["revise", "update", "tighten", "revise doc", "修订", "修改", "收紧"]],
  ["review", ["review", "audit", "审核", "审查"]],
  ["implement", ["implement", "build", "fix", "deliver", "实现", "开发", "修复", "交付"]],
  ["verify", ["verify", "test", "check", "validate", "验证", "测试", "检查"]],
  ["debug", ["debug", "investigate failure", "troubleshoot", "排查", "调试", "定位故障"]],
  ["operate", ["operate", "run", "publish", "execute", "运行", "发布", "执行"]],
];

export interface BuildTaskFingerprintInput {
  userRequest: string;
  taskTitle?: string;
  explicitPaths?: string[];
  referencedSpecs?: string[];
  explicitConstraintTags?: string[];
  projectFacts?: ProjectFactRecord[];
}

export function buildTaskFingerprint(input: BuildTaskFingerprintInput): TaskFingerprint {
  const targetPaths = normalizePathList(input.explicitPaths ?? []);
  const referencedSpecs = normalizeReferencedSpecs(input.referencedSpecs ?? []);
  const requestedArtifactTypes = extractArtifactTypes([...targetPaths, ...referencedSpecs]);
  const fieldEvidence: TaskFingerprintEvidence[] = [];
  const resolutionNotes: string[] = [];
  const taskTitle = input.taskTitle ?? "";
  const taskKind = resolveMappedValue("task_kind", input.userRequest, taskTitle, TASK_KIND_TERM_MAP, fieldEvidence, resolutionNotes);
  const domain = resolveTaskDomain(input.userRequest, taskTitle, [...targetPaths, ...referencedSpecs], requestedArtifactTypes, taskKind, fieldEvidence, resolutionNotes);
  addPathEvidence(fieldEvidence, "target_paths", targetPaths);
  addPathEvidence(fieldEvidence, "referenced_specs", referencedSpecs);
  addArtifactEvidence(fieldEvidence, requestedArtifactTypes);
  const constraintTags = collectConstraintTags(input.projectFacts ?? [], input.explicitConstraintTags ?? [], targetPaths, referencedSpecs, fieldEvidence);
  const goalTerms = collectGoalTerms(input.userRequest, taskTitle, fieldEvidence);
  const resolutionStatus = determineResolutionStatus(domain, taskKind, resolutionNotes);

  return {
    domain,
    task_kind: taskKind,
    requested_artifact_types: requestedArtifactTypes,
    target_paths: targetPaths,
    referenced_specs: referencedSpecs,
    constraint_tags: Array.from(constraintTags).sort((left, right) => left.localeCompare(right)),
    goal_terms: goalTerms,
    resolution_status: resolutionStatus,
    field_evidence: fieldEvidence,
    resolution_notes: resolutionNotes,
  };
}

function normalizeReferencedSpecs(referencedSpecs: string[]): string[] {
  return normalizePathList(referencedSpecs).filter((item) => item.startsWith("docs/specs/") && item.endsWith(".md"));
}

function resolveTaskDomain(
  userRequest: string,
  taskTitle: string,
  paths: string[],
  artifactTypes: ArtifactType[],
  taskKind: TaskKind | null,
  fieldEvidence: TaskFingerprintEvidence[],
  resolutionNotes: string[],
): Domain | null {
  return (
    resolveNativeSpecDomain(paths, taskKind, artifactTypes, fieldEvidence) ??
    resolveFallbackDomain(userRequest, taskTitle, artifactTypes, fieldEvidence, resolutionNotes, taskKind)
  );
}

function addPathEvidence(
  fieldEvidence: TaskFingerprintEvidence[],
  field: Extract<FingerprintField, "target_paths" | "referenced_specs">,
  values: string[],
): void {
  for (const value of values) {
    fieldEvidence.push({
      field,
      value,
      source_type: "explicit-path",
      source_ref: value,
      priority: 3,
    });
  }
}

function addArtifactEvidence(fieldEvidence: TaskFingerprintEvidence[], artifactTypes: ArtifactType[]): void {
  for (const artifactType of artifactTypes) {
    fieldEvidence.push({
      field: "requested_artifact_types",
      value: artifactType,
      source_type: "explicit-path",
      source_ref: artifactType,
      priority: 3,
    });
  }
}

function collectConstraintTags(
  projectFacts: ProjectFactRecord[],
  explicitConstraintTags: string[],
  targetPaths: string[],
  referencedSpecs: string[],
  fieldEvidence: TaskFingerprintEvidence[],
): string[] {
  const constraintTags = new Set(explicitConstraintTags);
  const relevantFacts = projectFacts.filter((fact) => fact.related_paths.some((relatedPath) => targetPaths.includes(relatedPath) || referencedSpecs.includes(relatedPath)));
  for (const fact of relevantFacts) {
    for (const tag of fact.constraint_tags) {
      constraintTags.add(tag);
      fieldEvidence.push({
        field: "constraint_tags",
        value: tag,
        source_type: "project-fact",
        source_ref: fact.fact_id,
        priority: 4,
      });
    }
  }
  return Array.from(constraintTags).sort((left, right) => left.localeCompare(right));
}

function collectGoalTerms(userRequest: string, taskTitle: string, fieldEvidence: TaskFingerprintEvidence[]): string[] {
  const goalTerms = [taskTitle.trim(), userRequest.trim()].filter((item): item is string => Boolean(item)).slice(0, 2);
  for (const goalTerm of goalTerms) {
    const fromTitle = goalTerm === taskTitle.trim();
    fieldEvidence.push({
      field: "goal_terms",
      value: goalTerm,
      source_type: fromTitle ? "task-title" : "user-request",
      source_ref: fromTitle ? "task-title" : "user-request",
      priority: fromTitle ? 2 : 1,
    });
  }
  return goalTerms;
}

function determineResolutionStatus(domain: Domain | null, taskKind: TaskKind | null, resolutionNotes: string[]): TaskFingerprint["resolution_status"] {
  if (domain && taskKind) return "resolved";
  return resolutionNotes.length > 0 ? "ambiguous" : "underspecified";
}

function resolveMappedValue<T extends string>(
  field: FingerprintField,
  userRequest: string,
  taskTitle: string,
  mapping: Array<[T, string[]]>,
  fieldEvidence: TaskFingerprintEvidence[],
  resolutionNotes: string[],
): T | null {
  const userMatches = collectMatches(userRequest, mapping);
  if (userMatches.length === 1) {
    fieldEvidence.push({
      field,
      value: userMatches[0]!,
      source_type: "user-request",
      source_ref: "user-request",
      priority: 1,
    });
    return userMatches[0]!;
  }
  if (userMatches.length > 1) {
    resolutionNotes.push(`${field}:ambiguous-user-request`);
    return null;
  }

  const titleMatches = collectMatches(taskTitle, mapping);
  if (titleMatches.length === 1) {
    fieldEvidence.push({
      field,
      value: titleMatches[0]!,
      source_type: "task-title",
      source_ref: "task-title",
      priority: 2,
    });
    return titleMatches[0]!;
  }
  if (titleMatches.length > 1) {
    resolutionNotes.push(`${field}:ambiguous-task-title`);
  }

  return null;
}

function resolveNativeSpecDomain(
  paths: string[],
  taskKind: TaskKind | null,
  artifactTypes: ArtifactType[],
  fieldEvidence: TaskFingerprintEvidence[],
): Domain | null {
  const domains = new Set<Domain>();
  for (const currentPath of paths) {
    if (currentPath.startsWith("docs/specs/product-specs/")) domains.add("requirements");
    if (currentPath.startsWith("docs/specs/design-docs/")) domains.add("design");
    if (currentPath.startsWith("docs/specs/exec-plans/")) domains.add("exec-plan");
  }

  if (domains.size !== 1) return null;
  if (taskKind === "implement" && artifactTypes.some((artifactType) => ["source-code", "test-code", "config", "skill-script"].includes(artifactType))) {
    return null;
  }
  const domain = Array.from(domains)[0]!;
  fieldEvidence.push({
    field: "domain",
    value: domain,
    source_type: "explicit-path",
    source_ref: paths.find((currentPath) => currentPath.startsWith("docs/specs/")) ?? "explicit-path",
    priority: 3,
  });
  return domain;
}

function resolveFallbackDomain(
  userRequest: string,
  taskTitle: string,
  artifactTypes: ArtifactType[],
  fieldEvidence: TaskFingerprintEvidence[],
  resolutionNotes: string[],
  taskKind: TaskKind | null,
): Domain | null {
  if (taskKind === "review" && artifactTypes.some((artifactType) => ["source-code", "test-code", "config", "report", "audit-receipt"].includes(artifactType))) {
    fieldEvidence.push({
      field: "domain",
      value: "artifact-review",
      source_type: "user-request",
      source_ref: "artifact-review",
      priority: 1,
    });
    return "artifact-review";
  }

  return resolveMappedValue("domain", userRequest, taskTitle, DOMAIN_TERM_MAP, fieldEvidence, resolutionNotes);
}

function collectMatches<T extends string>(text: string, mapping: Array<[T, string[]]>): T[] {
  if (!text.trim()) return [];
  const lowered = stripPathLikeText(text).toLowerCase();
  return mapping
    .filter(([, terms]) => terms.some((term) => lowered.includes(term.toLowerCase())))
    .map(([value]) => value);
}

function stripPathLikeText(text: string): string {
  return text.replace(/(?:docs|src|app|scripts|data)\/[A-Za-z0-9_./-]+/g, " ");
}

function extractArtifactTypes(paths: string[]): ArtifactType[] {
  const artifacts = new Set<ArtifactType>();
  for (const currentPath of paths) {
    addArtifactMatches(currentPath, artifacts);
  }
  return Array.from(artifacts).sort((left, right) => left.localeCompare(right));
}

const ARTIFACT_MATCHERS: Array<{ artifact: ArtifactType; matches: (currentPath: string) => boolean }> = [
  { artifact: "requirement-doc", matches: (currentPath) => /^docs\/specs\/product-specs\/.+\.md$/.test(currentPath) },
  { artifact: "design-doc", matches: (currentPath) => /^docs\/specs\/design-docs\/.+\.md$/.test(currentPath) },
  { artifact: "exec-plan", matches: (currentPath) => /^docs\/specs\/exec-plans\/.+\.exec-plan\.md$/.test(currentPath) },
  { artifact: "skill-doc", matches: (currentPath) => /^docs\/specs\/agent-work\/.+\.md$/.test(currentPath) },
  { artifact: "config", matches: (currentPath) => ["config.yaml", "package.json", "tsconfig.json"].includes(currentPath) },
  { artifact: "test-code", matches: (currentPath) => currentPath.startsWith("src/__tests__/") || currentPath.endsWith(".test.ts") },
  { artifact: "source-code", matches: (currentPath) => currentPath.startsWith("src/") || currentPath.startsWith("app/") },
  { artifact: "skill-script", matches: (currentPath) => currentPath.startsWith("scripts/skills/") },
  { artifact: "report", matches: (currentPath) => currentPath.startsWith("data/reports/") },
];

function addArtifactMatches(currentPath: string, artifacts: Set<ArtifactType>): void {
  for (const matcher of ARTIFACT_MATCHERS) {
    if (matcher.matches(currentPath)) artifacts.add(matcher.artifact);
  }
}
