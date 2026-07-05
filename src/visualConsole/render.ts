import type {
  KnowledgeBaseViewModel,
  ObserverViewModel,
  OverviewViewModel,
  ProjectsViewModel,
  RunHealthViewModel,
  WeeklyViewModel,
} from "./types.ts";
import type { DailyReport } from "../types.ts";

function readObserverIncubatingDirections(model: ObserverViewModel) {
  return Array.isArray(model.artifact?.incubating_directions) ? model.artifact.incubating_directions : [];
}

function readObserverPromotionCandidates(model: ObserverViewModel) {
  return Array.isArray(model.artifact?.promotion_candidates) ? model.artifact.promotion_candidates : [];
}

function renderProjectLine(
  project: DailyReport["today_star_projects"][number] | DailyReport["context_only_projects"][number],
): string[] {
  return [
    `- ${project.project.project_name}: repo=${project.project.repo_url}, score=${project.score.total_score}, confidence=${project.score.confidence}, paradigm=${project.score.paradigm}, persistence=${project.project.persistence_state}, exposure_bucket=${project.exposure_bucket ?? "none"}`,
    `  - directions=${project.direction_matches?.join(", ") || "none"}`,
    `  - appearance_reason_codes=${project.appearance_reason_codes?.join(" | ") || "none"}`,
    `  - appearance_explanation=${project.appearance_explanation_cn ?? "none"}`,
    `  - top_evidence=${project.project_brief_cn}, risks=${project.score.risks.join(" | ") || "none"}, next_actions=${project.score.next_actions.join(" | ") || "none"}, matched_interest_topics=${project.matched_interest_topics.join(", ") || "none"}, enhancement=${project.enhancement_source}`,
  ];
}

function renderBanner(model: {
  banner: {
    title: string;
    context_label: string;
    generated_at: string | null;
    enhancement_status: string;
    github_enrichment_status: string;
    source_health: string;
    notes: string[];
  };
  state: { status: string; reasons: string[] };
}): string[] {
  return [
    `# ${model.banner.title}`,
    "",
    `- context: ${model.banner.context_label}`,
    `- status: ${model.state.status}`,
    `- generated_at: ${model.banner.generated_at ?? "unknown"}`,
    `- enhancement_status: ${model.banner.enhancement_status}`,
    `- github_enrichment_status: ${model.banner.github_enrichment_status}`,
    `- source_health: ${model.banner.source_health}`,
    ...(model.banner.notes.length > 0 ? ["- notes:", ...model.banner.notes.map((note) => `  - ${note}`)] : []),
    ...(model.state.reasons.length > 0 ? ["- reasons:", ...model.state.reasons.map((reason) => `  - ${reason}`)] : []),
    "",
  ];
}

export function renderOverviewView(model: OverviewViewModel): string {
  const runtime = model.run_snapshot?.run_summary?.industry_runtime_summary ?? model.run_snapshot?.industry_runtime_summary ?? null;
  const policyFinanceReplay = model.run_snapshot?.policy_finance_runtime_replay ?? null;
  const lines = [
    ...renderBanner(model),
    "## Run Trust Summary",
    "",
    model.run_snapshot
      ? `- overall_daily_status: ${model.run_snapshot.daily_report.overall_daily_status}`
      : "- overall_daily_status: unavailable",
    `- verify_status: ${model.run_snapshot?.verify_result?.status ?? "missing"}`,
    `- freshness: ${
      model.run_snapshot?.daily_report.freshness_sources.map((item) => `${item.source}:${item.freshness_state}`).join(", ") ??
      "unavailable"
    }`,
    "",
    "## Source Health Summary",
    "",
    ...(model.run_snapshot?.run_summary?.source_status.map(
      (item) => `- ${item.source}: status=${item.status}, enabled=${item.enabled}, count=${item.item_count}`,
    ) ?? ["- run-summary missing"]),
    "",
    "## Industry Runtime Snapshot",
    "",
    runtime ? `- overall_status: ${runtime.overall_status}` : "- overall_status: missing",
    runtime
      ? `- policy_finance_status: ${runtime.policy_finance.status}`
      : policyFinanceReplay
        ? `- policy_finance_status: ${policyFinanceReplay.current_status}`
        : "- policy_finance_status: missing",
    runtime
      ? `- policy_finance_profiles: activation=${runtime.policy_finance.activation_profile_ids?.join(", ") || "none"}; stop=${runtime.policy_finance.stop_profile_ids?.join(", ") || "none"}; review=${runtime.policy_finance.review_profile_ids?.join(", ") || "none"}`
      : policyFinanceReplay
        ? `- policy_finance_profiles: activation=${policyFinanceReplay.activation_profile_ids.join(", ") || "none"}; stop=${policyFinanceReplay.stop_profile_ids.join(", ") || "none"}; review=${policyFinanceReplay.review_profile_ids.join(", ") || "none"}`
        : "- policy_finance_profiles: missing",
    runtime ? `- product_ecosystem_status: ${runtime.product_ecosystem.status}` : "- product_ecosystem_status: missing",
    runtime
      ? `- academic_blocked_until: ${runtime.academic_preparatory.blocked_until}`
      : "- academic_blocked_until: missing",
    runtime
      ? `- platform_contract_fixture: ${runtime.platform_contract.fixture_id}`
      : policyFinanceReplay
        ? `- platform_contract_fixture: ${policyFinanceReplay.fixture_id}`
        : "- platform_contract_fixture: missing",
    "",
    "## Top Decisions",
    "",
    ...(model.top_decisions.length > 0
      ? model.top_decisions.map(
          (project) =>
            `- ${project.project.project_name}: score=${project.score.total_score}, confidence=${project.score.confidence}, paradigm=${project.score.paradigm}, top_evidence=${project.score.components.map((item) => item.evidence[0]).filter(Boolean).slice(0, 3).join(" | ") || "none"}, persistence=${project.project.persistence_state}, risk=${project.score.risks.join(" | ") || "none"}`,
        )
      : ["- 褰撳墠娌℃湁鍙睍绀洪」鐩?"]),
    "",
    "## Risks and Recommended Actions",
    "",
    ...(model.risks_and_actions.length > 0 ? model.risks_and_actions.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Weekly Entry",
    "",
    model.weekly_entry ? `- ${model.weekly_entry.label}: anchor=${model.weekly_entry.anchor_date}` : "- weekly unavailable",
    "",
  ];
  return lines.join("\n");
}

export function renderProjectsView(model: ProjectsViewModel): string {
  const lines = [...renderBanner(model)];
  if (model.selected_project) {
    const selected = model.selected_project.project;
    lines.push("## Project Identity", "", `- project_name: ${selected.project.project_name}`, `- repo_url: ${selected.project.repo_url}`);
    lines.push(
      "",
      "## Score and Evidence",
      "",
      `- score: ${selected.score.total_score}`,
      `- confidence: ${selected.score.confidence}`,
      `- paradigm: ${selected.score.paradigm}`,
      `- top_evidence: ${selected.score.components.map((item) => item.evidence[0]).filter(Boolean).slice(0, 3).join(" | ") || "none"}`,
    );
    lines.push(
      "",
      "## Risk and Next Actions",
      "",
      `- risks: ${selected.score.risks.join(" | ") || "none"}`,
      `- next_actions: ${selected.score.next_actions.join(" | ") || "none"}`,
    );
    lines.push(
      "",
      "## Persistence and Appearances",
      "",
      `- persistence: ${selected.project.persistence_state}`,
      `- appearances: ${selected.project.appearance_dates.join(", ")}`,
    );
    lines.push(
      "",
      "## Run / Audit Context",
      "",
      `- source_view: ${model.selected_project.binding.source_view}`,
      `- date: ${model.selected_project.binding.date ?? "none"}`,
      `- window_end: ${model.selected_project.binding.window_end ?? "none"}`,
      `- trend_key: ${model.selected_project.binding.trend_key ?? "none"}`,
    );
    lines.push(
      "",
      "## Knowledge Card Preview",
      "",
      model.selected_project.kb_preview ? `- available: ${model.selected_project.kb_preview.project_name}` : "- KB 鏈敓鎴?/ 涓嶅瓨鍦?",
    );
  } else {
    lines.push("## Today Pulse", "");
    lines.push(
      ...(model.today_pulse_projects.length > 0
        ? model.today_pulse_projects.flatMap((project) => renderProjectLine(project))
        : ["- no today pulse projects"]),
    );
    lines.push("", "## Mission Match", "");
    lines.push(
      ...(model.mission_match_projects.length > 0
        ? model.mission_match_projects.flatMap((project) => renderProjectLine(project))
        : ["- no mission match projects"]),
    );
    lines.push("", "## Explore Ribbon", "");
    lines.push(
      ...(model.explore_ribbon_projects.length > 0
        ? model.explore_ribbon_projects.flatMap((project) => renderProjectLine(project))
        : ["- no explore ribbon projects"]),
    );
    lines.push("", "## Historical Context", "");
    lines.push(
      ...(model.historical_context_projects.length > 0
        ? model.historical_context_projects.flatMap((project) => renderProjectLine(project))
        : ["- no historical context projects"]),
    );
  }
  lines.push("");
  return lines.join("\n");
}

export function renderWeeklyView(model: WeeklyViewModel): string {
  const runtimeWindow = model.weekly_snapshot?.industry_runtime_window_summary ?? null;
  const lines = [
    ...renderBanner(model),
    "## Weekly Trust Summary",
    "",
    `- weekly_judgeable: ${model.state.status !== "failed" && model.state.status !== "empty" ? "yes" : "no"}`,
    `- enhancement_status: ${model.banner.enhancement_status}`,
    `- rules_mode: ${model.banner.mode_label}`,
    `- audit_context: ${model.weekly_snapshot?.audit_status ?? "missing"}`,
    "",
    "## Industry Runtime Window",
    "",
    runtimeWindow ? `- latest_overall_status: ${runtimeWindow.latest_overall_status ?? "none"}` : "- latest_overall_status: missing",
    runtimeWindow ? `- latest_academic_blocked_until: ${runtimeWindow.latest_academic_blocked_until ?? "none"}` : "- latest_academic_blocked_until: missing",
    runtimeWindow ? `- latest_platform_contract_fixture: ${runtimeWindow.latest_platform_contract_fixture ?? "none"}` : "- latest_platform_contract_fixture: missing",
    runtimeWindow ? `- days_with_industry_runtime_summary: ${runtimeWindow.days_with_industry_runtime_summary}` : "- days_with_industry_runtime_summary: 0",
    runtimeWindow ? `- policy_finance_runtime_ready_days: ${runtimeWindow.policy_finance_runtime_ready_days.join(", ") || "none"}` : "- policy_finance_runtime_ready_days: none",
    runtimeWindow ? `- latest_policy_finance_activation_profiles: ${runtimeWindow.latest_policy_finance_activation_profile_ids.join(", ") || "none"}` : "- latest_policy_finance_activation_profiles: none",
    runtimeWindow ? `- latest_policy_finance_stop_profiles: ${runtimeWindow.latest_policy_finance_stop_profile_ids.join(", ") || "none"}` : "- latest_policy_finance_stop_profiles: none",
    runtimeWindow ? `- latest_policy_finance_review_profiles: ${runtimeWindow.latest_policy_finance_review_profile_ids.join(", ") || "none"}` : "- latest_policy_finance_review_profiles: none",
    runtimeWindow ? `- product_ecosystem_dry_run_ready_days: ${runtimeWindow.product_ecosystem_dry_run_ready_days.join(", ") || "none"}` : "- product_ecosystem_dry_run_ready_days: none",
    runtimeWindow ? `- academic_preparatory_ready_days: ${runtimeWindow.academic_preparatory_ready_days.join(", ") || "none"}` : "- academic_preparatory_ready_days: none",
    "",
    "## Overall Weekly Judgment",
    "",
    `- overall_judgment: ${model.overall_judgment ?? "unavailable"}`,
    `- core_trend_count: ${model.weekly_snapshot?.markdown.core_trend_cards.length ?? 0}`,
    `- weak_signal_count: ${model.weekly_snapshot?.markdown.weak_signal_cards.length ?? 0}`,
    "",
    "## Core Trend Cards",
    "",
    ...(model.weekly_snapshot?.markdown.core_trend_cards.length
      ? model.weekly_snapshot.markdown.core_trend_cards.flatMap((card) => [
          `- ${card.trend_name_cn} [${card.trend_key}]`,
          `  - summary: ${card.trend_summary_cn ?? "none"}`,
          `  - evidence: ${card.evidence_summary_cn ?? "none"}`,
          `  - strength: ${card.strength ?? "none"}`,
          `  - watch_next: ${card.worth_following_next_week ?? "none"}`,
          `  - supporting_projects: ${card.supporting_projects.map((project) => project.project_name).join(", ") || "none"}`,
        ])
      : ["- 鏈懆杩樻病鏈夊舰鎴愮ǔ瀹氳秼鍔垮崱鐗?"]),
    "",
    "## Weak Signals / Watch Next",
    "",
    ...(model.weekly_snapshot?.markdown.weak_signal_cards.length
      ? model.weekly_snapshot.markdown.weak_signal_cards.flatMap((card) => [
          `- ${card.signal_name_cn} [${card.trend_key}]`,
          `  - why_weak: ${card.why_weak_cn ?? "none"}`,
          `  - evidence: ${card.evidence_summary_cn ?? "none"}`,
          `  - watch_next: ${card.worth_following_next_week ?? "none"}`,
        ])
      : ["- 褰撳墠娌℃湁闇€瑕佸崟鐙窡杩涚殑寮变俊鍙峰崱鐗?"]),
    "",
    "## Optional Audit Context Blocks",
    "",
    `- supporting_trend_keys: ${model.weekly_snapshot?.markdown.supporting_trend_keys.join(", ") || "none"}`,
    `- audit_rejected_outputs: ${model.weekly_snapshot?.audit_rejected_outputs ?? 0}`,
    `- drilldown_count: ${model.supporting_project_drilldowns.length}`,
    "",
    "## Drilldowns",
    "",
    ...(model.supporting_project_drilldowns.length > 0
      ? model.supporting_project_drilldowns.map(
          (item) => `- ${item.label}: date=${item.date ?? "none"}, trend_key=${item.trend_key ?? "none"}`,
        )
      : ["- none"]),
    "",
  ];
  return lines.join("\n");
}

export function renderRunHealthView(model: RunHealthViewModel): string {
  const coverageAtlas = model.run_snapshot?.run_summary?.coverage_atlas ?? [];
  const gapLedger = model.run_snapshot?.run_summary?.gap_ledger ?? [];
  const runtime = model.run_snapshot?.run_summary?.industry_runtime_summary ?? model.run_snapshot?.industry_runtime_summary ?? null;
  const policyFinanceReplay = model.run_snapshot?.policy_finance_runtime_replay ?? null;
  const recommendedActions = [
    ...(runtime?.academic_preparatory.blocked_until
      ? [`等待 academic 侧交付 ${runtime.academic_preparatory.blocked_until} 后再继续推进 formal runtime 集成`]
      : []),
    ...(model.run_snapshot?.verify_result?.recommended_actions ?? []),
  ];
  const lines = [
    ...renderBanner(model),
    "## Industry Runtime",
    "",
    runtime
      ? `- overall_status: ${runtime.overall_status}`
      : policyFinanceReplay
        ? `- overall_status: ${policyFinanceReplay.current_status}`
        : "- overall_status: missing",
    runtime
      ? `- policy_finance: status=${runtime.policy_finance.status}, negative_reason=${runtime.policy_finance.negative_reason_code}, same_run_messages=${runtime.policy_finance.runtime_consumed_same_run_messages}, activation_profiles=${runtime.policy_finance.activation_profile_ids?.join(", ") || "none"}, stop_profiles=${runtime.policy_finance.stop_profile_ids?.join(", ") || "none"}, review_profiles=${runtime.policy_finance.review_profile_ids?.join(", ") || "none"}`
      : policyFinanceReplay
        ? `- policy_finance: status=${policyFinanceReplay.current_status}, negative_reason=${policyFinanceReplay.negative_reason_code}, same_run_messages=${policyFinanceReplay.runtime_consumed_same_run_messages}, activation_profiles=${policyFinanceReplay.activation_profile_ids.join(", ") || "none"}, stop_profiles=${policyFinanceReplay.stop_profile_ids.join(", ") || "none"}, review_profiles=${policyFinanceReplay.review_profile_ids.join(", ") || "none"}`
        : "- policy_finance: missing",
    runtime
      ? `- product_ecosystem: status=${runtime.product_ecosystem.status}, normalized_refs=${runtime.product_ecosystem.normalized_event_batch_refs_count}, coverage_refs=${runtime.product_ecosystem.coverage_refs_count}, contribution_refs=${runtime.product_ecosystem.contribution_refs_count}`
      : "- product_ecosystem: missing",
    runtime
      ? `- academic_preparatory: status=${runtime.academic_preparatory.status}, blocked_until=${runtime.academic_preparatory.blocked_until}, promotion_ready=${runtime.academic_preparatory.promotion_ready ? "true" : "false"}`
      : "- academic_preparatory: missing",
    runtime
      ? `- platform_contract: fixture=${runtime.platform_contract.fixture_id}, governance_published=${runtime.platform_contract.shared_governance_published ? "true" : "false"}, governance_profiles=${runtime.platform_contract.shared_governance_profile_count}, published_for=${runtime.platform_contract.published_for.join(", ") || "none"}`
      : policyFinanceReplay
        ? `- platform_contract: fixture=${policyFinanceReplay.fixture_id}, governance_published=unknown, governance_profiles=unknown, published_for=unknown`
        : "- platform_contract: missing",
    runtime
      ? `- dispatch_gate: same_run_requires=${runtime.platform_contract.dispatch_gate.same_run_requires_count}, reservation_state=${runtime.platform_contract.dispatch_gate.high_cost_requires_reservation_state}, budget_rejected_blocks_start=${runtime.platform_contract.dispatch_gate.budget_rejected_blocks_start ? "true" : "false"}, async_only_review_blocks_same_run=${runtime.platform_contract.dispatch_gate.async_only_review_is_not_same_run_available ? "true" : "false"}`
      : "- dispatch_gate: missing",
    runtime
      ? `- event_consumer_gate: responsibility_match=${runtime.platform_contract.event_consumer_gate.execution_context_primary_responsibility_matches_responsibility ? "true" : "false"}, operational_executor_required=${runtime.platform_contract.event_consumer_gate.operational_executor_id_required ? "true" : "false"}, takeover_requires_audit_ref=${runtime.platform_contract.event_consumer_gate.takeover_requires_takeover_audit_ref ? "true" : "false"}`
      : "- event_consumer_gate: missing",
    "",
    "## Mission Health",
    "",
    `- mission_discovery_status: ${model.run_snapshot?.run_summary?.mission_discovery_status ?? "missing"}`,
    `- mission_degraded_reason_codes: ${model.run_snapshot?.run_summary?.mission_degraded_reason_codes?.join(", ") || "none"}`,
    `- search_exhausted_count: ${coverageAtlas.filter((item) => item.search_exhausted).length}`,
    `- coverage_unmet_count: ${coverageAtlas.filter((item) => !item.quantity_target_met).length}`,
    "",
    "## Coverage Atlas",
    "",
    ...(coverageAtlas.length > 0
      ? coverageAtlas.map(
          (item) =>
            `- ${item.direction_key}: outcome=${item.outcome}, pressure_state=${item.pressure_state}, quantity_target_met=${item.quantity_target_met}, search_exhausted=${item.search_exhausted ? "true" : "false"}, next_action=${item.next_action}`,
        )
      : ["- coverage atlas missing"]),
    "",
    "## Gap Ledger",
    "",
    ...(gapLedger.length > 0
      ? gapLedger.map(
          (item) =>
            `- ${item.direction_key}: outcome=${item.outcome}, search_exhausted=${item.search_exhausted ? "true" : "false"}, next_action=${item.next_action}, reason_codes=${item.reason_codes.join(" | ") || "none"}`,
        )
      : ["- gap ledger missing"]),
    "",
    "## Verify Result Summary",
    "",
    `- verify_status: ${model.run_snapshot?.verify_result?.status ?? "missing"}`,
    ...(model.run_snapshot?.verify_result?.checks.map((check) => `- ${check.name}: ${check.status} (${check.detail})`) ?? ["- verify missing"]),
    "",
    "## Source Status Table",
    "",
    ...(model.run_snapshot?.run_summary?.source_status.map(
      (source) => `- ${source.source}: status=${source.status}, enabled=${source.enabled}, notes=${source.notes.join(" | ")}`,
    ) ?? ["- run-summary missing"]),
    "",
    "## GitHub Enrichment Audit Table",
    "",
    ...(model.run_snapshot?.github_audit?.map(
      (entry) => `- ${entry.repo_full_name}: status=${entry.status}, metrics_applied=${entry.metrics_applied}`,
    ) ?? ["- github audit missing"]),
    "",
    "## Failure / Empty / Fallback Notes",
    "",
    ...(model.state.reasons.length > 0 ? model.state.reasons.map((reason) => `- ${reason}`) : ["- none"]),
    "",
    "## Recommended Actions",
    "",
    ...(recommendedActions.length > 0 ? recommendedActions.map((action) => `- ${action}`) : ["- none"]),
    "",
  ];
  return lines.join("\n");
}

export function renderObserverView(model: ObserverViewModel): string {
  const incubatingDirections = readObserverIncubatingDirections(model);
  const promotionCandidates = readObserverPromotionCandidates(model);
  const lines = [
    ...renderBanner(model),
    "## Ecosystem Coverage",
    "",
    ...(model.artifact
      ? Object.entries(model.artifact.ecosystem_counts).map(([ecosystem, count]) => `- ${ecosystem}: ${count}`)
      : ["- observer artifact missing"]),
    "",
    "## Incubating Directions",
    "",
    ...(incubatingDirections.length
      ? incubatingDirections.flatMap((direction) => [
          `- ${direction.direction_key}: status=${direction.status}, observer_hits_7d=${direction.observer_hits_7d}, repos=${direction.candidate_repo_count}, promotion_candidate=${direction.promotion_candidate ? "true" : "false"}`,
          `  - related_catalog_direction_keys=${direction.related_catalog_direction_keys.join(", ") || "none"}`,
          `  - related_gap_pressure_states=${direction.related_gap_pressure_states.join(", ") || "none"}`,
          `  - representative_repos=${direction.representative_repos.map((repo) => repo.repo_full_name).join(", ") || "none"}`,
          `  - unmet_gates=${direction.unmet_gates.join(" | ") || "none"}`,
          `  - evidence=${direction.evidence.join(" | ") || "none"}`,
        ])
      : ["- no incubating directions"]),
    "",
    "## Candidate Bench",
    "",
    ...(model.artifact?.entries.length
      ? model.artifact.entries.flatMap((entry) => [
          `- ${entry.repo_full_name}: rank=${entry.observer_rank ?? "?"}, observer_score=${entry.observer_score ?? "unknown"}, ecosystems=${entry.ecosystems.join(", ")}, stars=${entry.stars ?? "unknown"}`,
          `  - labels=${entry.labels?.join(", ") || "none"}`,
          `  - pedigree=builders:${entry.pedigree?.builders.join(", ") || "none"}; companies:${entry.pedigree?.companies.join(", ") || "none"}; engineers:${entry.pedigree?.engineers.join(", ") || "none"}`,
          `  - keywords=${entry.matched_by.keywords.join(", ") || "none"}`,
          `  - topics=${entry.matched_by.topic_hints.join(", ") || "none"}`,
          `  - source_notes=${entry.source_notes.join(" | ") || "none"}`,
        ])
      : ["- no observer candidates"]),
    "",
    "## Promotion Review",
    "",
    ...(promotionCandidates.length
      ? promotionCandidates.flatMap((candidate) => [
          `- ${candidate.direction_key}: display_name=${candidate.display_name_cn}`,
          `  - evidence=${candidate.evidence.join(" | ") || "none"}`,
          `  - unmet_gates=${candidate.unmet_gates.join(" | ") || "none"}`,
        ])
      : ["- no promotion candidates"]),
    "",
    "## Observer Guidance",
    "",
    "- observer-only findings are not scored and do not enter the main board.",
    ...(model.artifact?.notes.length ? model.artifact.notes.map((note) => `- ${note}`) : []),
    "",
  ];
  return lines.join("\n");
}

export function renderKnowledgeBaseView(model: KnowledgeBaseViewModel): string {
  const lines = [...renderBanner(model)];
  if (model.selected_card) {
    lines.push("## Card Reader", "", `- project_name: ${model.selected_card.project_name}`, `- repo_url: ${model.selected_card.repo_url}`);
    lines.push("", "## Machine Section", "");
    lines.push(...model.selected_card.sections.machine_sections.map((section) => `- ${section.title}: ${section.body.join(" ") || "none"}`));
    lines.push("", "## Human Section", "");
    lines.push(
      ...(model.selected_card.sections.human_sections.length > 0
        ? model.selected_card.sections.human_sections.map((section) => `- ${section.title}: ${section.body.join(" ") || "none"}`)
        : ["- KB 鏈寘鍚汉宸ュ尯鍐呭"]),
    );
    lines.push("", "## Linked Context", "", `- updated_at: ${model.selected_card.updated_at}`, `- paradigm: ${model.selected_card.paradigm}`);
  } else {
    lines.push("## KB Index", "");
    lines.push(
      ...(model.index && model.index.length > 0
        ? model.index.map((item) => `- ${item.project_name}: paradigm=${item.paradigm}, updated_at=${item.updated_at}`)
        : ["- KB 鏈敓鎴?/ 涓嶅瓨鍦?"]),
    );
  }
  lines.push("");
  return lines.join("\n");
}
