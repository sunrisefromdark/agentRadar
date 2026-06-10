export type SignalSource =
  | "agents-radar"
  | "trendshift"
  | "github_trending"
  | "github_live_star_delta"
  | "watchlist_live_activity"
  | "manual";
export type MetricsSource = "embedded" | "github_api" | "github_html" | "github_cache" | "unavailable";
export type DataTrustLevel = "high" | "medium" | "low" | "unverified";
export type StarDeltaSource = "github_live" | "github_snapshot" | "signal" | "unavailable";
export type FreshnessState = "fresh_today" | "fallback_recent" | "fallback_stale" | "unavailable";
export type DailyOverallStatus =
  | "数据新鲜，可直接阅读"
  | "数据部分回退，谨慎参考"
  | "数据显著过期，不建议直接用于判断";
export type DailyMainBoardMode = "fresh_today_only" | "partial_fresh" | "no_fresh_main_board";
export type DailyProjectClass = "today_star" | "context_only" | "pending_confirmation";
export type UserInterestTopicName = string;
export type EnhancementSource = "agent" | "template_fallback";
export type RiskReviewSource = EnhancementSource;
export type EnhancementStatus = "rules-only" | "agent-partial" | "agent-full";

export interface RejectedOutput {
  layer: string;
  target_key: string;
  reason_code: string;
  reason_detail: string;
}

export interface EnhancementAudit {
  rejected_outputs: RejectedOutput[];
}

export interface StarDeltaWindow {
  since: string;
  until: string;
}

export interface RawSignal {
  project_name: string;
  repo_url: string;
  source: SignalSource;
  timestamp: string;
  stars?: number;
  star_delta?: number;
  forks?: number;
  issues?: number;
  PR?: number;
  tags: string[];
  description?: string;
  metrics_source?: MetricsSource;
  metrics_trust_score?: number;
  star_delta_source?: StarDeltaSource;
  star_delta_window?: StarDeltaWindow;
}

export interface DailyFreshnessSource {
  source: string;
  effective_date: string | null;
  freshness_state: FreshnessState;
  fallback_reason?: string;
  status_summary_cn?: string;
  diagnostic_reason?: string;
  diagnostic_ref?: string;
  from_realtime_run: boolean;
  source_role?: "freshness-driving" | "context";
}

export interface DailyReportProjectDetail {
  project_class: DailyProjectClass;
  objective_score: number;
  preference_boost: number;
  base_final_rank: number;
  final_rank: number;
  matched_interest_topics: UserInterestTopicName[];
  project_brief_cn: string;
  why_today_cn: string;
  enhancement_source: EnhancementSource;
  summary_source?: EnhancementSource;
  position_qualification?: EcosystemObserverPositionQualification;
  position_rationale_cn?: string;
  judge_score_delta?: number;
  judge_source?: EnhancementSource;
  personalization_reason_cn?: string;
  risk_review_required?: boolean;
  risk_review_note_cn?: string;
  risk_review_source?: RiskReviewSource;
  watchlist_note_cn?: string;
}

export interface NormalizedProject {
  project_name: string;
  repo_url: string;
  repo_full_name: string;
  first_seen: string;
  last_seen: string;
  sources: SignalSource[];
  source_counts: Partial<Record<SignalSource, number>>;
  appearances: number;
  appearance_dates: string[];
  persistence_state: "single-spike" | "emerging" | "persistent";
  stars: number;
  star_delta_daily?: number;
  star_delta_weekly?: number;
  forks: number;
  issues: number;
  PR: number;
  tags: string[];
  description: string;
  metrics_source: MetricsSource;
  metrics_trust_score: number;
  data_trust: DataTrustLevel;
  star_delta_available: boolean;
  star_delta_source?: StarDeltaSource;
  trust_flags: string[];
  raw_signals: RawSignal[];
}

export type ScoreComponentName =
  | "star_velocity"
  | "engagement_score"
  | "architecture_shift"
  | "compounding_capability"
  | "autonomy_score"
  | "discussion_score";

export interface ScoreComponent {
  name: ScoreComponentName;
  score: number;
  weight: number;
  weighted_score: number;
  evidence: string[];
}

export interface ScoreBreakdown {
  total_score: number;
  components: ScoreComponent[];
  verdict: "high" | "watch" | "low";
  confidence: "high" | "medium" | "low";
  trust_score: number;
  data_trust: DataTrustLevel;
  paradigm: string;
  anti_noise_flags: string[];
  risks: string[];
  next_actions: string[];
  rules_only: boolean;
}

export interface ScoredProject {
  project: NormalizedProject;
  score: ScoreBreakdown;
}

export interface DailyReport {
  date: string;
  generated_at: string;
  enhancement_status: EnhancementStatus;
  enhancement_audit: EnhancementAudit;
  llm_diagnostics?: LlmRunDiagnostics;
  personalized_relevance_applicable: boolean;
  overall_daily_status: DailyOverallStatus;
  freshness_sources: DailyFreshnessSource[];
  today_fresh_candidate_count: number;
  context_candidate_count: number;
  pending_confirmation_count: number;
  main_board_mode: DailyMainBoardMode;
  today_star_projects: Array<ScoredProject & DailyReportProjectDetail>;
  context_only_projects: Array<ScoredProject & DailyReportProjectDetail>;
  new_projects: ScoredProject[];
  high_score_projects: ScoredProject[];
  anomaly_projects: ScoredProject[];
  all_projects: ScoredProject[];
}

export interface DailySemanticInputProject {
  repo_url: string;
  project_name: string;
  repo_full_name: string;
  project_class: DailyProjectClass;
  objective_score: number;
  preference_boost: number;
  base_final_rank: number;
  final_rank: number;
  matched_interest_topics: UserInterestTopicName[];
  project_brief_cn: string;
  why_today_cn: string;
  project: {
    data_trust: DataTrustLevel;
    appearances: number;
    star_delta_daily?: number;
    trust_flags: string[];
    tags: string[];
    description: string;
    raw_signals: RawSignal[];
  };
  freshness_hit_sources: string[];
  score: {
    verdict: ScoreBreakdown["verdict"];
    confidence: ScoreBreakdown["confidence"];
    paradigm: string;
    components: ScoreComponent[];
    anti_noise_flags: string[];
    risks: string[];
  };
}

export interface DailySemanticInputBundle {
  report_date: string;
  overall_daily_status: DailyOverallStatus;
  freshness_sources: DailyFreshnessSource[];
  objective_projects: DailySemanticInputProject[];
  user_interest_profile: NonNullable<import("./config.ts").SourceConfig["userInterestProfile"]>;
  agent_mode: EnhancementStatus;
}

export interface WeeklyTrendCandidate {
  trend_key: string;
  matched_topics: UserInterestTopicName[];
  matched_paradigm: string;
  distinct_repo_count: number;
  supporting_project_refs: Array<{
    repo_url: string;
    repo_full_name: string;
    appearance_dates: string[];
  }>;
  appearance_dates: string[];
  shared_capability_tags: string[];
  evidence_notes: string[];
  candidate_strength: "strong" | "medium";
}

export interface WeeklyEvidenceProject {
  repo_url: string;
  repo_full_name: string;
  project_name: string;
  description: string;
  appearance_dates: string[];
  appearances: number;
  persistence_state: NormalizedProject["persistence_state"];
  sources: SignalSource[];
  tags: string[];
  matched_topics: UserInterestTopicName[];
  paradigm: string;
  confidence: ScoreBreakdown["confidence"];
  total_score: number;
  data_trust: DataTrustLevel;
  anti_noise_flags: string[];
  risks: string[];
  components: ScoreComponent[];
  evidence_snippets: string[];
}

export interface WeeklyEvidenceCluster {
  cluster_id: string;
  seed_labels: string[];
  shared_capabilities: string[];
  shared_paradigms: string[];
  supporting_projects: WeeklyEvidenceProject[];
  repeated_project_count: number;
  distinct_repo_count: number;
  appearance_day_count: number;
  high_confidence_project_count: number;
  evidence_refs: string[];
  counter_evidence_refs: string[];
  uncovered_project_refs: string[];
}

export interface WeeklyTrendCandidateV2 {
  candidate_id: string;
  source_cluster_ids: string[];
  candidate_name_hint: string;
  hypothesis: string;
  supporting_project_refs: string[];
  evidence_refs: string[];
  counter_evidence_refs: string[];
  unexplained_project_refs: string[];
  anomaly_refs: string[];
  coverage_score: number;
  cohesion_score: number;
  novelty_score: number;
  reliability_score: number;
  rule_verdict: "likely-trend" | "watch" | "mixed" | "reject";
}

export interface WeeklySemanticInputProject {
  repo_url: string;
  project_name: string;
  repo_full_name: string;
  trend_key: string;
  data_trust: DataTrustLevel;
  appearance_dates: string[];
  sources: SignalSource[];
  trust_flags: string[];
  score: {
    paradigm: string;
    components: ScoreComponent[];
    anti_noise_flags: string[];
    risks: string[];
  };
  tags: string[];
  description: string;
}

export interface WeeklySemanticInputScoreWindow {
  date: string;
  scored_projects: ScoredProject[];
}

export interface WeeklySemanticInputBundle {
  window_start: string;
  window_end: string;
  scored_project_windows: WeeklySemanticInputScoreWindow[];
  trend_candidates: WeeklyTrendCandidate[];
  weekly_focus_projects: WeeklySemanticInputProject[];
  user_interest_profile: NonNullable<import("./config.ts").SourceConfig["userInterestProfile"]>;
  agent_mode: EnhancementStatus;
}

export interface WeeklySupportProject extends DailyReportProjectDetail {
  repo_url: string;
  project_name: string;
  trend_key: string;
  why_this_week_cn: string;
}

export interface WeeklyEvidenceAxisProjectRef {
  repo_url: string;
  repo_full_name: string;
  score: number;
}

export interface WeeklyEvidenceAxis {
  axis: ScoreComponentName;
  score: number;
  project_count: number;
  high_signal_project_count: number;
  evidence_count: number;
  sample_projects: WeeklyEvidenceAxisProjectRef[];
  top_evidence: string[];
  summary_cn: string;
}

export interface WeeklyEvidenceMatrix {
  focused_trend_key: string | null;
  focused_trend_name_cn: string | null;
  summary_cn: string;
  axes: WeeklyEvidenceAxis[];
}

export interface FinalWeeklyTrend {
  trend_id: string;
  trend_name_cn: string;
  claim_cn: string;
  why_established_cn: string;
  supporting_candidate_ids: string[];
  supporting_project_refs: string[];
  evidence_refs: string[];
  counter_evidence_refs: string[];
  watch_next_week_cn: string;
  audit_confidence: ScoreBreakdown["confidence"];
}

export interface FinalWeeklyTrendObservation {
  trend_id: string;
  trend_name_cn: string;
  why_not_established_cn: string;
  supporting_candidate_ids: string[];
  supporting_project_refs: string[];
  evidence_refs: string[];
  watch_next_week_cn: string;
}

export interface WeeklyAuditConclusion {
  accepted_candidate_ids: string[];
  rejected_candidate_ids: string[];
  merged_groups: string[][];
  split_actions: Array<{
    source_candidate_id: string;
    new_trend_names: string[];
  }>;
  added_trends: string[];
  missed_signal_summary_cn: string[];
  misjudgment_summary_cn: string[];
  residual_blindspots_cn: string[];
}

export interface WeeklyTrendAgentReview {
  executive_summary_cn: string;
  established_trends: FinalWeeklyTrend[];
  observing_trends: FinalWeeklyTrendObservation[];
  audit_findings: WeeklyAuditConclusion;
}

export interface CoreTrendCard {
  trend_key: string;
  trend_name_cn: string;
  trend_summary_cn: string;
  evidence_summary_cn: string;
  strength: "strong" | "medium";
  worth_following_next_week: string;
  evidence_matrix?: WeeklyEvidenceMatrix;
  supporting_projects: WeeklySupportProject[];
}

export interface WeakSignalCard {
  trend_key: string;
  signal_name_cn: string;
  why_weak_cn: string;
  evidence_summary_cn: string;
  worth_following_next_week: string;
}

export interface PersonalizedWeeklyFocus {
  trend_key: string;
  matched_interest_topics: UserInterestTopicName[];
  personalization_reason_cn: string;
  supporting_project_refs: Array<{
    repo_url: string;
    repo_full_name: string;
  }>;
}

export interface WeeklyReport {
  date: string;
  generated_at: string;
  window_start: string;
  window_end: string;
  enhancement_status: EnhancementStatus;
  personalized_weekly_focus_applicable: boolean;
  personalized_weekly_focus_note_cn?: string;
  overall_summary_cn: string;
  supporting_trend_keys: string[];
  evidence_matrix?: WeeklyEvidenceMatrix;
  core_trend_cards: CoreTrendCard[];
  personalized_weekly_focus: PersonalizedWeeklyFocus[];
  weak_signal_cards: WeakSignalCard[];
  enhancement_audit: EnhancementAudit;
}

export interface WeeklyAuditReport {
  enhancement_status: EnhancementStatus;
  personalized_weekly_focus: PersonalizedWeeklyFocus[];
  rejected_outputs: RejectedOutput[];
}

export interface WeeklyJudgmentRuleMaterials {
  evidence_projects: WeeklyEvidenceProject[];
  evidence_clusters: WeeklyEvidenceCluster[];
  trend_candidates: WeeklyTrendCandidateV2[];
  unexplained_project_refs: string[];
  anomaly_project_refs: string[];
}

export interface WeeklyJudgmentReport {
  date: string;
  generated_at: string;
  window_start: string;
  window_end: string;
  enhancement_status: EnhancementStatus;
  executive_summary_cn: string;
  rule_materials: WeeklyJudgmentRuleMaterials;
  established_trends: FinalWeeklyTrend[];
  observing_trends: FinalWeeklyTrendObservation[];
  audit_conclusion: WeeklyAuditConclusion;
  evidence_matrix?: WeeklyEvidenceMatrix;
  enhancement_audit: EnhancementAudit;
}

export interface DailyRunSummarySourceStatus {
  source: SignalSource | "github-enrichment";
  enabled: boolean;
  item_count: number;
  distinct_projects: number;
  status: "active" | "empty" | "failed" | "disabled";
  notes: string[];
}

export interface GitHubEnrichmentAuditEntry {
  repo_url: string;
  repo_full_name: string;
  status: "api" | "html" | "cache" | "unavailable" | "invalid_repo";
  metrics_applied: boolean;
  notes: string[];
}

export type ObserverStatus = "active" | "empty" | "failed" | "disabled";

export interface EcosystemObserverMatchEvidence {
  keywords: string[];
  topic_hints: string[];
  repo_seeds: string[];
  org_seeds: string[];
}

export interface EcosystemObserverPedigree {
  builders: string[];
  companies: string[];
  engineers: string[];
}

export type EcosystemObserverEntityTier = "core" | "proven" | "watch" | "none";
export type EcosystemObserverHistoryLabel = "validated" | "mixed" | "emerging" | "none";
export type EcosystemObserverPositionQualification = "top-tier-now" | "strong-watch" | "keep-observing" | "drop";

export type EcosystemObserverLongTailReason =
  | "priority-company"
  | "priority-builder"
  | "priority-engineer"
  | "breakout-newcomer"
  | "ecosystem-signal";

export interface ObserverLlmDiagnostics {
  enabled: boolean;
  provider: string;
  summary_attempt_count: number;
  summary_success_count: number;
  summary_failure_count: number;
  judge_attempt_count: number;
  judge_success_count: number;
  judge_failure_count: number;
  last_error?: string;
}

export interface EcosystemObserverEntry {
  repo_full_name: string;
  repo_url: string;
  observed_at: string;
  repo_created_at?: string;
  repo_updated_at?: string;
  observer_rank?: number;
  base_observer_score?: number;
  observer_score?: number;
  ecosystems: string[];
  labels?: string[];
  freshness_label?: string;
  breakout_label?: string;
  ecosystem_depth_label?: string;
  long_tail_reason?: EcosystemObserverLongTailReason;
  pedigree?: EcosystemObserverPedigree;
  entity_tier?: EcosystemObserverEntityTier;
  historical_precision_score?: number;
  historical_precision_label?: EcosystemObserverHistoryLabel;
  project_brief_cn?: string;
  why_now_cn?: string;
  watch_next_cn?: string;
  summary_source?: EnhancementSource;
  position_qualification?: EcosystemObserverPositionQualification;
  position_rationale_cn?: string;
  judge_score_delta?: number;
  judge_source?: EnhancementSource;
  matched_by: EcosystemObserverMatchEvidence;
  description?: string;
  stars?: number;
  forks?: number;
  issues?: number;
  PR?: number;
  source_notes: string[];
}

export interface EcosystemObserverArtifact {
  scope: "ecosystem-focus";
  date: string;
  generated_at: string;
  status: ObserverStatus;
  llm_diagnostics?: ObserverLlmDiagnostics;
  candidate_count: number;
  ecosystem_counts: Record<string, number>;
  notes: string[];
  entries: EcosystemObserverEntry[];
}

export interface VerificationCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

export interface DailyRunSummaryCounts {
  raw_signals: number;
  normalized_projects: number;
  scored_projects: number;
  high_score_projects: number;
  anomaly_projects: number;
  new_projects: number;
  classifications: number;
}

export interface DailyRunSummaryQuality {
  missing_descriptions: number;
  watchlist_hits: number;
  low_confidence_projects: number;
  medium_confidence_projects: number;
  insufficient_metrics_projects: number;
  suspicious_growth_projects: number;
  single_source_projects: number;
  single_spike_projects: number;
  emerging_projects: number;
  persistent_projects: number;
}

export interface DailyRunSummaryDiagnostics {
  anomaly_share: number;
  uniform_star_velocity_detected: boolean;
  metrics_source_distribution: Record<MetricsSource, number>;
  star_delta_source_distribution: Record<StarDeltaSource, number>;
  github_star_delta: {
    live_delta_attempts: number;
    live_delta_success: number;
    snapshot_delta_success: number;
    token_missing: number;
    auth_invalid?: number;
    rate_limit: number;
    network_blocked: number;
  };
}

export interface DailyRunSummaryTopProject {
  project_name: string;
  repo_url: string;
  total_score: number;
  base_final_rank?: number;
  final_rank?: number;
  confidence: ScoreBreakdown["confidence"];
  paradigm: string;
  position_qualification?: EcosystemObserverPositionQualification;
  position_rationale_cn?: string;
  judge_score_delta?: number;
  summary_source?: EnhancementSource;
  judge_source?: EnhancementSource;
  why_selected: string[];
  risks: string[];
}

export interface DailyRunSummary {
  date: string;
  generated_at: string;
  dry_run: boolean;
  minimum_viable_run_completed: boolean;
  completion_notes: string[];
  llm_diagnostics?: LlmRunDiagnostics;
  overall_daily_status?: DailyOverallStatus;
  freshness_sources?: DailyFreshnessSource[];
  main_board_mode?: DailyMainBoardMode;
  today_fresh_candidate_count?: number;
  today_star_count?: number;
  context_candidate_count?: number;
  pending_confirmation_count?: number;
  counts: DailyRunSummaryCounts;
  source_status: DailyRunSummarySourceStatus[];
  quality: DailyRunSummaryQuality;
  diagnostics: DailyRunSummaryDiagnostics;
  top_projects: DailyRunSummaryTopProject[];
  observer_status?: {
    ecosystem_focus: ObserverStatus;
  };
  observer_candidate_count?: number;
  observer_ecosystem_counts?: Record<string, number>;
  observer_top_candidates: Array<
    Pick<
      EcosystemObserverEntry,
      | "repo_full_name"
      | "repo_url"
      | "observer_rank"
      | "observer_score"
      | "base_observer_score"
      | "ecosystems"
      | "labels"
      | "freshness_label"
      | "breakout_label"
      | "ecosystem_depth_label"
      | "long_tail_reason"
      | "pedigree"
      | "entity_tier"
      | "historical_precision_score"
      | "historical_precision_label"
      | "project_brief_cn"
      | "why_now_cn"
      | "watch_next_cn"
      | "summary_source"
      | "position_qualification"
      | "position_rationale_cn"
      | "judge_score_delta"
      | "judge_source"
      | "matched_by"
      | "source_notes"
    >
  >;
  watchouts: string[];
  next_focus: string[];
  recommended_actions: string[];
}

export interface LlmRunDiagnostics {
  enabled: boolean;
  mode: "rules-only" | "semantic-classification";
  provider: string;
  classification_cache_hit_count?: number;
  classification_attempt_count: number;
  classification_success_count: number;
  classification_failure_count: number;
  classification_last_error?: string;
  summary_attempt_count?: number;
  summary_success_count?: number;
  summary_failure_count?: number;
  summary_last_error?: string;
  judge_attempt_count?: number;
  judge_success_count?: number;
  judge_failure_count?: number;
  judge_last_error?: string;
}

export interface VerifyDailyResult {
  date: string;
  status: "pass" | "warn" | "fail";
  summary_path: string;
  github_audit_path: string;
  checks: VerificationCheck[];
  recommended_actions: string[];
}

export interface KnowledgeCard {
  project_name: string;
  repo_url: string;
  summary: string;
  star_growth: string;
  why_it_matters: string;
  paradigm: string;
  risks: string[];
  next_actions: string[];
  updated_at: string;
}
