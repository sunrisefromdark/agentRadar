import type { ScoredProject, WeeklyEvidenceMatrix, WeeklyJudgmentReport, WeeklyReport } from "../types.ts";
import { renderCoreTrendCard, renderWeakSignalCard } from "./weeklyEnhancement.ts";

function countByParadigm(items: ScoredProject[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.score.paradigm, (counts.get(item.score.paradigm) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function countByFlag(items: ScoredProject[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const flag of item.score.anti_noise_flags) {
      counts.set(flag, (counts.get(flag) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function renderLegacyWeeklyReport(items: ScoredProject[], opts: { date: string; generatedAt: string }): string {
  const top = items.slice(0, 25);
  const paradigms = countByParadigm(top);
  const antiNoise = countByFlag(top);
  const strongest = paradigms[0]?.[0] ?? "insufficient signal";
  const emerging = paradigms.find(([paradigm]) => paradigm !== strongest)?.[0] ?? "no clear second paradigm";

  return [
    `# Agent Trend Radar 周报 ${opts.date}`,
    "",
    `> 生成时间 ${opts.generatedAt}`,
    "",
    "## 哪些方向一起爆发？",
    "",
    ...paradigms.slice(0, 8).map(([paradigm, count]) => `- ${paradigm}: ${count} 个项目`),
    "",
    "## 哪个方向在被持续强化？",
    "",
    `当前被强化最明显的方向是：${strongest}。`,
    "",
    "## 是否有新范式开始冒头？",
    "",
    `候选新范式：${emerging}。建议下周继续看它是否能同时在 agents-radar 和 Trendshift 中持续出现。`,
    "",
    "## 降噪模式摘要",
    "",
    ...(antiNoise.length > 0
      ? antiNoise.slice(0, 8).map(([flag, count]) => `- ${flag}: ${count} 个项目`)
      : ["- 当前 Top 样本里没有明显的降噪告警"]),
    "",
    "## Top 项目",
    "",
    ...top.map((item) => {
      const flags = item.score.anti_noise_flags.length > 0 ? item.score.anti_noise_flags.join(",") : "无";
      return `- [${item.project.project_name}](${item.project.repo_url}) score=${item.score.total_score} confidence=${item.score.confidence} paradigm="${item.score.paradigm}" anti_noise="${flags}"`;
    }),
    "",
  ].join("\n");
}

function renderWeeklyEvidenceMatrix(matrix?: WeeklyEvidenceMatrix): string[] {
  if (!matrix) {
    return [
      "- focused_trend_key: none",
      "- focused_trend_name_cn: none",
      "- summary_cn: 当前 weekly 产物尚未提供结构化 evidence matrix。",
    ];
  }

  return [
    `- focused_trend_key: ${matrix.focused_trend_key ?? "none"}`,
    `- focused_trend_name_cn: ${matrix.focused_trend_name_cn ?? "none"}`,
    `- summary_cn: ${matrix.summary_cn}`,
    ...matrix.axes.flatMap((axis) => [
      `- axis: ${axis.axis}`,
      `  - score: ${axis.score}`,
      `  - project_count: ${axis.project_count}`,
      `  - high_signal_project_count: ${axis.high_signal_project_count}`,
      `  - evidence_count: ${axis.evidence_count}`,
      `  - sample_projects: ${axis.sample_projects.map((project) => project.repo_full_name).join(", ") || "none"}`,
      `  - top_evidence: ${axis.top_evidence.join(" || ") || "none"}`,
      `  - summary_cn: ${axis.summary_cn}`,
    ]),
  ];
}

function renderAuditConclusion(judgment?: WeeklyJudgmentReport): string[] {
  if (!judgment) {
    return [
      "- accepted_candidate_ids: none",
      "- rejected_candidate_ids: none",
      "- missed_signal_summary_cn: none",
      "- misjudgment_summary_cn: none",
      "- residual_blindspots_cn: none",
    ];
  }

  return [
    `- accepted_candidate_ids: ${judgment.audit_conclusion.accepted_candidate_ids.join(", ") || "none"}`,
    `- rejected_candidate_ids: ${judgment.audit_conclusion.rejected_candidate_ids.join(", ") || "none"}`,
    `- missed_signal_summary_cn: ${judgment.audit_conclusion.missed_signal_summary_cn.join("；") || "none"}`,
    `- misjudgment_summary_cn: ${judgment.audit_conclusion.misjudgment_summary_cn.join("；") || "none"}`,
    `- residual_blindspots_cn: ${judgment.audit_conclusion.residual_blindspots_cn.join("；") || "none"}`,
  ];
}

function renderEnhancedWeeklyReport(report: WeeklyReport, judgment?: WeeklyJudgmentReport): string {
  const personalizedSection = report.personalized_weekly_focus_applicable
    ? [
        "## 与你更相关的趋势 / 项目",
        "",
        ...(report.personalized_weekly_focus.length > 0
          ? report.personalized_weekly_focus.flatMap((item) => [
              `- ${item.trend_key}`,
              `  - matched_interest_topics: ${item.matched_interest_topics.join(", ")}`,
              `  - personalization_reason_cn: ${item.personalization_reason_cn}`,
              `  - supporting_project_refs: ${item.supporting_project_refs.map((project) => project.repo_full_name).join(", ")}`,
              "",
            ])
          : [`- ${report.personalized_weekly_focus_note_cn ?? "本周没有明显更贴近你当前关注方向的趋势。"}`, ""]),
      ]
    : [];

  return [
    `# Agent Trend Radar 周报 ${report.date}`,
    "",
    `> generated_at: ${report.generated_at}`,
    `> window: ${report.window_start} -> ${report.window_end}`,
    "",
    "## 本周总结",
    "",
    `- ${report.overall_summary_cn}`,
    `- enhancement_status: ${report.enhancement_status}`,
    `- supporting_trend_keys: ${report.supporting_trend_keys.length > 0 ? report.supporting_trend_keys.join(", ") : "none"}`,
    "",
    "## 结构化证据矩阵",
    "",
    ...renderWeeklyEvidenceMatrix(report.evidence_matrix),
    "",
    "## 已成立趋势",
    "",
    ...(report.core_trend_cards.length > 0
      ? report.core_trend_cards.flatMap((card) => [...renderCoreTrendCard(card), ""])
      : ["- 本周还没有形成稳定趋势。", ""]),
    ...personalizedSection,
    "## 待观察趋势",
    "",
    ...(report.weak_signal_cards.length > 0
      ? report.weak_signal_cards.flatMap((card) => [...renderWeakSignalCard(card), ""])
      : ["- 当前没有额外待观察趋势。", ""]),
    "## Agent审计结论",
    "",
    `- executive_summary_cn: ${judgment?.executive_summary_cn ?? report.overall_summary_cn}`,
    `- enhancement_status: ${judgment?.enhancement_status ?? report.enhancement_status}`,
    ...renderAuditConclusion(judgment),
    `- rejected_outputs: ${(judgment?.enhancement_audit.rejected_outputs ?? report.enhancement_audit.rejected_outputs).length}`,
    "",
  ].join("\n");
}

export function renderWeeklyReport(
  input: WeeklyReport | ScoredProject[],
  opts?: { date?: string; generatedAt?: string; judgment?: WeeklyJudgmentReport },
): string {
  if (Array.isArray(input)) {
    return renderLegacyWeeklyReport(input, { date: opts?.date ?? "", generatedAt: opts?.generatedAt ?? "" });
  }
  return renderEnhancedWeeklyReport(input, opts?.judgment);
}
