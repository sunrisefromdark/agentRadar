export const DEFAULT_DEMOTED_REPO_KEYS = new Set([
  "openai/codex",
  "anthropics/claude-code",
  "openclaw/openclaw",
  "nousresearch/hermes-agent",
  "langchain-ai/langchain",
  "langchain-ai/langgraph",
  "langchain-ai/langmem",
]);

export function isDefaultDemotedProject(repoFullName: string | null | undefined): boolean {
  return DEFAULT_DEMOTED_REPO_KEYS.has(String(repoFullName ?? "").trim().toLowerCase());
}

export function compareProjectLibraryOrder<T extends {
  repoFullName: string;
  finalRank: number;
  baseFinalRank?: number;
  score: number;
  preference?: number;
}>(left: T, right: T, options?: { preferPersonal?: boolean }): number {
  const preferPersonal = options?.preferPersonal === true;
  if (preferPersonal) {
    const leftPreference = left.preference ?? 0;
    const rightPreference = right.preference ?? 0;
    if (rightPreference !== leftPreference) return rightPreference - leftPreference;
  }

  const leftDemoted = isDefaultDemotedProject(left.repoFullName);
  const rightDemoted = isDefaultDemotedProject(right.repoFullName);
  if (leftDemoted !== rightDemoted) return Number(leftDemoted) - Number(rightDemoted);

  const leftBaseFinalRank = left.baseFinalRank ?? left.finalRank;
  const rightBaseFinalRank = right.baseFinalRank ?? right.finalRank;
  return right.finalRank - left.finalRank || rightBaseFinalRank - leftBaseFinalRank || right.score - left.score;
}
