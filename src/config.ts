/**
 * Loads and validates agent-radar configuration from config.yaml.
 */

import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { VALID_PROVIDER_NAMES } from "./providers/index.ts";
import type { ScoreComponentName, UserInterestTopicName } from "./types.ts";

export interface SourceConfig {
  observerEntityTierRegistry: {
    core: {
      builders: string[];
      companies: string[];
      engineers: string[];
    };
    proven: {
      builders: string[];
      companies: string[];
      engineers: string[];
    };
    watch: {
      builders: string[];
      companies: string[];
      engineers: string[];
    };
  };
  agentsRadar: {
    enabled: boolean;
    mode: "github-http" | "local";
    localPath: string;
    manifestPath: string;
    repoUrl?: string;
    refreshTimeoutMs?: number;
    reports: {
      daily: string[];
      weekly: string[];
      monthly: string[];
    };
  };
  trendshift: {
    enabled: boolean;
    mode: "http" | "snapshot";
    baseUrl: string;
    snapshotDir: string;
  };
  watchlistOrgs: string[];
  ecosystemFocus: {
    enabled: boolean;
    mode: "github-search";
    recentDays: number;
    perEcosystemLimit: number;
    maxTotalCandidates: number;
    historicalPrecisionDays: number;
    judgeTopN: number;
    priorityEntities: {
      builders: string[];
      companies: string[];
      engineers: string[];
    };
    entityTiers: SourceConfig["observerEntityTierRegistry"];
    ecosystems: Array<{
      name: string;
      enabled: boolean;
      keywords: string[];
      topicHints: string[];
      repoSeeds: string[];
      orgSeeds: string[];
      negativeKeywords: string[];
    }>;
  };
  userInterestProfile?: {
    enabled: boolean;
    topics: Array<{
      name: UserInterestTopicName;
      weight: number;
    }>;
  };
}

export interface LlmConfig {
  enabled: boolean;
  mode: "rules-only" | "semantic-classification";
  provider: string;
  dailyJudgeTopN?: number;
}

export type ScoreWeights = Record<ScoreComponentName, number>;

export interface ThresholdConfig {
  highScore: number;
  anomalyStarDeltaDaily: number;
  anomalyStarDeltaWeekly: number;
  minEngagementRatio: number;
  minSourcesForDiscussionBonus: number;
}

export interface RuntimeConfig {
  dryRunDefault: boolean;
  retry: {
    attempts: number;
    baseDelayMs: number;
  };
  logging: {
    level: "debug" | "info" | "warn" | "error";
    json: boolean;
  };
  mission: {
    githubSearchEnabled: boolean;
    perDirectionConcurrency: number;
    queryTimeoutMs: number;
    deepBatchLimit: number;
    allowDryRunSkipLiveDeep: boolean;
  };
}

export interface AppConfig {
  sources: SourceConfig;
  llm: LlmConfig;
  weights: ScoreWeights;
  thresholds: ThresholdConfig;
  runtime: RuntimeConfig;
}

type RawRecord = Record<string, unknown>;
type AllowedKeysSpec = readonly string[];

const DEFAULT_OBSERVER_ENTITY_TIERS: SourceConfig["observerEntityTierRegistry"] = {
  core: {
    builders: ["simonw", "paul-gauthier", "hwchase17", "karpathy"],
    companies: [
      "openai",
      "anthropics",
      "google",
      "google-gemini",
      "google-deepmind",
      "microsoft",
      "aws",
      "awslabs",
      "meta-llama",
      "xai-org",
      "mistralai",
      "cohere-ai",
      "deepseek-ai",
      "QwenLM",
    ],
    engineers: ["addyosmani"],
  },
  proven: {
    builders: ["yoheinakajima", "jxnl", "samuelcolvin", "rasbt"],
    companies: [
      "EleutherAI",
      "allenai",
      "THUDM",
      "InternLM",
      "minimax-ai",
      "ByteDance-Seed",
      "alibaba",
      "Tencent",
      "TencentARC",
      "vercel",
      "sourcegraph",
      "All-Hands-AI",
      "continuedev",
      "run-llama",
      "pydantic",
      "langchain-ai",
      "modelcontextprotocol",
      "browser-use",
      "mem0ai",
      "langfuse",
      "crewAIInc",
      "huggingface",
      "OpenBMB",
      "HKUDS",
    ],
    engineers: ["thorwebdev", "dbieber"],
  },
  watch: {
    builders: ["mckaywrigley", "swyxio", "unclecode"],
    companies: ["NousResearch", "facebookresearch", "bytedance", "camel-ai", "jina-ai", "mastra-ai", "instructor-ai"],
    engineers: [],
  },
};

function uniqueLowerStable(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function flattenObserverEntityTiers(
  tiers: SourceConfig["observerEntityTierRegistry"],
): SourceConfig["ecosystemFocus"]["priorityEntities"] {
  return {
    builders: uniqueLowerStable([...tiers.core.builders, ...tiers.proven.builders, ...tiers.watch.builders]),
    companies: uniqueLowerStable([...tiers.core.companies, ...tiers.proven.companies, ...tiers.watch.companies]),
    engineers: uniqueLowerStable([...tiers.core.engineers, ...tiers.proven.engineers, ...tiers.watch.engineers]),
  };
}

const DEFAULT_ECOSYSTEMS: SourceConfig["ecosystemFocus"]["ecosystems"] = [
  {
    name: "coding-agents",
    enabled: true,
    keywords: ["claude code", "codex", "aider", "cursor", "code review", "patch", "diff", "repo coding"],
    topicHints: ["coding-agent", "code-review"],
    repoSeeds: ["openai/codex", "Aider-AI/aider"],
    orgSeeds: ["openai", "anthropics"],
    negativeKeywords: ["video game", "gaming", "minecraft"],
  },
  {
    name: "agent-runtime",
    enabled: true,
    keywords: ["runtime", "orchestration", "workflow", "sandbox", "scheduler", "execution"],
    topicHints: ["agent-runtime", "workflow-engine"],
    repoSeeds: ["langchain-ai/langgraph", "openai/swarm"],
    orgSeeds: ["langchain-ai", "openai"],
    negativeKeywords: ["airflow", "game runtime"],
  },
  {
    name: "skills-tools-mcp",
    enabled: true,
    keywords: ["skills", "mcp", "plugin", "connector", "tool-use"],
    topicHints: ["mcp", "plugin-system"],
    repoSeeds: ["modelcontextprotocol/servers", "openai/codex"],
    orgSeeds: ["modelcontextprotocol", "openai"],
    negativeKeywords: ["minecraft plugin", "browser extension"],
  },
  {
    name: "memory-knowledge",
    enabled: true,
    keywords: ["memory", "context", "retrieval", "knowledge", "rag"],
    topicHints: ["agent-memory", "retrieval"],
    repoSeeds: ["mem0ai/mem0", "langchain-ai/langmem"],
    orgSeeds: ["mem0ai", "langchain-ai"],
    negativeKeywords: ["knowledge graph for games"],
  },
  {
    name: "browser-computer-use",
    enabled: true,
    keywords: ["browser agent", "computer use", "desktop", "gui", "automation"],
    topicHints: ["browser-automation", "computer-use"],
    repoSeeds: ["browser-use/browser-use", "microsoft/playwright-mcp"],
    orgSeeds: ["browser-use", "microsoft"],
    negativeKeywords: ["marketing automation", "gui game"],
  },
  {
    name: "eval-observability-governance",
    enabled: true,
    keywords: ["eval", "trace", "observability", "review", "guardrail", "policy"],
    topicHints: ["observability", "evals"],
    repoSeeds: ["openai/evals", "langfuse/langfuse"],
    orgSeeds: ["openai", "langfuse"],
    negativeKeywords: ["policy gradient", "code owners only"],
  },
  {
    name: "multi-agent-coordination",
    enabled: true,
    keywords: ["swarm", "multi-agent", "team", "coordination"],
    topicHints: ["multi-agent", "swarm"],
    repoSeeds: ["openai/swarm", "crewAIInc/crewAI"],
    orgSeeds: ["openai", "crewAIInc"],
    negativeKeywords: ["sports team", "team chat"],
  },
  {
    name: "agent-ui-workbench",
    enabled: true,
    keywords: ["viewer", "console", "workbench", "session log", "operator ui"],
    topicHints: ["agent-ui", "session-log"],
    repoSeeds: ["openai/codex", "anthropics/claude-code"],
    orgSeeds: ["openai", "anthropics"],
    negativeKeywords: ["video viewer", "game console"],
  },
  {
    name: "agentic-rl",
    enabled: true,
    keywords: ["agentic rl", "reinforcement learning", "rl agent", "self-play", "trajectory optimization", "reward model", "policy optimization"],
    topicHints: ["reinforcement-learning", "agent-training"],
    repoSeeds: ["openai/baselines", "huggingface/trl"],
    orgSeeds: ["openai", "huggingface"],
    negativeKeywords: ["robotics only", "rl game"],
  },
];

const DEFAULT_CONFIG: AppConfig = {
  sources: {
    observerEntityTierRegistry: DEFAULT_OBSERVER_ENTITY_TIERS,
    agentsRadar: {
      enabled: true,
      mode: "github-http",
      localPath: "data/upstream/agents-radar-source",
      manifestPath: "data/upstream/agents-radar-source/manifest.json",
      repoUrl: "https://github.com/duanyytop/agents-radar",
      refreshTimeoutMs: 300000,
      reports: {
        daily: ["ai-trending", "ai-agents", "ai-cli"],
        weekly: ["ai-weekly"],
        monthly: ["ai-monthly"],
      },
    },
    trendshift: {
      enabled: true,
      mode: "http",
      baseUrl: "https://trendshift.io",
      snapshotDir: "data/raw/trendshift",
    },
    watchlistOrgs: flattenObserverEntityTiers(DEFAULT_OBSERVER_ENTITY_TIERS).companies,
    ecosystemFocus: {
      enabled: true,
      mode: "github-search",
      recentDays: 7,
      perEcosystemLimit: 12,
      maxTotalCandidates: 80,
      historicalPrecisionDays: 45,
      judgeTopN: 20,
      priorityEntities: flattenObserverEntityTiers(DEFAULT_OBSERVER_ENTITY_TIERS),
      entityTiers: DEFAULT_OBSERVER_ENTITY_TIERS,
      ecosystems: DEFAULT_ECOSYSTEMS,
    },
    userInterestProfile: {
      enabled: false,
      topics: [],
    },
  },
  llm: {
    enabled: false,
    mode: "rules-only",
    provider: "none",
    dailyJudgeTopN: 12,
  },
  weights: {
    star_velocity: 0.2,
    engagement_score: 0.2,
    architecture_shift: 0.2,
    compounding_capability: 0.15,
    autonomy_score: 0.15,
    discussion_score: 0.1,
  },
  thresholds: {
    highScore: 75,
    anomalyStarDeltaDaily: 500,
    anomalyStarDeltaWeekly: 1500,
    minEngagementRatio: 0.02,
    minSourcesForDiscussionBonus: 2,
  },
  runtime: {
    dryRunDefault: false,
    retry: {
      attempts: 3,
      baseDelayMs: 1000,
    },
    logging: {
      level: "info",
      json: false,
    },
    mission: {
      githubSearchEnabled: true,
      perDirectionConcurrency: 2,
      queryTimeoutMs: 12000,
      deepBatchLimit: 6,
      allowDryRunSkipLiveDeep: true,
    },
  },
};

function asRecord(value: unknown): RawRecord {
  return value && typeof value === "object" ? (value as RawRecord) : {};
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asRequiredString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asPositiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function asStringArray(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : fallback;
}

function asOneOf<T extends string>(value: unknown, fallback: T, allowed: readonly T[]): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function isUserInterestTopicName(value: unknown): value is UserInterestTopicName {
  return typeof value === "string" && value.trim().length > 0;
}

function ensureOnlyKeys(raw: RawRecord, allowedKeys: AllowedKeysSpec, context: string): void {
  const unknownKeys = Object.keys(raw).filter((key) => !allowedKeys.includes(key));
  if (unknownKeys.length > 0) {
    throw new Error(`Invalid config: ${context} contains unknown field(s): ${unknownKeys.join(", ")}.`);
  }
}

function normalizeWeights(raw: RawRecord): ScoreWeights {
  const defaults = DEFAULT_CONFIG.weights;
  const weights = {
    star_velocity: asNumber(raw["star_velocity"], defaults.star_velocity),
    engagement_score: asNumber(raw["engagement_score"], defaults.engagement_score),
    architecture_shift: asNumber(raw["architecture_shift"], defaults.architecture_shift),
    compounding_capability: asNumber(raw["compounding_capability"], defaults.compounding_capability),
    autonomy_score: asNumber(raw["autonomy_score"], defaults.autonomy_score),
    discussion_score: asNumber(raw["discussion_score"], defaults.discussion_score),
  };

  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return defaults;

  return Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, value / total])) as ScoreWeights;
}

function validateLlmConfig(config: AppConfig): AppConfig {
  if (config.llm.enabled && config.llm.mode === "semantic-classification") {
    if (config.llm.provider === "none") {
      throw new Error('Invalid config: llm.provider must not be "none" when semantic-classification is enabled.');
    }
    if (!VALID_PROVIDER_NAMES.includes(config.llm.provider as never)) {
      throw new Error(
        `Invalid config: llm.provider must be one of ${VALID_PROVIDER_NAMES.join(", ")} when semantic-classification is enabled.`,
      );
    }
  }
  return config;
}

function parseUserInterestProfileConfig(raw: RawRecord): SourceConfig["userInterestProfile"] {
  const defaults = DEFAULT_CONFIG.sources.userInterestProfile ?? {
    enabled: false,
    topics: [],
  };
  if (Object.keys(raw).length === 0) return defaults;
  ensureOnlyKeys(raw, ["enabled", "topics"], "user_interest_profile");

  const enabled = asBoolean(raw["enabled"], defaults.enabled);
  const topicsValue = raw["topics"];
  if (!Array.isArray(topicsValue)) {
    throw new Error("Invalid config: user_interest_profile.topics must be an array when user_interest_profile is provided.");
  }

  const topics = topicsValue.map((entry, index) => {
    const topic = asRecord(entry);
    ensureOnlyKeys(topic, ["name", "weight"], `user_interest_profile.topics[${index}]`);
    const name = topic["name"];
    const weight = topic["weight"];

    const normalizedName = asRequiredString(name);
    if (!normalizedName || !isUserInterestTopicName(normalizedName)) {
      throw new Error(`Invalid config: user_interest_profile.topics[${index}].name must be a non-empty string.`);
    }

    const normalizedWeight = asPositiveNumber(weight);
    if (normalizedWeight === undefined) {
      throw new Error(`Invalid config: user_interest_profile.topics[${index}].weight must be a non-negative number.`);
    }

    return {
      name: normalizedName,
      weight: normalizedWeight,
    };
  });

  if (enabled && topics.length === 0) {
    throw new Error("Invalid config: user_interest_profile.topics must contain at least one topic when enabled.");
  }

  return {
    enabled,
    topics,
  };
}

function parseAgentsRadarConfig(raw: RawRecord): SourceConfig["agentsRadar"] {
  const reports = asRecord(raw["reports"]);
  const defaults = DEFAULT_CONFIG.sources.agentsRadar;
  return {
    enabled: asBoolean(raw["enabled"], defaults.enabled),
    mode: asOneOf(raw["mode"], defaults.mode, ["github-http", "local"]),
    localPath: asString(raw["local_path"], defaults.localPath),
    manifestPath: asString(raw["manifest_path"], defaults.manifestPath),
    repoUrl: asString(raw["repo_url"], defaults.repoUrl ?? "https://github.com/duanyytop/agents-radar"),
    refreshTimeoutMs: asNumber(raw["refresh_timeout_ms"], defaults.refreshTimeoutMs ?? 300000),
    reports: {
      daily: asStringArray(reports["daily"], defaults.reports.daily),
      weekly: asStringArray(reports["weekly"], defaults.reports.weekly),
      monthly: asStringArray(reports["monthly"], defaults.reports.monthly),
    },
  };
}

function parseTrendshiftConfig(raw: RawRecord): SourceConfig["trendshift"] {
  const defaults = DEFAULT_CONFIG.sources.trendshift;
  return {
    enabled: asBoolean(raw["enabled"], defaults.enabled),
    mode: asOneOf(raw["mode"], defaults.mode, ["http", "snapshot"]),
    baseUrl: asString(raw["base_url"], defaults.baseUrl),
    snapshotDir: asString(raw["snapshot_dir"], defaults.snapshotDir),
  };
}

function parseEcosystemFocusConfig(raw: RawRecord): SourceConfig["ecosystemFocus"] {
  const defaults = DEFAULT_CONFIG.sources.ecosystemFocus;
  if (Object.keys(raw).length === 0) return defaults;
  ensureOnlyKeys(
    raw,
    [
      "enabled",
      "mode",
      "recent_days",
      "per_ecosystem_limit",
      "max_total_candidates",
      "historical_precision_days",
      "judge_top_n",
      "priority_entities",
      "entity_tiers",
      "ecosystems",
    ],
    "ecosystem_focus",
  );

  const priorityEntitiesRaw = asRecord(raw["priority_entities"]);
  ensureOnlyKeys(priorityEntitiesRaw, ["builders", "companies", "engineers"], "ecosystem_focus.priority_entities");
  const entityTiersRaw = asRecord(raw["entity_tiers"]);
  ensureOnlyKeys(entityTiersRaw, ["core", "proven", "watch"], "ecosystem_focus.entity_tiers");
  const parseEntityTierGroup = (
    groupRaw: RawRecord,
    fallback: SourceConfig["observerEntityTierRegistry"]["core"],
    context: string,
  ): SourceConfig["observerEntityTierRegistry"]["core"] => {
    ensureOnlyKeys(groupRaw, ["builders", "companies", "engineers"], context);
    return {
      builders: asStringArray(groupRaw["builders"], fallback.builders),
      companies: asStringArray(groupRaw["companies"], fallback.companies),
      engineers: asStringArray(groupRaw["engineers"], fallback.engineers),
    };
  };
  const entityTiers =
    Object.keys(entityTiersRaw).length > 0
      ? {
          core: parseEntityTierGroup(asRecord(entityTiersRaw["core"]), defaults.entityTiers.core, "ecosystem_focus.entity_tiers.core"),
          proven: parseEntityTierGroup(
            asRecord(entityTiersRaw["proven"]),
            defaults.entityTiers.proven,
            "ecosystem_focus.entity_tiers.proven",
          ),
          watch: parseEntityTierGroup(
            asRecord(entityTiersRaw["watch"]),
            defaults.entityTiers.watch,
            "ecosystem_focus.entity_tiers.watch",
          ),
        }
      : defaults.entityTiers;
  const flattenedEntityTiers = flattenObserverEntityTiers(entityTiers);

  const ecosystemsValue = raw["ecosystems"];
  const ecosystems =
    Array.isArray(ecosystemsValue) && ecosystemsValue.length > 0
      ? ecosystemsValue.map((entry, index) => {
          const ecosystem = asRecord(entry);
          ensureOnlyKeys(
            ecosystem,
            ["name", "enabled", "keywords", "topic_hints", "repo_seeds", "org_seeds", "negative_keywords"],
            `ecosystem_focus.ecosystems[${index}]`,
          );

          const name = asRequiredString(ecosystem["name"]);
          if (!name) {
            throw new Error(`Invalid config: ecosystem_focus.ecosystems[${index}].name must be a non-empty string.`);
          }

          return {
            name,
            enabled: asBoolean(ecosystem["enabled"], true),
            keywords: asStringArray(ecosystem["keywords"], []),
            topicHints: asStringArray(ecosystem["topic_hints"], []),
            repoSeeds: asStringArray(ecosystem["repo_seeds"], []),
            orgSeeds: asStringArray(ecosystem["org_seeds"], []),
            negativeKeywords: asStringArray(ecosystem["negative_keywords"], []),
          };
        })
      : defaults.ecosystems;

  return {
    enabled: asBoolean(raw["enabled"], defaults.enabled),
    mode: "github-search",
    recentDays: asNumber(raw["recent_days"], defaults.recentDays),
    perEcosystemLimit: asNumber(raw["per_ecosystem_limit"], defaults.perEcosystemLimit),
    maxTotalCandidates: asNumber(raw["max_total_candidates"], defaults.maxTotalCandidates),
    historicalPrecisionDays: asNumber(raw["historical_precision_days"], defaults.historicalPrecisionDays),
    judgeTopN: asNumber(raw["judge_top_n"], defaults.judgeTopN),
    priorityEntities: {
      builders: asStringArray(priorityEntitiesRaw["builders"], flattenedEntityTiers.builders),
      companies: asStringArray(priorityEntitiesRaw["companies"], flattenedEntityTiers.companies),
      engineers: asStringArray(priorityEntitiesRaw["engineers"], flattenedEntityTiers.engineers),
    },
    entityTiers,
    ecosystems,
  };
}

function parseSourceConfig(raw: RawRecord): SourceConfig {
  const ecosystemFocus = parseEcosystemFocusConfig(asRecord(raw["ecosystem_focus"]));
  return {
    observerEntityTierRegistry: ecosystemFocus.entityTiers,
    agentsRadar: parseAgentsRadarConfig(asRecord(raw["agents_radar"])),
    trendshift: parseTrendshiftConfig(asRecord(raw["trendshift"])),
    watchlistOrgs: asStringArray(raw["watchlist_orgs"], DEFAULT_CONFIG.sources.watchlistOrgs),
    ecosystemFocus,
    userInterestProfile: parseUserInterestProfileConfig(asRecord(raw["user_interest_profile"])),
  };
}

function parseLlmConfig(raw: RawRecord): LlmConfig {
  const defaults = DEFAULT_CONFIG.llm;
  return {
    enabled: asBoolean(raw["enabled"], defaults.enabled),
    mode: asOneOf(raw["mode"], defaults.mode, ["rules-only", "semantic-classification"]),
    provider: asString(raw["provider"], defaults.provider),
    dailyJudgeTopN: asNumber(raw["daily_judge_top_n"], defaults.dailyJudgeTopN ?? 12),
  };
}

function parseThresholdConfig(raw: RawRecord): ThresholdConfig {
  const defaults = DEFAULT_CONFIG.thresholds;
  return {
    highScore: asNumber(raw["high_score"], defaults.highScore),
    anomalyStarDeltaDaily: asNumber(raw["anomaly_star_delta_daily"], defaults.anomalyStarDeltaDaily),
    anomalyStarDeltaWeekly: asNumber(raw["anomaly_star_delta_weekly"], defaults.anomalyStarDeltaWeekly),
    minEngagementRatio: asNumber(raw["min_engagement_ratio"], defaults.minEngagementRatio),
    minSourcesForDiscussionBonus: asNumber(
      raw["min_sources_for_discussion_bonus"],
      defaults.minSourcesForDiscussionBonus,
    ),
  };
}

function parseRuntimeConfig(raw: RawRecord): RuntimeConfig {
  const defaults = DEFAULT_CONFIG.runtime;
  const retry = asRecord(raw["retry"]);
  const logging = asRecord(raw["logging"]);
  const mission = asRecord(raw["mission"]);
  return {
    dryRunDefault: asBoolean(raw["dry_run_default"], defaults.dryRunDefault),
    retry: {
      attempts: asNumber(retry["attempts"], defaults.retry.attempts),
      baseDelayMs: asNumber(retry["base_delay_ms"], defaults.retry.baseDelayMs),
    },
    logging: {
      level: asOneOf(logging["level"], defaults.logging.level, ["debug", "info", "warn", "error"]),
      json: asBoolean(logging["json"], defaults.logging.json),
    },
    mission: {
      githubSearchEnabled: asBoolean(mission["github_search_enabled"], defaults.mission.githubSearchEnabled),
      perDirectionConcurrency: asNumber(mission["per_direction_concurrency"], defaults.mission.perDirectionConcurrency),
      queryTimeoutMs: asNumber(mission["query_timeout_ms"], defaults.mission.queryTimeoutMs),
      deepBatchLimit: asNumber(mission["deep_batch_limit"], defaults.mission.deepBatchLimit),
      allowDryRunSkipLiveDeep: asBoolean(mission["allow_dry_run_skip_live_deep"], defaults.mission.allowDryRunSkipLiveDeep),
    },
  };
}

function parseConfig(raw: RawRecord): AppConfig {
  return {
    sources: parseSourceConfig(asRecord(raw["sources"])),
    llm: parseLlmConfig(asRecord(raw["llm"])),
    weights: normalizeWeights(asRecord(raw["weights"])),
    thresholds: parseThresholdConfig(asRecord(raw["thresholds"])),
    runtime: parseRuntimeConfig(asRecord(raw["runtime"])),
  };
}

function asEnvBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
}

function envStringOrFallback(name: string, fallback: string | undefined): string | undefined {
  return process.env[name]?.trim() || fallback;
}

function envAgentsRadarModeOrFallback(
  fallback: SourceConfig["agentsRadar"]["mode"],
): SourceConfig["agentsRadar"]["mode"] {
  const modeRaw = process.env["AGENT_TREND_RADAR_AGENTS_RADAR_MODE"]?.trim();
  return modeRaw === "github-http" || modeRaw === "local" ? modeRaw : fallback;
}

function envNonNegativeIntOrFallback(name: string, fallback: number | undefined): number | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;

  const candidate = Number.parseInt(raw, 10);
  return Number.isFinite(candidate) && candidate >= 0 ? candidate : fallback;
}

function applyAgentsRadarEnvOverrides(config: AppConfig): AppConfig {
  const current = config.sources.agentsRadar;
  return {
    ...config,
    sources: {
      ...config.sources,
      agentsRadar: {
        ...current,
        mode: envAgentsRadarModeOrFallback(current.mode),
        localPath: envStringOrFallback("AGENT_TREND_RADAR_AGENTS_RADAR_LOCAL_PATH", current.localPath) ?? current.localPath,
        manifestPath:
          envStringOrFallback("AGENT_TREND_RADAR_AGENTS_RADAR_MANIFEST_PATH", current.manifestPath) ?? current.manifestPath,
        repoUrl: envStringOrFallback("AGENT_TREND_RADAR_AGENTS_RADAR_REPO_URL", current.repoUrl),
        refreshTimeoutMs: envNonNegativeIntOrFallback(
          "AGENT_TREND_RADAR_AGENTS_RADAR_REFRESH_TIMEOUT_MS",
          current.refreshTimeoutMs,
        ),
      },
    },
  };
}

function inferProviderFromAvailableCredentials(env: NodeJS.ProcessEnv): string | undefined {
  if (env["ANTHROPIC_API_KEY"]?.trim()) return "anthropic";
  if (env["OPENAI_API_KEY"]?.trim()) return "openai";
  if (env["DEEPSEEK_API_KEY"]?.trim()) return "deepseek";
  if (env["OPENROUTER_API_KEY"]?.trim()) return "openrouter";
  if (env["MINIMAX_API_KEY"]?.trim()) return "minimax";
  return undefined;
}

function applyLlmEnvOverrides(config: AppConfig): AppConfig {
  const explicitProvider = process.env["LLM_PROVIDER"]?.trim();
  const inferredProvider = inferProviderFromAvailableCredentials(process.env);
  const provider = explicitProvider || (config.llm.provider !== "none" ? config.llm.provider : (inferredProvider ?? "none"));
  const enabledOverride = asEnvBoolean(process.env["LLM_ENABLED"]);
  const modeOverride = process.env["LLM_MODE"]?.trim();

  const enabled =
    enabledOverride
    ?? (explicitProvider ? true : (inferredProvider ? true : config.llm.enabled));
  const mode =
    modeOverride === "rules-only" || modeOverride === "semantic-classification"
      ? modeOverride
      : explicitProvider || inferredProvider
        ? "semantic-classification"
        : config.llm.mode;

  return {
    ...config,
    llm: {
      ...config.llm,
      enabled,
      mode,
      provider,
    },
  };
}

export function loadConfig(configPath = "config.yaml"): AppConfig {
  const resolved = path.resolve(configPath);
  if (!fs.existsSync(resolved)) {
    console.log(`[config] ${configPath} not found; using defaults.`);
    return validateLlmConfig(applyLlmEnvOverrides(applyAgentsRadarEnvOverrides(DEFAULT_CONFIG)));
  }

  const raw = asRecord(yaml.load(fs.readFileSync(resolved, "utf-8")));
  return validateLlmConfig(applyLlmEnvOverrides(applyAgentsRadarEnvOverrides(parseConfig(raw))));
}
