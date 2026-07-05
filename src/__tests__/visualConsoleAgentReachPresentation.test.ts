import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AgentReachView from "../../app/client/AgentReachView.tsx";
import { buildAgentReachDisplayModel } from "../visualConsole/agentReachViewModel.ts";
import type { AgentReachViewProps } from "../../app/client/AgentReachView.tsx";
import type { ExternalCandidateExplanationArtifact } from "../externalDiscovery/types.ts";
import {
  makeAgentReachCandidateExplanationsArtifact,
  makeFailedAgentReachAggregate,
  makeOkAgentReachAggregate,
} from "./visualConsoleAgentReachFixtures.ts";

function propsFromAggregate(
  aggregate = makeOkAgentReachAggregate(),
  candidateExplanations?: ExternalCandidateExplanationArtifact | null,
): AgentReachViewProps {
  const display = buildAgentReachDisplayModel({
    aggregate,
    candidateExplanations,
    aggregateReadStatus: "ok",
    candidateExplanationsReadStatus: candidateExplanations ? "ok" : "not_found",
  });
  return {
    lang: "zh",
    initialTheme: "light",
    initialSelectedId: display.candidates[0]?.candidate_id ?? null,
    status: display.status,
    summary_cards: display.summary_cards,
    filters: display.filters,
    candidates: display.candidates,
    coverage: display.coverage,
    direction_snapshot: display.direction_snapshot,
    warnings: display.warnings,
    state: {
      status: aggregate.status === "failed" ? "failed" : display.candidates.length > 0 ? "ready" : "empty",
      reasons: [],
    },
    banner: {
      title: "AgentReach",
      context_label: aggregate.date,
      generated_at: aggregate.generated_at,
      enhancement_status: "unknown",
      mode_label: "unknown",
      github_enrichment_status: "external-discovery",
      source_health: display.source_health,
      notes: display.warnings,
    },
  };
}

describe("AgentReach React presentation", () => {
  it("renders Chinese metric labels, external attention wording, and read-only observer note", () => {
    const html = renderToStaticMarkup(React.createElement(AgentReachView, propsFromAggregate()));

    expect(html).toContain("外部发现");
    expect(html).toContain("外部关注度");
    expect(html).toContain("关注度");
    expect(html).toContain("证据");
    expect(html).toContain("来源");
    expect(html).toContain("独立来源");
    expect(html).toContain("谁在讨论");
    expect(html).toContain("它是什么");
    expect(html).toContain("为什么值得看");
    expect(html).toContain("还需要确认什么");
    expect(html).toContain("外部讨论观察");
    expect(html).toContain("平台与数据状态");
    expect(html).toContain("X / Reddit 出现该对象讨论");
    expect(html).toContain("外部关注度 72");
    expect(html).toContain("公开来源");
    expect(html).toContain("@acme");
    expect(html).toContain("r/LocalLLaMA");
    expect(html).toContain("agentreach-action-note");
    expect(html).not.toContain("is-disabled");
    expect(html).toContain("外部信号只作为次级判断");
    expect(html).not.toContain("证据强度");
    expect(html).not.toContain("加入观察");
    expect(html).not.toContain("unknown 1");
  });

  it("localizes AgentReach dynamic view-model labels in English mode", () => {
    const props = propsFromAggregate(makeOkAgentReachAggregate(), makeAgentReachCandidateExplanationsArtifact());
    props.lang = "en";
    const html = renderToStaticMarkup(React.createElement(AgentReachView, props));

    expect(html).toContain("New Candidates");
    expect(html).toContain("New Discovery");
    expect(html).toContain("Attention");
    expect(html).toContain("Needs Primary Confirmation");
    expect(html).toContain("Project · Project level");
    expect(html).toContain("Discussion");
    expect(html).toContain("Community / Watch");
    expect(html).toContain("Reddit OK");
    expect(html).toContain("What It Is");
    expect(html).toContain("Why Watch");
    expect(html).toContain("What Still Needs Confirmation");
    expect(html).toContain("External Discussion Watch");
    expect(html).toContain("Platform &amp; Data Status");
    expect(html).toContain("External attention 72");
    expect(html).toContain("X / Reddit surfaced discussion around this object");
    expect(html).not.toContain("新发现");
    expect(html).not.toContain("方向观察");
    expect(html).not.toContain("官方信号");
    expect(html).not.toContain("待确认");
    expect(html).not.toContain("未识别");
    expect(html).not.toContain("为什么值得看");
    expect(html).not.toContain("还需要确认什么");
    expect(html).not.toContain("AgentFlow 是一个已绑定 GitHub repo 的工作流自动化项目候选");
    expect(html).not.toContain("X 和 Reddit 同时讨论 AgentFlow");
    expect(html).not.toContain("外部信号只能作为次级判断");
    expect(html).not.toContain("仍需主源确认");
    expect(html).not.toContain("当前仍是单日快照");
  });

  it("renders backend candidate explanations on the Chinese page", () => {
    const html = renderToStaticMarkup(
      React.createElement(AgentReachView, propsFromAggregate(makeOkAgentReachAggregate(), makeAgentReachCandidateExplanationsArtifact())),
    );

    expect(html).toContain("AgentFlow 是一个已绑定 GitHub repo 的工作流自动化项目候选。");
    expect(html).toContain("X 和 Reddit 同时讨论 AgentFlow，适合作为外部层新发现继续观察。");
    expect(html).toContain("仍需 GitHub 主链路确认活跃度。");
    expect(html).not.toContain("证据强度");
    expect(html).not.toContain("高置信推荐");
  });

  it("does not render failed provider as an empty no-signal state", () => {
    const html = renderToStaticMarkup(React.createElement(AgentReachView, propsFromAggregate(makeFailedAgentReachAggregate())));

    expect(html).toContain("外部层执行失败");
    expect(html).toContain("provider failed before aggregation");
    expect(html).not.toContain("今天暂无可展示的外部候选</h3>");
  });
});
