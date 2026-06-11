import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildEnhancedDailyReport, renderDailyReport } from "./action/dailyReport.ts";
import { buildVerifyDailyResult, renderVerifyDailyResult } from "./action/dailyVerification.ts";
import { buildKnowledgeCard, knowledgeCardSlug, renderKnowledgeCard } from "./action/knowledgeCard.ts";
import { buildDailyRunSummary, renderDailyRunSummary } from "./action/runSummary.ts";
import { renderWeeklyReport } from "./action/weeklyReport.ts";
import { buildWeeklyArtifactsWithEnhancement } from "./action/weeklyEnhancement.ts";
import { classifyProjects, classifyProjectsDetailed, serializeClassificationArtifacts } from "./llmClassification.ts";
import { loadConfig } from "./config.ts";
import { toLocalDateStr, toLocalIsoString } from "./date.ts";
import { assertValidDateOnly, assertValidDateOnlyOrLatest } from "./dateInput.ts";
import { scoreProjects } from "./filter/scoring.ts";
import { Logger } from "./logger.ts";
import { loadRuntimeEnv } from "./env.ts";
import { configureGlobalNetworkProxy } from "./network/proxy.ts";
import { normalizeSignals } from "./normalize.ts";
import { collectRawSignalsDetailed } from "./signal/index.ts";
import { collectEcosystemFocusObserver, writeEcosystemFocusObserverArtifact } from "./signal/ecosystemFocusObserver.ts";
import { captureTrackedRepoStarSnapshots } from "./signal/githubTrackedStars.ts";
import {
  ensureDataDirs,
  readJsonFile,
  readTextFile,
  writeJsonFile,
  writeTextFile,
} from "./storage/files.ts";
import type { AppConfig } from "./config.ts";
import type { DailyFreshnessSource, DailyReport, DailyRunSummary, NormalizedProject, RawSignal, ScoredProject, VerifyDailyResult } from "./types.ts";
import type { ClassificationArtifact, ClassificationRunDiagnostics, SemanticClassification } from "./llmClassification.ts";
import type { RunAgentTaskWorkflowInput, TaskExecutionReceipt } from "./agentMemory/index.ts";
import { renderVisualConsole } from "./visualConsole/index.ts";
import { listAvailableDailyDates, listAvailableWeeklyAnchors } from "./visualConsole/readLayer.ts";
import { planWeeklySync } from "./weeklyCadence.ts";
import {
  buildInitialManualRegistry,
  buildProjectFacts,
  buildRoutingManifest,
  runAgentTaskWorkflow,
  validateManualRegistryFreshness,
  validateManifestFreshness,
  validateProjectFactsFreshness,
  writeManualRegistryFiles,
  writeProjectFactsFiles,
  writeRoutingManifest,
} from "./agentMemory/index.ts";

interface CliOptions {
  date: string;
  dryRun: boolean;
  backfillMissingDays?: boolean;
  enrichGithub: boolean;
  includeAgentsRadar: boolean;
  includeTrendshift: boolean;
  configPath: string;
  view?: "overview" | "projects" | "weekly" | "run-health" | "observer" | "knowledge-base" | "kb";
  project?: string;
  slug?: string;
  trendKey?: string;
  sourceView?: "overview" | "projects" | "weekly";
  anchorDate?: string;
  recordAgentMemory?: boolean;
  inputPath?: string;
}

type FlagHandler = (opts: CliOptions, argv: string[], index: number) => number;

const FLAG_HANDLERS: Record<string, FlagHandler> = {
  "--dry-run": (opts, _argv, index) => {
    opts.dryRun = true;
    return index;
  },
  "--backfill-missing-days": (opts, _argv, index) => {
    opts.backfillMissingDays = true;
    return index;
  },
  "--no-github": (opts, _argv, index) => {
    opts.enrichGithub = false;
    return index;
  },
  "--no-agents-radar": (opts, _argv, index) => {
    opts.includeAgentsRadar = false;
    return index;
  },
  "--no-trendshift": (opts, _argv, index) => {
    opts.includeTrendshift = false;
    return index;
  },
  "--record-agent-memory": (opts, _argv, index) => {
    opts.recordAgentMemory = true;
    return index;
  },
  "--no-record-agent-memory": (opts, _argv, index) => {
    opts.recordAgentMemory = false;
    return index;
  },
  "--config": (opts, argv, index) => {
    if (argv[index + 1]) opts.configPath = argv[index + 1] ?? opts.configPath;
    return index + 1;
  },
  "--date": (opts, argv, index) => {
    if (argv[index + 1]) opts.date = argv[index + 1] ?? opts.date;
    return index + 1;
  },
  "--view": (opts, argv, index) => {
    const value = argv[index + 1] as CliOptions["view"] | undefined;
    if (value) opts.view = value === "kb" ? "knowledge-base" : value;
    return index + 1;
  },
  "--project": (opts, argv, index) => {
    if (argv[index + 1]) opts.project = argv[index + 1];
    return index + 1;
  },
  "--slug": (opts, argv, index) => {
    if (argv[index + 1]) opts.slug = argv[index + 1];
    return index + 1;
  },
  "--trend-key": (opts, argv, index) => {
    if (argv[index + 1]) opts.trendKey = argv[index + 1];
    return index + 1;
  },
  "--source-view": (opts, argv, index) => {
    const value = argv[index + 1] as CliOptions["sourceView"] | undefined;
    if (value) opts.sourceView = value;
    return index + 1;
  },
  "--anchor-date": (opts, argv, index) => {
    if (argv[index + 1]) opts.anchorDate = argv[index + 1];
    return index + 1;
  },
  "--input": (opts, argv, index) => {
    if (argv[index + 1]) opts.inputPath = argv[index + 1];
    return index + 1;
  },
};

function parseArgs(argv: string[]): { command: string; opts: CliOptions } {
  const command = argv[2] ?? "run-daily";
  const opts: CliOptions = {
    date: toLocalDateStr(new Date()),
    dryRun: false,
    backfillMissingDays: false,
    enrichGithub: true,
    includeAgentsRadar: true,
    includeTrendshift: true,
    configPath: "config.yaml",
    view: "overview",
    recordAgentMemory: false,
  };

  for (let i = 3; i < argv.length; i++) {
    const handler = FLAG_HANDLERS[argv[i] ?? ""];
    if (handler) i = handler(opts, argv, i);
  }

  if (command === "visual-console") {
    assertValidDateOnlyOrLatest(opts.date, "--date");
  } else {
    assertValidDateOnly(opts.date, "--date");
  }
  if (opts.anchorDate) assertValidDateOnlyOrLatest(opts.anchorDate, "--anchor-date");

  return { command, opts };
}

function scorePath(date: string): string {
  return path.join("data", "scores", `${date}.json`);
}

function weeklyAuditPath(date: string): string {
  return path.join("data", "reports", `${date}.weekly.audit.json`);
}

function normalizedPath(date: string): string {
  return path.join("data", "normalized", `${date}.json`);
}

function previousNormalizedPath(date: string): string | undefined {
  const normalizedDir = path.join("data", "normalized");
  if (!fs.existsSync(normalizedDir)) return undefined;

  const datedFiles = fs
    .readdirSync(normalizedDir)
    .filter((entry) => /^\d{4}-\d{2}-\d{2}\.json$/.test(entry))
    .map((entry) => entry.replace(/\.json$/, ""));

  const candidate = datedFiles
    .filter((entryDate) => entryDate < date)
    .sort((a, b) => b.localeCompare(a))[0];

  if (candidate) return normalizedPath(candidate);
  if (datedFiles.length === 0) return path.join("data", "normalized", "latest.json");
  return undefined;
}

function runSummaryJsonPath(date: string): string {
  return path.join("data", "reports", `${date}.run-summary.json`);
}

function runSummaryMarkdownPath(date: string): string {
  return path.join("data", "reports", `${date}.run-summary.md`);
}

function verifyDailyJsonPath(date: string): string {
  return path.join("data", "reports", `${date}.verify-daily.json`);
}

function dailyReportJsonPath(date: string): string {
  return path.join("data", "reports", `${date}.daily.json`);
}

function dailyReportMarkdownPath(date: string): string {
  return path.join("data", "reports", `${date}.daily.md`);
}

type AgentMemoryCliTaskSpec = {
  now: string;
  command: string;
  userRequest: string;
  taskTitle: string;
  explicitPaths: string[];
  filesTouched: string[];
  result: TaskExecutionReceipt["result"];
  resultReason: TaskExecutionReceipt["result_reason"];
};

function ensureAgentMemoryFoundation(rootDir: string, now: string): void {
  const registry = validateManualRegistryFreshness(rootDir);
  if (registry.status !== "available") {
    writeManualRegistryFiles(rootDir, buildInitialManualRegistry(rootDir, now));
  }

  const facts = validateProjectFactsFreshness(rootDir);
  if (facts.status !== "available") {
    writeProjectFactsFiles(rootDir, buildProjectFacts(rootDir, now));
  }

  const manifest = validateManifestFreshness(rootDir);
  if (manifest.status !== "fresh") {
    writeRoutingManifest(rootDir, buildRoutingManifest(rootDir, now));
  }
}

function recordCliAgentMemoryTask(logger: Logger, opts: CliOptions, spec: AgentMemoryCliTaskSpec): void {
  if (opts.recordAgentMemory !== true) return;
  const rootDir = process.cwd();
  try {
    ensureAgentMemoryFoundation(rootDir, spec.now);
    runAgentTaskWorkflow({
      rootDir,
      now: spec.now,
      userRequest: spec.userRequest,
      taskTitle: spec.taskTitle,
      explicitPaths: spec.explicitPaths,
      gateEvidenceById: {},
      commands: [
        {
          seq: 1,
          command: spec.command,
          exit_status: spec.result === "success" ? "passed" : "failed",
          runtime_context: "project-env",
          writes_repo_files: false,
          touches_outside_repo: false,
          uses_checked_in_entrypoint: true,
          evidence_ref: `cli://${spec.command.replace(/\s+/g, " ").trim()}`,
        },
      ],
      filesTouched: spec.filesTouched,
      verificationBindings: [
        {
          command_seq: 1,
          kind: "verification-command",
          status: spec.result === "success" ? "passed" : "failed",
        },
      ],
      autoReuseMatchedSkills: true,
      result: spec.result,
      resultReason: spec.resultReason,
    });
  } catch (error) {
    logger.error("agent-memory task recording failed", {
      command: spec.command,
      date: opts.date,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function readCachedClassificationMap(projects: NormalizedProject[]): Map<string, SemanticClassification> {
  const artifacts = readJsonFile<ClassificationArtifact[]>(path.join("data", "classifications", "latest.json"), []);
  const availableKeys = new Set(projects.map((project) => project.repo_full_name.toLowerCase()));
  const map = new Map<string, SemanticClassification>();

  for (const artifact of artifacts) {
    const key = artifact.repo_full_name.toLowerCase();
    if (!availableKeys.has(key)) continue;
    map.set(key, artifact.classification);
  }

  return map;
}

function classificationMapFromArtifacts(artifacts: ClassificationArtifact[]): Map<string, SemanticClassification> {
  const map = new Map<string, SemanticClassification>();
  for (const artifact of artifacts) {
    map.set(artifact.repo_full_name.toLowerCase(), artifact.classification);
  }
  return map;
}

async function classifyProjectsWithCache(
  projects: NormalizedProject[],
  config: ReturnType<typeof loadConfig>,
): Promise<{ classifications: Map<string, SemanticClassification>; diagnostics: ClassificationRunDiagnostics }> {
  const cached = readCachedClassificationMap(projects);
  const missingProjects = projects.filter((project) => !cached.has(project.repo_full_name.toLowerCase()));
  const fresh = await classifyProjectsDetailed(missingProjects, config);
  const merged = new Map<string, SemanticClassification>(cached);

  for (const [key, value] of fresh.classifications) {
    merged.set(key, value);
  }

  return {
    classifications: merged,
    diagnostics: {
      ...fresh.diagnostics,
      classification_cache_hit_count: cached.size,
    },
  };
}

async function classifyProjectsSimpleWithCache(
  projects: NormalizedProject[],
  config: ReturnType<typeof loadConfig>,
): Promise<Map<string, SemanticClassification>> {
  const cached = readCachedClassificationMap(projects);
  const missingProjects = projects.filter((project) => !cached.has(project.repo_full_name.toLowerCase()));
  const fresh = await classifyProjects(missingProjects, config);
  const merged = new Map<string, SemanticClassification>(cached);

  for (const [key, value] of fresh) {
    merged.set(key, value);
  }

  return merged;
}

function inferFreshnessSourcesFromRaw(raw: RawSignal[], date: string): DailyFreshnessSource[] {
  const seen = new Set(raw.filter((signal) => signal.timestamp.slice(0, 10) === date).map((signal) => signal.source));
  const sources: DailyFreshnessSource[] = [];

  if (seen.has("agents-radar")) {
    sources.push({
      source: "agents-radar",
      effective_date: date,
      freshness_state: "fresh_today",
      status_summary_cn: `agents-radar 已同步，可读取 ${date} 的上下文摘要`,
      from_realtime_run: false,
      source_role: "context",
    });
  }
  if (seen.has("trendshift")) {
    sources.push({
      source: "trendshift_live",
      effective_date: date,
      freshness_state: "fresh_today",
      status_summary_cn: `Trendshift 快照可用，已恢复 ${date} 的趋势信号`,
      from_realtime_run: false,
      source_role: "freshness-driving",
    });
  }
  if (seen.has("github_trending")) {
    sources.push({
      source: "github_trending",
      effective_date: date,
      freshness_state: "fresh_today",
      status_summary_cn: `GitHub Trending 快照可用，已恢复 ${date} 的热度信号`,
      from_realtime_run: false,
      source_role: "freshness-driving",
    });
  }
  if (seen.has("github_live_star_delta")) {
    sources.push({
      source: "github_live_star_delta",
      effective_date: date,
      freshness_state: "fresh_today",
      status_summary_cn: `GitHub star delta 快照可用，已恢复 ${date} 的增量信号`,
      from_realtime_run: false,
      source_role: "freshness-driving",
    });
  }
  if (seen.has("watchlist_live_activity")) {
    sources.push({
      source: "watchlist_live_activity",
      effective_date: date,
      freshness_state: "fresh_today",
      status_summary_cn: `Watchlist 活动快照可用，已恢复 ${date} 的观察清单信号`,
      from_realtime_run: false,
      source_role: "freshness-driving",
    });
  }

  return sources;
}

function existingLatestReportDate(): string | null {
  const latestSummary = readJsonFile<{ date?: string } | null>(path.join("data", "reports", "latest.run-summary.json"), null);
  const fromSummary = typeof latestSummary?.date === "string" ? latestSummary.date : null;
  const datedReports = listAvailableDailyDates();
  const fromDatedReports = datedReports.at(-1) ?? null;
  return [fromSummary, fromDatedReports].filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
}

function shouldRefreshLatestDailyArtifacts(date: string): boolean {
  const latest = existingLatestReportDate();
  return !latest || date >= latest;
}

function githubEnrichmentAuditPath(date: string): string {
  return path.join("data", "raw", "github", `${date}.enrichment.json`);
}

function shiftDateStr(date: string, deltaDays: number): string {
  const utc = new Date(`${date}T00:00:00.000Z`);
  utc.setUTCDate(utc.getUTCDate() + deltaDays);
  return utc.toISOString().slice(0, 10);
}

type WeeklyWindowDay = {
  date: string;
  scored: ScoredProject[];
  daily: DailyReport;
};

function hasWeeklyVisibleProjectLists(report: unknown): report is DailyReport {
  if (!report || typeof report !== "object") return false;
  const candidate = report as Partial<DailyReport>;
  return Array.isArray(candidate.today_star_projects) && Array.isArray(candidate.context_only_projects);
}

function inspectWeeklyWindowDays(opts: CliOptions): { days: WeeklyWindowDay[]; missingDays: string[] } {
  const missingDays: string[] = [];

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = shiftDateStr(opts.date, index - 6);
    const scoreFile = scorePath(date);
    const dailyFile = path.join("data", "reports", `${date}.daily.json`);
    const scoreExists = fs.existsSync(scoreFile);
    const dailyExists = fs.existsSync(dailyFile);
    let dailyReport: DailyReport | null = null;

    if (scoreExists && dailyExists) {
      const parsedDaily = readJsonFile<unknown>(dailyFile, null);
      if (hasWeeklyVisibleProjectLists(parsedDaily)) {
        dailyReport = parsedDaily;
      } else {
        missingDays.push(date);
      }
    } else {
      missingDays.push(date);
    }

    return {
      date,
      scored: scoreExists ? readJsonFile<ScoredProject[]>(scoreFile, []) : [],
      daily: (dailyReport ?? null) as unknown as DailyReport,
    };
  });

  return {
    days,
    missingDays: [...new Set(missingDays)],
  };
}

function formatMissingWeeklyWindowMessage(date: string, missingDays: string[]): string {
  const missingList = [...new Set(missingDays)].join(", ");
  const retryCommand =
    date === toLocalDateStr(new Date())
      ? "corepack pnpm run-weekly -- --backfill-missing-days"
      : `corepack pnpm run-weekly -- --date ${date} --backfill-missing-days`;
  return [
    `run-weekly requires a complete 7-day canonical window. Missing or incompatible daily data for: ${missingList}.`,
    `Run \`corepack pnpm run-daily -- --date <missing-date>\` for each missing day first, or retry with \`${retryCommand}\`.`,
  ].join(" ");
}

async function backfillMissingWeeklyWindowDays(opts: CliOptions, missingDays: string[], logger: Logger): Promise<void> {
  for (const missingDate of [...new Set(missingDays)].sort()) {
    logger.info("weekly window backfill started", {
      missingDate,
      anchorDate: opts.date,
      dryRun: opts.dryRun,
    });
    await runDaily({
      ...opts,
      date: missingDate,
    });
  }
}

export async function runDaily(opts: CliOptions): Promise<void> {
  const config = loadConfig(opts.configPath);
  const dryRun = opts.dryRun || config.runtime.dryRunDefault;
  const logger = new Logger(config.runtime.logging);
  const generatedAt = toLocalIsoString(new Date());

  ensureDataDirs();

  const collection = await collectRawSignalsDetailed(config, logger, {
    date: opts.date,
    dryRun,
    enrichGithub: opts.enrichGithub,
    includeAgentsRadar: opts.includeAgentsRadar,
    includeTrendshift: opts.includeTrendshift,
  });
  const raw = collection.rawSignals;
  writeJsonFile(path.join("data", "raw", "latest.json"), raw, dryRun);
  writeJsonFile(path.join("data", "raw", `${opts.date}.json`), raw, dryRun);
  writeJsonFile(githubEnrichmentAuditPath(opts.date), collection.githubEnrichment, dryRun);
  writeJsonFile(path.join("data", "raw", "github", "latest.enrichment.json"), collection.githubEnrichment, dryRun);

  const previous = readJsonFile<NormalizedProject[]>(previousNormalizedPath(opts.date) ?? "", []);
  const normalized = normalizeSignals(raw, previous);
  writeJsonFile(normalizedPath(opts.date), normalized, dryRun);
  writeJsonFile(path.join("data", "normalized", "latest.json"), normalized, dryRun);

  const [observer, { classifications, diagnostics: llmDiagnostics }] = await Promise.all([
    collectEcosystemFocusObserver(config.sources.ecosystemFocus, {
      date: opts.date,
      generatedAt,
      dryRun,
      dailyCandidateProjects: normalized,
      llmConfig: config.llm,
    }),
    classifyProjectsWithCache(normalized, config),
  ]);
  writeEcosystemFocusObserverArtifact(observer.artifact, process.cwd(), dryRun);
  const classificationArtifacts = serializeClassificationArtifacts(normalized, classifications);
  writeJsonFile(path.join("data", "classifications", `${opts.date}.json`), classificationArtifacts, dryRun);
  writeJsonFile(path.join("data", "classifications", "latest.json"), classificationArtifacts, dryRun);
  const scored = scoreProjects(normalized, config, classifications);
  writeJsonFile(scorePath(opts.date), scored, dryRun);
  writeJsonFile(path.join("data", "scores", "latest.json"), scored, dryRun);

  // report needs freshness metadata to drive the new first-screen layout.
  const reportWithFreshness = await buildEnhancedDailyReport(scored, config, {
    date: opts.date,
    generatedAt,
    freshnessSources: collection.freshnessSources,
  });
  reportWithFreshness.llm_diagnostics = {
    enabled: reportWithFreshness.llm_diagnostics?.enabled ?? llmDiagnostics.enabled,
    provider: reportWithFreshness.llm_diagnostics?.provider ?? llmDiagnostics.provider,
    mode: llmDiagnostics.mode,
    classification_cache_hit_count: llmDiagnostics.classification_cache_hit_count,
    classification_attempt_count: llmDiagnostics.classification_attempt_count,
    classification_success_count: llmDiagnostics.classification_success_count,
    classification_failure_count: llmDiagnostics.classification_failure_count,
    classification_last_error: llmDiagnostics.classification_last_error,
    summary_attempt_count: reportWithFreshness.llm_diagnostics?.summary_attempt_count,
    summary_success_count: reportWithFreshness.llm_diagnostics?.summary_success_count,
    summary_failure_count: reportWithFreshness.llm_diagnostics?.summary_failure_count,
    summary_last_error: reportWithFreshness.llm_diagnostics?.summary_last_error,
    judge_attempt_count: reportWithFreshness.llm_diagnostics?.judge_attempt_count,
    judge_success_count: reportWithFreshness.llm_diagnostics?.judge_success_count,
    judge_failure_count: reportWithFreshness.llm_diagnostics?.judge_failure_count,
    judge_last_error: reportWithFreshness.llm_diagnostics?.judge_last_error,
  };
  writeJsonFile(path.join("data", "reports", `${opts.date}.daily.json`), reportWithFreshness, dryRun);
  writeTextFile(path.join("data", "reports", `${opts.date}.daily.md`), renderDailyReport(reportWithFreshness), dryRun);

  const runSummary = buildDailyRunSummary(raw, scored, reportWithFreshness, {
    date: opts.date,
    generatedAt,
    dryRun,
    sourceStatus: collection.sourceStatus,
    classificationsCount: classificationArtifacts.length,
    llmDiagnostics,
    githubStarDelta: collection.githubStarDelta,
    observer: {
      status: observer.artifact.status,
      candidateCount: observer.artifact.candidate_count,
      ecosystemCounts: observer.artifact.ecosystem_counts,
      topCandidates: observer.artifact.entries.map((entry) => ({
        repo_full_name: entry.repo_full_name,
        repo_url: entry.repo_url,
        observer_rank: entry.observer_rank,
        base_observer_score: entry.base_observer_score,
        observer_score: entry.observer_score,
        ecosystems: entry.ecosystems,
        labels: entry.labels,
        freshness_label: entry.freshness_label,
        breakout_label: entry.breakout_label,
        ecosystem_depth_label: entry.ecosystem_depth_label,
        long_tail_reason: entry.long_tail_reason,
        pedigree: entry.pedigree,
        entity_tier: entry.entity_tier,
        historical_precision_score: entry.historical_precision_score,
        historical_precision_label: entry.historical_precision_label,
        project_brief_cn: entry.project_brief_cn,
        why_now_cn: entry.why_now_cn,
        watch_next_cn: entry.watch_next_cn,
        summary_source: entry.summary_source,
        position_qualification: entry.position_qualification,
        position_rationale_cn: entry.position_rationale_cn,
        judge_score_delta: entry.judge_score_delta,
        judge_source: entry.judge_source,
        matched_by: entry.matched_by,
        source_notes: entry.source_notes,
      })),
    },
  });
  writeJsonFile(runSummaryJsonPath(opts.date), runSummary, dryRun);
  writeJsonFile(path.join("data", "reports", "latest.run-summary.json"), runSummary, dryRun);
  writeTextFile(runSummaryMarkdownPath(opts.date), renderDailyRunSummary(runSummary), dryRun);
  writeTextFile(path.join("data", "reports", "latest.run-summary.md"), renderDailyRunSummary(runSummary), dryRun);

  logger.info("daily loop completed", {
    raw: raw.length,
    normalized: normalized.length,
    classifications: classificationArtifacts.length,
    scored: scored.length,
    observerCandidates: observer.artifact.candidate_count,
    observerStatus: observer.artifact.status,
    dryRun,
    minimumViableRunCompleted: runSummary.minimum_viable_run_completed,
  });
  recordCliAgentMemoryTask(logger, opts, {
    now: generatedAt,
    command: `pnpm run-daily -- --date ${opts.date}${dryRun ? " --dry-run" : ""}`,
    userRequest: `operate the daily automation workflow and refresh daily report artifacts for ${opts.date}`,
    taskTitle: "run-daily automation workflow",
    explicitPaths: ["scripts/automationDailyPipeline.sh", "data/raw/", "data/normalized/", "data/classifications/", "data/scores/", "data/reports/"],
    filesTouched: [
      path.join("data", "raw", "latest.json"),
      path.join("data", "raw", `${opts.date}.json`),
      githubEnrichmentAuditPath(opts.date),
      path.join("data", "raw", "github", "latest.enrichment.json"),
      normalizedPath(opts.date),
      path.join("data", "normalized", "latest.json"),
      path.join("data", "classifications", `${opts.date}.json`),
      path.join("data", "classifications", "latest.json"),
      scorePath(opts.date),
      path.join("data", "scores", "latest.json"),
      dailyReportJsonPath(opts.date),
      dailyReportMarkdownPath(opts.date),
      runSummaryJsonPath(opts.date),
      runSummaryMarkdownPath(opts.date),
      path.join("data", "reports", "latest.run-summary.json"),
      path.join("data", "reports", "latest.run-summary.md"),
    ],
    result: "success",
    resultReason: "none",
  });
}

function readRecoverRawSignals(date: string): RawSignal[] {
  const raw = readJsonFile<RawSignal[]>(path.join("data", "raw", `${date}.json`), []);
  if (raw.length === 0) {
    throw new Error(`recover-daily requires cached raw signals at data/raw/${date}.json`);
  }

  return raw;
}

function recoverNormalizedProjects(raw: RawSignal[], date: string, dryRun: boolean): NormalizedProject[] {
  let normalized = readJsonFile<NormalizedProject[]>(normalizedPath(date), []);
  if (normalized.length === 0) {
    const previous = readJsonFile<NormalizedProject[]>(previousNormalizedPath(date) ?? "", []);
    normalized = normalizeSignals(raw, previous);
    writeJsonFile(normalizedPath(date), normalized, dryRun);
  }

  return normalized;
}

async function recoverClassificationArtifacts(
  normalized: NormalizedProject[],
  config: AppConfig,
  date: string,
  dryRun: boolean,
): Promise<{ classificationArtifacts: ClassificationArtifact[]; classifications: Map<string, SemanticClassification> }> {
  let classificationArtifacts = readJsonFile<ClassificationArtifact[]>(path.join("data", "classifications", `${date}.json`), []);
  let classifications = classificationMapFromArtifacts(classificationArtifacts);
  if (classificationArtifacts.length === 0) {
    classifications = await classifyProjectsSimpleWithCache(normalized, config);
    classificationArtifacts = serializeClassificationArtifacts(normalized, classifications);
    writeJsonFile(path.join("data", "classifications", `${date}.json`), classificationArtifacts, dryRun);
  }

  return { classificationArtifacts, classifications };
}

function recoverScoredProjects(
  normalized: NormalizedProject[],
  config: AppConfig,
  classifications: Map<string, SemanticClassification>,
  date: string,
  dryRun: boolean,
): ScoredProject[] {
  let scored = readJsonFile<ScoredProject[]>(scorePath(date), []);
  if (scored.length === 0) {
    scored = scoreProjects(normalized, config, classifications);
    writeJsonFile(scorePath(date), scored, dryRun);
  }

  return scored;
}

function refreshLatestRecoveredArtifacts(
  date: string,
  runSummary: DailyRunSummary,
  verifyResult: VerifyDailyResult,
  dryRun: boolean,
): void {
  if (!shouldRefreshLatestDailyArtifacts(date)) {
    return;
  }

  writeJsonFile(path.join("data", "reports", "latest.run-summary.json"), runSummary, dryRun);
  writeTextFile(path.join("data", "reports", "latest.run-summary.md"), renderDailyRunSummary(runSummary), dryRun);
  writeJsonFile(path.join("data", "reports", "latest.verify-daily.json"), verifyResult, dryRun);
}

export async function recoverDailyArtifacts(opts: CliOptions): Promise<void> {
  const config = loadConfig(opts.configPath);
  const dryRun = opts.dryRun || config.runtime.dryRunDefault;
  const logger = new Logger(config.runtime.logging);
  const generatedAt = toLocalIsoString(new Date());

  ensureDataDirs();

  const raw = readRecoverRawSignals(opts.date);
  const normalized = recoverNormalizedProjects(raw, opts.date, dryRun);
  const { classificationArtifacts, classifications } = await recoverClassificationArtifacts(normalized, config, opts.date, dryRun);
  const scored = recoverScoredProjects(normalized, config, classifications, opts.date, dryRun);

  const freshnessSources = inferFreshnessSourcesFromRaw(raw, opts.date);
  const report = await buildEnhancedDailyReport(scored, config, {
    date: opts.date,
    generatedAt,
    freshnessSources,
    rawSignals: raw,
  });
  writeJsonFile(dailyReportJsonPath(opts.date), report, dryRun);
  writeTextFile(dailyReportMarkdownPath(opts.date), renderDailyReport(report), dryRun);

  const runSummary = buildDailyRunSummary(raw, scored, report, {
    date: opts.date,
    generatedAt,
    dryRun,
    classificationsCount: classificationArtifacts.length,
  });
  writeJsonFile(runSummaryJsonPath(opts.date), runSummary, dryRun);
  writeTextFile(runSummaryMarkdownPath(opts.date), renderDailyRunSummary(runSummary), dryRun);

  const verifyResult = buildVerifyDailyResult(opts.date);
  writeJsonFile(verifyDailyJsonPath(opts.date), verifyResult, dryRun);
  refreshLatestRecoveredArtifacts(opts.date, runSummary, verifyResult, dryRun);

  logger.info("daily artifact recovery completed", {
    date: opts.date,
    raw: raw.length,
    normalized: normalized.length,
    classifications: classificationArtifacts.length,
    scored: scored.length,
    dryRun,
  });
}

export async function runScore(opts: CliOptions): Promise<void> {
  const config = loadConfig(opts.configPath);
  const dryRun = opts.dryRun || config.runtime.dryRunDefault;
  const logger = new Logger(config.runtime.logging);
  const generatedAt = toLocalIsoString(new Date());
  ensureDataDirs();

  const normalized = readJsonFile<NormalizedProject[]>(normalizedPath(opts.date), readJsonFile("data/normalized/latest.json", []));
  const classifications = await classifyProjectsSimpleWithCache(normalized, config);
  const classificationArtifacts = serializeClassificationArtifacts(normalized, classifications);
  writeJsonFile(path.join("data", "classifications", `${opts.date}.json`), classificationArtifacts, dryRun);
  writeJsonFile(path.join("data", "classifications", "latest.json"), classificationArtifacts, dryRun);
  const scored = scoreProjects(normalized, config, classifications);
  writeJsonFile(scorePath(opts.date), scored, dryRun);
  writeJsonFile(path.join("data", "scores", "latest.json"), scored, dryRun);

  logger.info("score completed", {
    normalized: normalized.length,
    classifications: classificationArtifacts.length,
    scored: scored.length,
    dryRun,
  });
  recordCliAgentMemoryTask(logger, opts, {
    now: generatedAt,
    command: `pnpm score -- --date ${opts.date}`,
    userRequest: `operate the score workflow and refresh classification and score artifacts for ${opts.date}`,
    taskTitle: "score automation workflow",
    explicitPaths: ["data/classifications/", "data/scores/"],
    filesTouched: [
      path.join("data", "classifications", `${opts.date}.json`),
      path.join("data", "classifications", "latest.json"),
      scorePath(opts.date),
      path.join("data", "scores", "latest.json"),
    ],
    result: "success",
    resultReason: "none",
  });
}

export async function runWeekly(opts: CliOptions): Promise<void> {
  const config = loadConfig(opts.configPath);
  const dryRun = opts.dryRun || config.runtime.dryRunDefault;
  const logger = new Logger(config.runtime.logging);
  ensureDataDirs();

  const generatedAt = toLocalIsoString(new Date());
  let windowState = inspectWeeklyWindowDays(opts);

  if (windowState.missingDays.length > 0 && opts.backfillMissingDays) {
    await backfillMissingWeeklyWindowDays(
      {
        ...opts,
        dryRun,
      },
      windowState.missingDays,
      logger,
    );
    windowState = inspectWeeklyWindowDays(opts);
  }

  if (windowState.missingDays.length > 0) {
    throw new Error(formatMissingWeeklyWindowMessage(opts.date, windowState.missingDays));
  }

  const days = windowState.days;
  const artifacts = await buildWeeklyArtifactsWithEnhancement(days, config);

  writeJsonFile(path.join("data", "reports", `${opts.date}.weekly.json`), artifacts.report, dryRun);
  writeJsonFile(path.join("data", "reports", `${opts.date}.weekly.judgment.json`), artifacts.judgment, dryRun);
  writeTextFile(
    path.join("data", "reports", `${opts.date}.weekly.md`),
    renderWeeklyReport(artifacts.report, { judgment: artifacts.judgment }),
    dryRun,
  );
  let auditWriteError: Error | undefined;
  try {
    writeJsonFile(weeklyAuditPath(opts.date), artifacts.audit, dryRun);
  } catch (error) {
    auditWriteError = error instanceof Error ? error : new Error(String(error));
    logger.error("weekly audit write failed", {
      date: opts.date,
      dryRun,
      error: auditWriteError.message,
    });
  }

  if (auditWriteError) {
    throw new Error(`weekly audit write failed for ${opts.date}: ${auditWriteError.message}`);
  }

  logger.info("weekly report completed", {
    days: days.length,
    established_trends: artifacts.judgment.established_trends.length,
    observing_trends: artifacts.judgment.observing_trends.length,
    dryRun,
  });
  recordCliAgentMemoryTask(logger, opts, {
    now: generatedAt,
    command: `pnpm run-weekly -- --date ${opts.date}${opts.backfillMissingDays ? " --backfill-missing-days" : ""}${dryRun ? " --dry-run" : ""}`,
    userRequest: `operate the weekly automation workflow and refresh weekly report artifacts for ${opts.date}`,
    taskTitle: "run-weekly automation workflow",
    explicitPaths: ["scripts/automationWeeklyPipeline.sh", "data/reports/"],
    filesTouched: [
      path.join("data", "reports", `${opts.date}.weekly.json`),
      path.join("data", "reports", `${opts.date}.weekly.judgment.json`),
      path.join("data", "reports", `${opts.date}.weekly.md`),
      weeklyAuditPath(opts.date),
    ],
    result: "success",
    resultReason: "none",
  });
}

export async function syncWeeklyReports(opts: CliOptions): Promise<void> {
  const config = loadConfig(opts.configPath);
  const dryRun = opts.dryRun || config.runtime.dryRunDefault;
  const logger = new Logger(config.runtime.logging);
  ensureDataDirs();

  const plan = planWeeklySync({
    availableDailyDates: listAvailableDailyDates(),
    existingWeeklyAnchors: listAvailableWeeklyAnchors(),
    targetDate: opts.date,
  });

  if (plan.dueAnchors.length === 0) {
    logger.info("weekly sync skipped", {
      targetDate: opts.date,
      lastExistingAnchor: plan.lastExistingAnchor,
      baselineAnchor: plan.baselineAnchor,
      dryRun,
    });
    return;
  }

  for (const anchorDate of plan.dueAnchors) {
    logger.info("weekly sync generating report", {
      targetDate: opts.date,
      anchorDate,
      lastExistingAnchor: plan.lastExistingAnchor,
      dryRun,
    });
    await runWeekly({
      ...opts,
      date: anchorDate,
      dryRun,
    });
  }
}

export async function verifyDaily(opts: CliOptions): Promise<void> {
  const config = loadConfig(opts.configPath);
  const logger = new Logger(config.runtime.logging);
  const generatedAt = toLocalIsoString(new Date());
  const result = buildVerifyDailyResult(opts.date);
  writeJsonFile(verifyDailyJsonPath(opts.date), result, opts.dryRun);
  writeJsonFile(path.join("data", "reports", "latest.verify-daily.json"), result, opts.dryRun);
  const output = renderVerifyDailyResult(result);
  console.log(output);
  recordCliAgentMemoryTask(logger, opts, {
    now: generatedAt,
    command: `pnpm verify-daily -- --date ${opts.date}${opts.dryRun ? " --dry-run" : ""}`,
    userRequest: `verify the daily automation outputs for ${opts.date}`,
    taskTitle: "verify-daily automation workflow",
    explicitPaths: ["data/reports/"],
    filesTouched: [verifyDailyJsonPath(opts.date), path.join("data", "reports", "latest.verify-daily.json")],
    result: result.status === "fail" ? "failed" : "success",
    resultReason: result.status === "fail" ? "verification-failed" : "none",
  });

  if (result.status === "fail") {
    throw new Error(`verify-daily failed for ${opts.date}`);
  }
}

export async function buildKb(opts: CliOptions): Promise<void> {
  const config = loadConfig(opts.configPath);
  const dryRun = opts.dryRun || config.runtime.dryRunDefault;
  const logger = new Logger(config.runtime.logging);
  const generatedAt = toLocalIsoString(new Date());
  ensureDataDirs();

  const scored = readJsonFile<ScoredProject[]>(path.join("data", "scores", "latest.json"), []);
  const updatedAt = toLocalIsoString(new Date());
  const cards = scored.map((item) => buildKnowledgeCard(item, updatedAt));
  writeJsonFile(path.join("data", "kb", "latest.json"), cards, dryRun);

  for (const card of cards) {
    const slug = knowledgeCardSlug(card.project_name);
    const filePath = path.join("data", "kb", `${slug}.md`);
    const existingMarkdown = readTextFile(filePath, "");
    writeTextFile(filePath, renderKnowledgeCard(card, existingMarkdown), dryRun);
  }

  logger.info("knowledge base completed", { cards: cards.length, dryRun });
  recordCliAgentMemoryTask(logger, opts, {
    now: generatedAt,
    command: "pnpm build-kb",
    userRequest: "operate the build-kb workflow and refresh knowledge base artifacts",
    taskTitle: "build-kb automation workflow",
    explicitPaths: ["data/kb/"],
    filesTouched: [path.join("data", "kb", "latest.json")],
    result: "success",
    resultReason: "none",
  });
}

export async function recordAgentTask(opts: CliOptions): Promise<void> {
  if (!opts.inputPath?.trim()) {
    throw new Error("record-agent-task requires --input <task-json-path>");
  }
  const config = loadConfig(opts.configPath);
  const logger = new Logger(config.runtime.logging);
  ensureDataDirs();
  const payload = JSON.parse(fs.readFileSync(opts.inputPath, "utf-8")) as Omit<RunAgentTaskWorkflowInput, "rootDir">;
  ensureAgentMemoryFoundation(process.cwd(), payload.now);
  runAgentTaskWorkflow({
    ...payload,
    rootDir: process.cwd(),
  });
  logger.info("agent-memory dev task recorded", {
    inputPath: opts.inputPath,
    taskTitle: payload.taskTitle ?? payload.userRequest,
    result: payload.result,
  });
}

export async function captureGithubStars(opts: CliOptions): Promise<void> {
  const config = loadConfig(opts.configPath);
  const dryRun = opts.dryRun || config.runtime.dryRunDefault;
  const logger = new Logger(config.runtime.logging);
  ensureDataDirs();

  const result = await captureTrackedRepoStarSnapshots(opts.date, { dryRun });
  logger.info("tracked github star snapshots completed", {
    date: opts.date,
    trackedRepos: result.tracked_repo_count,
    captured: result.captured_count,
    preservedExisting: result.preserved_existing_count,
    unavailable: result.unavailable_count,
    dryRun,
  });
}

export async function visualConsole(opts: CliOptions): Promise<void> {
  const output = renderVisualConsole({
    view: opts.view ?? "overview",
    date: opts.date,
    anchorDate: opts.anchorDate,
    project: opts.project,
    slug: opts.slug,
    trendKey: opts.trendKey,
    sourceView: opts.sourceView,
  });
  console.log(output);
}

async function main(): Promise<void> {
  loadRuntimeEnv(process.cwd(), { overrideProcessEnv: true });
  configureGlobalNetworkProxy();
  const { command, opts } = parseArgs(process.argv);
  const commands: Record<string, (cliOptions: CliOptions) => Promise<void>> = {
    "run-daily": runDaily,
    "recover-daily": recoverDailyArtifacts,
    score: runScore,
    "run-weekly": runWeekly,
    "sync-weekly": syncWeeklyReports,
    "verify-daily": verifyDaily,
    "capture-github-stars": captureGithubStars,
    "build-kb": buildKb,
    "record-agent-task": recordAgentTask,
    "visual-console": visualConsole,
  };
  const runner = commands[command];
  if (!runner) {
    throw new Error(
      `Unknown command "${command}". Use run-daily, recover-daily, score, run-weekly, sync-weekly, verify-daily, capture-github-stars, build-kb, record-agent-task, or visual-console.`,
    );
  }
  await runner(opts);
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const currentPath = fileURLToPath(import.meta.url);

if (entryPath === currentPath) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
