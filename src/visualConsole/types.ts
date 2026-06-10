import type {
  DailyReport,
  DailyRunSummary,
  EcosystemObserverArtifact,
  EnhancementStatus,
  GitHubEnrichmentAuditEntry,
  KnowledgeCard,
  ScoreComponentName,
  VerifyDailyResult,
} from "../types.ts";

export type ReadStatus = "ok" | "not_found" | "parse_error" | "unsupported_context";
export type TopLevelViewStatus = "ready" | "degraded" | "stale" | "failed" | "empty" | "not-judgeable";
export type VisualConsoleView = "overview" | "projects" | "weekly" | "run-health" | "observer" | "knowledge-base";
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
  verify_result: VerifyDailyResult | null;
  github_audit: GitHubEnrichmentAuditEntry[] | null;
  observer_artifact: EcosystemObserverArtifact | null;
}

export interface WeeklySnapshot {
  anchor_date: string;
  markdown: ParsedWeeklyReport;
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
export type RouteFrameRoute = "overview" | "projects" | "weekly" | "run-health" | "observer" | "kb";

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
  top_decisions: DailyReport["today_star_projects"];
  risks_and_actions: string[];
  weekly_entry: DrilldownRef | null;
}

export interface ProjectsViewModel {
  context: ViewContext;
  banner: ViewBanner;
  state: VisualConsoleState;
  time_navigator: TimeNavigatorModel;
  route_frame: RouteFrameModel;
  projects: Array<DailyReport["today_star_projects"][number] | DailyReport["context_only_projects"][number]>;
  selected_project:
    | {
        project: DailyReport["today_star_projects"][number] | DailyReport["context_only_projects"][number];
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
