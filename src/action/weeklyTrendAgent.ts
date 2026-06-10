import type {
  EnhancementStatus,
  RejectedOutput,
  WeeklyEvidenceCluster,
  WeeklyEvidenceProject,
  WeeklyTrendAgentReview,
  WeeklyTrendCandidateV2,
} from "../types.ts";

export interface WeeklyTrendAgentContext {
  candidates: WeeklyTrendCandidateV2[];
  projects: WeeklyEvidenceProject[];
}

const MAX_CANDIDATE_REFS = 8;
const MAX_PROMPT_PROJECTS = 64;
const MAX_PROJECT_COMPONENTS = 3;
const MAX_COMPONENT_EVIDENCE = 1;
const MAX_PROJECT_EVIDENCE = 2;
const MAX_FALLBACK_TRENDS = 6;
const MAX_AUDIT_TEXTS = 4;

function take<T>(items: T[] | undefined, maxItems: number): T[] {
  return Array.isArray(items) ? items.slice(0, maxItems) : [];
}

function compactCandidates(candidates: WeeklyTrendCandidateV2[]) {
  return candidates.map((candidate) => ({
    cid: candidate.candidate_id,
    cl: take(candidate.source_cluster_ids, 4),
    hint: candidate.candidate_name_hint,
    hyp: candidate.hypothesis,
    p: take(candidate.supporting_project_refs, 5),
    e: take(candidate.evidence_refs, 5),
    ce: take(candidate.counter_evidence_refs, 2),
    u: take(candidate.unexplained_project_refs, 2),
    a: take(candidate.anomaly_refs, 2),
    sc: [
      candidate.coverage_score,
      candidate.cohesion_score,
      candidate.novelty_score,
      candidate.reliability_score,
    ],
    rv: candidate.rule_verdict,
  }));
}

function compactClusters(clusters: WeeklyEvidenceCluster[]) {
  return clusters.map((cluster) => ({
    id: cluster.cluster_id,
    seed: take(cluster.seed_labels, 4),
    cap: take(cluster.shared_capabilities, 4),
    pdg: take(cluster.shared_paradigms, 4),
    p: take(
      cluster.supporting_projects.map((project) => project.repo_full_name),
      6,
    ),
    n: cluster.distinct_repo_count,
    days: cluster.appearance_day_count,
    rep: cluster.repeated_project_count,
    hi: cluster.high_confidence_project_count,
  }));
}

function compactProjects(projects: WeeklyEvidenceProject[]) {
  return [...projects]
    .sort((left, right) => {
      const scoreDelta = right.total_score - left.total_score;
      if (scoreDelta !== 0) return scoreDelta;
      const appearanceDelta = right.appearances - left.appearances;
      if (appearanceDelta !== 0) return appearanceDelta;
      return left.repo_full_name.localeCompare(right.repo_full_name);
    })
    .slice(0, MAX_PROMPT_PROJECTS)
    .map((project) => ({
      repo: project.repo_full_name,
      days: take(project.appearance_dates, 4),
      n: project.appearances,
      ps: project.persistence_state,
      src: take(project.sources, 3),
      topic: take(project.matched_topics, 4),
      pdg: project.paradigm,
      cf: project.confidence,
      sc: project.total_score,
      flags: take(project.anti_noise_flags, 3),
      tags: take(project.tags, 4),
      risks: take(project.risks, 2),
      cmp: take(project.components, MAX_PROJECT_COMPONENTS).map((component) => ({
        n: component.name,
        s: component.score,
        w: component.weighted_score,
        e: take(component.evidence, MAX_COMPONENT_EVIDENCE),
      })),
      ev: take(project.evidence_snippets, MAX_PROJECT_EVIDENCE),
    }));
}

function compactFallbackReview(fallback: WeeklyTrendAgentReview) {
  return {
    sum: fallback.executive_summary_cn,
    established_trends: take(fallback.established_trends, MAX_FALLBACK_TRENDS).map((trend) => ({
      id: trend.trend_id,
      name: trend.trend_name_cn,
      claim: trend.claim_cn,
      why: trend.why_established_cn,
      cand: take(trend.supporting_candidate_ids, MAX_CANDIDATE_REFS),
      watch: trend.watch_next_week_cn,
      conf: trend.audit_confidence,
    })),
    observing_trends: take(fallback.observing_trends, MAX_FALLBACK_TRENDS).map((trend) => ({
      id: trend.trend_id,
      name: trend.trend_name_cn,
      why: trend.why_not_established_cn,
      cand: take(trend.supporting_candidate_ids, MAX_CANDIDATE_REFS),
      watch: trend.watch_next_week_cn,
    })),
    audit: {
      acc: take(fallback.audit_findings.accepted_candidate_ids, MAX_FALLBACK_TRENDS),
      rej: take(fallback.audit_findings.rejected_candidate_ids, MAX_FALLBACK_TRENDS),
      mg: take(fallback.audit_findings.merged_groups, 4).map((group) => take(group, 4)),
      sp: take(fallback.audit_findings.split_actions, 4).map((action) => ({
        src: action.source_candidate_id,
        next: take(action.new_trend_names, 4),
      })),
      add: take(fallback.audit_findings.added_trends, 4),
      miss: take(fallback.audit_findings.missed_signal_summary_cn, MAX_AUDIT_TEXTS),
      mis: take(fallback.audit_findings.misjudgment_summary_cn, MAX_AUDIT_TEXTS),
      blind: take(fallback.audit_findings.residual_blindspots_cn, MAX_AUDIT_TEXTS),
    },
  };
}

export function buildWeeklyTrendAgentPrompt(
  candidates: WeeklyTrendCandidateV2[],
  clusters: WeeklyEvidenceCluster[],
  projects: WeeklyEvidenceProject[],
  fallback: WeeklyTrendAgentReview,
): string {
  const compactInput = {
    cands: compactCandidates(candidates),
    cls: compactClusters(clusters),
    projs: compactProjects(projects),
    fb: compactFallbackReview(fallback),
  };

  return [
    "You are the weekly trend review agent.",
    "Review compact rule-side weekly trend candidates.",
    "You may merge, split, rename, reject, or add trends only if every final trend maps back to supplied candidates, projects, and evidence refs.",
    "Return exactly one JSON object and nothing else.",
    "Do not use markdown fences or prose outside the JSON object.",
    "Do not invent projects, evidence, scores, or dates.",
    "Input is aggressively compacted for provider safety; truncated arrays preserve only the highest-signal refs.",
    "",
    "Input legend: cands=candidates, cls=clusters, projs=projects, fb=fallback review.",
    "Candidate keys: cid id, cl cluster ids, hint name hint, hyp hypothesis, p supporting_project_refs, e evidence_refs, ce counter_evidence_refs, u unexplained refs, a anomaly refs, sc [coverage,cohesion,novelty,reliability], rv rule verdict.",
    "Cluster keys: id cluster_id, seed seed labels, cap shared capabilities, pdg shared paradigms, p supporting repos, n distinct repos, days appearance-day count, rep repeated projects, hi high-confidence projects.",
    "Project keys: repo repo_full_name, days top appearance dates, n appearances, ps persistence_state, src sources, topic matched topics, pdg paradigm, cf confidence, sc total_score, flags anti-noise flags, cmp scored components, ev evidence snippets.",
    "Fallback keys: sum summary, established/observing items use id/name/claim-or-why/cand/watch/conf; audit uses acc/rej/mg/sp/add/miss/mis/blind.",
    "",
    'Output JSON keys: "executive_summary_cn", "established_trends"[], "observing_trends"[], "audit_findings"{accepted_candidate_ids,rejected_candidate_ids,merged_groups,split_actions,added_trends,missed_signal_summary_cn,misjudgment_summary_cn,residual_blindspots_cn}.',
    "",
    JSON.stringify(compactInput),
  ].join("\n");
}

function cloneReview(review: WeeklyTrendAgentReview): WeeklyTrendAgentReview {
  return {
    executive_summary_cn: review.executive_summary_cn,
    established_trends: review.established_trends.map((trend) => ({
      ...trend,
      supporting_candidate_ids: [...trend.supporting_candidate_ids],
      supporting_project_refs: [...trend.supporting_project_refs],
      evidence_refs: [...trend.evidence_refs],
      counter_evidence_refs: [...trend.counter_evidence_refs],
    })),
    observing_trends: review.observing_trends.map((trend) => ({
      ...trend,
      supporting_candidate_ids: [...trend.supporting_candidate_ids],
      supporting_project_refs: [...trend.supporting_project_refs],
      evidence_refs: [...trend.evidence_refs],
    })),
    audit_findings: {
      accepted_candidate_ids: [...review.audit_findings.accepted_candidate_ids],
      rejected_candidate_ids: [...review.audit_findings.rejected_candidate_ids],
      merged_groups: review.audit_findings.merged_groups.map((group) => [...group]),
      split_actions: review.audit_findings.split_actions.map((action) => ({
        source_candidate_id: action.source_candidate_id,
        new_trend_names: [...action.new_trend_names],
      })),
      added_trends: [...review.audit_findings.added_trends],
      missed_signal_summary_cn: [...review.audit_findings.missed_signal_summary_cn],
      misjudgment_summary_cn: [...review.audit_findings.misjudgment_summary_cn],
      residual_blindspots_cn: [...review.audit_findings.residual_blindspots_cn],
    },
  };
}

export function applyWeeklyTrendAgentReview(
  fallback: WeeklyTrendAgentReview,
  draft: WeeklyTrendAgentReview,
  context: WeeklyTrendAgentContext,
): { review: WeeklyTrendAgentReview; rejectedOutputs: RejectedOutput[]; enhancementStatus: EnhancementStatus } {
  const validProjectRefs = new Set(context.projects.map((project) => project.repo_full_name));
  const validCandidateIds = new Set(context.candidates.map((candidate) => candidate.candidate_id));
  const rejectedOutputs: RejectedOutput[] = [];
  const hasSupportedProjectsAndCandidates = (input: {
    supporting_project_refs: string[];
    supporting_candidate_ids: string[];
  }): boolean =>
    input.supporting_project_refs.every((ref) => validProjectRefs.has(ref)) &&
    input.supporting_candidate_ids.length > 0 &&
    input.supporting_candidate_ids.every((id) => validCandidateIds.has(id));

  const established = draft.established_trends.filter((trend) => {
    if (!hasSupportedProjectsAndCandidates(trend)) {
      rejectedOutputs.push({
        layer: "weekly_established_trend",
        target_key: trend.trend_id,
        reason_code: "unsupported_added_trend",
        reason_detail: "Established trend could not be mapped back to known weekly evidence.",
      });
      return false;
    }

    return true;
  });
  const observing = draft.observing_trends.filter((trend) => {
    if (!hasSupportedProjectsAndCandidates(trend)) {
      rejectedOutputs.push({
        layer: "weekly_observing_trend",
        target_key: trend.trend_id,
        reason_code: "unsupported_observing_trend",
        reason_detail: "Observing trend could not be mapped back to known weekly evidence.",
      });
      return false;
    }

    return true;
  });

  const review = cloneReview(fallback);
  if (draft.executive_summary_cn.trim()) {
    review.executive_summary_cn = draft.executive_summary_cn.trim();
  }
  if (established.length > 0) {
    review.established_trends = established;
  }
  if (observing.length > 0) {
    review.observing_trends = observing;
  }
  review.audit_findings = {
    ...review.audit_findings,
    ...draft.audit_findings,
  };

  return {
    review,
    rejectedOutputs,
    enhancementStatus: rejectedOutputs.length === 0 ? "agent-full" : "agent-partial",
  };
}
