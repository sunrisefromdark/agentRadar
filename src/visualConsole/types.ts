import type {
  DailyReport,
  DailyRunSummary,
  EcosystemObserverArtifact,
  EcosystemObserverEntry,
  EnhancementStatus,
  GitHubEnrichmentAuditEntry,
  HeadProjectExceptionReason,
  IndustryRuntimeWindowSummary,
  KnowledgeCard,
  ObserverPresetBucket,
  ObserverPresetFilter,
  ProjectPresetBucket,
  ProjectPresetFilter,
  ProjectUtilityHint,
  RepeatExposureState,
  ScoreComponentName,
  VerifyDailyResult,
} from "../types.ts";
import type {
  ExternalBindingConfidence,
  ExternalCoverageStatus,
  ExternalProviderStatus,
} from "../externalDiscovery/types.ts";

export type ReadStatus = "ok" | "not_found" | "parse_error" | "unsupported_context";
export type TopLevelViewStatus = "ready" | "degraded" | "stale" | "failed" | "empty" | "not-judgeable";
export type VisualConsoleView = "overview" | "projects" | "weekly" | "run-health" | "observer" | "agentreach" | "knowledge-base";
export type ViewMode = "daily" | "weekly";
export type EntryKind = "explicit-date" | "latest-shortcut";
export type NavigatorMode = "daily" | "weekly";

export interface ArtifactRef {
  kind: string;
  path: string;
}

export type ReadResult<T> =
  | { status: "ok"; path: string; value: T }
  | { status: "not_found"; path: string }
  | { status: "parse_error"; path: string; error: string }
  | { status: "unsupported_context"; path: string; reason: string };

export interface WeeklyWindow {
  window_start: string;
  window_end: string;
  anchor_date: string;
}

export interface ViewContext {
  mode: ViewMode;
  selected_date: string | null;
  selected_window: WeeklyWindow | null;
  entry_kind: EntryKind;
  resolved_artifacts: ArtifactRef[];
  generated_at: string | null;
  stale: boolean;
}

export type ContextResolution =
  | { status: "ok"; context: ViewContext }
  | { status: "failed"; context: ViewContext; message: string };

export interface ParsedWeeklySupportProject {
  repo_url: string;
  project_name: string;
  objective_score?: number | null;
  base_final_rank?: number | null;
  final_rank?: number | null;
  project_brief_cn: string | null;
  why_this_week_cn: string | null;
  enhancement_source: "agent" | "template_fallback" | null;
  personalization_reason_cn: string | null;
  risk_review_required: boolean;
  risk_review_note_cn: string | null;
  risk_review_source: "agent" | "template_fallback" | null;
  watchlist_note_cn: string | null;
}

export interface ParsedWeeklyCoreTrendCard {
  trend_key: string;
  trend_name_cn: string;
  trend_summary_cn: string | null;
  evidence_summary_cn: string | null;
  strength: "strong" | "medium" | null;
  worth_following_next_week: string | null;
  evidence_matrix: ParsedWeeklyEvidenceMatrix | null;
  supporting_projects: ParsedWeeklySupportProject[];
}

export interface ParsedWeakSignalCard {
  trend_key: string;
  signal_name_cn: string;
  why_weak_cn: string | null;
  evidence_summary_cn: string | null;
  worth_following_next_week: string | null;
}

export interface ParsedWeeklyEvidenceAxis {
  axis: ScoreComponentName;
  score: number | null;
  project_count: number;
  high_signal_project_count: number;
  evidence_count: number;
  sample_projects: string[];
  top_evidence: string[];
  summary_cn: string | null;
}

export interface ParsedWeeklyEvidenceMatrix {
  focused_trend_key: string | null;
  focused_trend_name_cn: string | null;
  summary_cn: string | null;
  axes: ParsedWeeklyEvidenceAxis[];
}

export interface ParsedWeeklyReport {
  generated_at: string | null;
  window_start: string | null;
  window_end: string | null;
  overall_summary_cn: string | null;
  enhancement_status: EnhancementStatus | null;
  supporting_trend_keys: string[];
  evidence_matrix: ParsedWeeklyEvidenceMatrix | null;
  core_trend_cards: ParsedWeeklyCoreTrendCard[];
  weak_signal_cards: ParsedWeakSignalCard[];
}

export interface KbCardSections {
  machine_sections: Array<{ title: string; body: string[] }>;
  human_sections: Array<{ title: string; body: string[] }>;
}

export interface RunSnapshot {
  date: string;
  daily_report: DailyReport;
  run_summary: DailyRunSummary | null;
  industry_runtime_summary?: DailyRunSummary["industry_runtime_summary"] | null;
  policy_finance_runtime_replay?: import("../types.ts").PolicyFinanceRuntimeReplayArtifact | null;
  verify_result: VerifyDailyResult | null;
  github_audit: GitHubEnrichmentAuditEntry[] | null;
  observer_artifact: EcosystemObserverArtifact | null;
}

export interface WeeklySnapshot {
  anchor_date: string;
  markdown: ParsedWeeklyReport;
  industry_runtime_window_summary: IndustryRuntimeWindowSummary | null;
  judgment_status: ReadStatus;
  judgment_enhancement_status: EnhancementStatus | null;
  judgment_rule_candidate_count: number;
  judgment_unexplained_project_count: number;
  judgment_anomaly_project_count: number;
  audit_status: ReadStatus;
  audit_enhancement_status: EnhancementStatus | null;
  audit_rejected_outputs: number;
}

export interface ProjectIdentity {
  project_name: string;
  repo_url: string;
  repo_full_name: string;
}

export interface ProjectContextBinding {
  source_view: "overview" | "projects" | "weekly";
  date: string | null;
  window_end: string | null;
  trend_key: string | null;
}

export interface DrilldownRef {
  label: string;
  view: VisualConsoleView;
  date?: string;
  anchor_date?: string;
  project?: string;
  slug?: string;
  trend_key?: string;
  section?: string;
}

export interface ViewBanner {
  title: string;
  context_label: string;
  generated_at: string | null;
  enhancement_status: EnhancementStatus | "unknown";
  mode_label: "rules-only" | "agent-partial" | "agent-full" | "unknown";
  github_enrichment_status: string;
  source_health: string;
  notes: string[];
}

export interface VisualConsoleState {
  status: TopLevelViewStatus;
  reasons: string[];
}

export interface TimeSliceWindow {
  current: string | null;
  previous: string | null;
  next: string | null;
  latest: string | null;
  index: number;
  total: number;
}

export interface TimeNavigatorPreviewBase {
  kind: NavigatorMode;
  slice_key: string;
  generated_at: string | null;
  top_level_state: TopLevelViewStatus;
  enhancement_status: EnhancementStatus | null;
}

export interface DailyTimeNavigatorPreview extends TimeNavigatorPreviewBase {
  kind: "daily";
  top_decision_count: number;
  source_active_count: number;
  failed_count: number;
  empty_count: number;
  verify_status: VerifyDailyResult["status"] | null;
}

export interface WeeklyTimeNavigatorPreview extends TimeNavigatorPreviewBase {
  kind: "weekly";
  core_trend_count: number;
  weak_signal_count: number;
  audit_status: ReadStatus | null;
}

export type TimeNavigatorPreview = DailyTimeNavigatorPreview | WeeklyTimeNavigatorPreview;

export interface TimeNavigatorModel {
  mode: NavigatorMode;
  current_key: string | null;
  latest_key: string | null;
  previous_key: string | null;
  next_key: string | null;
  current_label: string;
  stale: boolean;
  window: TimeSliceWindow;
  previews: TimeNavigatorPreview[];
}

export type SurfaceRole = "hero" | "stage" | "rail" | "strip" | "dock" | "reader" | "audit";
export type StageDensityPreset = "compact" | "balanced" | "expanded";
export type RouteFrameRoute = "overview" | "projects" | "weekly" | "run-health" | "observer" | "agentreach" | "kb";

export interface StatusBandModel {
  label: string;
  state: TopLevelViewStatus | "neutral";
}

export interface EvidenceAnchorModel {
  code: string;
  label: string;
  href: string;
}

export interface SurfaceBlockModel {
  id: string;
  role: SurfaceRole;
  title: string;
  eyebrow?: string | null;
  body?: string | null;
  state?: TopLevelViewStatus | "neutral";
  primaryObjectKey?: string | null;
  emphasis?: "primary" | "secondary" | "tertiary";
  density?: StageDensityPreset;
  status_band?: StatusBandModel | null;
  slots?: string[];
  sections?: string[];
  anchors?: EvidenceAnchorModel[];
}

export interface RouteFrameModel {
  route: RouteFrameRoute;
  hero: SurfaceBlockModel | null;
  stage: SurfaceBlockModel[];
  rail: SurfaceBlockModel[];
  strip: SurfaceBlockModel[];
  dock: SurfaceBlockModel | null;
  reader: SurfaceBlockModel | null;
  audit: SurfaceBlockModel[];
}

export interface OverviewViewModel {
  context: ViewContext;
  banner: ViewBanner;
  state: VisualConsoleState;
  time_navigator: TimeNavigatorModel;
  route_frame: RouteFrameModel;
  run_snapshot: RunSnapshot | null;
  top_decisions: ProjectProjection[];
  semantic_bands: Array<{
    key: "mission_match" | "today_pulse" | "explore_ribbon" | "infra_context";
    label: string;
    capacity: number;
    projects: ProjectProjection[];
    empty_state: boolean;
    collapsible: boolean;
  }>;
  risks_and_actions: string[];
  weekly_entry: DrilldownRef | null;
}

export type ProjectProjection = (DailyReport["today_star_projects"][number] | DailyReport["context_only_projects"][number]) & {
  preset_bucket: ProjectPresetBucket | null;
  preset_memberships: ProjectPresetBucket[];
  utility_hint: ProjectUtilityHint;
  repeat_exposure_state: RepeatExposureState;
  head_project_exception_reason: HeadProjectExceptionReason | null;
  hard_infra: boolean;
};

export type ObserverProjection = EcosystemObserverEntry & {
  observer_preset_bucket: ObserverPresetBucket | null;
  utility_hint: ProjectUtilityHint;
  repeat_exposure_state: RepeatExposureState;
  head_project_exception_reason: HeadProjectExceptionReason | null;
  hard_infra: boolean;
};

export interface ProjectsViewModel {
  context: ViewContext;
  banner: ViewBanner;
  state: VisualConsoleState;
  time_navigator: TimeNavigatorModel;
  route_frame: RouteFrameModel;
  today_pulse_projects: DailyReport["today_star_projects"];
  mission_match_projects: DailyReport["today_star_projects"];
  explore_ribbon_projects: DailyReport["today_star_projects"];
  historical_context_projects: DailyReport["context_only_projects"];
  default_preset: ProjectPresetFilter;
  preset_query_enabled: boolean;
  preset_groups: Record<ProjectPresetBucket, ProjectProjection[]>;
  projects: ProjectProjection[];
  selected_project:
    | {
        project: ProjectProjection;
        binding: ProjectContextBinding;
        kb_preview: KnowledgeCard | null;
        kb_missing: boolean;
      }
    | null;
}

export interface WeeklyViewModel {
  context: ViewContext;
  banner: ViewBanner;
  state: VisualConsoleState;
  time_navigator: TimeNavigatorModel;
  route_frame: RouteFrameModel;
  weekly_snapshot: WeeklySnapshot | null;
  overall_judgment: string | null;
  supporting_project_drilldowns: DrilldownRef[];
}

export interface RunHealthViewModel {
  context: ViewContext;
  banner: ViewBanner;
  state: VisualConsoleState;
  time_navigator: TimeNavigatorModel;
  route_frame: RouteFrameModel;
  run_snapshot: RunSnapshot | null;
}

export interface ObserverViewModel {
  context: ViewContext;
  banner: ViewBanner;
  state: VisualConsoleState;
  time_navigator: TimeNavigatorModel;
  route_frame: RouteFrameModel;
  artifact: EcosystemObserverArtifact | null;
  default_preset: ObserverPresetFilter;
  preset_query_enabled: boolean;
  entries: ObserverProjection[];
}

export type AgentReachDataSourceKind = "aggregate" | "daily-section" | "run-summary" | "missing";
export type AgentReachChipTone = "neutral" | "good" | "warn" | "bad" | "accent";

export interface AgentReachStatusViewModel {
  provider_status: ExternalProviderStatus | "missing";
  label: string;
  reason: string;
  tone: AgentReachChipTone;
  data_source: AgentReachDataSourceKind;
  aggregate_path: string | null;
}

export interface AgentReachSummaryCardViewModel {
  key: "overview" | "new_discoveries" | "project_evidence" | "direction_observations" | "official_releases";
  label: string;
  value: number;
  body: string;
  tone: AgentReachChipTone;
}

export interface AgentReachFilterChipViewModel {
  key: string;
  label: string;
  count?: number;
  tone?: AgentReachChipTone;
  readonly?: boolean;
}

export interface AgentReachFilterViewModel {
  type_chips: AgentReachFilterChipViewModel[];
  source_chips: AgentReachFilterChipViewModel[];
  sort_options: AgentReachFilterChipViewModel[];
  status_chips: AgentReachFilterChipViewModel[];
}

export interface AgentReachEvidenceSourceViewModel {
  source_id: string;
  event_id: string;
  platform: string;
  platform_label: string;
  title: string;
  source_url: string | null;
  raw_event_kind: string;
  raw_event_kind_label: string;
  target_name: string;
  target_url: string | null;
  source_published_at: string | null;
  observed_at: string | null;
  metrics: Array<{ key: string; label: string; value: number }>;
  actor_type: string;
  actor_type_label: string;
  actor_tier: string;
  actor_tier_label: string;
}

export interface AgentReachNamedActorViewModel {
  entity_id: string;
  display_name: string;
  actor_type: string;
  actor_type_label: string;
  registry_tier: string;
  registry_tier_label: string;
  event_count: number;
  platforms: string[];
  platform_labels: string[];
  first_seen_at: string | null;
  last_seen_at: string | null;
}

export interface AgentReachPublicActorViewModel {
  actor_id: string;
  display_name: string;
  actor_type: string;
  actor_type_label: string;
  source_kind: string;
  source_kind_label: string;
  event_count: number;
  platforms: string[];
  platform_labels: string[];
  first_seen_at: string | null;
  last_seen_at: string | null;
}

export interface AgentReachEvidenceViewModel {
  evidence_id: string;
  target_key: string;
  event_ids: string[];
  platforms: string[];
  platform_labels: string[];
  mention_count: number;
  distinct_actor_count: number;
  first_seen_at: string | null;
  last_seen_at: string | null;
  active_day_count: number;
  cross_platform: boolean;
  named_registry_actors: AgentReachNamedActorViewModel[];
  public_actors: AgentReachPublicActorViewModel[];
  actor_types: Array<{ key: string; label: string; count: number }>;
  actor_tiers: Array<{ key: string; label: string; count: number }>;
  authority_summary_cn: string;
  intensity_summary_cn: string;
  persistence_summary_cn: string;
  caveats: string[];
  source_cards: AgentReachEvidenceSourceViewModel[];
}

export interface AgentReachCandidateCardViewModel {
  candidate_id: string;
  scope: "project" | "direction";
  candidate_kind: string;
  display_name: string;
  type_key: string;
  type_label: string;
  target_type: string;
  target_type_label: string;
  target_key: string;
  target_url: string | null;
  object_label: string;
  external_attention_score: number | null;
  external_attention_label: string;
  evidence_count: number;
  evidence_ids: string[];
  platforms: string[];
  platform_labels: string[];
  source_count: number;
  distinct_actor_count: number;
  binding_confidence: ExternalBindingConfidence;
  binding_confidence_label: string;
  named_registry_actors: AgentReachNamedActorViewModel[];
  public_actors: AgentReachPublicActorViewModel[];
  named_actor_count: number;
  actor_types: Array<{ key: string; label: string; count: number }>;
  actor_tiers: Array<{ key: string; label: string; count: number }>;
  cross_platform: boolean;
  qualification: string;
  qualification_label: string;
  can_enter_daily: boolean;
  can_enter_weekly: boolean;
  cannot_be_primary_conclusion: boolean;
  caveats: string[];
  summary: string;
  intro_line: string;
  appearance_reason: string;
  why_watch_reasons: string[];
  confirmation_gaps: string[];
  display_reasons: string[];
  tags: string[];
  last_seen_at: string | null;
  evidence_cards: AgentReachEvidenceViewModel[];
  source_cards: AgentReachEvidenceSourceViewModel[];
}

export interface AgentReachCoverageViewModel {
  platform: string;
  platform_label: string;
  status: ExternalCoverageStatus | "missing";
  status_label: string;
  reason: string;
  warnings: string[];
  tone: AgentReachChipTone;
}

export interface AgentReachDirectionSnapshotViewModel {
  direction_evidence_count: number;
  direction_candidate_count: number;
  direction_label_counts: Array<{ key: string; label: string; count: number }>;
  pending_external_signal_count: number;
  zero_relevant_results_count: number;
  not_configured_count: number;
  partial_count: number;
}

export interface AgentReachViewModel {
  context: ViewContext;
  banner: ViewBanner;
  state: VisualConsoleState;
  time_navigator: TimeNavigatorModel;
  route_frame: RouteFrameModel;
  status: AgentReachStatusViewModel;
  summary_cards: AgentReachSummaryCardViewModel[];
  filters: AgentReachFilterViewModel;
  candidates: AgentReachCandidateCardViewModel[];
  evidence_by_id: Record<string, AgentReachEvidenceViewModel>;
  sources_by_event_id: Record<string, AgentReachEvidenceSourceViewModel[]>;
  coverage: AgentReachCoverageViewModel[];
  direction_snapshot: AgentReachDirectionSnapshotViewModel;
  warnings: string[];
}

export interface KnowledgeBaseViewModel {
  context: ViewContext;
  banner: ViewBanner;
  state: VisualConsoleState;
  time_navigator: TimeNavigatorModel;
  route_frame: RouteFrameModel;
  index: KnowledgeCard[] | null;
  selected_card: (KnowledgeCard & { sections: KbCardSections }) | null;
}
