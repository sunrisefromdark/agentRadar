# 行业级 Agent 趋势判断：工具保障与 Seed Registry

> 本文档拆自 [行业级Agent趋势判断设计文档.md](../行业级Agent趋势判断设计文档.md)，是行业级 Agent 趋势判断设计文档包的一部分。

## 工具四级保障链路

每个证据轴必须记录 `primary_tool`、`secondary_toolset`、`fallback_tools`、`last_resort_mode`、`unavailable_state`。工具失败时，先走备用链路，最后才标注缺失或弱观察。

本节冻结的是工具治理语义，不冻结某个具体工具的永久优先级。`primary_tool / secondary_toolset / fallback_tools / last_resort_mode` 是能力层级；具体工具名称只是 V1 `tools.json` 的候选 seed，必须由 `registry-agent` 按轴评估后写入 tool registry snapshot。ExecPlan 不得把下表硬编码为固定调用顺序，也不得因为某个 seed 工具暂不可用就降低四级保障链路、工具覆盖报告或 unavailable 语义。

V1 工具候选 seed 如下：

| 证据场景 | primary_tool candidates | secondary_toolset candidates | fallback_tools candidates | last_resort_mode |
| --- | --- | --- | --- | --- |
| 跨平台搜寻与工具路由 | AgentReach、AutoSearch、mcp-omnisearch 中按轴评估最高者 | open-websearch、GPT Researcher | direct platform APIs、RSSHub、Crawl4AI、Firecrawl | 标注渠道 `unavailable` |
| 官方网页 / 文档 / changelog | Firecrawl、Crawl4AI | AgentReach、AutoSearch、mcp-omnisearch、open-websearch | Jina Reader、RSSHub、official sitemap / RSS | Playwright / Scrapy 定向抓取，标记 `last_resort` |
| 学术元数据 | Paper Search MCP、Open Deep Research、Local Deep Research | AutoSearch、GPT Researcher | OpenAlex、Semantic Scholar API、arXiv API、OpenReview API | 顶会或机构官方页面定向抓取 |
| 学术综合 / auto research | PaperQA / PaperQA2、Open Deep Research、GPT Researcher | Tongyi DeepResearch、dzhng/deep-research、Local Deep Research、OpenScholar | Paper Search MCP、OpenAlex、Semantic Scholar API、arXiv API、OpenReview API | 只输出文献列表和引用链 |
| 顶会 / benchmark | Paper Search MCP、Open Deep Research、agents-radar | AutoSearch、GPT Researcher | OpenReview、arXiv、Semantic Scholar、OpenAlex、Papers with Code、official proceedings / schedule / leaderboard | 官方网页抓取 |
| 开源项目与依赖生态 | agents-radar、AI Community Intelligence、AutoSearch | MorningAI、mcp-omnisearch、AgentReach | GitHub REST / GraphQL API、GH Archive、ecosyste.ms、Libraries.io、deps.dev | GitHub HTML 弱信号，不能单独升级 |
| 模型 / 数据集 / Space | agents-radar、AI Community Intelligence、AutoSearch | MorningAI、AgentReach | Hugging Face Hub API、`huggingface_hub`、ModelScope、OpenXLab、GitHub org | 网页抓取并降低权重 |
| 社区讨论 | AI Community Intelligence、agents-radar、AgentReach | AutoSearch、MorningAI、mcp-omnisearch | HN Algolia API、Reddit API、GitHub Discussions GraphQL、Hugging Face community、公开 Discord / forum | 只进入观察热度 |
| 大厂 / 产品发布 | MorningAI、AI Community Intelligence、agents-radar | AgentReach、AutoSearch、Open Deep Research | 官方 blog、RSS、release notes、API docs、GitHub org、Hugging Face org、RSSHub、Firecrawl、Crawl4AI、Jina Reader | 新闻转述仅辅助观察 |
| 政策 / 监管 | Open Deep Research、GPT Researcher、AutoSearch | AgentReach、mcp-omnisearch | Federal Register API、OECD.AI、SEC EDGAR、官方 gov / eu APIs、RSSHub、Crawl4AI、Jina Reader | 新闻或智库解读辅助解释 |
| 金融 / 资本 | OpenBB、Open Deep Research、GPT Researcher | AutoSearch、mcp-omnisearch、AgentReach | SEC EDGAR、company investor relations、公开财报和公告、GDELT、Reuters、Bloomberg、The Information、Sifted、Dealroom | TechCrunch、36氪等 watch 源作线索 |
| 全球新闻 / 叙事扩散 | MorningAI、AI Community Intelligence、agents-radar | AgentReach、AutoSearch、mcp-omnisearch、open-websearch | GDELT DOC / Context API、RSSHub、Firecrawl、Crawl4AI、Jina Reader | 标注新闻轴缺失或低置信观察 |

AgentReach 不是所有证据轴的天然首选。`registry-agent` 必须按证据轴评估工具适配度、维护活跃度、稳定性、输出结构化程度、引用可追溯能力、成本和授权风险。

工具 seed 维护规则：

- 下表中的工具名不构成产品语义，不得出现在趋势等级裁决逻辑中；裁决只能依赖 evidence event、authority、axis summary、tool route state 和 audit。
- `registry-agent` 可以新增、降级、替换或标记 seed 工具不可用，但必须保留 `replacement_tool_ids`、`unavailable_state`、成本/授权状态和变更原因。
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
  active_route_level:
    | "primary_tool"
    | "secondary_toolset"
    | "fallback_tools"
    | "last_resort_mode"
    | "none";
  active_tool_ids: string[];
  route_status: {
    primary_tool: ToolAvailabilityState;
    secondary_toolset: ToolAvailabilityState;
    fallback_tools: ToolAvailabilityState;
    last_resort_mode: ToolAvailabilityState;
  };
  unavailable_state?: {
    reason_code: string;
    since: string;
    affected_axes: IndustryEvidenceAxisKey[];
  };
  degraded: boolean;
  degradation_reason_codes: string[];
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
| `active_route_level` | route enum 或 `none` | 本次实际采用的工具层级。 | 必须选择最高可用层级；全部不可用时为 `none`。 |
| `active_tool_ids` | string[] | 本次实际产出证据的工具。 | `active_route_level="none"` 时必须为空；否则必须属于对应 route list。 |
| `route_status` | object | 四级 route 的可用状态。 | 每个 route level 都必须有状态，不能只报告 active route。 |
| `unavailable_state` | object optional | 完全不可用或关键缺失原因。 | `active_route_level="none"` 或 route 全部失败时必填。 |
| `degraded` | boolean | 本轴是否降级覆盖。 | 使用 secondary、fallback、last resort、partial 或 rate_limited 时必须为 true。 |
| `degradation_reason_codes` | string[] | 降级原因。 | `degraded=true` 时不能为空。 |
| `evidence_event_ids` | string[] | 该工具覆盖产生或支撑的 accepted events。 | 必须能在 daily pack 或 claim ledger 中找到。 |
| `rejected_event_ids` | string[] | 工具发现但被拒绝的 events。 | 必须有 rejected reason，不能静默丢弃。 |
| `registry_snapshot_ref` / `tool_registry_snapshot_ref` | string | 本报告所用 registry 快照。 | 必须与 weekly / daily artifact 中引用一致。 |
| `summary_cn` | string | 用户可读覆盖摘要。 | 只作解释，不得替代 route_status 和 event refs。 |

工具覆盖冻结规则：

- 每个 evidence axis 必须恰好输出一条 `AxisToolCoverageReport`。
- `AxisEvidenceSummary.tool_route_state.active_tool_ids` 必须能在 `AxisToolCoverageReport` 中找到对应 route。
- 全部工具链失败时，`active_route_level="none"`，对应轴为 `unavailable`，并写明 `unavailable_state.reason_code`。
- 使用 `secondary_toolset`、`fallback_tools` 或 `last_resort_mode` 时，`degraded=true`，weekly 必须让用户知道该轴本周是降级覆盖。
- `last_resort_mode` 产出的证据不得单独推动趋势升级，只能作为弱观察、补证线索或缺口说明。

## V1 Seed Registry 采用范围

本设计采用需求文档中的 V1 Seed Registry 作为 V1 完成态 registry，不允许缩减为热门公司、只实现部分轴、先落地最小子集，或把下列覆盖族降级为后续扩展项。以下覆盖族必须在 V1 materialize；新增前沿主体只能追加到该完整基线之上。

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

成本和授权规则：

- Crunchbase、PitchBook、CB Insights、Bloomberg、Gartner、Forrester 等高成本或授权受限来源不得成为 V1 自动化硬依赖。
- 它们必须保留 registry 状态，并使用已冻结的 schema 字段组合表达：可选付费用 `access_mode="optional_paid"`，Agent 异步补证或待审用 `review_status="needs_review"`，人工授权例外用 `access_mode="human_exception"` 且 `human_exception_required=true`，不可用或未覆盖用 `access_mode="unavailable"` 或 `review_status="unavailable"`。
