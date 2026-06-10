import type {
  ParsedWeakSignalCard,
  ParsedWeeklyCoreTrendCard,
  ParsedWeeklyEvidenceAxis,
  ParsedWeeklyEvidenceMatrix,
  ParsedWeeklyReport,
  ParsedWeeklySupportProject,
} from "./types.ts";
import type { ScoreComponentName } from "../types.ts";

const WEEKLY_AXIS_KEYS = new Set<ScoreComponentName>([
  "star_velocity",
  "engagement_score",
  "architecture_shift",
  "compounding_capability",
  "autonomy_score",
  "discussion_score",
]);

function sectionLines(markdown: string, title: string | string[]): string[] {
  const titles = Array.isArray(title) ? title : [title];
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => titles.includes(line.trim()));
  if (start < 0) return [];
  const result: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (/^##\s+/.test(line) && !titles.includes(line.trim())) break;
    result.push(line);
  }
  return result;
}

function parseHeaderValue(
  markdown: string,
  key: "generated_at" | "window" | "enhancement_status" | "supporting_trend_keys",
): string | null {
  const regex = new RegExp(`^>\\s*${key}:\\s*(.+)$`, "m");
  const match = markdown.match(regex);
  return match?.[1]?.trim() ?? null;
}

function parseOverviewLines(markdown: string) {
  return sectionLines(markdown, "## 本周总结")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseSupportProject(lines: string[], start: number): { project: ParsedWeeklySupportProject; end: number } {
  const header = lines[start] ?? "";
  const match = header.match(/^\s*-\s*\[(.+?)\]\((.+?)\)\s*$/);
  const project: ParsedWeeklySupportProject = {
    project_name: match?.[1] ?? "",
    repo_url: match?.[2] ?? "",
    project_brief_cn: null,
    why_this_week_cn: null,
    enhancement_source: null,
    personalization_reason_cn: null,
    risk_review_required: false,
    risk_review_note_cn: null,
    risk_review_source: null,
    watchlist_note_cn: null,
  };

  let end = start;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (/^\s{2}-\s*\[/.test(line) || /^\s*-\s*(趋势:|[^[]+?\[.+\])/.test(line) || /^##\s+/.test(line)) {
      break;
    }
    end = index;
    const body = line.trim();
    if (body.startsWith("- 这个项目是做什么的:")) project.project_brief_cn = body.replace(/^- 这个项目是做什么的:\s*/, "");
    if (body.startsWith("- 为什么这周值得记住:")) project.why_this_week_cn = body.replace(/^- 为什么这周值得记住:\s*/, "");
    if (body.startsWith("- enhancement_source:")) {
      const value = body.replace(/^- enhancement_source:\s*/, "");
      project.enhancement_source = value === "agent" || value === "template_fallback" ? value : null;
    }
    if (body.startsWith("- personalization_reason_cn:")) {
      project.personalization_reason_cn = body.replace(/^- personalization_reason_cn:\s*/, "");
    }
    if (body.startsWith("- risk_review_required:")) {
      project.risk_review_required = /true/i.test(body);
    }
    if (body.startsWith("- risk_review_note_cn:")) {
      project.risk_review_note_cn = body.replace(/^- risk_review_note_cn:\s*/, "");
    }
    if (body.startsWith("- risk_review_source:")) {
      const value = body.replace(/^- risk_review_source:\s*/, "");
      project.risk_review_source = value === "agent" || value === "template_fallback" ? value : null;
    }
    if (body.startsWith("- watchlist_note_cn:")) {
      project.watchlist_note_cn = body.replace(/^- watchlist_note_cn:\s*/, "");
    }
  }

  return { project, end };
}

function parseCoreTrendCards(markdown: string): ParsedWeeklyCoreTrendCard[] {
  const lines = sectionLines(markdown, ["## 已成立趋势", "## 核心趋势卡片"]);
  const cards: ParsedWeeklyCoreTrendCard[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? "";
    const match = line.match(/^- 趋势:\s*(.+?)\s+\[(.+?)\]$/);
    if (!match) continue;

    const card: ParsedWeeklyCoreTrendCard = {
      trend_name_cn: match[1] ?? "",
      trend_key: match[2] ?? "",
      trend_summary_cn: null,
      evidence_summary_cn: null,
      strength: null,
      worth_following_next_week: null,
      evidence_matrix: null,
      supporting_projects: [],
    };

    for (index += 1; index < lines.length; index += 1) {
      const body = lines[index] ?? "";
      const trimmed = body.trim();
      if (/^- 趋势:\s*/.test(trimmed)) {
        index -= 1;
        break;
      }
      if (/^\s{2}-\s*\[/.test(body)) {
        const parsed = parseSupportProject(lines, index);
        card.supporting_projects.push(parsed.project);
        index = parsed.end;
        continue;
      }
      if (trimmed.startsWith("- 总结:")) card.trend_summary_cn = trimmed.replace(/^- 总结:\s*/, "");
      if (trimmed.startsWith("- 证据:")) card.evidence_summary_cn = trimmed.replace(/^- 证据:\s*/, "");
      if (trimmed.startsWith("- 强度:")) {
        const strength = trimmed.replace(/^- 强度:\s*/, "");
        card.strength = strength === "strong" || strength === "medium" ? strength : null;
      }
      if (trimmed.startsWith("- 下周是否继续跟进:")) {
        card.worth_following_next_week = trimmed.replace(/^- 下周是否继续跟进:\s*/, "");
      }
    }

    cards.push(card);
  }

  return cards;
}

function parseWeakSignalCards(markdown: string): ParsedWeakSignalCard[] {
  const lines = sectionLines(markdown, ["## 待观察趋势", "## 弱信号"]);
  const cards: ParsedWeakSignalCard[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? "";
    const match = line.match(/^- (.+?)\s+\[(.+?)\]$/);
    if (!match || match[1] === "当前没有需要单独跟进的弱信号卡片。" || match[1] === "当前没有额外待观察趋势。") continue;
    const card: ParsedWeakSignalCard = {
      signal_name_cn: match[1] ?? "",
      trend_key: match[2] ?? "",
      why_weak_cn: null,
      evidence_summary_cn: null,
      worth_following_next_week: null,
    };

    for (index += 1; index < lines.length; index += 1) {
      const body = lines[index]?.trim() ?? "";
      if (/^- .+\[.+\]$/.test(body)) {
        index -= 1;
        break;
      }
      if (body.startsWith("- 为什么它还是弱信号:")) card.why_weak_cn = body.replace(/^- 为什么它还是弱信号:\s*/, "");
      if (body.startsWith("- 证据:")) card.evidence_summary_cn = body.replace(/^- 证据:\s*/, "");
      if (body.startsWith("- 下周是否继续跟进:")) {
        card.worth_following_next_week = body.replace(/^- 下周是否继续跟进:\s*/, "");
      }
    }

    cards.push(card);
  }

  return cards;
}

function parseInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseFloatValue(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "none" ? null : trimmed;
}

function createParsedWeeklyEvidenceAxis(axis: ScoreComponentName): ParsedWeeklyEvidenceAxis {
  return {
    axis,
    score: null,
    project_count: 0,
    high_signal_project_count: 0,
    evidence_count: 0,
    sample_projects: [],
    top_evidence: [],
    summary_cn: null,
  };
}

function parseWeeklyAxisHeader(trimmed: string): ScoreComponentName | null {
  if (!trimmed.startsWith("- axis:")) return null;
  return trimmed.replace(/^- axis:\s*/, "") as ScoreComponentName;
}

function applyWeeklyMatrixHeader(matrix: ParsedWeeklyEvidenceMatrix, trimmed: string): boolean {
  if (trimmed.startsWith("- focused_trend_key:")) {
    matrix.focused_trend_key = parseOptionalText(trimmed.replace(/^- focused_trend_key:\s*/, ""));
    return true;
  }
  if (trimmed.startsWith("- focused_trend_name_cn:")) {
    matrix.focused_trend_name_cn = parseOptionalText(trimmed.replace(/^- focused_trend_name_cn:\s*/, ""));
    return true;
  }
  return false;
}

const WEEKLY_AXIS_LINE_HANDLERS: Array<{
  prefix: string;
  apply: (axis: ParsedWeeklyEvidenceAxis, value: string) => void;
}> = [
  {
    prefix: "- score:",
    apply: (axis, value) => {
      axis.score = parseFloatValue(value);
    },
  },
  {
    prefix: "- project_count:",
    apply: (axis, value) => {
      axis.project_count = parseInteger(value);
    },
  },
  {
    prefix: "- high_signal_project_count:",
    apply: (axis, value) => {
      axis.high_signal_project_count = parseInteger(value);
    },
  },
  {
    prefix: "- evidence_count:",
    apply: (axis, value) => {
      axis.evidence_count = parseInteger(value);
    },
  },
  {
    prefix: "- sample_projects:",
    apply: (axis, value) => {
      axis.sample_projects = value === "none" ? [] : value.split(",").map((item) => item.trim()).filter(Boolean);
    },
  },
  {
    prefix: "- top_evidence:",
    apply: (axis, value) => {
      axis.top_evidence = value === "none" ? [] : value.split("||").map((item) => item.trim()).filter(Boolean);
    },
  },
  {
    prefix: "- summary_cn:",
    apply: (axis, value) => {
      axis.summary_cn = value;
    },
  },
];

function applyWeeklyAxisLine(axis: ParsedWeeklyEvidenceAxis, trimmed: string): void {
  for (const handler of WEEKLY_AXIS_LINE_HANDLERS) {
    if (!trimmed.startsWith(handler.prefix)) continue;
    handler.apply(axis, trimmed.slice(handler.prefix.length).trim());
    return;
  }
}

function parseWeeklyEvidenceMatrix(markdown: string): ParsedWeeklyEvidenceMatrix | null {
  const lines = sectionLines(markdown, "## 结构化证据矩阵");
  if (lines.length === 0) return null;

  const matrix: ParsedWeeklyEvidenceMatrix = {
    focused_trend_key: null,
    focused_trend_name_cn: null,
    summary_cn: null,
    axes: [],
  };
  let currentAxis: ParsedWeeklyEvidenceAxis | null = null;

  const pushAxis = () => {
    if (currentAxis) matrix.axes.push(currentAxis);
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (applyWeeklyMatrixHeader(matrix, trimmed)) {
      continue;
    }

    const axisKey = parseWeeklyAxisHeader(trimmed);
    if (axisKey) {
      pushAxis();
      currentAxis = createParsedWeeklyEvidenceAxis(axisKey);
      continue;
    }

    if (currentAxis) {
      applyWeeklyAxisLine(currentAxis, trimmed);
      continue;
    }

    if (trimmed.startsWith("- summary_cn:")) {
      matrix.summary_cn = trimmed.replace(/^- summary_cn:\s*/, "");
    }
  }

  pushAxis();
  matrix.axes = matrix.axes.filter((axis) => WEEKLY_AXIS_KEYS.has(axis.axis));
  return matrix;
}

export function parseWeeklyMarkdown(markdown: string): ParsedWeeklyReport {
  const overview = parseOverviewLines(markdown);
  const overallSummary = overview.find((line) => line.startsWith("- ") && !line.startsWith("- enhancement_status:"))?.replace(/^- /, "") ?? null;
  const enhancementStatus = overview
    .find((line) => line.startsWith("- enhancement_status:"))
    ?.replace(/^- enhancement_status:\s*/, "") as ParsedWeeklyReport["enhancement_status"];
  const supportingTrendKeysRaw = overview
    .find((line) => line.startsWith("- supporting_trend_keys:"))
    ?.replace(/^- supporting_trend_keys:\s*/, "");
  const windowRaw = parseHeaderValue(markdown, "window");
  const [windowStart, windowEnd] = windowRaw?.split("->").map((item) => item.trim()) ?? [null, null];

  return {
    generated_at: parseHeaderValue(markdown, "generated_at"),
    window_start: windowStart,
    window_end: windowEnd,
    overall_summary_cn: overallSummary,
    enhancement_status:
      enhancementStatus === "rules-only" || enhancementStatus === "agent-partial" || enhancementStatus === "agent-full"
        ? enhancementStatus
        : null,
    supporting_trend_keys:
      supportingTrendKeysRaw && supportingTrendKeysRaw !== "none"
        ? supportingTrendKeysRaw.split(",").map((item) => item.trim()).filter(Boolean)
        : [],
    evidence_matrix: parseWeeklyEvidenceMatrix(markdown),
    core_trend_cards: parseCoreTrendCards(markdown),
    weak_signal_cards: parseWeakSignalCards(markdown),
  };
}
