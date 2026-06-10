import { fetchGitHubRepoMetricsDetailed } from "../signal/githubMetrics.ts";
import type { ScoredProject } from "../types.ts";

function hasConcreteDescription(text: string | null | undefined): boolean {
  const normalized = String(text ?? "").trim();
  if (!normalized) return false;
  if (/^BROKEN-DESCRIPTION-DO-NOT-USE$/i.test(normalized)) return false;
  if (/^no description$/i.test(normalized) || /^description unavailable$/i.test(normalized)) return false;
  return normalized.length >= 24 || /[A-Za-z]{4,}/.test(normalized) || /[\u4e00-\u9fff]{8,}/.test(normalized);
}

function needsRepoDescriptionBackfill(project: Pick<ScoredProject, "project">): boolean {
  if (hasConcreteDescription(project.project.description)) return false;

  const signalDescriptions = project.project.raw_signals
    .map((signal) => signal.description?.trim() ?? "")
    .filter((description) => description.length > 0);
  if (signalDescriptions.some((description) => hasConcreteDescription(description))) return false;

  return /^https?:\/\/github\.com\//i.test(project.project.repo_url);
}

async function mapWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  for (let index = 0; index < items.length; index += concurrency) {
    const chunk = items.slice(index, index + concurrency);
    await Promise.all(chunk.map((item) => worker(item)));
  }
}

export async function warmMissingProjectDescriptions(projects: Array<Pick<ScoredProject, "project">>): Promise<void> {
  const targets = Array.from(
    new Set(
      projects
        .filter((project) => needsRepoDescriptionBackfill(project))
        .map((project) => project.project.repo_url),
    ),
  );

  if (targets.length === 0) return;

  await mapWithConcurrency(targets, 3, async (repoUrl) => {
    try {
      await fetchGitHubRepoMetricsDetailed(repoUrl);
    } catch {
      // Best-effort warmup only. The downstream brief builder will keep existing local fallbacks.
    }
  });
}
