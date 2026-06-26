import { conferenceSourceCatalog } from "./conferenceSourceCatalog.ts";
import { paperSourceCatalog } from "./paperSourceCatalog.ts";
import type { AxisToolCoverageReport, IndustryEvidenceAxisKey, IndustrySignalEvent } from "./types.ts";

function toolIdsForAxis(axis: IndustryEvidenceAxisKey): string[] {
  const catalog = axis === "research_paper" ? Object.values(paperSourceCatalog) : Object.values(conferenceSourceCatalog);
  return [...new Set(catalog.flatMap((item) => [...item.tool_ids]))];
}

export function buildCoverageReport(
  axis: IndustryEvidenceAxisKey,
  events: IndustrySignalEvent[],
): AxisToolCoverageReport {
  const axisEvents = events.filter((event) => event.axis === axis);
  const accepted = axisEvents.filter((event) => event.audit.bucket === "accepted");
  const rejected = axisEvents.filter((event) => event.audit.bucket === "rejected");
  const allToolIds = toolIdsForAxis(axis);
  const citationTraceRate = axisEvents.length === 0 ? 0 : accepted.length / axisEvents.length;

  return {
    axis,
    primary_tool_ids: allToolIds.slice(0, 2),
    secondary_toolset_ids: allToolIds.slice(2),
    fallback_tool_ids: [],
    last_resort_tool_ids: [],
    eligible_tool_ids: allToolIds,
    selected_from_tool_ids: allToolIds,
    attempted_tool_ids: allToolIds,
    selection_scorecard_version: "academic-agent.local.v0",
    selection_score_total: 100,
    selection_score_breakdown: { authority: 40, traceability: 35, freshness: 25 },
    veto_reason_codes: [],
    selection_reason_codes: ["official_academic_source_only"],
    active_route_level: "primary",
    active_tool_ids: allToolIds.slice(0, 2),
    active_source_class: "official_academic",
    route_status: rejected.length > 0 ? "degraded" : "ok",
    budget_status: "within_budget",
    degraded: rejected.length > 0,
    degradation_reason_codes: rejected.length > 0 ? ["partial_rejection_present"] : [],
    candidate_ref_count: axisEvents.length,
    accepted_ref_count: accepted.length,
    citation_trace_rate: Number(citationTraceRate.toFixed(2)),
    evidence_event_ids: accepted.map((event) => event.event_id),
    rejected_event_ids: rejected.map((event) => event.event_id),
    registry_snapshot_ref: "stub://industry/registry-snapshot/current",
    tool_registry_snapshot_ref: "stub://industry/tool-registry/current",
    summary_cn: axis === "research_paper" ? "论文轴已绑定一手学术源。" : "会议轴已绑定官方 accepted/proceedings/challenge 源。",
  };
}
