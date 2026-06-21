# 行业级 Agent 趋势判断：工具保障与 Seed Registry

> 本文档拆自 [行业级Agent趋势判断设计文档.md](../行业级Agent趋势判断设计文档.md)，是行业级 Agent 趋势判断设计文档包的一部分。

## 工具四级保障链路

本章只冻结工具治理、来源优先级和 seed registry 基线。多 Agent 消息协议、输入输出 envelope、payload schema registry 与交互 DAG 以 [05-多Agent协作与中间件](05-多Agent协作与中间件.md) 和 [08-验证追溯与完成定义](08-验证追溯与完成定义.md) 为准；本章不重复定义消息契约。

每个证据轴必须记录 `primary_tool`、`secondary_toolset`、`fallback_tools`、`last_resort_mode`、`unavailable_state`。工具失败时，先走备用链路，最后才标注缺失或弱观察。

V1 不再把“来源”和“工具”混成一个优先级表。四级保障链路必须同时表达两层语义：

- `source_class`：这条证据路线优先访问哪类来源。高权威轴优先级固定为 `official_structured_api` 或 `official_owned_feed_or_doc`，而不是先跑聚合器再补官方源。
- `tool`：负责发现、抓取、解析、引用追溯或补证的执行器。工具只是一种执行手段，不能替代来源类型本身的权威语义。

本节冻结的是工具治理语义，不冻结某个具体工具的永久优先级。`primary_tool / secondary_toolset / fallback_tools / last_resort_mode` 是能力层级；具体工具名称只是 V1 `tools.json` 的候选 seed，必须由 `registry-agent` 按轴评估后写入 tool registry snapshot。ExecPlan 不得把下表硬编码为固定调用顺序，也不得因为某个 seed 工具暂不可用就降低四级保障链路、工具覆盖报告或 unavailable 语义。

V1 工具候选 seed 如下：

| 证据场景 | primary source class | secondary source class | preferred retrieval executors | fallback executors / sources | last_resort_mode |
| --- | --- | --- | --- | --- | --- |
| 跨平台搜寻与工具路由 | `domain_structured_search` | `general_web_search` | AgentReach、AutoSearch、mcp-omnisearch 中按轴评估最高者 | open-websearch、GPT Researcher、direct platform APIs、RSSHub | `mark_unavailable` |
| 官方网页 / 文档 / changelog | `official_owned_feed_or_doc` | `domain_structured_search` | Firecrawl、Crawl4AI、RSSHub、official sitemap / RSS、Jina Reader | AgentReach、AutoSearch、mcp-omnisearch、open-websearch | `targeted_fetch` |
| 学术元数据 | `official_structured_api` | `official_owned_feed_or_doc` | OpenAlex、Semantic Scholar API、arXiv API、OpenReview API、Paper Search MCP | AutoSearch、GPT Researcher、顶会或机构官方页面定向抓取 | `targeted_fetch` |
| 学术综合 / auto research | `specialized_research_or_discovery` | `official_structured_api` | PaperQA / PaperQA2、Open Deep Research、GPT Researcher、OpenScholar | Paper Search MCP、OpenAlex、Semantic Scholar API、arXiv API、OpenReview API | `weak_signal_only` |
| 顶会 / benchmark | `official_owned_feed_or_doc` | `official_structured_api` | OpenReview、Papers with Code、official proceedings / schedule / leaderboard、Paper Search MCP | Open Deep Research、AutoSearch、GPT Researcher | `targeted_fetch` |
| 开源项目与依赖生态 | `official_structured_api` | `official_owned_feed_or_doc` | GitHub REST / GraphQL API、GH Archive、ecosyste.ms、Libraries.io、deps.dev、agents-radar | AI Community Intelligence、AutoSearch、GitHub HTML | `weak_signal_only` |
| 模型 / 数据集 / Space | `official_structured_api` | `official_owned_feed_or_doc` | Hugging Face Hub API、`huggingface_hub`、ModelScope、OpenXLab、GitHub org | agents-radar、AI Community Intelligence、网页抓取 | `weak_signal_only` |
| 社区讨论 | `official_structured_api` | `official_owned_feed_or_doc` | HN Algolia API、Reddit API、GitHub Discussions GraphQL、Hugging Face community、公开论坛 | AI Community Intelligence、AgentReach、AutoSearch、MorningAI | `weak_signal_only` |
| 大厂 / 产品发布 | `official_owned_feed_or_doc` | `official_structured_api` | 官方 blog、RSS、release notes、API docs、GitHub org、Hugging Face org、Firecrawl、Crawl4AI、Jina Reader | MorningAI、AI Community Intelligence、AgentReach、AutoSearch | `targeted_fetch` |
| 政策 / 监管 | `official_structured_api` | `official_owned_feed_or_doc` | Federal Register API、OECD.AI、官方 gov / eu APIs、官方政策页面、Crawl4AI、Jina Reader | Open Deep Research、GPT Researcher、AutoSearch、RSSHub | `manual_verification` |
| 金融 / 资本 | `official_structured_api` | `official_owned_feed_or_doc` | SEC EDGAR、company investor relations、公开财报和公告、OpenBB | Open Deep Research、GPT Researcher、Reuters、Sifted、Dealroom、TechCrunch、36氪 | `manual_verification` |
| 全球新闻 / 叙事扩散 | `domain_structured_search` | `general_web_search` | GDELT DOC / Context API、RSSHub、Firecrawl、Crawl4AI、Jina Reader | MorningAI、AI Community Intelligence、AgentReach、open-websearch | `mark_unavailable` |

### 来源优先级与 high-risk 轴约束

以下约束冻结为设计语义：

- `policy_regulatory`、`capital_finance`、`product_vendor_release` 三个高权威轴必须优先命中 `official_structured_api` 或 `official_owned_feed_or_doc`。
- `specialized_research_or_discovery`、`general_web_search` 和各类新闻聚合器可用于发现、补元数据、补引用链或形成 `needs_review`，但不能直接充当高权威轴的 primary supporting route。
- `last_resort_mode` 只能有四种固定语义：`targeted_fetch`、`manual_verification`、`weak_signal_only`、`mark_unavailable`。ExecPlan 可以替换具体工具，不得自造新的 last resort 语义。

### `tool-selection-scorecard.v1`

AgentReach 不是所有证据轴的天然首选。`registry-agent` 必须按证据轴评估工具适配度、维护活跃度、稳定性、输出结构化程度、引用可追溯能力、成本和授权风险，并使用统一的 `tool-selection-scorecard.v1` 审计 primary route 选择。

`tool-selection-scorecard.v1` 默认权重冻结如下：

| 维度 | 权重 | 说明 |
| --- | ---: | --- |
| `source_fidelity` | `0.30` | 是否优先访问该轴应有的 `source_class`，尤其是 high-risk 轴的官方源命中能力。 |
| `citation_traceability` | `0.20` | 是否能稳定给出 canonical URL、DOI、filing link、official doc ref 等可回溯引用。 |
| `output_structure` | `0.15` | 是否能稳定输出结构化字段，而不是难审计的自由文本。 |
| `freshness_sla_fit` | `0.10` | 工具的刷新承诺是否满足该 axis 的实际新鲜度要求。 |
| `stability` | `0.10` | 最近运行稳定性、失败率、rate limit 表现和维护活跃度。 |
| `cost_efficiency` | `0.10` | 单次采集和核验成本是否适合进入默认 V1 主路径。 |
| `license_risk_fit` | `0.05` | 授权、抓取和复用风险是否可控。 |

默认晋升门槛冻结如下：

- `score >= 75` 且未命中 veto 时，才可进入 `primary_tool`。
- `60-74` 可进入 `secondary_toolset`。
- `40-59` 只能进入 `fallback_tools`。
- `< 40` 或命中 veto 时，只能进入 `last_resort_mode` 或 `unavailable`。

默认 veto 规则冻结如下：

- `license_risk="high/unknown"` 不得进入 `primary_tool`。
- `cost_tier="high"` 或 `access_mode="optional_paid"` 不得成为 V1 自动化 primary。
- 无法产出 canonical ref、source trace 或稳定结构化输出的工具不得进入 `primary_tool`。
- `freshness_sla` 低于该 axis 需求的工具不得进入 `primary_tool`。
- `general_web_search`、`specialized_research_or_discovery`、`manual_or_local_only` 不得直接成为 `policy_regulatory`、`capital_finance`、`product_vendor_release` 的 primary supporting route。

审计落点冻结如下：

- `tool-selection-scorecard.v1` 不是只存在于实现代码中的隐式打分函数；每次 active route 选择都必须在 canonical artifact 中留下版本、总分、分项得分、候选集合和 veto 原因。
- V1 可以把这些字段直接挂在 `AxisToolCoverageReport`，也可以额外输出 `ToolSelectionAudit` artifact；但至少要有一处能被 weekly、审计和 replay 直接消费。

工具 seed 维护规则：

- 下表中的工具名不构成产品语义，不得出现在趋势等级裁决逻辑中；裁决只能依赖 evidence event、authority、axis summary、tool route state 和 audit。
- `registry-agent` 可以新增、降级、替换或标记 seed 工具不可用，但必须保留 `replacement_tool_ids`、`unavailable_state`、成本/授权状态、`source_class`、`retrieval_role` 和变更原因。
- 当某类工具没有可用实现时，系统仍必须输出对应轴的 `AxisToolCoverageReport`，并用 `active_route_level="none"` 或降级 route 表达，而不是把该轴从设计范围移除。
- ExecPlan 可以把工具接入拆成阶段，但不能把未接入的证据轴从 V1 完成定义中删掉；未自动覆盖的轴必须以 `unavailable / partial / needs_review` 进入 weekly 可见账本。

`AxisToolCoverageReport` 是 weekly 可见的工具覆盖账本，不能只在 registry 内部存在。

```ts
interface AxisToolCoverageReport {
  axis: IndustryEvidenceAxisKey;
  primary_tool_ids: string[];
  secondary_toolset_ids: string[];
  fallback_tool_ids: string[];
  last_resort_tool_ids: string[];
  eligible_tool_ids: string[];
  selected_from_tool_ids: string[];
  attempted_tool_ids: string[];
  selection_scorecard_version?: "tool-selection-scorecard.v1";
  selection_score_total?: number;
  selection_score_breakdown?: {
    source_fidelity: number;
    citation_traceability: number;
    output_structure: number;
    freshness_sla_fit: number;
    stability: number;
    cost_efficiency: number;
    license_risk_fit: number;
  };
  veto_reason_codes: string[];
  selection_reason_codes: string[];
  active_route_level:
    | "primary_tool"
    | "secondary_toolset"
    | "fallback_tools"
    | "last_resort_mode"
    | "none";
  active_tool_ids: string[];
  active_source_class:
    | "official_structured_api"
    | "official_owned_feed_or_doc"
    | "domain_structured_search"
    | "specialized_research_or_discovery"
    | "general_web_search"
    | "manual_or_local_only"
    | "none";
  last_resort_mode_kind?:
    | "targeted_fetch"
    | "manual_verification"
    | "weak_signal_only"
    | "mark_unavailable";
  route_status: {
    primary_tool: ToolAvailabilityState;
    secondary_toolset: ToolAvailabilityState;
    fallback_tools: ToolAvailabilityState;
    last_resort_mode: ToolAvailabilityState;
  };
  budget_status: {
    profile_id: string;
    budget_exceeded: boolean;
    spent_summary_cn: string;
  };
  unavailable_state?: {
    reason_code: string;
    since: string;
    affected_axes: IndustryEvidenceAxisKey[];
  };
  degraded: boolean;
  degradation_reason_codes: string[];
  candidate_ref_count: number;
  accepted_ref_count: number;
  citation_trace_rate: number;
  max_source_lag_days?: number;
  evidence_event_ids: string[];
  rejected_event_ids: string[];
  registry_snapshot_ref: string;
  tool_registry_snapshot_ref: string;
  summary_cn: string;
}
```

`AxisToolCoverageReport` 字段定义冻结如下：

| 字段 | 类型 / 取值 | 含义 | 执行约束 |
| --- | --- | --- | --- |
| `axis` | `IndustryEvidenceAxisKey` | 工具覆盖报告对应证据轴。 | 每个 weekly 必须恰好输出十条，一轴一条。 |
| `primary_tool_ids` / `secondary_toolset_ids` / `fallback_tool_ids` / `last_resort_tool_ids` | string[] | 该轴各 route level 的候选工具。 | ID 必须存在于 tool registry；空数组表示该层无可用工具，但不能省略字段。 |
| `eligible_tool_ids` | string[] | 本次按 axis、source class、预算和授权规则筛出的可选工具。 | 必须是 route 候选的子集；不能把未通过 veto 的工具静默算入 eligible。 |
| `selected_from_tool_ids` | string[] | 实际进行 scorecard 比较和 route 选择的候选集合。 | 至少应覆盖 active route 所在层级的可选工具；不得在未进入比较集合时直接跳选某个 tool。 |
| `attempted_tool_ids` | string[] | 本次真正尝试调用过的工具。 | 必须可反查 run trace、timeout 或 failure_notice。 |
| `selection_scorecard_version` | literal string optional | 本次使用的工具选型 scorecard 版本。 | `active_route_level!="none"` 时必填；V1 必须为 `tool-selection-scorecard.v1`。 |
| `selection_score_total` | number optional | active route / active tool 的总分。 | 命中 scorecard 的 route 选择时必填；不得只写 reason 而没有分值。 |
| `selection_score_breakdown` | object optional | active route / active tool 的分项分值。 | `selection_scorecard_version` 存在时必填；分项必须能加总到总分或经固定归一规则映射。 |
| `veto_reason_codes` | string[] | 本次候选工具命中的 veto 原因。 | 没有命中 veto 时也必须输出空数组；不得把 veto 结果藏在自然语言里。 |
| `selection_reason_codes` | string[] | 选择 active route / tool 的原因。 | primary、secondary、fallback 的选择必须可解释；不得只写 `best_tool` 之类空洞原因。 |
| `active_route_level` | route enum 或 `none` | 本次实际采用的工具层级。 | 必须选择最高可用层级；全部不可用时为 `none`。 |
| `active_tool_ids` | string[] | 本次实际产出证据的工具。 | `active_route_level="none"` 时必须为空；否则必须属于对应 route list。 |
| `active_source_class` | enum | 本次实际命中的来源类型。 | `active_route_level="none"` 时必须为 `none`；否则必须为真实 source class。high-risk 轴如果不是 `official_structured_api` 或 `official_owned_feed_or_doc`，必须 `degraded=true` 并写明 reason。 |
| `last_resort_mode_kind` | enum optional | 本次 last resort 的固定语义。 | 只有 `active_route_level="last_resort_mode"` 时可填；不得使用自由文本。 |
| `route_status` | object | 四级 route 的可用状态。 | 每个 route level 都必须有状态，不能只报告 active route。 |
| `budget_status` | object | 本次预算消耗和是否超额。 | 超预算时必须可见；不得把预算耗尽伪装成来源不存在。 |
| `unavailable_state` | object optional | 完全不可用或关键缺失原因。 | `active_route_level="none"` 或 route 全部失败时必填。 |
| `degraded` | boolean | 本轴是否降级覆盖。 | 使用 secondary、fallback、last resort、partial、rate_limited、非官方 source class 或 `budget_exceeded` 时必须为 true。 |
| `degradation_reason_codes` | string[] | 降级原因。 | `degraded=true` 时不能为空。 |
| `candidate_ref_count` / `accepted_ref_count` | number | 候选引用数与被接受引用数。 | 必须与 normalization / rejected audit 大致对齐；不能凭空增长。 |
| `citation_trace_rate` | `0-1` number | 本轴候选引用的可解析率。 | 核心趋势支撑轴低于全局 citation floor 时必须降级。 |
| `max_source_lag_days` | number optional | 本轴本次接受证据中最旧的一条相对窗口结束日的天数。 | stale 过高时必须影响 freshness 和 degraded 语义。 |
| `evidence_event_ids` | string[] | 该工具覆盖产生或支撑的 accepted events。 | 必须能在 daily pack 或 claim ledger 中找到。 |
| `rejected_event_ids` | string[] | 工具发现但被拒绝的 events。 | 必须有 rejected reason，不能静默丢弃。 |
| `registry_snapshot_ref` / `tool_registry_snapshot_ref` | string | 本报告所用 registry 快照。 | 必须与 weekly / daily artifact 中引用一致。 |
| `summary_cn` | string | 用户可读覆盖摘要。 | 只作解释，不得替代 route_status、budget_status 和 event refs。 |

工具覆盖冻结规则：

- 每个 evidence axis 必须恰好输出一条 `AxisToolCoverageReport`。
- `AxisEvidenceSummary.tool_route_state.active_tool_ids` 必须能在 `AxisToolCoverageReport` 中找到对应 route。
- 全部工具链失败时，`active_route_level="none"`，对应轴为 `unavailable`，并写明 `unavailable_state.reason_code`。
- `active_route_level!="none"` 时，`active_source_class`、`selection_scorecard_version`、`selection_score_total`、`selection_score_breakdown` 和 `selected_from_tool_ids` 不得缺失。
- 使用 `secondary_toolset`、`fallback_tools` 或 `last_resort_mode` 时，`degraded=true`，weekly 必须让用户知道该轴本周是降级覆盖。
- `last_resort_mode` 产出的证据不得单独推动趋势升级，只能作为弱观察、补证线索或缺口说明。
- `policy_regulatory`、`capital_finance`、`product_vendor_release` 若本次没有命中官方 source class，则即使工具调用成功，也不得单独把该轴升级为 `strong`。

## V1 Seed Registry 采用范围

本设计采用需求文档中的 V1 Seed Registry 作为 V1 完成态 registry，不允许缩减为热门公司、只实现部分轴、先落地最小子集，或把下列覆盖族降级为后续扩展项。以下覆盖族必须在 V1 materialize；新增前沿主体只能追加到该完整基线之上。这里的 `materialize` 指完整进入 registry、具备 authority / access / review / monitoring_tier 等治理字段，不等于每个 seed 都要默认高频主动扫描。

### 大厂 / 产品与平台主体

- 国际大厂与实验室：OpenAI、Anthropic、Google / Google DeepMind / Gemini、Microsoft / GitHub、Meta / FAIR、Amazon / AWS、Apple、NVIDIA、xAI、IBM、Salesforce、ServiceNow、Adobe、Databricks、Snowflake。
- 模型与 Agent 平台公司：Mistral AI、Cohere、Perplexity、Anysphere / Cursor、Cognition、Replit、Sourcegraph、Vercel、Hugging Face。
- 中国与亚洲主体：DeepSeek、Alibaba / Qwen、ByteDance / Seed、Tencent、Baidu、Huawei、Moonshot AI、Zhipu AI、MiniMax、01.AI、StepFun、ModelBest / OpenBMB、Shanghai AI Laboratory。
- Agent / 开发者工具生态主体：LangChain、LlamaIndex、Microsoft AutoGen、CrewAI、OpenHands、Browser Use、Aider、Continue、Mem0、Composio、Pydantic AI、Mastra、Langfuse、Ragas、DSPy。

### 研究所 / 大学 / 实验室

- 国际研究机构：Allen Institute for AI、Stanford HAI、Stanford CRFM、UC Berkeley BAIR、MIT CSAIL、Carnegie Mellon University、Princeton NLP、University of Washington NLP、NYU Center for Data Science、Mila、Vector Institute、ETH AI Center、Oxford、Cambridge。
- 大厂研究组织：OpenAI Research、Google DeepMind、Meta FAIR、Microsoft Research、NVIDIA Research、Apple Machine Learning Research、Amazon Science、Salesforce AI Research。
- 中国及亚洲研究机构：Tsinghua University / THUDM、Peking University、Shanghai AI Laboratory、Chinese Academy of Sciences、HKU、HKUST、NUS、NTU、KAIST、RIKEN AIP。

### 顶会 / 学术活动 / Benchmark 场域

- AI / ML 顶会：NeurIPS、ICML、ICLR、AAAI、COLM。
- NLP / Agent 语言系统：ACL、EMNLP、NAACL、EACL、CoNLL。
- 数据、Web 与系统：KDD、The Web Conference、SIGIR、VLDB、SIGMOD、OSDI、SOSP、USENIX ATC。
- 人机交互与工具使用：CHI、UIST、CSCW、IUI。
- 多模态、视觉和具身智能：CVPR、ICCV、ECCV、RSS、CoRL、ICRA、IROS。
- 必跟主题：agent、tool use、computer use、workflow automation、coding agent、multi-agent、memory、eval、alignment、safety、governance、robotics agent、web agent、GUI agent 相关 workshop、tutorial、challenge、benchmark。

### 知名开发者 / 工作室 / 开源维护者

- 个人与意见领袖种子：Simon Willison、Andrej Karpathy、Swyx、Harrison Chase、Jerry Liu、Paul Gauthier、Yohei Nakajima、Jason Liu、Addy Osmani、Thorsten Ball、Chip Huyen、Lilian Weng、Eugene Yan、Sebastian Raschka。
- Builder / 工作室 / 开源团队种子：LangChain、LlamaIndex、Aider、OpenHands、Browser Use、CrewAI、Mem0、Composio、Continue、Pydantic AI、Mastra、DSPy、Langfuse、Ragas、Model Context Protocol 社区、Hugging Face Agents / Smolagents 社区。

### 中文社区 / 海外社区

- 海外核心社区种子：Hacker News、Reddit 中的高质量 AI / ML / Local LLM / programming 子社区、X / Twitter 高权威开发者与研究者网络、GitHub Discussions、Hugging Face community、Papers with Code、Lobsters、LessWrong / Alignment Forum、AI Engineer community、Latent Space community、OpenReview discussion、LangChain / LlamaIndex / MCP / Hugging Face / EleutherAI / LAION 等公开 Discord 或论坛。
- 中文核心社区种子：GitHub 中文开发者讨论、Hugging Face / ModelScope / OpenXLab / OpenMMLab 等模型与开源生态社区、V2EX 中高质量 AI / 编程讨论、少量可验证作者的个人技术博客或公众号。
- 中文高质量机构观察源：腾讯研究院 AI 速递。
- 中文观察源：InfoQ 中文、AI 科技评论、机器之心、量子位、智东西，只能作为新闻/宣传、机构观察或二级观察源。
- 中文排除或低权重源：知乎、掘金、CSDN、小红书、泛 Bilibili 技术内容、泛微信公众号精选源，默认不进入 V1 核心证据池。

### 政策监管机构 / 政策研究 / 智库

- 政策监管机构：OECD.AI、EU AI Office、European Commission、NIST、U.S. AI Safety Institute、UK AI Safety Institute、Federal Register、White House OSTP、FTC、SEC、China CAC、MIIT、MOST、NDRC、ISO / IEC JTC 1 SC 42。
- 政策研究与智库：CSET、Stanford AI Index、Stanford HAI、Brookings、RAND、OECD AI Policy Observatory、Center for AI Safety、Ada Lovelace Institute、Alan Turing Institute、Institute for AI Policy and Strategy、GovAI。

### 金融 / 资本 / 产业数据来源

- 开放与低成本金融数据：SEC EDGAR、OpenBB、FRED、公司 investor relations、上市公司 10-K / 10-Q / 8-K、年度报告、财报电话会 transcript、并购公告、公开招股书。
- 融资与并购核心 / proven 源：SEC EDGAR、公司 investor relations、Reuters、Bloomberg、The Information、Sifted、Dealroom、Crunchbase、PitchBook、CB Insights。
- 融资与并购 watch 源：TechCrunch、VentureBeat、Forbes、CNBC、36氪、钛媒体、晚点 LatePost。
- 产业研究与市场报告源：Gartner、Forrester、IDC、McKinsey、BCG、Bain、a16z、Sequoia、Lightspeed、Index Ventures、ARK Invest、ARK Big Ideas、Stanford AI Index。

### Seed monitoring tiers

完整 seed registry 不等于全量同频扫描。V1 必须给每个 seed 分配 `monitoring_tier`；对多轴主体，如不同 axis 需要不同频率或不同触发方式，必须再用 `axis_monitoring_overrides` 精细化：

| tier | 默认行为 | 可推动的作用 | 成本约束 |
| --- | --- | --- | --- |
| `core_monitor` | 进入默认 weekly 主动扫描；按 axis runtime budget 获取 canonical refs | 可直接参与候选发现、supporting evidence 和 trend audit | 消耗主扫描预算，必须优先配置 fallback |
| `watchlist` | 不保证每周主动扫；由触发信号、轮巡窗口或人工点名进入扫描 | 可用于补充覆盖、观察新主体和冷启动补证 | 只能消耗 watch/rotation 预算，不得挤占 core monitor 主预算 |
| `cold_archive` | 默认不主动扫；仅做低频健康检查、历史对齐和实体归一 | 用于历史 continuity、实体映射、已退潮主体复核 | 不得隐式变成常规主动扫描 |

冻结规则：

- V1 完成态要求完整 seed families 全部 materialize，但不要求全部进入 `core_monitor`。
- `watchlist` 或 `cold_archive` 的主体仍在 V1 覆盖边界内；它们只是默认扫描优先级更低，不得被实现阶段当作“后续再说”的借口。
- 任何从 `core_monitor` 降到 `watchlist` 或 `cold_archive` 的变更都必须保留 `change_reason` 和生效时间。
- 同一主体如果在不同 axis 上需要不同巡检强度，必须用 `axis_monitoring_overrides` 显式表达；不得用一个全局 tier 粗暴覆盖全部 axis。

成本和授权规则：

- Crunchbase、PitchBook、CB Insights、Bloomberg、Gartner、Forrester 等高成本或授权受限来源不得成为 V1 自动化硬依赖。
- 它们必须保留 registry 状态，并使用已冻结的 schema 字段组合表达：可选付费用 `access_mode="optional_paid"`，Agent 异步补证或待审用 `review_status="needs_review"`，人工授权例外用 `access_mode="human_exception"` 且 `human_exception_required=true`，不可用或未覆盖用 `access_mode="unavailable"` 或 `review_status="unavailable"`。
- `optional_paid`、`human_exception`、高成本数据库和登录态内容可以作为 `watchlist` 补证线索或人工复核材料，但不能成为 accepted event 的唯一 canonical source，也不能成为高权威轴的唯一 primary route。
