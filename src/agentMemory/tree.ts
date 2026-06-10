import { writeJsonAtomic, writeTextAtomic } from "./fs.ts";
import { detectInvalidRouteableSkillIds } from "./skillValidation.ts";
import type { LearnedSkillMetadata, ManualSkillMetadata, RoutingReceipt, SkillReuseReceipt } from "./types.ts";

type RouteableSkill = ManualSkillMetadata | LearnedSkillMetadata;

const DOMAINS = [
  "requirements",
  "design",
  "exec-plan",
  "code-implementation",
  "artifact-review",
  "testing",
  "visual-console",
  "automation",
  "repo-ops",
] as const;

export interface SkillTreeNode {
  skill_id: string;
  title: string;
  domain: RouteableSkill["domain"];
  subdomain: RouteableSkill["subdomain"];
  task_kinds: string[];
  artifact_types: string[];
  trust_tier: "manual" | "learned_stable" | "learned_candidate";
  lifecycle_status: RouteableSkill["lifecycle_status"];
  drift_status: RouteableSkill["drift_status"];
  successful_reuse_count: number;
  last_verified_at?: string;
  source_task_ids?: string[];
  source_doc_path?: string;
  parent_skill_id?: string;
  children?: SkillTreeNode[];
}

export interface SkillTreeStats {
  total_skill_count: number;
  stable_count: number;
  candidate_count: number;
  paused_count: number;
  expired_count: number;
  retired_count: number;
  manual_count: number;
  learned_count: number;
  recent30_candidate_count: number;
  hit_rate: number;
  effective_hit_rate: number;
  primary_match_rate: number;
  no_confident_match_rate: number;
  successful_reuse_rate: number;
  failure_rate: number;
  domain_coverage: Record<string, { routeable_skill_count: number; reusable_skill_count: number; recent30_effective_hit_task_count: number }>;
}

export interface SkillTreeIndex {
  generated_at: string;
  domains: Record<string, SkillTreeNode[]>;
  stats: SkillTreeStats;
  invalid_skill_ids: string[];
}

export interface SkillTreeArtifacts {
  index: SkillTreeIndex;
  overview_markdown: string;
  domain_markdown: Record<string, string>;
}

export interface BuildSkillTreeInput {
  now: string;
  manualSkills: ManualSkillMetadata[];
  learnedSkills: LearnedSkillMetadata[];
  routingReceipts: RoutingReceipt[];
  reuseReceipts: SkillReuseReceipt[];
}

export function buildSkillTreeArtifacts(input: BuildSkillTreeInput): SkillTreeArtifacts {
  const sourceSkills = [...input.manualSkills, ...input.learnedSkills];
  const routeableSkills = sourceSkills.filter((skill) => skill.lifecycle_status !== "retired");
  const invalidSkillIds = detectInvalidRouteableSkillIds(routeableSkills);
  const validSkills = routeableSkills.filter((skill) => !invalidSkillIds.has(skill.skill_id));
  const childrenByParent = new Map<string, RouteableSkill[]>();
  for (const skill of validSkills) {
    if (!("parent_skill_id" in skill) || !skill.parent_skill_id) continue;
    const siblings = childrenByParent.get(skill.parent_skill_id) ?? [];
    siblings.push(skill);
    childrenByParent.set(skill.parent_skill_id, siblings);
  }

  const domains: Record<string, SkillTreeNode[]> = Object.fromEntries(DOMAINS.map((domain) => [domain, []]));
  for (const domain of DOMAINS) {
    const roots = validSkills.filter((skill) => skill.domain === domain && (!("parent_skill_id" in skill) || !skill.parent_skill_id));
    domains[domain] = sortSkills(roots).map((skill) => materializeNode(skill, childrenByParent));
  }

  const stats = computeTreeStats(input.now, validSkills, sourceSkills, input.routingReceipts, input.reuseReceipts);
  const index: SkillTreeIndex = {
    generated_at: input.now,
    domains,
    stats,
    invalid_skill_ids: Array.from(invalidSkillIds).sort((left, right) => left.localeCompare(right)),
  };

  return {
    index,
    overview_markdown: renderOverview(index),
    domain_markdown: Object.fromEntries(
      DOMAINS.map((domain) => [domain, renderDomain(domain, domains[domain], index.stats.domain_coverage[domain])]),
    ),
  };
}

export function writeSkillTreeArtifacts(rootDir: string, artifacts: SkillTreeArtifacts): void {
  writeJsonAtomic(rootDir, "data/agent-memory/tree/index.json", artifacts.index);
  writeTextAtomic(rootDir, "data/agent-memory/tree/overview.md", `${artifacts.overview_markdown}\n`);
  for (const [domain, markdown] of Object.entries(artifacts.domain_markdown)) {
    writeTextAtomic(rootDir, `data/agent-memory/tree/domains/${domain}.md`, `${markdown}\n`);
  }
}

function materializeNode(skill: RouteableSkill, childrenByParent: Map<string, RouteableSkill[]>): SkillTreeNode {
  const node: SkillTreeNode = {
    skill_id: skill.skill_id,
    title: skill.title,
    domain: skill.domain,
    subdomain: skill.subdomain,
    task_kinds: [...skill.task_kinds],
    artifact_types: [...skill.artifact_types],
    trust_tier: skill.origin === "manual" ? "manual" : skill.trust_tier,
    lifecycle_status: skill.lifecycle_status,
    drift_status: skill.drift_status,
    successful_reuse_count: skill.origin === "manual" ? 0 : skill.successful_reuse_count,
    ...(skill.origin === "manual" ? { source_doc_path: skill.source_doc_path } : { source_task_ids: skill.source_task_ids }),
    ...(skill.origin === "learned" && skill.last_verified_at ? { last_verified_at: skill.last_verified_at } : {}),
    ...(skill.origin === "learned" && skill.parent_skill_id ? { parent_skill_id: skill.parent_skill_id } : {}),
  };
  const children = sortSkills(childrenByParent.get(skill.skill_id) ?? []).map((child) => materializeNode(child, childrenByParent));
  if (children.length > 0) node.children = children;
  return node;
}

function sortSkills(skills: RouteableSkill[]): RouteableSkill[] {
  const tierRank = (skill: RouteableSkill): number => {
    if (skill.origin === "manual") return 0;
    return skill.trust_tier === "learned_stable" ? 1 : 2;
  };
  return [...skills].sort((left, right) => {
    const tierDelta = tierRank(left) - tierRank(right);
    if (tierDelta !== 0) return tierDelta;
    const reuseDelta = (right.origin === "manual" ? 0 : right.successful_reuse_count) - (left.origin === "manual" ? 0 : left.successful_reuse_count);
    if (reuseDelta !== 0) return reuseDelta;
    return left.skill_id.localeCompare(right.skill_id);
  });
}

function computeTreeStats(
  now: string,
  skills: RouteableSkill[],
  sourceSkills: RouteableSkill[],
  routingReceipts: RoutingReceipt[],
  reuseReceipts: SkillReuseReceipt[],
): SkillTreeStats {
  const cutoff = Date.parse(now) - 30 * 24 * 60 * 60 * 1000;
  const recentRouting = routingReceipts.filter((receipt) => Date.parse(receipt.created_at) >= cutoff);
  const recentReuse = reuseReceipts.filter((receipt) => Date.parse(receipt.last_attempted_at) >= cutoff);
  const routingMetrics = collectRoutingMetrics(recentRouting);
  const reuseMetrics = collectReuseMetrics(recentReuse);

  const domainCoverage = Object.fromEntries(
    DOMAINS.map((domain) => {
      const domainSkills = skills.filter((skill) => skill.domain === domain);
      const reusable = domainSkills.filter(
        (skill) =>
          skill.lifecycle_status === "stable" &&
          skill.drift_status === "trusted" &&
          (skill.origin === "manual" || skill.trust_tier === "learned_stable"),
      );
      const recentEffectiveHitTaskCount = recentRouting.filter(
        (receipt) => receipt.task_fingerprint.domain === domain && reuseMetrics.effective_hit_task_ids.has(receipt.task_id),
      ).length;
      return [
        domain,
        {
          routeable_skill_count: domainSkills.length,
          reusable_skill_count: reusable.length,
          recent30_effective_hit_task_count: recentEffectiveHitTaskCount,
        },
      ];
    }),
  );

  return {
    total_skill_count: skills.length,
    stable_count: skills.filter((skill) => skill.lifecycle_status === "stable").length,
    candidate_count: skills.filter((skill) => skill.lifecycle_status === "candidate").length,
    paused_count: skills.filter((skill) => skill.lifecycle_status === "paused").length,
    expired_count: skills.filter((skill) => skill.lifecycle_status === "expired").length,
    retired_count: sourceSkills.filter((skill) => skill.lifecycle_status === "retired").length,
    manual_count: sourceSkills.filter((skill) => skill.origin === "manual" && skill.lifecycle_status !== "retired").length,
    learned_count: sourceSkills.filter((skill) => skill.origin === "learned" && skill.lifecycle_status !== "retired").length,
    recent30_candidate_count: skills.filter(
      (skill) => skill.origin === "learned" && Date.parse(skill.created_at) >= cutoff && skill.trust_tier === "learned_candidate",
    ).length,
    hit_rate: ratio(routingMetrics.hit_count, recentRouting.length),
    effective_hit_rate: ratio(reuseMetrics.effective_hit_task_ids.size, recentRouting.length),
    primary_match_rate: ratio(routingMetrics.primary_match_count, recentRouting.length),
    no_confident_match_rate: ratio(routingMetrics.no_confident_match_count, recentRouting.length),
    successful_reuse_rate: ratio(reuseMetrics.success_attempt_count, reuseMetrics.attempt_count),
    failure_rate: ratio(reuseMetrics.failure_attempt_count, reuseMetrics.attempt_count),
    domain_coverage: domainCoverage,
  };
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Number((numerator / denominator).toFixed(4));
}

function renderOverview(index: SkillTreeIndex): string {
  const lines = [
    "# Skill Tree Overview",
    `generated_at: ${index.generated_at}`,
    `total_skill_count: ${index.stats.total_skill_count}`,
    `stable_count: ${index.stats.stable_count}`,
    `candidate_count: ${index.stats.candidate_count}`,
    `paused_count: ${index.stats.paused_count}`,
    `expired_count: ${index.stats.expired_count}`,
    `retired_count: ${index.stats.retired_count}`,
    `manual_count: ${index.stats.manual_count}`,
    `learned_count: ${index.stats.learned_count}`,
    `recent30_candidate_count: ${index.stats.recent30_candidate_count}`,
    `hit_rate: ${index.stats.hit_rate}`,
    `effective_hit_rate: ${index.stats.effective_hit_rate}`,
    `primary_match_rate: ${index.stats.primary_match_rate}`,
    `no_confident_match_rate: ${index.stats.no_confident_match_rate}`,
    `successful_reuse_rate: ${index.stats.successful_reuse_rate}`,
    `failure_rate: ${index.stats.failure_rate}`,
  ];
  for (const domain of DOMAINS) {
    const coverage = index.stats.domain_coverage[domain];
    lines.push(
      `domain_coverage.${domain}: routeable_skill_count=${coverage.routeable_skill_count}, reusable_skill_count=${coverage.reusable_skill_count}, recent30_effective_hit_task_count=${coverage.recent30_effective_hit_task_count}`,
    );
  }
  return lines.join("\n");
}

function renderDomain(
  domain: string,
  nodes: SkillTreeNode[],
  coverage: { routeable_skill_count: number; reusable_skill_count: number; recent30_effective_hit_task_count: number },
): string {
  return [
    `# ${domain}`,
    `routeable_skill_count: ${coverage.routeable_skill_count}`,
    `reusable_skill_count: ${coverage.reusable_skill_count}`,
    `recent30_effective_hit_task_count: ${coverage.recent30_effective_hit_task_count}`,
    "",
    ...nodes.flatMap((node) => renderNode(node, 0)),
  ].join("\n");
}

function renderNode(node: SkillTreeNode, depth: number): string[] {
  const indent = "  ".repeat(depth);
  const lines = [
    `${indent}- skill_id: ${node.skill_id}`,
    `${indent}  title: ${node.title}`,
    `${indent}  domain: ${node.domain}`,
    `${indent}  subdomain: ${node.subdomain}`,
    `${indent}  task_kinds: ${joinList(node.task_kinds)}`,
    `${indent}  artifact_types: ${joinList(node.artifact_types)}`,
    `${indent}  trust_tier: ${node.trust_tier}`,
    `${indent}  lifecycle_status: ${node.lifecycle_status}`,
    `${indent}  drift_status: ${node.drift_status}`,
    `${indent}  successful_reuse_count: ${node.successful_reuse_count}`,
    `${indent}  last_verified_at: ${node.last_verified_at ?? "none"}`,
    `${indent}  source_task_ids: ${joinList(node.source_task_ids ?? [])}`,
    `${indent}  source_doc_path: ${node.source_doc_path ?? "none"}`,
    `${indent}  parent_skill_id: ${node.parent_skill_id ?? "none"}`,
  ];
  for (const child of node.children ?? []) {
    lines.push(...renderNode(child, depth + 1));
  }
  return lines;
}

function joinList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

function collectRoutingMetrics(recentRouting: RoutingReceipt[]): {
  hit_count: number;
  primary_match_count: number;
  no_confident_match_count: number;
} {
  return {
    hit_count: recentRouting.filter((receipt) => receipt.primary_match !== null || receipt.reference_matches.length > 0).length,
    primary_match_count: recentRouting.filter((receipt) => receipt.primary_match !== null).length,
    no_confident_match_count: recentRouting.filter(
      (receipt) => receipt.primary_match === null && receipt.reference_matches.length === 0 && receipt.decision_reason.startsWith("no_confident_match"),
    ).length,
  };
}

function collectReuseMetrics(recentReuse: SkillReuseReceipt[]): {
  effective_hit_task_ids: Set<string>;
  attempt_count: number;
  success_attempt_count: number;
  failure_attempt_count: number;
} {
  const effective_hit_task_ids = new Set(
    recentReuse
      .filter((receipt) => receipt.attempts.some(isSuccessfulAttempt))
      .map((receipt) => receipt.task_id),
  );
  return {
    effective_hit_task_ids,
    attempt_count: recentReuse.reduce((sum, receipt) => sum + receipt.attempts.length, 0),
    success_attempt_count: recentReuse.reduce((sum, receipt) => sum + receipt.attempts.filter(isSuccessfulAttempt).length, 0),
    failure_attempt_count: recentReuse.reduce((sum, receipt) => sum + receipt.attempts.filter(isFailureAttempt).length, 0),
  };
}

function isSuccessfulAttempt(attempt: SkillReuseReceipt["attempts"][number]): boolean {
  return attempt.execution_result === "success" && attempt.verification_result === "passed" && attempt.fallback_used === false;
}

function isFailureAttempt(attempt: SkillReuseReceipt["attempts"][number]): boolean {
  return attempt.execution_result === "failed" || attempt.execution_result === "partial" || attempt.verification_result === "failed";
}
