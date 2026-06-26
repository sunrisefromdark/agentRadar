import type {
  IndustryEvidenceAxisKey,
  LocalIndustryAgentContribution,
  IndustrySignalEvent,
  IndustryResponsibilityId,
} from "./types.ts";
import { academicAgentId, executionContextFor, responsibilityForAxis } from "./types.ts";

export function buildContribution(
  axis: IndustryEvidenceAxisKey,
  events: IndustrySignalEvent[],
  inputArtifactRefs: string[],
  outputArtifactRef: string,
  toolRouteIds: string[],
): LocalIndustryAgentContribution {
  const axisEvents = events.filter((event) => event.axis === axis);
  const accepted = axisEvents.filter((event) => event.audit.bucket === "accepted").length;
  const rejected = axisEvents.filter((event) => event.audit.bucket === "rejected").length;
  const counter = axisEvents.filter((event) => event.audit.bucket === "counter").length;
  const diagnostic = axisEvents.filter((event) => event.audit.bucket === "diagnostic").length;
  const responsibility: IndustryResponsibilityId = responsibilityForAxis(axis);

  return {
    responsibility_id: responsibility,
    handled_by_agent_id: academicAgentId,
    execution_context: executionContextFor(axis),
    status: diagnostic > 0 || rejected > 0 ? "partial" : "ok",
    covered_axes: [axis],
    event_count: accepted + rejected + counter,
    accepted_event_count: accepted,
    assisted_event_count: 0,
    rejected_event_count: rejected,
    counter_event_count: counter,
    diagnostic_event_count: diagnostic,
    metric_input_gap_count: diagnostic,
    unscorable_event_count: rejected,
    profile_blocked_event_count: 0,
    input_artifact_refs: inputArtifactRefs,
    output_artifact_refs: [outputArtifactRef],
    tool_route_ids: toolRouteIds,
    status_reason:
      diagnostic > 0 || rejected > 0 ? "存在需中台接线前保留的 diagnostic/rejected 样本。" : undefined,
    contribution_summary_cn:
      axis === "research_paper"
        ? "已产出 research_paper 事件、coverage 与 replay 入口。"
        : "已产出 conference_academic 事件、coverage 与 replay 入口。",
    upstream_payload_schema: "industry-agent-contribution.v1",
  };
}
