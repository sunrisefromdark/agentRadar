# AgentReach 外部发现与补证信号层设计草案

## 文档状态

- 状态：`Draft for Review`
- 对应需求：`docs/specs/product-specs/外部发现与补证信号层需求分析.md`
- 需求状态：`Frozen for Design`
- 设计范围：外部发现与补证信号层，即 `external discovery & evidence layer`
- 非目标：本设计不修改代码、不创建或更新 exec-plan、不扩大已冻结需求边界

## 0. 本轮设计结论

本轮先完成 Agent-Reach 信号源输入的设计冻结，不进入代码实现。实现阶段必须在本设计获得确认后再开始，且不得绕过本文边界直接改主链路。

V1 结论如下：

1. Agent-Reach 是外部信号 provider，`agent-trend-radar` 只消费它已经生成的结构化 JSON / artifact，不直接爬取 X / Twitter、Reddit、Hacker News 或官方网页。
2. Agent-Reach 输出进入独立的 external discovery 层，生成事件级 `ExternalSignalEvent` 和按日 `DailyExternalAggregate`，不直接写入现有 `RawSignal[]`。
3. 外部层只服务两类目标：发现 GitHub 尚未兴起的新观察候选，以及为已有项目补充“谁在讨论、讨论是否持续、是否跨平台”的次级证据。
4. 外部层不得改变现有主 score 公式，不得把社媒热度计入主源多源确认，也不得单独制造高置信主结论。
5. daily 可以展示项目级外部观察候选和已有项目补证摘要；weekly 可以消费最近 7 日按日 aggregate，用于方向级观察和趋势强化说明。
6. 外部层缺失、失败、部分失败时，daily / weekly 主产物必须继续生成，并在 run-summary / verify 中以 skipped / partial / failed 明确审计。
7. 设计落点建议优先固定 artifact contract、schema、adapter、aggregate 与审计字段的边界，再讨论 daily / weekly 展示层；具体执行顺序、阶段拆分和验证命令留给后续 exec-plan。

## 1. 背景与设计原则

`agent-trend-radar` 当前主链路是 `Signal -> Normalize -> Filter -> Action`：

- `Signal` 读取 agents-radar、Trendshift、GitHub realtime / enrichment、watchlist 等来源，并产出 `RawSignal`。
- `Normalize` 以 canonical GitHub repo 为主键归并为 `NormalizedProject`。
- `Filter / Scoring` 以 rules-first 的可解释组件计算 `ScoreBreakdown`。
- `Action` 产出 daily、weekly、run-summary、verify、KB、observer 等工件。

AgentReach 对应的新能力不是替换这条主链路，而是在主链路旁新增一层外部发现与补证信号层。该层的设计原则如下：

1. 外部层是次级判断信号，不是主裁决链路。
2. 外部层同时服务两类目标：新候选发现与已有候选补证。
3. GitHub / Trendshift 继续承担主源判断职责；外部层不得单独制造高置信主结论。
4. 外部层必须可降级；失效时 daily / weekly 主产物仍按现有语义生成。
5. 外部层必须保留事件级证据、按日聚合证据与 weekly 7 日窗口证据，避免把不可复现的社媒热度写成项目事实。
6. 外部层必须区分项目级对象与方向级观察信号；无法绑定明确 repo / paper 的信号不得伪装成项目级结论。

## 2. 外部层在现有系统中的边界

### 2.1 系统位置

外部层位于现有 `Signal` 与 `Action` 之间，但不应直接混入主 `RawSignal -> NormalizedProject -> ScoreBreakdown` 的主评分事实路径。

推荐逻辑位置：

```text
AgentReach provider / adapter
  -> ExternalSignalEvent[]
  -> DailyExternalAggregate
  -> Project-level ExternalEvidence / ObservationCandidate
  -> Direction-level ObservationCandidate
  -> daily / weekly consumption
```

主链路保持：

```text
Primary sources
  -> RawSignal[]
  -> NormalizedProject[]
  -> ScoredProject[]
  -> DailyReport / WeeklyReport / RunSummary
```

外部层可以读取主链路产物进行匹配和补证，但不能反向覆盖主源事实。

### 2.2 权限边界

外部层可以：

- 为已有项目生成 `ExternalEvidence`。
- 为尚未被主源确认的新对象生成 `ObservationCandidate`。
- 为无法绑定 repo / paper 的方向讨论生成方向级 `ObservationCandidate`。
- 为 daily 提供“外部发现候选”“外部补证摘要”“外部层参与状态”。
- 为 weekly 提供“方向级讨论强化”“跨平台确认”“持续性证据”。
- 以受限、可解释、有上限的方式影响观察优先级或待补证排序。

外部层不得：

- 替代 GitHub / Trendshift 成为主裁决来源。
- 单独把对象升级为高置信主趋势、高分推荐或正式主结论。
- 把 Twitter / Reddit / HN 热度等同于项目质量或成熟度。
- 编造 repo、paper、指标、作者身份、tier 或跨平台确认。
- 将 GitHub 再次纳入本需求的外部平台范围。
- 将 YouTube、Bilibili、播客、微信公众号、长视频或长内容平台纳入 V1 正式链路。

### 2.3 与 `RawSignal` 的关系

V1 不建议把 AgentReach 事件直接扩展为现有 `RawSignal.source` 的主源成员并进入主评分路径。原因：

- 当前 `RawSignal` 要求 `repo_url`，而外部层需要支持无法绑定 repo / paper 的方向级观察。
- 当前 `discussion_score` 依赖 `NormalizedProject.sources` 与 `appearances`，如果把外部社媒事件直接作为主 `source`，容易把外部噪声误计为主源多源确认。
- 外部层表达的是外部讨论证据，不是项目结构化事实。

因此 V1 应引入独立的 `ExternalSignalEvent`、`ExternalEvidence` 与 `DailyExternalAggregate`，并在 daily / weekly 消费层显式合并展示。未来如果要让外部层参与 scoring，应先通过受限的 `external_evidence` 解释字段或独立 score component 设计，并同步更新 scoring spec、config、测试；不应隐式改造现有 `discussion_score`。

## 3. Agent-Reach provider / adapter 接入方式

### 3.1 Provider / Adapter 分层

AgentReach 在本设计中被视为 external provider，不是直接内嵌 crawler。推荐分为两层：

1. `provider`：负责取得 AgentReach 输出。V1 固定读取结构化 JSON artifact；不要求系统直接调用 X / Reddit / HN / web search API。
2. `adapter`：负责把 provider 输出校验、标准化、去重并转换成 `ExternalSignalEvent[]`。

V1 provider 边界固定如下：

- AgentReach 是 V1 唯一 external provider。
- 多 provider registry、provider priority、provider merge / conflict resolution 均属于未来扩展，不进入 V1 exec-plan。
- V1 adapter 只接受 `provider="agent-reach"` 且 `schema_version="agent-reach.external-discovery.v1"` 的本地 JSON artifact。
- 如果未来引入其他 provider，必须新增 provider contract、去重规则、冲突规则、审计字段和结构测试，不能复用 AgentReach V1 contract 隐式接入。

推荐模块边界：

```text
src/signal/externalDiscovery/
  agentReachProvider.ts       # 读取 AgentReach 本地 JSON artifact
  externalSignalSchema.ts     # 校验 ExternalSignalEvent 输入边界
  externalSignalAdapter.ts    # provider output -> canonical events
  externalAggregate.ts        # events -> daily aggregate / 7-day window material
  externalEntityRegistry.ts   # tier registry lookup
```

具体文件名可在 exec-plan 阶段调整；设计层只固定职责边界。

### 3.2 输入方式

V1 冻结为读取 AgentReach 生成的本地 JSON artifact。该 artifact 默认为 local-only 输入，可以由本地运行 AgentReach 后生成，也可以由协作者显式放入本地工作区；`agent-trend-radar` 在 V1 不直接调用 AgentReach HTTP API、CLI，也不直接调用 X / Reddit / HN / official source 的平台 API。

在 OSS 仓库中，AgentReach raw input 不应作为公开历史数据自动提交。若需要提交示例输入，只能提交经过脱敏的 public-safe fixture，并必须满足第 3.6 节与第 12 节的公开 artifact 边界。

推荐输入路径：

```text
data/raw/external-discovery/YYYY-MM-DD.agent-reach.json
data/raw/external-discovery/latest.agent-reach.json
```

该输入属于外部层 raw artifact，不是现有 `data/raw/YYYY-MM-DD.json` 主 raw signal 文件的替代品。HTTP API provider、AgentReach CLI direct invocation、远程拉取 latest artifact 均属于未来扩展，不属于 V1 exec-plan 范围。

V1 启用与输入发现规则：

- 外部层在 daily / weekly 中默认启用为 optional secondary layer。
- daily 默认读取 `data/raw/external-discovery/YYYY-MM-DD.agent-reach.json`；如果显式配置输入路径，则读取该路径。
- weekly 不直接读取 provider raw input，而是读取 7 日窗口内已生成的 `DailyExternalAggregate[]`。
- 默认输入文件缺失且未显式指定输入路径时，provider status 为 `skipped`，`status_reason=input_missing`，主 daily / weekly 继续。
- 显式指定输入路径但文件缺失、不可读或 JSON 不可解析时，provider status 为 `failed`，主 daily / weekly 继续，但 run-summary / verify 必须记录失败原因。
- GitHub Actions 默认不得上传或提交 `data/raw/external-discovery/` 下的 provider raw input；唯一例外是文件明确标记为 sanitized fixture，且通过 public-safe / redaction 验证。
- V1 runtime contract 固定包含 `--no-external-discovery` 与 `--external-discovery-input <path>` 两个 CLI flag；实现阶段必须同步 `cli-runtime.md`、README 和结构测试。

Provider 输入 artifact 应至少包含以下设计级 contract；其中 `ExternalPlatform`、`ExternalProviderStatus` 等枚举语义见后文数据模型与状态定义：

```ts
interface AgentReachProviderArtifact {
  schema_version: "agent-reach.external-discovery.v1";
  provider: "agent-reach";
  provider_run_id?: string;
  generated_at: string;
  coverage_window: {
    start: string;
    end: string;
  };
  platforms: ExternalPlatform[];
  status: ExternalProviderStatus;
  items: AgentReachProviderItem[];
  diagnostics?: {
    query_count?: number;
    rate_limited_platforms?: ExternalPlatform[];
    partial_platforms?: ExternalPlatform[];
    warnings: string[];
  };
}

interface AgentReachProviderItem {
  raw_ref?: string;
  platform: string;
  source_published_at?: string;
  observed_at: string;
  url?: string;
  title?: string;
  text?: string;
  actor?: {
    display_name?: string;
    handle?: string;
    profile_url?: string;
    type_hint?: string;
    tier_hint?: string;
  };
  target?: {
    name?: string;
    url?: string;
    repo_url?: string;
    paper_url?: string;
    topic_hint?: string;
  };
  metrics?: Record<string, number>;
  tags?: string[];
}
```

该 artifact 是 provider 边界，不是系统内部事实边界。Adapter 必须把其中的自由文本、平台名、actor hint、target hint 校验并转换为 canonical `ExternalSignalEvent`；不能把 `provider_tier_hint` 原样当作 tier、repo 绑定或跨平台确认事实。若 provider 只提供一个时间字段，adapter 必须明确映射为 `observed_at`，不得伪装成 `source_published_at`。Provider item 的 `url` 与 `raw_ref` 至少应存在一个，以便转换后的 canonical event 仍可追溯。

### 3.3 Provider 状态

Provider 必须返回结构化状态：

```ts
type ExternalProviderStatus =
  | "ok"
  | "skipped"
  | "partial"
  | "failed";
```

状态语义：

- `ok`：输入存在、schema 合法、至少成功产出一条事件或明确产出空事件。
- `skipped`：外部层被显式关闭，或默认输入路径不存在且用户未显式指定输入路径；`dry-run` 只报告 planned reads / writes，不改变该语义。
- `partial`：provider artifact 可解析且部分事件可用，但部分事件因 schema、platform、target、URL/raw ref 或 tier 错误被拒绝。
- `failed`：显式输入路径缺失 / 不可读、JSON 不可解析、artifact 顶层 schema 非法、或 provider artifact 声称 ok 但缺少必要审计字段；该失败不得阻断主 daily / weekly。

### 3.4 不直接接平台 API 的原因

V1 不设计直接爬取 X / Reddit / HN / 官方网页的采集器，原因：

- 平台 API 与页面结构漂移会显著提高失败率。
- X / Reddit 等平台存在认证、限流、成本和条款风险。
- 当前需求目标是设计外部发现与补证层，不是替代 AgentReach 构建全量外部采集系统。
- 结构化 AgentReach 输出更符合可审计、可回放、可降级的仓库契约。

### 3.5 CLI command matrix

V1 必须把 external discovery 的 CLI 语义固定到命令级，避免实现阶段把 raw input 读取范围扩大到 weekly 或 verify。

| 命令 | 是否读取 external raw input | 是否生成 `DailyExternalAggregate` | `--external-discovery-input <path>` | `--no-external-discovery` | dry-run 行为 |
| --- | --- | --- | --- | --- | --- |
| `run-daily` | 是。默认读取 `data/raw/external-discovery/YYYY-MM-DD.agent-reach.json`；显式路径优先 | 是。生成当日 aggregate 与 audit，但不得写入 raw input | 允许。路径缺失 / 不可读 / JSON 不可解析时 status=`failed` | 允许。跳过读取与聚合，status=`skipped`，`status_reason=disabled_by_flag` | 只报告 planned reads / planned writes，不写入 aggregate 或 latest 指针 |
| `recover-daily` | 否，除非显式传入 `--external-discovery-input <path>` | 仅在显式输入时重建；默认只恢复已有 external aggregate 状态引用，不从默认 raw 路径补抓 | 允许。仅用于显式重建当日 aggregate；失败语义同 `run-daily` | 允许。恢复产物中外部层状态为 `skipped` | 只报告 planned recovery，不写入 external artifact |
| `run-weekly` | 否。只能读取 7 日窗口内已存在的 `DailyExternalAggregate[]` | 否。只消费 daily aggregate，不生成 provider raw 或 daily aggregate | 不允许。传入即参数错误，CLI 必须 fail-fast，不生成 weekly artifact，且不得继续执行 | 允许。weekly external window status 标记为 `skipped`，主 weekly 继续 | 只报告 planned 7 日 aggregate reads / weekly writes，不写入 weekly artifact |
| `verify-daily` | 否。只读取 daily report、run-summary、verify 目标和当日 aggregate | 否 | 不允许。传入即参数错误，CLI 必须 fail-fast，不写入 verify artifact，且不得继续执行 | 允许。只验证主 daily，并对外部层缺失输出 warn | 只报告 planned verification result，不写入 verify artifact |

固定语义：

- 默认输入缺失且用户未显式指定输入路径时，status 必须为 `skipped`，`status_reason=input_missing`。
- 显式输入路径缺失、不可读或 JSON 不可解析时，status 必须为 `failed`。
- weekly 永远不得直接读取 provider raw input；weekly 的 external evidence 只能来自 7 日 `DailyExternalAggregate[]`。
- `run-weekly` 与 `verify-daily` 收到 `--external-discovery-input <path>` 时必须 fail-fast，避免用户误以为 weekly / verify 会直接消费 provider raw input。
- `--external-discovery-input <path>` 不得暗示系统会调用 AgentReach、平台 API、远程 latest artifact 或任何登录态采集能力。

### 3.6 OSS / Public Artifact Boundary

AgentRadar OSS 是去登录的公开版本：无登录、无注册、无 OAuth、无 session / account settings，本地 Web Console 以只读浏览已生成产物为边界。外部发现层不得重新引入任何账号态、私有配置或平台登录依赖。

OSS V1 必须冻结以下公开边界：

- 开源版不保存、不读取、不暴露登录态数据、cookie、session、OAuth、账号配置、平台 API 凭据或私有 provider diagnostics。
- AgentReach raw input 默认为 local-only 输入，不应作为公开历史数据提交，也不得被默认 GitHub Actions 自动上传。
- 如需提交示例数据，只能提交 sanitized fixture。fixture 不得包含平台原文全文、未脱敏 handle、`profile_url`、cookie / token / session / password / OAuth 字样、私有 query、私有限流细节或不可公开的 provider diagnostics。
- Public aggregate 只能保留摘要、计数、稳定 evidence id、`source_input_hash`、平台枚举、状态、reason code 与可审计警告；不得保留 raw social text、完整原文、profile URL、未脱敏 handle 或可反推出私有查询的 raw ref。
- `content_text`、provider raw `text`、`actor.platform_profile_url`、provider `actor.profile_url` 等字段可以存在于 local raw / local canonical 处理边界，但不得进入公开可提交的 aggregate。
- 公开 artifact 必须能通过 public-safe / redaction 验证；验证失败时不得提交，也不得被 daily / weekly 当作可消费 external layer。

## 4. 数据模型

以下模型为设计级 contract，字段命名可在实现阶段按 TypeScript 风格微调，但语义不得漂移。

### 4.1 `ExternalSignalEvent`

`ExternalSignalEvent` 是底层事件级事实，表达“一次外部提及、发布、讨论或补证”。

```ts
type ExternalPlatform = "x_twitter" | "reddit" | "hacker_news" | "official_web" | "official_blog";

type ExternalSignalKind = "discovery" | "evidence";

type ExternalRawEventKind = "mention" | "discussion" | "official_release" | "blog_post" | "question" | "showcase" | "unknown";

type ExternalTargetType = "project" | "paper" | "product" | "topic";

type ExternalActorType = "institution" | "team" | "person" | "community" | "unknown";

type ExternalActorTier = "core" | "proven" | "watch" | "ordinary" | "unknown";

type ExternalRegistryTier = "core" | "proven" | "watch";

type ExternalProviderTierHint = "core" | "proven" | "watch" | "ordinary" | "unknown";

interface ExternalSignalEvent {
  event_id: string;
  provider: "agent-reach";
  platform: ExternalPlatform;
  raw_event_kind: ExternalRawEventKind;
  derived_signal_kinds: ExternalSignalKind[];
  source_published_at?: string;
  observed_at: string;
  ingested_at: string;
  event_url?: string;
  content_text?: string;
  content_title?: string;
  language?: string;

  actor: {
    display_name?: string;
    handle?: string;
    platform_profile_url?: string;
    actor_type: ExternalActorType;
    registry_entity_id?: string;
    registry_tier?: ExternalRegistryTier;
    provider_tier_hint?: ExternalProviderTierHint;
    effective_tier: ExternalActorTier;
    tier_basis: "registry" | "registry_miss" | "unknown";
  };

  target: {
    target_type: ExternalTargetType;
    name: string;
    url?: string;
    repo_url?: string;
    paper_url?: string;
    canonical_key?: string;
    topic_key?: string;
    binding_confidence: "high" | "medium" | "low" | "unbound";
  };

  metrics?: {
    likes?: number;
    reposts?: number;
    comments?: number;
    upvotes?: number;
    replies?: number;
  };

  tags: string[];
  raw_ref?: string;
  notes: string[];
}
```

关键约束：

- `platform` 只能来自 V1 白名单。
- `raw_event_kind` 保留 AgentReach 对原始事件类型的归类；`derived_signal_kinds` 是本系统基于 target 绑定、主源匹配和消费语义派生出的 discovery / evidence。
- `derived_signal_kinds` 至少包含一个值，允许同一事件同时是 `discovery` 与 `evidence`；例如官方发布页首次引入新项目，同时也补证已有方向。
- `source_published_at` 表示平台原文发布时间；`observed_at` 表示 AgentReach 观测时间；`ingested_at` 表示本系统接收时间，三者不得混写。
- `event_url` 与 `raw_ref` 至少存在一个；公开 URL 不可用时必须保留可追溯的 provider raw reference。
- `target.target_type=topic` 时允许没有 `repo_url` / `paper_url`，但必须有 `topic_key`，且只能进入方向级观察路径。
- `effective_tier=core/proven/watch` 只能来自维护名单命中，即 `tier_basis=registry`；`provider_tier_hint` 只能进入审计或待维护提示，不能产生 core / proven / watch，也不得参与头部讨论统计。
- `metrics` 是互动强度证据，不是项目质量事实。

### 4.2 `ExternalEvidence`

`ExternalEvidence` 是给项目级或方向级消费的外部证据摘要。该模型只表达外部讨论与补证信号，不等同于 `ScoreComponent.evidence`、`WeeklyEvidenceProject` 或项目成熟度事实。

```ts
interface ExternalEvidence {
  evidence_id: string;
  event_ids: string[];
  scope: "project" | "direction";
  target_key: string;
  derived_signal_kinds: ExternalSignalKind[];
  platforms: ExternalPlatform[];
  actor_tiers: Partial<Record<ExternalActorTier, number>>;
  actor_types: Partial<Record<ExternalActorType, number>>;
  mention_count: number;
  distinct_actor_count: number;
  first_seen_at: string;
  last_seen_at: string;
  active_day_count: number;
  cross_platform: boolean;
  authority_summary_cn: string;
  intensity_summary_cn: string;
  persistence_summary_cn: string;
  caveats: string[];
}
```

`actor_tiers` 必须按事件 actor 的 `effective_tier` 聚合，不能按 `provider_tier_hint` 聚合。若 registry 未命中，作者只能计入 `ordinary` 或 `unknown`。

### 4.3 `ObservationCandidate`

`ObservationCandidate` 是外部层可以生成但不能直接升级为主结论的观察对象。

这里的 `ObservationCandidate` 指外部发现观察候选、项目候选或方向候选，不对应 `src/agentMemory/candidate.ts` 中的开发任务候选。

```ts
interface ObservationCandidate {
  candidate_id: string;
  scope: "project" | "direction";
  candidate_kind: "new_external_discovery" | "needs_confirmation" | "external_evidence_boost" | "direction_watch";
  target_key: string;
  display_name: string;
  repo_url?: string;
  paper_url?: string;
  topic_key?: string;
  binding_confidence: "high" | "medium" | "low" | "unbound";
  evidence_ids: string[];
  evidence_summary_cn: string;
  qualification: "observe" | "needs_primary_confirmation" | "supporting_evidence_only";
  can_enter_daily: boolean;
  can_enter_weekly: boolean;
  cannot_be_primary_conclusion: true;
  caveats: string[];
}
```

约束：

- 仅外部层发现且尚未被主源确认的项目级候选，应标记为 `needs_primary_confirmation`。
- 方向级候选必须标记 `scope=direction`，并说明“尚未绑定明确 repo / paper”。
- `cannot_be_primary_conclusion` 固定为 `true`，用于防止消费层误升格。

### 4.4 `DailyExternalAggregate`

`DailyExternalAggregate` 是按日聚合结果，供 daily、run-summary、verify 和 weekly 7 日窗口读取。文档中不得将其简写为 `DailyAggregate`，避免与现有 daily report / daily artifacts 混淆。

```ts
interface DailyExternalAggregate {
  schema_version: "external-discovery.aggregate.v1";
  date: string;
  generated_at: string;
  provider: "agent-reach";
  provider_run_id?: string;
  status: ExternalProviderStatus;
  status_reason?: string;
  source_input_ref?: string;
  source_input_hash?: string;
  public_safe: boolean;
  redaction_policy_version: string;
  contains_raw_text: false;
  contains_profile_urls: false;

  event_count: number;
  accepted_event_count: number;
  rejected_event_count: number;
  platform_counts: Partial<Record<ExternalPlatform, number>>;
  derived_signal_kind_counts: Partial<Record<ExternalSignalKind, number>>;

  project_evidence: ExternalEvidence[];
  direction_evidence: ExternalEvidence[];
  observation_candidates: ObservationCandidate[];

  audit: {
    rejected_events: Array<{
      raw_ref?: string;
      reason_code: string;
      reason_detail: string;
    }>;
    warnings: string[];
  };
}
```

公开可提交的 `DailyExternalAggregate` 必须满足：

- `public_safe=true`。
- `contains_raw_text=false`。
- `contains_profile_urls=false`。
- `redaction_policy_version` 指向稳定脱敏策略版本，例如 `external-discovery-redaction.v1`。
- `source_input_hash` 必须存在，用于追溯 local raw input，而不是把 raw input 原文沉进公开 aggregate。

`derived_signal_kind_counts` 按 `derived_signal_kinds` 展开计数，因此当同一事件同时具备 discovery 与 evidence 语义时，`derived_signal_kind_counts.discovery + derived_signal_kind_counts.evidence` 可以大于 `accepted_event_count`。消费层不得用该字段反推事件总数。

推荐 artifact：

```text
data/external-discovery/YYYY-MM-DD.aggregate.json
data/external-discovery/latest.aggregate.json
```

最终目录名可在 exec-plan 中按仓库结构微调；但设计上必须区分 local raw input、sanitized canonical events 与 public daily aggregate，并同步 `.gitignore`、`data/README.md`、GitHub Actions artifact path 和结构测试。

## 5. V1 平台边界

### 5.1 平台白名单

V1 只支持以下平台：

| 平台 | 枚举 | 作用 |
| --- | --- | --- |
| X / Twitter | `x_twitter` | 讨论、发现、头部个人 / 团队传播信号 |
| Reddit | `reddit` | 社区讨论、问题语境、早期扩散 |
| Hacker News | `hacker_news` | 技术社区讨论、产品 / repo / blog 传播 |
| 官方网页 | `official_web` | 发布确认、项目主页、机构说明 |
| 官方博客页 | `official_blog` | 发布确认、版本说明、团队叙事补证 |

`official_web` 与 `official_blog` 是 `official source family` 内部的两种内容形态拆分，用于区分项目主页 / 机构页面与博客 / release note 的证据语义；它们不代表扩大 V1 平台边界，也不允许把任意长内容平台、视频平台或公众号纳入正式链路。

### 5.2 明确不在 V1 范围

以下来源不进入 V1 正式链路：

- YouTube
- Bilibili
- 播客
- 微信公众号
- 长视频平台
- 长内容平台
- GitHub 作为外部层平台

如果 AgentReach provider 输出这些平台，adapter 应拒绝或标记为 rejected event，不能静默吞入正式 aggregate。

## 6. 项目级匹配与方向级观察信号

### 6.1 项目级匹配

项目级匹配目标是把外部事件关联到已有 `NormalizedProject` 或生成待确认观察候选。

匹配优先级：

1. 精确 GitHub repo URL：规范化为 `https://github.com/<owner>/<repo>`，与 `NormalizedProject.repo_url` / `repo_full_name` 匹配。
2. 明确 paper URL / product URL：生成 `canonical_key`，但不得伪装成 GitHub 项目。
3. 官方网页 / 博客中的 repo 链接：可作为 `repo_url` 绑定证据，但必须记录来源事件。
4. 名称相似匹配：仅可生成 `binding_confidence=low/medium` 的候选，不得自动并入已有项目，除非有 URL 佐证。

匹配结果：

- 命中已有项目：生成 `ExternalEvidence(scope=project)`，用于补证。
- 未命中但有明确 repo / paper / product：生成 `ObservationCandidate(scope=project, needs_primary_confirmation)`。
- 未命中且只有模糊名称：保留为 rejected 或 low-confidence candidate，默认不进入 daily 主展示。

### 6.2 方向级观察

方向级观察用于无法绑定明确 repo / paper，但具有趋势语义的外部讨论，例如：

- agent memory
- runtime / sandbox
- MCP skills / tools
- browser automation agents
- multi-agent workflow
- coding agent eval / governance

方向级事件必须满足：

- `target.target_type=topic`
- `target.topic_key` 存在
- `binding_confidence=unbound` 或非 high
- 明确标注“尚未绑定明确 repo / paper”

V1 `topic_key` canonicalization 固定按以下优先级执行：

1. 命中现有 `userInterestProfile.topics[].name` 时，直接使用该 topic name。
2. 命中现有 weekly trend key / paradigm label 时，使用现有 trend key 或规范化后的 paradigm key。
3. AgentReach provider 提供明确 `topic_hint` 时，adapter 可将其规范化为小写 kebab-case `topic_key`，并保留原始 hint 作为 evidence note。
4. 无法得到稳定 `topic_key` 的方向事件不得进入 weekly direction observation，只能 rejected 或保留为 raw audit evidence。

方向级候选进入 weekly 前，V1 必须按固定收敛规则判断，不得由实现阶段临时决定。

收敛条件定义：

- `cross_platform_confirmation`：同一 `topic_key` 在至少 2 个 V1 平台出现。
- `multi_actor_confirmation`：同一 `topic_key` 至少有 2 个独立 actor 讨论。
- `multi_day_persistence`：同一 `topic_key` 在 weekly 7 日窗口内至少 2 个不同日期出现。
- `registry_tier_participation`：同一 `topic_key` 至少有 1 个 registry 命中的 `core / proven / watch` actor 参与。

进入 weekly direction observation 的 V1 门槛：

- 满足上述 4 个条件中的至少 2 个，才可设置 `ObservationCandidate(scope=direction, can_enter_weekly=true)`。
- 如果只满足 1 个条件，只能保留为 `DailyExternalAggregate.direction_evidence` 或低置信 audit evidence，不进入 weekly direction observation。
- 如果没有条件满足，必须 rejected 或仅作为 raw event 审计留存。
- `provider_tier_hint` 不计入 `registry_tier_participation`；只有 registry 命中的 `effective_tier=core/proven/watch` 才可计入。

方向级候选不得：

- 进入项目级 score。
- 生成 repo 级 KB card。
- 成为高置信正式主趋势结论。
- 在 daily 中伪装成“今日新项目”。

## 7. “谁在讨论”的 tier 维护与判断

### 7.1 Entity Registry

V1 需要维护外部讨论者实体名单，覆盖机构、团队、个人三类主体。

推荐 artifact：

```text
data/external-discovery/entity-registry.json
```

V1 允许 entity registry 空启动。空 registry 不阻塞 external discovery 层运行，但会产生以下语义：

- 所有未命中 registry 的 actor 只能计入 `ordinary` 或 `unknown`。
- `registry_tier_participation` 条件不成立。
- `top_tier_actor_count` 必须为 0。
- run-summary / verify 应记录 `registry_empty` 或 `registry_miss` warning，提醒后续维护名单。

设计级结构：

```ts
interface ExternalEntityRegistryEntry {
  entity_id: string;
  display_name: string;
  actor_type: "institution" | "team" | "person";
  tier: "core" | "proven" | "watch";
  handles: Partial<Record<ExternalPlatform, string[]>>;
  profile_urls?: string[];
  notes: string[];
  updated_at: string;
}
```

### 7.2 Tier 语义

- `core`：对 Agent / AI infra 生态方向具有稳定影响力的机构、团队或个人。
- `proven`：历史上多次发现或推动高质量项目 / 方向的主体。
- `watch`：值得观察但尚未证明稳定影响力的主体。
- `ordinary`：未进入维护名单的普通讨论者。
- `unknown`：无法识别或缺少作者信息。

### 7.3 判断规则

- 只有 registry 命中的实体才可被判定为 `core/proven/watch`。
- AgentReach provider 可以提供 tier hint，但只能写入 `provider_tier_hint`，不能直接成为 `registry_tier` 或 `effective_tier=core/proven/watch`，也不能参与头部讨论统计。
- 未命中 registry 的作者默认 `ordinary` 或 `unknown`。
- 头部讨论判断必须是分层统计，不得压缩成 `is_top=true/false`。

## 8. 讨论强度、持续性、跨平台确认计算口径

### 8.1 事件采集

底层以 `ExternalSignalEvent` 为最小单位。每条事件必须包含：

- 平台
- 时间：`source_published_at`、`observed_at`、`ingested_at` 三者按可得性区分
- actor
- target
- raw event kind 与 derived signal kinds
- event URL 或 raw ref

### 8.2 按日聚合

每日聚合以 `date` 为窗口，默认按 `observed_at` 归入当日 `DailyExternalAggregate`。若 `source_published_at` 明显早于 `observed_at`，可在 evidence 中保留原始发布时间用于解释“旧内容被今日发现”，但不得把事件回写到历史 daily artifact。`ingested_at` 只用于审计和重放，不用于业务窗口归属。

每日聚合计算：

- `event_count`
- `accepted_event_count`
- `rejected_event_count`
- `mention_count`
- `distinct_actor_count`
- `platform_counts`
- `derived_signal_kind_counts`
- `project_evidence`
- `direction_evidence`
- `observation_candidates`

### 8.3 Weekly 7 日窗口

Weekly 消费最近 7 日 `DailyExternalAggregate`，窗口边界以 daily aggregate 的 `date` 为准，也就是沿用 daily 对 `observed_at` 的归属结果；weekly 不直接跳过日聚合重新按 `source_published_at` 或 `ingested_at` 统计。

Weekly 窗口计算：

- `active_day_count`：7 日内出现过事件的天数。
- `platform_count`：7 日内独立平台数。
- `distinct_actor_count`：7 日内独立 actor 数。
- `top_tier_actor_count`：core / proven / watch actor 数量及分布。
- `cross_platform=true`：同一 target 在至少两个 V1 平台独立出现。
- `persistence=true`：同一 target 在多个日期出现。

### 8.4 强度解释

讨论强度只表达外部讨论，不表达项目质量。

推荐分层：

- `low`：单平台、少量事件、普通 actor。
- `medium`：多 actor 或连续出现，但缺少跨平台 / tier 支持。
- `high`：跨平台、多 actor、连续多日或有 core / proven 参与。

即使外部强度为 `high`，也只能作为次级证据，不能单独成为主结论。

## 9. Daily 消费方式

Daily 中外部层优先服务“发现与补证”。

### 9.1 Daily 输入

Daily 读取当日 `DailyExternalAggregate`，并与当日 `ScoredProject[]` / `DailyReport` 做关联。

### 9.2 Daily 输出语义

Daily V1 必须固定一个 external discovery section。无论外部层是 `ok`、`skipped`、`partial` 还是 `failed`，该 section 都应存在，避免用户无法判断外部层是否参与。

Daily JSON / Markdown 的 V1 稳定区块建议命名为 `external_discovery`，至少包含：

```ts
interface DailyExternalDiscoverySection {
  external_layer_status: {
    provider: "agent-reach";
    status: ExternalProviderStatus;
    status_reason?: string;
    input_ref?: string;
    aggregate_ref?: string;
  };
  external_observation_candidates: ObservationCandidate[];
  external_project_evidence_summaries: ExternalEvidence[];
  external_direction_signal_summary: {
    candidate_count: number;
    evidence_count: number;
    top_topic_keys: string[];
    note_cn: string;
  };
  external_audit_summary: {
    event_count: number;
    accepted_event_count: number;
    rejected_event_count: number;
    platform_counts: Partial<Record<ExternalPlatform, number>>;
    derived_signal_kind_counts: Partial<Record<ExternalSignalKind, number>>;
  };
}
```

字段语义：

- `external_observation_candidates` 只放 `scope=project` 且 `can_enter_daily=true` 的外部观察候选；这些候选不得进入 `today_star_projects`。
- `external_project_evidence_summaries` 只放已匹配现有项目的补证摘要，用于项目卡片或 daily 外部补证区块。
- `external_direction_signal_summary` 只做方向级概览，daily 不生成方向级主结论。
- 当 provider status 为 `skipped` 或 `failed` 时，列表字段为空数组，`external_layer_status.status_reason` 必须说明原因。

### 9.3 对项目分组的影响

外部层不能直接把项目提升为 `today_star`。推荐影响方式：

- 已有项目获得外部补证：在项目卡片或报告中展示 `external_evidence_summary`。
- 外部发现但主源未确认：进入 `pending_confirmation` 或单独的“外部观察候选”区块。
- 方向级观察：daily 可简短提示，但主要进入 weekly 方向判断。

### 9.4 Run-summary 表达

`run-summary` 应记录：

- provider status。
- aggregate 文件路径。
- accepted / rejected event count。
- platform counts。
- observation candidate count。
- degraded / skipped / failed reason。

这与现有 `source_status` / `freshness_sources` 语义一致，但应明确标注为 external secondary layer，避免被误解为主 freshness-driving source。

## 10. Weekly 消费方式

Weekly 中外部层优先服务“趋势强化、跨平台确认、权威性判断”。

### 10.1 Weekly 输入

Weekly 读取 canonical 7 日窗口内的 `DailyExternalAggregate[]`。如果窗口缺失，应按外部层降级处理，不得阻断主 weekly。

### 10.2 Weekly 输出语义

Weekly V1 必须固定一个 external discovery window section，消费最近 7 日 `DailyExternalAggregate[]`，并把方向级观察与项目级补证分开表达。

Weekly JSON / Markdown 的 V1 稳定区块建议命名为 `external_discovery_window`，至少包含：

```ts
interface WeeklyExternalDiscoveryWindowSection {
  external_layer_window_status: {
    provider: "agent-reach";
    window_start: string;
    window_end: string;
    daily_statuses: Array<{
      date: string;
      status: ExternalProviderStatus;
      status_reason?: string;
      aggregate_ref?: string;
    }>;
    usable_day_count: number;
  };
  weekly_direction_observations: ObservationCandidate[];
  external_project_evidence_summaries: ExternalEvidence[];
  external_cross_platform_confirmations: Array<{
    target_key: string;
    scope: "project" | "direction";
    platforms: ExternalPlatform[];
    evidence_ids: string[];
  }>;
  external_window_audit_summary: {
    event_count: number;
    accepted_event_count: number;
    rejected_event_count: number;
    active_day_count: number;
    registry_tier_actor_count: number;
  };
}
```

字段语义：

- `weekly_direction_observations` 只包含满足第 6.2 节 V1 收敛门槛的 `scope=direction` 候选。
- `external_project_evidence_summaries` 只为 weekly 已有项目 / evidence cluster 提供补证，不创建高置信项目结论。
- `external_cross_platform_confirmations` 只表达跨平台外部讨论确认，不等同于主源多源确认。
- `external_layer_window_status` 必须保留每个 daily aggregate 的状态，窗口内部分缺失时仍可生成 weekly，但必须标注 usable day count。

### 10.3 趋势边界

Weekly 可以说：

- “该方向获得外部讨论强化”。
- “该项目在外部层出现跨平台补证”。
- “该方向仍为观察信号，尚未绑定明确 repo / paper”。

Weekly 不得说：

- “仅因外部讨论，该方向已经成为正式主趋势”。
- “仅因外部讨论，该项目就是高置信推荐”。
- “未绑定 repo / paper 的方向讨论已经等同于项目级结论”。

## 11. 外部层失效时的降级与审计表达

### 11.1 降级原则

外部层失效时：

- `run-daily` 主链路继续。
- `run-weekly` 主链路继续。
- daily / weekly 必须表达外部层未参与或参与不足。
- 不得伪造外部 evidence。
- 不得把外部层失败上升为主源失败。

### 11.2 降级状态

- `skipped`：未启用、无输入、显式跳过。
- `partial`：部分事件被拒绝，仍有可用 aggregate。
- `failed`：整体读取 / 解析失败，没有可用 aggregate。
- `ok`：读取成功，可能有 0 条事件，但状态可审计。

### 11.3 审计字段

Daily / weekly / run-summary 应至少能追溯：

- 输入文件路径或 provider ref。
- provider status。
- rejected events 数量与原因。
- unsupported platform 数量。
- unbound target 数量。
- registry miss 数量。
- partial / failed reason。

### 11.4 Verify 语义

`verify-daily` 对外部层应以 warn 为主，不应因外部层 skipped / failed 直接 fail 主 daily，除非：

- aggregate 文件存在但结构非法。
- daily 声称使用了外部层，但审计状态缺失。
- 外部层结果被错误混写为主源高置信结论。
- public aggregate 声称 `public_safe=true` 但包含未脱敏 raw 字段，例如 `content_text`、provider raw `text`、`profile_url`、未脱敏 handle、cookie、session、token、password 或 OAuth 字样。
- public aggregate 缺少 `redaction_policy_version`、`contains_raw_text=false`、`contains_profile_urls=false` 或 `source_input_hash` 中的必要公开安全字段。

## 12. Artifact contract 与目录规划

V1 设计上应区分三类 artifact，避免把 provider 原始输出、系统内 canonical event 和消费层 aggregate 混成一个文件。由于 OSS 仓库会公开提交 `data/` 下历史产物，本节同时冻结每类 artifact 的公开提交边界。

| 层级 | 推荐位置 | 语义 | 公开提交策略 | 消费方 |
| --- | --- | --- | --- | --- |
| local raw input | `data/raw/external-discovery/YYYY-MM-DD.agent-reach.json` | AgentReach 输出快照，可能包含 provider 原始字段、原文片段、actor hint 和 diagnostics | 默认 local-only，不得被 GitHub Actions 自动上传或提交；只有显式 sanitized fixture 可提交 | external adapter |
| canonical sanitized events | `data/external-discovery/YYYY-MM-DD.events.jsonl` 或 aggregate 内嵌 sanitized events | 系统校验后的 `ExternalSignalEvent` 脱敏视图，用于审计与重放 | 如保存 JSONL，必须标记 `public_safe=true`，且不得包含 raw social text、profile URL、未脱敏 handle 或私有 diagnostics | aggregate / tests / verify |
| public daily aggregate | `data/external-discovery/YYYY-MM-DD.aggregate.json` | `DailyExternalAggregate`，按日聚合后的公开消费契约 | 可公开提交，但必须通过 public-safe / redaction 验证 | daily / weekly / run-summary / verify |

推荐 `latest` 指针仅指向 aggregate：

```text
data/external-discovery/latest.aggregate.json
```

目录规划必须满足：

- provider raw input 可追溯，不能被 aggregate 覆盖，也不能被默认公开提交。
- canonical sanitized events 与 aggregate 至少保留 `schema_version`、`provider_run_id` 或 `source_input_hash` 中的一种稳定追溯字段；公开 artifact 必须优先使用 `source_input_hash` 追溯 local raw input。
- public aggregate 必须包含 `public_safe=true`、`redaction_policy_version`、`contains_raw_text=false`、`contains_profile_urls=false` 与 `source_input_hash`。
- raw input 不得被 GitHub Actions 默认上传或提交；如需要提交 fixture，文件名或 metadata 必须显式标记 sanitized fixture，并通过结构测试。
- dry-run 不得写入上述持久化目录；只能报告 planned writes。
- 如果未来引入 entity registry，registry 应作为独立 artifact 维护，不得塞进每日 aggregate。
- artifact 缺失应表达为 `skipped` 或 `failed`，不得生成看似成功但空审计的 aggregate。
- `.gitignore`、`data/README.md` 与 GitHub Actions artifact path 必须与本节目录语义一致；如果它们仍把 `data/raw/external-discovery/` 当作默认公开历史数据，结构测试必须失败。

## 13. 与现有类型和产物的接口边界

本节集中冻结外部层与当前实现类型的关系，防止后续实现把外部层隐式混入主链路。

| 现有对象 | V1 关系 | 禁止事项 |
| --- | --- | --- |
| `RawSignal` | 不直接扩展 `SignalSource`，外部事件不写入主 `RawSignal[]` | 不得让社媒事件参与主 `discussion_score` 多源确认 |
| `NormalizedProject` | 只读其 `repo_url` / `repo_full_name` / tags / paradigm 做项目级匹配 | 不得用外部事件反向覆盖主源 metrics、stars、appearances |
| `ScoreBreakdown` | V1 不改主 score 公式；仅可在消费层展示 external evidence | 不得新增未同步 spec / config / tests 的 score component |
| `DailyReport` | 可增加或预留外部观察候选、外部补证摘要、provider 状态 | 不得把外部候选直接塞进 `today_star_projects` 当作主源确认 |
| `WeeklyReport` | 可消费 7 日 `DailyExternalAggregate`，用于 weak signal / observing trend / evidence summary | 不得仅凭外部讨论生成正式高置信主趋势 |
| `DailyRunSummarySourceStatus` / run-summary | 应新增或映射 external secondary layer 状态、计数、失败原因 | 不得把外部层标为 freshness-driving primary source |
| `dailyVerification` | 应检查结构合法性、审计一致性和越权使用 | 不得因外部层 skipped / failed 直接判定主 daily 失败 |
| `storage/files.ts` 数据目录 | 后续实现若新增目录，应同步 `DATA_DIRS`、README 和结构测试 | 不得只在代码里新增目录而不更新 specs |

外部层允许影响“观察优先级”或“待补证排序”，但只能通过单独字段表达，例如：

```ts
interface ExternalPriorityHint {
  target_key: string;
  scope: "project" | "direction";
  reason: "top_tier_actor" | "cross_platform" | "persistent_discussion" | "official_confirmation";
  strength: "low" | "medium" | "high";
  capped: true;
}
```

该 hint 只能服务排序解释或展示优先级，不能被解释为主 score 加分。

## 14. 需要同步更新的 specs、README、验证脚本和产物目录

本设计获批并进入 exec-plan / 实现后，需要同步更新：

### 14.1 Specs

- `docs/specs/system-spec.md`：补充 external discovery & evidence layer 的系统边界与降级语义。
- `docs/specs/services/signal-ingestion.md`：补充 external provider / adapter 的 raw 输入、schema、失败语义。
- `docs/specs/services/normalization.md`：说明外部层不直接替代 repo canonical normalization，并定义项目级匹配边界。
- `docs/specs/services/scoring-engine.md`：如果外部层进入 scoring，必须新增明确组件或 evidence 边界；V1 若仅展示 evidence，也要说明不改主 score。
- `docs/specs/services/action-output.md`：补充 daily / weekly 外部发现、补证和方向级观察输出。
- `docs/specs/services/cli-runtime.md`：同步 `--no-external-discovery` 与 `--external-discovery-input <path>` 的 CLI 语义，并固定 `run-daily`、`recover-daily`、`run-weekly`、`verify-daily` 的命令级矩阵。
- `docs/specs/constraints/architecture-constraints.md`：补充外部层不得成为主裁决链路。
- `docs/specs/constraints/structure-tests.md`：补充新 source / external artifact / schema 的结构守护，以及 public-safe / redaction 守护。
- `docs/specs/feedback-loops/observability-contract.md`：补充 external event count、provider status、rejected events 等观测信号。
- `docs/specs/feedback-loops/failure-recovery-loop.md`：补充 AgentReach 失败、unsupported platform、registry miss 等恢复语义。

### 14.2 README / 运行说明

- `README.md`：说明 OSS 版无登录、无账号态 external discovery、raw input local-only、public aggregate 需脱敏。
- `README.en.md`：同步英文 OSS 边界、运行命令和 public artifact 策略。
- `README.zh-CN.md`：若继续作为中文入口或跳转页保留，需同步指向主 README 中的 external discovery OSS 边界。
- `data/README.md`：明确 `data/raw/external-discovery/` 默认不属于公开历史数据，只有 sanitized fixture 例外；说明 `data/external-discovery/*.aggregate.json` 的 public-safe contract。
- `.gitignore`：默认忽略 local-only external raw input，或通过结构测试确保只有 sanitized fixture 可提交。
- `.github/workflows/trend-radar-daily.yml`：不得默认 upload / commit external raw input；只允许上传 public aggregate 与 sanitized fixture。
- `.github/workflows/trend-radar-weekly.yml`：不得读取或上传 provider raw input；只消费 public daily aggregate window。
- 相关 deploy / automation 文档：仅当 GitHub Actions 或 systemd 自动化消费外部层时同步更新，并必须保留 OSS public-safe 边界。

以上同步项只在本设计获批后的 exec-plan / 实现阶段执行；本轮设计仅冻结要求，不修改这些文件。

### 14.3 验证脚本与测试

应增加或扩展：

- schema 测试：合法 / 非法 `ExternalSignalEvent`。
- adapter 测试：AgentReach provider output -> canonical events。
- aggregate 测试：按日聚合、平台计数、tier 计数、跨平台确认、持续性。
- matching 测试：repo URL 精确匹配、低置信名称匹配、方向级 unbound topic。
- daily 测试：外部层 ok / skipped / partial / failed 不破坏 daily。
- weekly 测试：7 日窗口消费 direction observation。
- direction gate 测试：方向级观察必须满足至少 2 个收敛条件才进入 weekly。
- status 测试：默认输入缺失为 skipped，显式输入缺失 / 不可解析为 failed。
- structure test：新增 source / artifact / spec 同步检查。
- verify-daily 测试：外部层缺失 warn、结构非法 fail、主链路不被外部失败拖垮。
- public-safe / redaction 测试：public aggregate 不得包含 `content_text`、provider raw `text`、`profile_url`、cookie、session、token、password、OAuth、未脱敏 handle 或私有 diagnostics。
- raw input 发布测试：`data/raw/external-discovery/` 不得被默认 commit / upload；只有显式 sanitized fixture 可进入公开历史。
- workflow path 测试：GitHub Actions artifact path 不得包含 local-only raw input；weekly workflow 不得读取 provider raw input。
- OSS boundary 测试：`data/README.md`、`.gitignore`、README 与 external artifact 策略不一致时结构测试失败。

### 14.4 产物目录

建议新增或保留以下目录语义：

```text
data/raw/external-discovery/        # local-only AgentReach provider 原始输入；仅 sanitized fixture 可公开提交
data/external-discovery/            # public-safe sanitized events / aggregate / latest 指针
data/external-discovery/entities/   # entity registry 或 tier registry，若拆分维护；公开版本不得包含私有账号态字段
```

最终目录名应在 exec-plan 阶段固定，并同步结构测试、README、`data/README.md`、`.gitignore` 与 GitHub Actions artifact path。

## 15. Requirement / Acceptance Traceability

本表用于把已冻结需求分析中的需求项与验收项映射到本设计章节。后续 exec-plan 不应新增隐式需求；如发现表中无法覆盖的项，应回到 Open Questions 或需求阶段处理。

| 冻结需求 / 验收项 | 设计覆盖章节 | 覆盖方式 |
| --- | --- | --- |
| 需求 1：区分外部发现信号与外部补证信号 | `4.1`、`4.2`、`4.3`、`9`、`10` | `derived_signal_kinds` 支持 discovery / evidence 多派生语义，`ObservationCandidate` 与 `ExternalEvidence` 分别承接发现和补证 |
| 需求 2：外部层参与 daily / weekly 但不替代主源 | `2`、`9`、`10`、`13` | 外部层只作为 secondary layer 被 daily / weekly 消费，不写入主 `RawSignal[]` 或主 score |
| 需求 3：支持“谁在讨论”的权威性判断 | `4.1`、`7`、`8` | actor type、registry tier、effective tier 与 tier 统计分离，provider tier hint 不产生正式头部判断，也不参与头部讨论统计 |
| 需求 4：支持讨论强度与持续性 | `4.2`、`4.4`、`8` | 事件级采集、按日 `DailyExternalAggregate`、weekly 7 日窗口、active day / actor / platform 统计 |
| 需求 5：支持跨平台确认语义 | `4.2`、`8`、`10` | `platforms`、`platform_counts`、`cross_platform` 与 weekly 趋势强化表达 |
| 需求 6：允许观察候选但不能制造高置信主结论 | `4.3`、`6`、`9`、`10`、`13` | `cannot_be_primary_conclusion=true`，方向级和项目级候选均受主源确认边界约束 |
| 需求 7：支持项目级与方向级对象 | `4.1`、`4.2`、`4.3`、`6` | `target_type`、`scope`、`topic_key` 与 `binding_confidence` 区分项目级匹配和方向级观察 |
| 需求 8：外部层失效时可降级 | `3.3`、`11`、`12`、`13` | `ok / skipped / partial / failed` 状态、审计字段、verify warn / fail 边界 |
| 验收 1：外部层正式参与判断但不与主源同级 | `2`、`9`、`10`、`13` | daily / weekly 可展示和消费外部层，但主链路和主 score 不被覆盖 |
| 验收 2：系统能更早发现新候选 | `4.3`、`6.1`、`9` | 外部 project candidate 可进入观察候选或 pending confirmation，而不是主结论 |
| 验收 3：系统能表达“谁在讨论” | `4.1`、`7`、`8` | actor type、registry tier、effective tier、actor tier count 与摘要字段共同表达 |
| 验收 4：系统能表达讨论强度是否持续 | `4.2`、`4.4`、`8` | mention、distinct actor、active day、platform count 与 weekly 7 日窗口口径 |
| 验收 5：weekly 能使用外部层强化趋势判断 | `6.2`、`8.3`、`10` | direction observation、weak signal / observing trend、cross-platform 与 persistence 支持 weekly |
| 验收 6：外部层失效时可降级 | `3.3`、`11`、`13` | 主 daily / weekly 继续，外部层状态和审计明确表达 |

## 16. Open Questions

以下问题不改写冻结需求，也不阻塞 V1 进入 exec-plan；V1 默认决策已在正文冻结，以下仅作为后续产品优化或未来扩展问题保留。

1. 未来是否需要支持 AgentReach HTTP API、CLI direct invocation 或远程 latest artifact 拉取？这些模式不属于 V1，若启用应另行设计 provider contract、认证、失败语义和测试 fixture。
2. entity registry 的长期维护责任、审核节奏和 tier 升降级流程如何设计？V1 允许空 registry 启动，未命中作者归为 `ordinary / unknown`。
3. 是否需要在 V1 之后建立独立 external topic registry？V1 已固定使用现有 user interest topics / weekly trend keys / provider topic hint 的优先级。
4. daily Markdown 的视觉呈现是否需要把 `external_discovery` 区块放在主榜前、主榜后还是附录？V1 JSON contract 已固定为独立 external discovery section。
5. 如果 AgentReach 输出官方网页 / 博客页并包含 GitHub repo 链接，该事件是否可以同时作为 `official_blog` 补证和项目级 discovery？设计倾向允许，但必须保留单一 event source，并用 `raw_event_kind` 与 `derived_signal_kinds` 明确原始事件类型和多派生语义的关系。
6. 是否需要在 V1 之后增加 env / config 文件层面的默认输入路径配置？V1 runtime contract 已固定 `--no-external-discovery` 与 `--external-discovery-input <path>` 两个 CLI flag。

## 17. 明确非目标

- 不实现 X / Twitter、Reddit、Hacker News、官方网页 / 博客的直接爬虫。
- 不接入 YouTube、Bilibili、播客、微信公众号或长内容平台。
- 不把 GitHub 纳入外部层平台。
- 不在 OSS 版保存、读取或暴露登录态数据、cookie、session、OAuth、账号配置、平台 API 凭据或私有 provider diagnostics。
- 不把 AgentReach raw input、raw social text、profile URL 或未脱敏 handle 作为默认公开历史数据提交。
- 不改变现有主 score 公式。
- 不新增未同步 spec / config / tests 的 score component。
- 不让 LLM 直接决定外部层是否构成主趋势。
- 不创建或更新 exec-plan，直到设计获得明确批准。

## 18. 设计自检清单

后续 review 本设计或基于本设计创建 exec-plan 前，应逐项确认：

- 是否仍然保持外部层为次级判断信号，而不是主裁决链路。
- 是否明确 AgentReach 是 provider / artifact 输入，不是本仓库直接平台 crawler。
- 是否明确 OSS 版无登录、无账号态 external discovery，不读取或保存 cookie、session、OAuth、账号配置、平台 API 凭据或私有 diagnostics。
- 是否明确 AgentReach raw input 默认为 local-only，默认不得被 GitHub Actions 上传或提交。
- 是否明确只有 sanitized fixture 可以作为示例输入提交，且不得包含平台原文全文、未脱敏 handle、profile URL、cookie、token、session、password、OAuth 或私有 diagnostics。
- 是否明确 AgentReach 是 V1 唯一 external provider，多 provider 属于未来扩展。
- 是否固定外部层默认启用、默认输入缺失为 `skipped`、显式输入失败为 `failed`。
- 是否固定 V1 CLI runtime contract：`--no-external-discovery` 与 `--external-discovery-input <path>`。
- 是否固定 `run-daily`、`recover-daily`、`run-weekly`、`verify-daily` 对 external raw input、aggregate、dry-run 与两个 external flags 的命令级语义。
- 是否明确 weekly 只读 7 日 `DailyExternalAggregate[]`，不得直接读取 provider raw input。
- 是否同时覆盖 discovery 与 evidence 两种语义。
- 是否允许单个 `ExternalSignalEvent` 通过 `derived_signal_kinds` 同时具备 discovery 与 evidence，而不是被单值 `signal_kind` 限死。
- 是否区分 `source_published_at`、`observed_at` 与 `ingested_at`，避免把发布时间、观测时间和入库时间混写。
- 是否要求 `event_url` 与 `raw_ref` 至少存在一个，确保外部事件可追溯。
- 是否保留事件级 `ExternalSignalEvent`、证据级 `ExternalEvidence`、按日 `DailyExternalAggregate` 和候选级 `ObservationCandidate` 的边界。
- 是否明确 V1 平台白名单，并拒绝 GitHub、视频、播客、微信公众号和长内容平台进入正式链路。
- 是否区分项目级匹配与方向级观察，且方向级观察不能伪装成项目级结论。
- 是否明确方向级观察进入 weekly 必须满足 4 个收敛条件中的至少 2 个。
- 是否要求 `effective_tier=core/proven/watch` 只能来自维护名单，而不是 `provider_tier_hint` 或临时主观判断，且 `provider_tier_hint` 不参与头部讨论统计。
- 是否明确 entity registry 可空启动，空 registry 不产生 top-tier 统计。
- 是否使用“事件采集 -> 按日聚合 -> weekly 7 日窗口”的统计口径。
- 是否说明 daily 与 weekly 的消费差异。
- 是否固定 daily 的 `external_discovery` section 与 weekly 的 `external_discovery_window` section。
- 是否定义 skipped / partial / failed 的降级和审计语义。
- 是否定义 public aggregate 必须包含 `public_safe=true`、`redaction_policy_version`、`contains_raw_text=false`、`contains_profile_urls=false` 与 `source_input_hash`。
- 是否定义 public-safe / redaction 验证：public aggregate 不得包含 `content_text`、provider raw `text`、`profile_url`、cookie、session、token、password、OAuth、未脱敏 handle 或私有 diagnostics。
- 是否禁止外部层直接改变主 score、`discussion_score`、主源多源确认或高置信主结论。
- 是否提供 Requirement / Acceptance Traceability，把冻结需求和验收项映射到设计章节。
- 是否列出后续 specs、README、`data/README.md`、`.gitignore`、GitHub Actions、验证脚本、产物目录的同步清单，但未在本轮创建 exec-plan。
