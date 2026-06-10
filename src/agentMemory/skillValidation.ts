import type { Domain, LearnedSkillMetadata, ManualSkillMetadata, Subdomain } from "./types.ts";

type RouteableSkill = ManualSkillMetadata | LearnedSkillMetadata;

const ALLOWED_SUBDOMAINS: Record<Domain, ReadonlySet<Subdomain>> = {
  requirements: new Set(["general", "requirement-analysis", "spec-gap-audit"]),
  design: new Set(["general", "design-doc", "design-review", "architecture-boundary"]),
  "exec-plan": new Set(["general", "exec-plan-drafting", "exec-plan-review"]),
  "code-implementation": new Set(["general", "feature-delivery", "bug-fix", "refactor"]),
  "artifact-review": new Set(["general", "code-review", "artifact-audit"]),
  testing: new Set(["general", "test-design", "regression-validation"]),
  "visual-console": new Set(["general", "ui-implementation", "visual-regression"]),
  automation: new Set(["general", "workflow-automation", "scheduled-automation"]),
  "repo-ops": new Set(["general", "script-maintenance", "dependency-ops", "workspace-hygiene"]),
};

export function detectInvalidRouteableSkillIds(skills: RouteableSkill[]): Set<string> {
  const invalid = new Set<string>();
  const byId = new Map(skills.map((skill) => [skill.skill_id, skill]));

  for (const skill of skills) {
    if (!isAllowedSubdomain(skill.domain, skill.subdomain)) invalid.add(skill.skill_id);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const skill of skills) {
      if (invalid.has(skill.skill_id)) continue;
      if (hasInvalidParent(skill, byId, invalid)) {
        invalid.add(skill.skill_id);
        changed = true;
      }
    }
  }

  for (const skill of skills) {
    if (invalid.has(skill.skill_id)) continue;
    if (hasCycle(skill, byId)) invalid.add(skill.skill_id);
  }

  return invalid;
}

function isAllowedSubdomain(domain: Domain, subdomain: Subdomain): boolean {
  return ALLOWED_SUBDOMAINS[domain].has(subdomain);
}

function hasInvalidParent(
  skill: RouteableSkill,
  byId: Map<string, RouteableSkill>,
  invalid: ReadonlySet<string>,
): boolean {
  if (skill.origin === "manual") return Boolean("parent_skill_id" in skill && skill.parent_skill_id);
  if (!skill.parent_skill_id) return false;

  const parent = byId.get(skill.parent_skill_id);
  if (!parent) return true;
  if (invalid.has(parent.skill_id)) return true;
  if (parent.skill_id === skill.skill_id) return true;
  if (parent.domain !== skill.domain || parent.subdomain !== skill.subdomain) return true;
  return parent.origin === "learned" && parent.trust_tier !== "learned_stable";
}

function hasCycle(skill: RouteableSkill, byId: Map<string, RouteableSkill>): boolean {
  const seen = new Set<string>([skill.skill_id]);
  let current = skill;
  while ("parent_skill_id" in current && current.parent_skill_id) {
    if (seen.has(current.parent_skill_id)) return true;
    seen.add(current.parent_skill_id);
    const parent = byId.get(current.parent_skill_id);
    if (!parent) return false;
    current = parent;
  }
  return false;
}
