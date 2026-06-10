import type { ScoredProject, UserInterestTopicName } from "../types.ts";
import { readCachedGitHubRepoMetrics } from "../signal/githubMetrics.ts";

type ProjectBriefInput = {
  project_name: string;
  repo_full_name: string;
  description: string;
  tags: string[];
  paradigm: string;
  evidence?: string[];
  source_descriptions?: string[];
  source_tags?: string[];
};

type BriefFamilyId =
  | "multi-agent-runtime"
  | "trading-research-agent"
  | "terminal-agent-shell"
  | "coding-agent"
  | "developer-resource"
  | "rag-knowledge"
  | "mcp-tooling"
  | "infra-platform"
  | "evaluation";

type BriefFamily = {
  id: BriefFamilyId;
  repoKeywords?: string[];
  tagKeywords?: string[];
  evidenceKeywords?: string[];
  descriptionKeywords?: string[];
  paradigmKeywords?: string[];
  requiresAny?: string[];
  anchorTerms: string[];
};

type EvidencePhraseRule = {
  keywords: string[];
  phrase: string;
  anchors: string[];
};

type BriefContext = {
  tags: string[];
  repoText: string;
  descriptionText: string;
  evidenceText: string;
  paradigmText: string;
  searchable: string;
};

type MatchedPhrase = EvidencePhraseRule & {
  score: number;
};

type BriefFacet = MatchedPhrase & {
  source: "family" | "generic";
};

type UsageScenarioRule = {
  keywords: string[];
  phrase: string;
  families?: BriefFamilyId[];
};

type ProjectFacetProfile = {
  family: BriefFamily | null;
  identityLabel: string;
  purposeFacets: BriefFacet[];
  primaryPurpose: string;
  secondaryPurpose?: string;
  usageScenario?: string;
  missingFields: string[];
  weakSignal: boolean;
  expectedAnchors: string[];
};

type RepoSemanticRule = {
  keywords: string[];
  familyId?: BriefFamilyId;
  identityLabel: string;
  primaryPurpose: string;
  usageScenario: string;
  anchors: string[];
};

const BRIEF_FAMILIES: BriefFamily[] = [
  {
    id: "trading-research-agent",
    repoKeywords: ["tradingagents", "trading agents", "trader", "quant", "portfolio"],
    tagKeywords: ["trading", "finance", "financial", "quant", "portfolio", "research"],
    evidenceKeywords: ["market", "trading", "alpha", "quant", "portfolio", "backtest", "strategy"],
    descriptionKeywords: ["financial", "finance", "trading", "market", "portfolio", "quant", "backtest", "research"],
    paradigmKeywords: ["trading", "finance", "research"],
    requiresAny: ["trading", "finance", "financial", "market", "portfolio", "quant", "alpha", "backtest"],
    anchorTerms: ["金融", "交易", "策略", "行情", "研究", "trading", "finance", "market", "quant"],
  },
  {
    id: "terminal-agent-shell",
    repoKeywords: ["openclaw", "shell", "terminal", "desktop"],
    tagKeywords: ["terminal", "cli", "shell", "computer-use", "desktop", "self-hosted", "personal"],
    evidenceKeywords: ["terminal", "command line", "cli", "shell", "computer use", "desktop automation", "own your data"],
    descriptionKeywords: ["terminal", "command line", "cli", "shell", "desktop automation", "local workflow", "self-hosted"],
    paradigmKeywords: ["shell", "terminal"],
    requiresAny: ["terminal", "command line", "cli", "shell", "computer use", "desktop automation", "self-hosted"],
    anchorTerms: ["终端", "命令行", "shell", "自托管", "本地", "助手", "tool use"],
  },
  {
    id: "coding-agent",
    repoKeywords: ["codex", "claude code", "aider", "cursor", "opencode", "code", "repo"],
    tagKeywords: ["coding-agent", "code-agent", "developer-tool", "devtool", "code-review"],
    evidenceKeywords: ["coding agent", "code agent", "software engineering", "code review", "pull request", "repo coding"],
    descriptionKeywords: ["codebase", "repository", "developer", "patch", "tests", "software engineering", "code review"],
    paradigmKeywords: ["coding", "developer"],
    requiresAny: ["coding agent", "code agent", "software engineering", "code review", "repository", "codebase", "developer", "patch", "codex"],
    anchorTerms: ["编程", "代码", "仓库", "测试", "开发", "coding agent", "code review", "补丁"],
  },
  {
    id: "developer-resource",
    repoKeywords: ["awesome", "templates", "starter", "skills", "playbook"],
    tagKeywords: ["template", "templates", "starter", "boilerplate", "skills", "awesome-list"],
    evidenceKeywords: ["skills", "playbook", "awesome", "templates", "boilerplate", "starter"],
    descriptionKeywords: ["skills", "playbook", "templates", "starter", "examples", "recipes"],
    paradigmKeywords: ["template", "starter"],
    requiresAny: ["skills", "playbook", "awesome", "templates", "boilerplate", "starter"],
    anchorTerms: ["技能", "模板", "脚手架", "资源", "资源包", "starter", "template", "skills"],
  },
  {
    id: "rag-knowledge",
    repoKeywords: ["rag", "knowledge", "retrieval", "search", "graph rag"],
    tagKeywords: ["memory", "rag", "retrieval", "knowledge-base", "search", "graph-rag"],
    evidenceKeywords: ["rag", "retrieval", "knowledge base", "semantic search", "vector", "embedding", "graph rag"],
    descriptionKeywords: ["memory", "context", "docs", "knowledge", "retrieval", "vector", "embedding"],
    paradigmKeywords: ["memory", "retrieval", "knowledge"],
    requiresAny: ["rag", "retrieval", "knowledge", "vector", "embedding", "memory", "context", "search"],
    anchorTerms: ["RAG", "检索", "知识", "向量", "记忆", "retrieval", "vector", "search"],
  },
  {
    id: "mcp-tooling",
    repoKeywords: ["mcp", "connector", "tool"],
    tagKeywords: ["mcp", "tool-use", "tooling", "connector"],
    evidenceKeywords: ["mcp", "model context protocol", "tool calling", "tool use", "tool-use", "connector"],
    descriptionKeywords: ["mcp", "tools", "integrations", "bridge", "tool calling"],
    paradigmKeywords: ["mcp", "tool"],
    requiresAny: ["mcp", "model context protocol", "tool calling", "tool use", "tool-use", "connector"],
    anchorTerms: ["MCP", "工具", "连接器", "tool", "connector", "protocol"],
  },
  {
    id: "evaluation",
    repoKeywords: ["eval", "benchmark", "judge"],
    tagKeywords: ["evaluation", "eval", "benchmark", "judge"],
    evidenceKeywords: ["evaluation", "benchmark", "regression", "judge", "grading"],
    descriptionKeywords: ["eval", "quality", "review", "regression", "benchmark"],
    paradigmKeywords: ["evaluation", "eval", "judge"],
    requiresAny: ["evaluation", "benchmark", "regression", "judge", "grading", "eval"],
    anchorTerms: ["评测", "基准", "回归", "质量", "benchmark", "evaluation", "judge"],
  },
  {
    id: "multi-agent-runtime",
    repoKeywords: ["ruflo", "swarm", "orchestrator", "workflow"],
    tagKeywords: ["agent-runtime", "multi-agent", "workflow", "orchestration"],
    evidenceKeywords: ["multi-agent", "multi agent", "workflow orchestration", "agent orchestration", "agent runtime", "swarm"],
    descriptionKeywords: ["workflow", "runtime", "orchestration", "agents", "sandbox", "coordination"],
    paradigmKeywords: ["agent-runtime", "workflow", "orchestration"],
    requiresAny: ["multi-agent", "multi agent", "workflow", "orchestration", "runtime", "agent runtime", "swarm"],
    anchorTerms: ["多代理", "编排", "工作流", "运行时", "swarm", "runtime", "orchestration"],
  },
  {
    id: "infra-platform",
    repoKeywords: ["sdk", "gateway", "router", "framework", "platform"],
    tagKeywords: ["infra", "platform", "framework", "sdk", "gateway", "router"],
    evidenceKeywords: ["infrastructure", "platform", "framework", "sdk", "gateway", "router", "serving", "deployment"],
    descriptionKeywords: ["infra", "runtime platform", "service layer", "deployment", "provider", "adapter"],
    paradigmKeywords: ["infra", "platform", "framework", "sdk"],
    requiresAny: ["infrastructure", "platform", "framework", "sdk", "gateway", "router", "serving", "deployment", "infra"],
    anchorTerms: ["基础设施", "平台", "框架", "SDK", "路由", "gateway", "deployment"],
  },
];

const FAMILY_EVIDENCE_RULES: Record<BriefFamilyId, EvidencePhraseRule[]> = {
  "multi-agent-runtime": [
    {
      keywords: ["workflow", "workflows", "orchestration", "orchestrator"],
      phrase: "把任务步骤编排成可重复执行的工作流",
      anchors: ["工作流", "编排", "workflow", "orchestration"],
    },
    {
      keywords: ["swarm", "swarms", "swarm intelligence", "distributed"],
      phrase: "协调多个代理以 swarm 方式协作",
      anchors: ["swarm", "协作", "多代理"],
    },
    {
      keywords: ["claude code", "codex", "subagents", "agent harness"],
      phrase: "把 Claude Code / Codex 这类 agent 接进同一条执行链路",
      anchors: ["claude code", "codex", "执行链路", "subagent"],
    },
    {
      keywords: ["tool", "tool use", "tool-use", "plugins", "connector"],
      phrase: "串联工具调用与扩展能力",
      anchors: ["工具", "tool", "connector", "调用"],
    },
    {
      keywords: ["rag", "retrieval", "memory", "context"],
      phrase: "把检索或记忆能力接进代理执行流程",
      anchors: ["检索", "记忆", "rag", "retrieval"],
    },
  ],
  "trading-research-agent": [
    {
      keywords: ["market", "markets", "research", "行情"],
      phrase: "围绕市场信息组织研究流程",
      anchors: ["市场", "行情", "research", "market"],
    },
    {
      keywords: ["strategy", "alpha", "signal"],
      phrase: "把策略研究和信号判断串起来",
      anchors: ["策略", "信号", "alpha", "strategy"],
    },
    {
      keywords: ["portfolio", "allocation", "position"],
      phrase: "服务组合配置和仓位决策",
      anchors: ["组合", "仓位", "portfolio", "allocation"],
    },
    {
      keywords: ["backtest", "simulation"],
      phrase: "把回测验证接进研究闭环",
      anchors: ["回测", "backtest", "simulation"],
    },
  ],
  "terminal-agent-shell": [
    {
      keywords: ["terminal", "command line", "cli", "shell"],
      phrase: "在命令行里读写文件并执行命令",
      anchors: ["终端", "命令行", "cli", "shell"],
    },
    {
      keywords: ["tool use", "tool-use", "tools", "plugins", "connector"],
      phrase: "支持工具调用和本地工作流自动化",
      anchors: ["工具", "tool", "自动化", "本地"],
    },
    {
      keywords: ["self-hosted", "own your data", "own-your-data", "personal"],
      phrase: "强调自托管和用户自己掌控数据边界",
      anchors: ["自托管", "数据边界", "own your data"],
    },
    {
      keywords: ["desktop automation", "computer use", "desktop"],
      phrase: "接管桌面级操作与本地执行流程",
      anchors: ["桌面", "computer use", "本地执行"],
    },
  ],
  "coding-agent": [
    {
      keywords: ["repository", "repo", "codebase"],
      phrase: "理解仓库结构和现有代码上下文",
      anchors: ["仓库", "代码库", "repository", "codebase"],
    },
    {
      keywords: ["tests", "test", "regression"],
      phrase: "修改代码后顺手跑测试验证",
      anchors: ["测试", "回归", "test", "regression"],
    },
    {
      keywords: ["pull request", "code review", "review"],
      phrase: "协助做代码审查和变更收敛",
      anchors: ["代码审查", "review", "pull request"],
    },
    {
      keywords: ["patch", "diff", "edit"],
      phrase: "直接产出补丁和工程修改",
      anchors: ["补丁", "diff", "修改"],
    },
  ],
  "developer-resource": [
    {
      keywords: ["skills", "playbook"],
      phrase: "整理现成技能和工作流打法",
      anchors: ["技能", "playbook", "工作流"],
    },
    {
      keywords: ["templates", "template", "starter", "boilerplate"],
      phrase: "提供模板和脚手架作为起步底座",
      anchors: ["模板", "脚手架", "starter", "boilerplate"],
    },
    {
      keywords: ["examples", "recipes", "samples"],
      phrase: "补充示例库和实操配方",
      anchors: ["示例", "配方", "examples", "recipes"],
    },
  ],
  "rag-knowledge": [
    {
      keywords: ["retrieval", "search", "semantic search", "graph rag"],
      phrase: "组织文档检索和语义搜索",
      anchors: ["检索", "搜索", "retrieval", "search"],
    },
    {
      keywords: ["vector", "embedding", "embeddings"],
      phrase: "把向量索引和嵌入能力接进问答链路",
      anchors: ["向量", "嵌入", "vector", "embedding"],
    },
    {
      keywords: ["memory", "context", "knowledge base"],
      phrase: "维护长期上下文和知识材料",
      anchors: ["记忆", "上下文", "知识", "knowledge"],
    },
  ],
  "mcp-tooling": [
    {
      keywords: ["mcp", "model context protocol"],
      phrase: "围绕 MCP 暴露工具能力",
      anchors: ["MCP", "protocol", "工具"],
    },
    {
      keywords: ["connector", "integrations", "bridge"],
      phrase: "把外部服务和系统接口接进模型上下文",
      anchors: ["连接器", "connector", "接口", "integrations"],
    },
    {
      keywords: ["tool calling", "tool use", "tool-use"],
      phrase: "统一模型的工具调用与执行边界",
      anchors: ["工具调用", "tool calling", "执行边界"],
    },
  ],
  evaluation: [
    {
      keywords: ["benchmark", "eval", "evaluation"],
      phrase: "比较不同模型或代理的表现",
      anchors: ["评测", "benchmark", "eval", "evaluation"],
    },
    {
      keywords: ["regression", "quality"],
      phrase: "盯住回归问题和质量波动",
      anchors: ["回归", "质量", "regression"],
    },
    {
      keywords: ["judge", "grading", "rubric"],
      phrase: "把打分和验收标准结构化",
      anchors: ["打分", "验收", "judge", "grading"],
    },
  ],
  "infra-platform": [
    {
      keywords: ["sdk", "framework"],
      phrase: "封装模型接入和开发框架",
      anchors: ["SDK", "框架", "framework"],
    },
    {
      keywords: ["gateway", "router", "routing"],
      phrase: "提供路由、网关或流量编排能力",
      anchors: ["路由", "网关", "router", "gateway"],
    },
    {
      keywords: ["deployment", "serving", "runtime platform"],
      phrase: "承接部署、服务化和运行层能力",
      anchors: ["部署", "服务化", "serving", "deployment"],
    },
    {
      keywords: ["provider", "adapter", "integration"],
      phrase: "统一不同模型提供方的接入方式",
      anchors: ["provider", "adapter", "接入"],
    },
  ],
};

const GENERIC_EVIDENCE_RULES: EvidencePhraseRule[] = [
  {
    keywords: ["automation", "workflow", "orchestration"],
    phrase: "把任务流程自动化串起来",
    anchors: ["自动化", "workflow", "orchestration"],
  },
  {
    keywords: ["search", "retrieval", "knowledge"],
    phrase: "组织检索和知识调用能力",
    anchors: ["检索", "知识", "retrieval", "search"],
  },
  {
    keywords: ["code", "repository", "patch"],
    phrase: "围绕代码仓库做分析与修改",
    anchors: ["代码", "仓库", "patch", "repository"],
  },
  {
    keywords: ["terminal", "cli", "shell"],
    phrase: "在本地终端环境里执行操作",
    anchors: ["终端", "cli", "shell", "本地"],
  },
  {
    keywords: ["sdk", "platform", "framework"],
    phrase: "把通用能力沉淀成平台或开发底座",
    anchors: ["平台", "framework", "sdk"],
  },
];

const USAGE_SCENARIO_RULES: UsageScenarioRule[] = [
  {
    keywords: ["docs", "documents", "pdf", "pdfs", "wiki", "wikis", "citation", "citations"],
    phrase: "给团队文档、PDF 或内部知识库做检索问答",
    families: ["rag-knowledge"],
  },
  {
    keywords: ["github", "slack", "api", "apis", "auth", "authentication", "tool server", "tool servers"],
    phrase: "把 GitHub、Slack 或内部 API 接成 agent 可调用工具",
    families: ["mcp-tooling"],
  },
  {
    keywords: ["debug", "debugging", "code review", "review", "release", "release checks", "playbook", "playbooks"],
    phrase: "复用调试、代码评审和发布检查流程",
    families: ["developer-resource"],
  },
  {
    keywords: ["pull request", "patch", "diff", "tests", "test", "repository", "repo"],
    phrase: "让它读仓库、改代码、跑测试或协助审 PR",
    families: ["coding-agent"],
  },
  {
    keywords: ["terminal", "command line", "cli", "shell", "desktop automation", "computer use"],
    phrase: "在本地终端里读文件、跑命令并串联工具操作",
    families: ["terminal-agent-shell"],
  },
  {
    keywords: ["workflow", "orchestration", "orchestrator", "swarm", "agents", "tool"],
    phrase: "把多个 agent 角色和工具编排成可重复执行的工作流",
    families: ["multi-agent-runtime"],
  },
  {
    keywords: ["provider", "router", "routing", "gateway", "deployment", "deploy", "serving"],
    phrase: "统一多模型接入、路由转发和部署服务链路",
    families: ["infra-platform"],
  },
  {
    keywords: ["market", "strategy", "backtest", "portfolio", "allocation"],
    phrase: "做行情研究、策略回测和组合决策支持",
    families: ["trading-research-agent"],
  },
  {
    keywords: ["benchmark", "evaluation", "eval", "regression", "judge", "grading"],
    phrase: "比较模型效果、回放失败样本和做回归验收",
    families: ["evaluation"],
  },
];

const REPO_SEMANTIC_RULES: RepoSemanticRule[] = [
  {
    keywords: ["langgraph"],
    familyId: "multi-agent-runtime",
    identityLabel: "LangGraph 这类 agent 工作流编排框架",
    primaryPurpose: "把带状态的 agent、工具调用和分支节点组织成可控流程",
    usageScenario: "搭多步骤 agent、审批流，或者需要人工介入的自动化流程",
    anchors: ["langgraph", "agent", "工作流", "节点", "人工介入"],
  },
  {
    keywords: ["vscode", "visual studio code"],
    identityLabel: "VS Code 这类代码编辑器 / IDE 项目",
    primaryPurpose: "提供写代码、装扩展、调试程序和管理工程的开发环境",
    usageScenario: "写代码、调试程序、安装插件，或者承载 AI 编程扩展",
    anchors: ["vscode", "vs code", "代码编辑器", "ide", "扩展", "调试"],
  },
];

const HOMOGENEOUS_BRIEF_PATTERNS = [
  "ai 代理调度后台",
  "ai agent orchestration backend",
  "通用 ai 代理平台",
  "通用 ai 工具平台",
  "ai 项目 tracked in this report",
  "围绕 ai 代理协作",
  "围绕 ai 工具或平台能力展开",
  "这是一个 ai 项目",
  "这是一个通用平台",
  "这是一个代理调度后台",
];

function normalizeText(...parts: Array<string | undefined>): string {
  return parts
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\[[^\]]+\]\(([^)]+)\)/g, " ")
    .replace(/[_/|.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique<T>(values: ReadonlyArray<T>): T[] {
  return [...new Set(values)];
}

function hasAnyKeyword(text: string, keywords: ReadonlyArray<string>): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function countKeywordMatches(text: string, keywords: ReadonlyArray<string> | undefined): number {
  if (!keywords || keywords.length === 0) return 0;
  return unique(keywords).filter((keyword) => text.includes(keyword)).length;
}

function countTagMatches(tags: string[], keywords: ReadonlyArray<string> | undefined): number {
  if (!keywords || keywords.length === 0) return 0;
  return unique(keywords).filter((keyword) => tags.some((tag) => tag === keyword || tag.includes(keyword))).length;
}

function familyKeywords(family: BriefFamily | null): string[] {
  if (!family) return [];
  return unique([
    ...(family.repoKeywords ?? []),
    ...(family.tagKeywords ?? []),
    ...(family.evidenceKeywords ?? []),
    ...(family.descriptionKeywords ?? []),
    ...(family.paradigmKeywords ?? []),
  ]);
}

function looksLikeNoisyDescription(description: string): boolean {
  return /https?:\/\//i.test(description) || /[|]{2,}/.test(description) || /\[[^\]]+\]\([^)]+\)/.test(description);
}

function hasConcreteDescriptionSignal(
  normalizedDescriptionText: string,
  family: BriefFamily | null,
  purposeFacets: BriefFacet[],
): boolean {
  if (!normalizedDescriptionText) return false;

  const keywordPool = unique([
    ...familyKeywords(family),
    ...(family?.anchorTerms ?? []),
    ...purposeFacets.flatMap((facet) => facet.keywords),
    ...purposeFacets.flatMap((facet) => facet.anchors),
    ...GENERIC_EVIDENCE_RULES.flatMap((rule) => rule.keywords),
    ...GENERIC_EVIDENCE_RULES.flatMap((rule) => rule.anchors),
    "github",
    "slack",
    "api",
    "auth",
    "oauth",
    "identity",
    "provider",
    "terminal",
    "command",
    "patch",
    "test",
    "review",
    "deploy",
    "release",
    "memory",
    "retrieval",
    "vector",
    "search",
    "docs",
    "document",
    "pdf",
    "workflow",
    "orchestration",
    "agent",
    "tool",
    "mcp",
    "connector",
    "integration",
    "stream",
    "streaming",
    "fix",
    "support",
    "代理",
    "编排",
    "工作流",
    "框架",
    "平台",
    "工具",
    "检索",
    "搜索",
    "知识库",
    "文档",
    "向量",
    "数据库",
    "索引",
    "引擎",
    "记忆",
    "终端",
    "命令行",
    "连接器",
    "接口",
    "身份",
    "认证",
    "部署",
    "路由",
    "推理",
    "训练",
    "教程",
    "微调",
    "教育",
    "复现",
    "依赖",
    "升级",
    "修复",
    "模型",
    "终端库",
    "pty",
    "离线",
    "自治",
    "系统",
  ]);
  const keywordMatches = countKeywordMatches(normalizedDescriptionText, keywordPool);
  const wordCount = normalizedDescriptionText.split(" ").filter((part) => part.length > 0).length;
  const cjkCharCount = (normalizedDescriptionText.match(/[\u4e00-\u9fff]/g) ?? []).length;

  return (keywordMatches >= 2 && wordCount >= 8) || (keywordMatches >= 1 && cjkCharCount >= 12);
}

function makeBriefContext(input: ProjectBriefInput): BriefContext {
  const tags = unique([...input.tags, ...(input.source_tags ?? [])]).map((tag) => tag.toLowerCase());
  const allDescriptions = [input.description, ...(input.source_descriptions ?? [])];
  const evidenceText = normalizeText(...(input.evidence ?? []));
  return {
    tags,
    evidenceText,
    repoText: normalizeText(input.project_name, input.repo_full_name),
    descriptionText: normalizeText(...allDescriptions),
    paradigmText: normalizeText(input.paradigm),
    searchable: normalizeText(
      input.project_name,
      input.repo_full_name,
      input.description,
      ...(input.source_descriptions ?? []),
      input.paradigm,
      ...input.tags,
      ...(input.source_tags ?? []),
      ...(input.evidence ?? []),
    ),
  };
}

function keywordScoreBySource(context: BriefContext, keywords: string[] | undefined): number {
  if (!keywords || keywords.length === 0) return 0;
  return (
    countKeywordMatches(context.repoText, keywords) * 10 +
    countTagMatches(context.tags, keywords) * 6 +
    countKeywordMatches(context.evidenceText, keywords) * 6 +
    countKeywordMatches(context.descriptionText, keywords) * 5 +
    countKeywordMatches(context.paradigmText, keywords) * 2
  );
}

function familyScore(context: BriefContext, family: BriefFamily): number {
  if (family.requiresAny && !hasAnyKeyword(context.searchable, family.requiresAny)) return 0;
  return (
    keywordScoreBySource(context, family.repoKeywords) +
    keywordScoreBySource(context, family.tagKeywords) +
    keywordScoreBySource(context, family.evidenceKeywords) +
    keywordScoreBySource(context, family.descriptionKeywords) +
    keywordScoreBySource(context, family.paradigmKeywords)
  );
}

function familyById(id: BriefFamilyId): BriefFamily {
  return BRIEF_FAMILIES.find((family) => family.id === id)!;
}

function pickStrongFeatureFamily(context: BriefContext): BriefFamily | null {
  if (
    hasAnyKeyword(context.repoText, ["tradingagents", "trading agents"]) ||
    keywordScoreBySource(context, ["trading", "finance", "financial", "market", "portfolio", "quant", "backtest"]) >= 12
  ) {
    return familyById("trading-research-agent");
  }

  if (
    hasAnyKeyword(context.repoText, ["codex", "claude code", "aider", "cursor", "opencode"]) ||
    keywordScoreBySource(context, ["coding agent", "code review", "pull request", "repository", "codebase", "patch", "test"]) >= 12
  ) {
    return familyById("coding-agent");
  }

  if (
    hasAnyKeyword(context.repoText, ["openclaw", "terminal", "shell"]) ||
    keywordScoreBySource(context, ["terminal", "command line", "cli", "shell", "self-hosted", "computer use"]) >= 12
  ) {
    return familyById("terminal-agent-shell");
  }

  if (
    hasAnyKeyword(context.repoText, ["rag", "knowledge", "retrieval", "graph rag"]) ||
    keywordScoreBySource(context, ["rag", "retrieval", "knowledge", "semantic search", "vector", "embedding"]) >= 12
  ) {
    return familyById("rag-knowledge");
  }

  if (
    hasAnyKeyword(context.repoText, ["swarm", "workflow", "orchestrator", "ruflo"]) ||
    keywordScoreBySource(context, ["multi-agent", "multi agent", "workflow", "orchestration", "agent runtime", "swarm"]) >= 12
  ) {
    return familyById("multi-agent-runtime");
  }

  return null;
}

function pickBriefFamily(context: BriefContext): BriefFamily | null {
  const strongFeatureFamily = pickStrongFeatureFamily(context);
  if (strongFeatureFamily) return strongFeatureFamily;

  let bestFamily: BriefFamily | null = null;
  let bestScore = 0;

  for (const family of BRIEF_FAMILIES) {
    const score = familyScore(context, family);
    if (score > bestScore) {
      bestScore = score;
      bestFamily = family;
    }
  }

  return bestScore > 0 ? bestFamily : null;
}

function matchedEvidenceRules(context: BriefContext, rules: EvidencePhraseRule[], limit = 2): MatchedPhrase[] {
  return rules
    .map((rule) => ({ ...rule, score: keywordScoreBySource(context, rule.keywords) }))
    .filter((rule) => rule.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

function containsAnchor(text: string, anchors: string[]): boolean {
  return anchors.some((anchor) => text.includes(anchor.toLowerCase()));
}

function buildFeatureSentence(primary: string, secondary?: string): string {
  return secondary ? `主要用来${primary}，也支持${secondary}` : `主要用来${primary}`;
}

function buildMultiAgentLabel(context: BriefContext): string {
  if (hasAnyKeyword(context.searchable, ["workflow", "orchestration", "orchestrator"])) return "多代理编排平台";
  if (hasAnyKeyword(context.searchable, ["swarm", "swarms"])) return "多代理协作平台";
  return "多代理运行时项目";
}

function buildTradingLabel(context: BriefContext): string {
  if (hasAnyKeyword(context.searchable, ["portfolio", "allocation", "backtest"])) return "金融交易 agent 框架";
  return "金融交易研究 agent";
}

function buildTerminalLabel(context: BriefContext): string {
  if (hasAnyKeyword(context.searchable, ["self-hosted", "own your data", "personal"])) return "自托管终端 AI 助手 / agent shell";
  return "终端 AI 助手 / agent shell";
}

function buildCodingLabel(context: BriefContext): string {
  if (hasAnyKeyword(context.searchable, ["code review", "pull request"])) return "代码审查型 coding agent";
  return "AI 编程助手";
}

const FAMILY_IDENTITY_LABEL_BUILDERS: Partial<Record<BriefFamilyId, (context: BriefContext) => string>> = {
  "multi-agent-runtime": buildMultiAgentLabel,
  "trading-research-agent": buildTradingLabel,
  "terminal-agent-shell": buildTerminalLabel,
  "coding-agent": buildCodingLabel,
};

const STATIC_IDENTITY_LABELS: Partial<Record<BriefFamilyId, string>> = {
  "developer-resource": "开发者资源包或模板集合",
  "rag-knowledge": "RAG / 知识工具项目",
  "mcp-tooling": "MCP / 工具接入项目",
  evaluation: "评测与验证项目",
  "infra-platform": "AI 基础设施或平台项目",
};

const GENERIC_IDENTITY_LABEL_RULES = [
  { keywords: ["rag", "retrieval", "knowledge", "search", "memory"], label: "知识检索类 AI 项目" },
  { keywords: ["mcp", "tool", "connector", "integration", "platform"], label: "工具接入类 AI 项目" },
  { keywords: ["repository", "repo", "patch", "diff", "test", "code review"], label: "仓库改动类 AI 工具" },
  { keywords: ["agent", "workflow", "automation"], label: "代理自动化项目" },
] as const;

const FAMILY_DEFAULT_PURPOSE_BUILDERS: Partial<Record<BriefFamilyId, (context: BriefContext) => string>> = {
  "multi-agent-runtime": (context) =>
    hasAnyKeyword(context.searchable, ["workflow", "orchestration", "tool", "connector"])
      ? "把多个代理、工具调用和执行步骤串成可重复运行的流程"
      : "协调多个代理分工协作并接住长链路任务",
  "coding-agent": (context) =>
    hasAnyKeyword(context.searchable, ["review", "pull request"])
      ? "理解代码仓库并协助完成代码审查或变更收敛"
      : "理解仓库上下文后生成补丁并配合测试回归",
};

const STATIC_FAMILY_DEFAULT_PURPOSES: Partial<Record<BriefFamilyId, string>> = {
  "trading-research-agent": "围绕市场信息组织研究、策略分析和交易判断",
  "terminal-agent-shell": "在本地终端里读写文件、执行命令并串联工具操作",
  "developer-resource": "整理技能、模板或脚手架，帮助团队更快起步",
  "rag-knowledge": "组织资料检索、知识调用和上下文复用",
  "mcp-tooling": "把模型接到外部工具、连接器或系统接口",
  evaluation: "比较模型或代理效果，并观察质量回归",
  "infra-platform": "沉淀模型接入、路由、部署或平台底座能力",
};

const STRONG_PURPOSE_SCORE = 8;

function humanizeRepoName(repoFullName: string): string {
  const normalized = repoFullName.trim();
  if (!normalized) return "unknown project";
  const lastSegment = normalized.split("/").pop() ?? normalized;
  return lastSegment.replace(/[-_]+/g, " ").trim() || normalized;
}

function labelFromKeywordRules(
  context: BriefContext,
  rules: ReadonlyArray<{ keywords: readonly string[]; label: string }>,
): string | undefined {
  return rules.find((rule) => hasAnyKeyword(context.searchable, rule.keywords))?.label;
}

function buildIdentityLabelForFamily(family: BriefFamily, context: BriefContext): string | undefined {
  return FAMILY_IDENTITY_LABEL_BUILDERS[family.id]?.(context) ?? STATIC_IDENTITY_LABELS[family.id];
}

function buildIdentityLabel(family: BriefFamily | null, context: BriefContext): string {
  return (
    (family ? buildIdentityLabelForFamily(family, context) : undefined) ??
    labelFromKeywordRules(context, GENERIC_IDENTITY_LABEL_RULES) ??
    "AI 项目"
  );
}

function buildFamilyDefaultPurpose(family: BriefFamily, context: BriefContext): string {
  return FAMILY_DEFAULT_PURPOSE_BUILDERS[family.id]?.(context) ?? STATIC_FAMILY_DEFAULT_PURPOSES[family.id] ?? buildGenericDefaultPurpose(context);
}

function buildGenericDefaultPurpose(context: BriefContext): string {
  if (hasAnyKeyword(context.searchable, ["agent", "workflow", "automation"])) return "串联一段代理执行或流程自动化链路";
  if (hasAnyKeyword(context.searchable, ["tool", "platform", "connector"])) return "把某类工具能力整理成更易复用的接入层";
  if (hasAnyKeyword(context.searchable, ["code", "repo", "repository", "patch"])) return "围绕代码仓库做分析、修改或辅助开发";
  if (hasAnyKeyword(context.searchable, ["search", "retrieval", "knowledge"])) return "组织检索、知识调用或信息处理流程";
  return "承接一类和 AI 相关的自动化或工具化需求";
}

function collectPurposeFacets(context: BriefContext, family: BriefFamily | null): BriefFacet[] {
  const familyFacets = family
    ? matchedEvidenceRules(context, FAMILY_EVIDENCE_RULES[family.id], 4).map((rule) => ({ ...rule, source: "family" as const }))
    : [];
  const genericFacets = matchedEvidenceRules(context, GENERIC_EVIDENCE_RULES, 4).map((rule) => ({ ...rule, source: "generic" as const }));
  const deduped = new Map<string, BriefFacet>();

  for (const facet of [...familyFacets, ...genericFacets]) {
    const existing = deduped.get(facet.phrase);
    if (!existing || facet.score > existing.score || (facet.score === existing.score && facet.source === "family")) {
      deduped.set(facet.phrase, facet);
    }
  }

  return [...deduped.values()].sort((left, right) => right.score - left.score).slice(0, 3);
}

function hasUsefulProjectDescription(
  input: ProjectBriefInput,
  context: BriefContext,
  family: BriefFamily | null,
  facets: BriefFacet[],
  hasRepoSemanticRule: boolean,
): boolean {
  const descriptions = [input.description, ...(input.source_descriptions ?? [])].map((item) => item.trim());
  return (
    descriptions.some((description) => description.length > 0 && !looksLikeNoisyDescription(description)) ||
    hasConcreteDescriptionSignal(context.descriptionText, family, facets) ||
    hasRepoSemanticRule
  );
}

function hasSpecificProjectTags(input: ProjectBriefInput): boolean {
  const allTags = unique([...input.tags, ...(input.source_tags ?? [])]);
  return allTags.some((tag) => tag.trim().length > 0 && tag.toLowerCase() !== "agent");
}

function shouldMarkUsageScenarioMissing(
  context: BriefContext,
  family: BriefFamily | null,
  richDescriptionSignal: boolean,
  hasRepoSemanticRule: boolean,
  hasSpecificTags: boolean,
): boolean {
  return (
    !hasSpecificTags &&
    !family &&
    !richDescriptionSignal &&
    !hasRepoSemanticRule &&
    !hasAnyKeyword(context.searchable, ["terminal", "code", "search", "mcp", "trading", "workflow", "tool"])
  );
}

function identifyMissingFields(
  input: ProjectBriefInput,
  context: BriefContext,
  facets: BriefFacet[],
  family: BriefFamily | null,
  richDescriptionSignal: boolean,
  hasRepoSemanticRule: boolean,
): string[] {
  const missing: string[] = [];
  const hasUsefulDescription = hasUsefulProjectDescription(input, context, family, facets, hasRepoSemanticRule);
  const hasEvidence = (input.evidence ?? []).some((item) => item.trim().length > 0);
  const hasSpecificTags = hasSpecificProjectTags(input);
  const strongFacetCount = facets.filter((facet) => facet.score >= 8).length;

  if (!hasUsefulDescription) missing.push("明确的功能描述");
  if (!hasEvidence && strongFacetCount === 0 && !richDescriptionSignal && !hasRepoSemanticRule) missing.push("关键能力线索");
  if (shouldMarkUsageScenarioMissing(context, family, richDescriptionSignal, hasRepoSemanticRule, hasSpecificTags)) {
    missing.push("使用场景");
  }

  return unique(missing);
}

function hasStrongPurposeSignal(facets: BriefFacet[]): boolean {
  return facets.some((facet) => facet.score >= STRONG_PURPOSE_SCORE);
}

function shouldUseFamilyDefaultPurpose(
  family: BriefFamily | null,
  strongestFacet: BriefFacet | undefined,
  hasAnyFamilyFacet: boolean,
): family is BriefFamily {
  return Boolean(family) && (!hasAnyFamilyFacet || !strongestFacet || strongestFacet.score < STRONG_PURPOSE_SCORE);
}

function buildPrimaryPurpose(
  family: BriefFamily | null,
  context: BriefContext,
  purposeFacets: BriefFacet[],
): string {
  const strongestFamilyFacet = purposeFacets.find((facet) => facet.source === "family" && facet.score >= STRONG_PURPOSE_SCORE);
  if (strongestFamilyFacet) return strongestFamilyFacet.phrase;

  const strongestFacet = purposeFacets[0];
  const hasAnyFamilyFacet = purposeFacets.some((facet) => facet.source === "family");
  if (shouldUseFamilyDefaultPurpose(family, strongestFacet, hasAnyFamilyFacet)) {
    return buildFamilyDefaultPurpose(family, context);
  }

  return strongestFacet?.phrase ?? buildGenericDefaultPurpose(context);
}

function buildSecondaryPurpose(purposeFacets: BriefFacet[], primaryPurpose: string): string | undefined {
  return purposeFacets.find((facet) => facet.phrase !== primaryPurpose && facet.score >= STRONG_PURPOSE_SCORE)?.phrase;
}

function pickRepoSemanticRule(context: BriefContext): RepoSemanticRule | undefined {
  return REPO_SEMANTIC_RULES.find((rule) => hasAnyKeyword(context.repoText, rule.keywords));
}

function buildUsageScenario(context: BriefContext, family: BriefFamily | null): string | undefined {
  const familyId = family?.id;
  const candidateRules =
    familyId && USAGE_SCENARIO_RULES.some((rule) => rule.families?.includes(familyId))
      ? USAGE_SCENARIO_RULES.filter((rule) => rule.families?.includes(familyId))
      : USAGE_SCENARIO_RULES;
  const ranked = candidateRules
    .map((rule) => ({
      ...rule,
      score: keywordScoreBySource(context, rule.keywords),
    }))
    .filter((rule) => rule.score > 0)
    .sort((left, right) => right.score - left.score);

  if (!familyId && (ranked[0]?.score ?? 0) < 10) {
    return undefined;
  }

  return ranked[0]?.phrase;
}

function hasRichDescriptionSignal(context: BriefContext, family: BriefFamily | null, purposeFacets: BriefFacet[]): boolean {
  if (!context.descriptionText) return false;

  if (hasConcreteDescriptionSignal(context.descriptionText, family, purposeFacets)) return true;

  if (countKeywordMatches(context.descriptionText, familyKeywords(family)) >= 2) return true;

  const genericDescriptionMatches = GENERIC_EVIDENCE_RULES.filter(
    (rule) => countKeywordMatches(context.descriptionText, rule.keywords) > 0,
  ).length;
  if (genericDescriptionMatches >= 2) return true;

  return purposeFacets.filter((facet) => countKeywordMatches(context.descriptionText, facet.keywords) > 0).length >= 2;
}

function buildExpectedAnchors(
  family: BriefFamily | null,
  purposeFacets: BriefFacet[],
  missingFields: string[],
  repoSemanticAnchors: string[] = [],
): string[] {
  return unique([
    ...purposeFacets.flatMap((facet) => facet.anchors),
    ...(family?.anchorTerms ?? []),
    ...repoSemanticAnchors,
    ...missingFields,
    "当前项目信息不足",
  ]);
}

function resolveProfileFamily(context: BriefContext, repoSemanticRule: RepoSemanticRule | undefined): BriefFamily | null {
  return repoSemanticRule?.familyId ? familyById(repoSemanticRule.familyId) : pickBriefFamily(context);
}

function resolveProfilePrimaryPurpose(
  repoSemanticRule: RepoSemanticRule | undefined,
  family: BriefFamily | null,
  context: BriefContext,
  purposeFacets: BriefFacet[],
): string {
  return repoSemanticRule?.primaryPurpose ?? buildPrimaryPurpose(family, context, purposeFacets);
}

function hasMissingDescriptionAndEvidence(input: ProjectBriefInput): boolean {
  return [input.description, ...(input.source_descriptions ?? [])].every((item) => item.trim().length === 0) && (input.evidence ?? []).length === 0;
}

function buildProjectFacetProfile(input: ProjectBriefInput): ProjectFacetProfile {
  const context = makeBriefContext(input);
  const repoSemanticRule = pickRepoSemanticRule(context);
  const family = resolveProfileFamily(context, repoSemanticRule);
  const purposeFacets = collectPurposeFacets(context, family);
  const identityLabel = repoSemanticRule?.identityLabel ?? buildIdentityLabel(family, context);
  const primaryPurpose = resolveProfilePrimaryPurpose(repoSemanticRule, family, context, purposeFacets);
  const secondaryPurpose = buildSecondaryPurpose(purposeFacets, primaryPurpose);
  const usageScenario = repoSemanticRule?.usageScenario ?? buildUsageScenario(context, family);
  const richDescriptionSignal = hasRichDescriptionSignal(context, family, purposeFacets) || Boolean(repoSemanticRule);
  const missingFields = identifyMissingFields(
    input,
    context,
    purposeFacets,
    family,
    richDescriptionSignal,
    Boolean(repoSemanticRule),
  );
  const hasStrongPurpose = hasStrongPurposeSignal(purposeFacets) || richDescriptionSignal;
  const missingDescriptionAndEvidence = hasMissingDescriptionAndEvidence(input);

  return {
    family,
    identityLabel,
    purposeFacets,
    primaryPurpose,
    secondaryPurpose,
    usageScenario,
    missingFields,
    weakSignal: missingFields.length > 0 || (missingDescriptionAndEvidence && !repoSemanticRule) || !hasStrongPurpose,
    expectedAnchors: buildExpectedAnchors(family, purposeFacets, missingFields, repoSemanticRule?.anchors),
  };
}

function formatMissingFields(fields: string[]): string {
  if (fields.length <= 1) return fields[0] ?? "更多结构化信息";
  return `${fields.slice(0, -1).join("、")}和${fields[fields.length - 1]}`;
}

function buildUsageSentence(profile: ProjectFacetProfile): string {
  if (profile.usageScenario) return `常见用法是拿它来${profile.usageScenario}`;
  if (profile.secondaryPurpose) return `大家通常会用它来${profile.primaryPurpose}，也会顺手${profile.secondaryPurpose}`;
  return `大家通常会用它来${profile.primaryPurpose}`;
}

function composeProjectBrief(profile: ProjectFacetProfile): string {
  let brief = `这是一个${profile.identityLabel}。它主要是帮你${profile.primaryPurpose}`;
  if (profile.secondaryPurpose) {
    brief += `，也能${profile.secondaryPurpose}`;
  }
  brief += "。";

  if (profile.usageScenario && (!profile.weakSignal || profile.family)) {
    brief += `${buildUsageSentence(profile)}。`;
  } else if (!profile.weakSignal) {
    brief += `${buildUsageSentence(profile)}。`;
  }

  if (profile.weakSignal && profile.missingFields.length > 0) {
    brief += `当前项目信息不足，缺少${formatMissingFields(profile.missingFields)}。`;
  }

  return brief;
}

export function buildProjectBrief(
  input: ProjectBriefInput,
  matchedTopics: UserInterestTopicName[] = [],
): string {
  void matchedTopics;
  return composeProjectBrief(buildProjectFacetProfile(input));
}

function scoreEvidenceSnippets(project: Pick<ScoredProject, "score">["score"]): string[] {
  return unique(
    project.components
      .flatMap((component) => component.evidence)
      .map((evidence) => {
        if (evidence.startsWith("classification.evidence=")) return evidence.replace("classification.evidence=", "");
        if (evidence === "classification.has_governance_boundary") return "governance boundary";
        if (evidence === "classification.has_persistent_memory") return "persistent memory";
        if (evidence === "classification.has_skill_ecosystem") return "tool skill ecosystem";
        if (evidence === "classification.has_self_improving_loop") return "self improving loop";
        if (evidence === "classification.autonomy_level=high") return "high autonomy agent";
        if (evidence === "classification.autonomy_level=medium") return "medium autonomy agent";
        return "";
      })
      .filter((item) => item.length > 0),
  );
}

export function validateProjectBriefSpecificity(
  input: ProjectBriefInput,
  value: string,
): string | undefined {
  const profile = buildProjectFacetProfile(input);
  const normalized = normalizeText(value);

  if (HOMOGENEOUS_BRIEF_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return "homogeneous_copy";
  }

  const hasPurposeAnchor = profile.expectedAnchors.some((anchor) => normalized.includes(anchor.toLowerCase()));
  const hasMissingNote =
    normalized.includes("当前项目信息不足") &&
    normalized.includes("缺少") &&
    profile.missingFields.some((field) => normalized.includes(field.toLowerCase()));

  if (normalized.includes("当前项目信息不足") && !hasMissingNote) {
    return "invalid_missing_note";
  }

  if (profile.weakSignal && hasMissingNote) {
    return undefined;
  }

  if (!hasPurposeAnchor) {
    return profile.family ? "invalid_purpose_fit" : "insufficient_project_evidence";
  }

  if (profile.purposeFacets.length > 0 && !profile.purposeFacets.some((facet) => containsAnchor(normalized, facet.anchors))) {
    return "insufficient_project_evidence";
  }

  return undefined;
}

export function buildProjectBriefFromScoredProject(
  project: Pick<ScoredProject, "project" | "score">,
  matchedTopics: UserInterestTopicName[] = [],
): string {
  const cachedRepoMetrics = readCachedGitHubRepoMetrics(project.project.repo_full_name);
  const sourceDescriptions = unique(
    [
      ...project.project.raw_signals.map((signal) => signal.description?.trim() ?? ""),
      cachedRepoMetrics?.description?.trim() ?? "",
    ]
      .filter((description) => description.length > 0),
  );
  const sourceTags = unique(
    [...project.project.raw_signals.flatMap((signal) => signal.tags ?? []), ...(cachedRepoMetrics?.tags ?? [])].filter(
      (tag) => tag.trim().length > 0,
    ),
  );

  return buildProjectBrief(
    {
      project_name: project.project.project_name,
      repo_full_name: project.project.repo_full_name,
      description: project.project.description,
      tags: project.project.tags,
      paradigm: project.score.paradigm,
      evidence: scoreEvidenceSnippets(project.score),
      source_descriptions: sourceDescriptions,
      source_tags: sourceTags,
    },
    matchedTopics,
  );
}
