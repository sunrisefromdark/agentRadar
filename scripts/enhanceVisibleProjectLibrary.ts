import { loadRuntimeEnv } from "../src/env.ts";
import { generateMissionScoutEnhancements } from "../src/signal/missionScoutEnhancement.ts";
import type { RawSignal } from "../src/types.ts";
import { buildProjectsView } from "../src/visualConsole/build.ts";

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function readPositiveIntArg(name: string, fallback: number): number {
  const raw = readArg(name);
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function containsChineseText(value: string | null | undefined): boolean {
  return /[\u3400-\u9fff]/.test(String(value ?? ""));
}

function needsChineseIntro(project: ReturnType<typeof buildProjectsView>["projects"][number]): boolean {
  if (project.enhancement_source !== "agent") return true;
  if (!containsChineseText(project.project_brief_cn)) return true;
  return false;
}

function toSignal(project: ReturnType<typeof buildProjectsView>["projects"][number]): RawSignal {
  return {
    project_name: project.project.project_name,
    repo_url: project.project.repo_url,
    source: "mission_github_search",
    timestamp: `${project.project.last_seen || project.project.first_seen || "2026-01-01"}T00:00:00.000Z`,
    stars: project.project.stars,
    star_delta: project.project.star_delta_daily,
    forks: project.project.forks,
    issues: project.project.issues,
    PR: project.project.PR,
    tags: [
      ...project.project.tags,
      ...(project.direction_matches ?? []).map((direction) => `mission-direction:${direction}`),
      ...project.matched_interest_topics,
    ],
    description: [project.project.description, project.project_brief_cn, project.why_today_cn].filter(Boolean).join(" "),
    metrics_source: project.project.metrics_source,
    metrics_trust_score: project.project.metrics_trust_score,
    star_delta_source: project.project.star_delta_source,
  };
}

loadRuntimeEnv(process.cwd(), { overrideProcessEnv: true });

const dateOrLatest = readArg("date") ?? "latest";
const limit = readPositiveIntArg("limit", 120);
const batchSize = readPositiveIntArg("batch-size", 8);
const view = buildProjectsView(dateOrLatest);
const date = view.context.selected_date ?? dateOrLatest;
const targets = view.projects.filter(needsChineseIntro);
const artifact = await generateMissionScoutEnhancements({
  date,
  signals: targets.map(toSignal),
  limit,
  batchSize,
});

console.log(
  JSON.stringify(
    {
      date,
      visible_projects: view.projects.length,
      targets: targets.length,
      enhanced_entries: artifact.entries.length,
    },
    null,
    2,
  ),
);
