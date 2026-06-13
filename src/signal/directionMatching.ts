import type { DirectionCatalogEntry, ScoredProject } from "../types.ts";

const GENERIC_DIRECTION_TERMS = new Set(["agent", "agents", "ai", "automation", "workflow", "software", "open", "source"]);

function normalizeText(value: string | undefined): string {
  return value?.toLowerCase().replace(/[^a-z0-9+#./-]+/g, " ").trim() ?? "";
}

function tokenize(value: string | undefined): string[] {
  return normalizeText(value)
    .split(/[\s-]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function buildDirectionSearchableText(project: Pick<ScoredProject["project"], "project_name" | "repo_full_name" | "description" | "tags" | "raw_signals">): string {
  return normalizeText(
    [
      project.project_name,
      project.repo_full_name,
      project.description,
      ...project.tags,
      ...project.raw_signals.flatMap((signal) => [signal.description ?? "", ...(signal.tags ?? [])]),
    ].join(" "),
  );
}

export function scoreDirectionMatch(
  project: Pick<ScoredProject["project"], "project_name" | "repo_full_name" | "description" | "tags" | "raw_signals">,
  direction: DirectionCatalogEntry,
): number {
  const searchable = buildDirectionSearchableText(project);
  const tokens = new Set(tokenize(searchable));
  let score = 0;
  let matchedSpecificTerms = 0;

  const phraseVariants = [
    direction.direction_key,
    direction.direction_key.replace(/-/g, " "),
    ...direction.query_packs.flatMap((pack) => pack.templates.map((template) => normalizeText(template))),
  ];
  for (const phrase of phraseVariants) {
    if (phrase && searchable.includes(phrase)) score += 12;
  }

  const requiredTerms = [...new Set(direction.required_terms.flatMap((term) => tokenize(term)))];
  for (const term of requiredTerms) {
    if (!term || GENERIC_DIRECTION_TERMS.has(term)) continue;
    if (tokens.has(term)) {
      matchedSpecificTerms += 1;
      score += 4;
    }
  }

  const evidenceTerms = [...direction.evidence_verbs, ...direction.evidence_objects]
    .flatMap((term) => tokenize(term))
    .filter((term) => !GENERIC_DIRECTION_TERMS.has(term));
  for (const term of evidenceTerms) {
    if (tokens.has(term)) score += 2;
  }

  const negativeHits = direction.negative_terms.flatMap((term) => tokenize(term)).filter((term) => tokens.has(term)).length;
  score -= negativeHits * 6;

  if (matchedSpecificTerms >= 2) score += 8;
  if (matchedSpecificTerms === 0 && score < 12) return 0;
  return score >= 10 ? score : 0;
}

export function directionMatchesProject(
  project: Pick<ScoredProject["project"], "project_name" | "repo_full_name" | "description" | "tags" | "raw_signals">,
  direction: DirectionCatalogEntry,
): boolean {
  return scoreDirectionMatch(project, direction) > 0;
}

export function directionLaneHits(
  project: Pick<ScoredProject["project"], "project_name" | "repo_full_name" | "description" | "tags" | "raw_signals">,
  direction: DirectionCatalogEntry,
): string[] {
  const searchable = buildDirectionSearchableText(project);
  return direction.query_packs
    .filter((pack) => pack.templates.some((template) => searchable.includes(normalizeText(template))))
    .map((pack) => pack.lane_type);
}
