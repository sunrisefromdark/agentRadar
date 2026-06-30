# 执行计划：AgentReach External Discovery & Evidence v0.1

## 文档状态

- 版本：`v0.1`
- 当前状态：`Approved for Implementation`
- 设计来源：
  - `docs/specs/product-specs/外部发现与补证信号层需求分析.md`
  - `docs/specs/design-docs/agent-reach-external-discovery-and-evidence-design.md`
  - `docs/specs/design-docs/trend-radar-ui-v3-stage-redesign-design.md`
- 说明：本计划只负责把已获批设计落到可执行实现阶段，不新增产品行为，不直接调用外部平台 API，不创建登录、OAuth、session 或账号配置能力。

## 设计复审记录

- 复审日期：`2026-06-30`
- 复审结论：AgentReach external discovery 设计与 UI V3 外部发现页补充设计均已更新为 `Approved for ExecPlan`。
- 本次合入范围：`ExternalEvidence.named_registry_actors`、`ExternalNamedRegistryActor`、registry/public-safe 具名讨论者生成规则、匿名降级规则，以及 daily / weekly / 项目详情 / 外部发现页复用同一“谁在讨论”契约。
- 边界：本合入不引入新的 provider、平台采集、账号态、登录态、主评分公式或 UI 侧重算逻辑；UI 只能消费 public aggregate 中的 `named_registry_actors` 与匿名统计，不得从 provider raw actor 字段、未脱敏事件或自由文本临时拼接身份。本文中的“项目详情 / 外部发现页复用”指本计划必须产出同一 public contract 和消费语义，具体 visual console 页面代码若不在本计划触达面内，应由后续 UI exec-plan 承接，不得在本计划内顺手扩权。

## ExecPlan 复审记录

- 复审日期：`2026-06-30`
- 复审结论：`APPROVE`
- 风险等级：`High`，原因是 external discovery 涉及 public artifact、redaction、registry tier、daily / weekly 消费和 verify 门禁；当前计划已用 Phase 0 结构测试、contract-first 类型、public-safe 验证、负例测试和回滚策略约束风险。
- 无阻塞项：计划已基于批准设计，承接 `named_registry_actors` 具名讨论者契约，明确禁止 provider raw actor 身份拼接，并保留 preflight-sync 未完成前不得开始生产代码实现的入口门禁。

## 任务信息

| 字段 | 内容 |
| --- | --- |
| 任务名称 | AgentReach External Discovery & Evidence |
| 负责人 | Codex |
| 风险等级 | `High` |
| 关联需求 | `docs/specs/product-specs/外部发现与补证信号层需求分析.md` |
| 关联设计 | `docs/specs/design-docs/agent-reach-external-discovery-and-evidence-design.md` |
| 主要影响范围 | `src/externalDiscovery/`、`src/types.ts`、`src/cli.ts`、`src/action/*`、`src/storage/files.ts`、`src/__tests__/*`、`docs/specs/*`、`README*.md`、`data/README.md`、`.gitignore`、`.github/workflows/*` |

## 目标

在不改变现有主源链路、主评分公式和 OSS 无登录边界的前提下，引入 AgentReach 本地 JSON artifact 消费层，生成可审计、可脱敏、可降级的 external discovery & evidence aggregate，并让 daily、weekly、run-summary 和 verify 能以次级信号语义消费它。

## 架构落点

### 新增模块

- `src/externalDiscovery/types.ts`
  - 定义 external discovery 内部类型、provider raw input 类型、canonical event 类型、aggregate 类型、status / reason code 枚举。
  - 冻结 `ExternalPlatform = "x_twitter" | "reddit" | "hacker_news" | "official_web" | "official_blog"`。
  - 冻结 `ExternalTargetType = "project" | "paper" | "product" | "topic"`；`direction` 只能作为 `scope` / consumption 语义，不得作为 target type。
  - 冻结 `derived_signal_kinds: ExternalSignalKind[]`，允许同一事件同时具备 `discovery` 与 `evidence`。
  - 定义 `ExternalNamedRegistryActor`，并要求 `ExternalEvidence.named_registry_actors` 作为“谁在讨论”的唯一 public-safe 具名数据入口。
  - 定义 `ObservationCandidate`，并固定 `cannot_be_primary_conclusion: true`。
  - 只承接 external layer，不扩展 `RawSignal.source`。

- `src/externalDiscovery/paths.ts`
  - 统一生成 `data/raw/external-discovery/`、`data/external-discovery/`、aggregate latest 指针、entity registry 和 sanitized fixture 路径。
  - V1 不定义 production `externalEventsPath()`，不默认落盘 `YYYY-MM-DD.events.jsonl`。
  - 所有路径函数必须只返回本地文件路径，不包含远程 URL 或平台 API endpoint。

- `src/externalDiscovery/redaction.ts`
  - 实现 public-safe 字段扫描、raw text/profile URL/token/cookie/session/password/OAuth 字样拦截、public aggregate 验证。
  - 验证 `named_registry_actors` 只包含 `entity_id`、`display_name`、`actor_type`、`registry_tier`、`event_count`、`platforms`、`first_seen_at`、`last_seen_at`，不得包含 raw handle、profile URL、raw social text、provider diagnostics 或 private metadata。
  - 输出稳定 reason code，供 adapter、aggregate、verify 和结构测试复用。

- `src/externalDiscovery/agentReachProvider.ts`
  - 只读取本地 JSON artifact。
  - 校验 provider artifact 顶层 contract：`provider="agent-reach"`、`schema_version="agent-reach.external-discovery.v1"`、`provider_run_id`、`generated_at`、`platforms`、`status`、`items`。
  - 不调用 AgentReach CLI，不请求 X / Reddit / HN / official web，不读取 cookie/token/session/OAuth。
  - 默认输入缺失返回 `skipped`；显式输入缺失、不可读或 JSON 不可解析返回 `failed`。
  - `url` 与 `raw_ref` 至少存在一个；`source_published_at`、`observed_at`、`ingested_at` 不得混写。
  - `provider_tier_hint` 只能进入审计，不得产生 `effective_tier=core/proven/watch`。

- `src/externalDiscovery/entityRegistry.ts`
  - 读取 `data/external-discovery/entity-registry.json`，registry 可空启动。
  - 只有 registry 命中的实体可产生 `registry_tier=core/proven/watch` 与 `effective_tier=core/proven/watch`。
  - 只有 `tier_basis="registry"` 且存在 `registry_entity_id` / `registry_tier` 的 canonical event，可参与后续 `named_registry_actors` 生成。
  - 空 registry 或 registry miss 不阻塞 external layer，但必须记录 `registry_empty` / `registry_miss` warning，且 `top_tier_actor_count=0`。
  - 覆盖机构、团队、个人三类主体，不得收缩为仅机构账号。

- `src/externalDiscovery/matching.ts`
  - 实现 project / paper / product / topic matching 与 `topic_key` canonicalization。
  - repo URL 精确匹配已有 `NormalizedProject` 时生成 `ExternalEvidence(scope=project)`。
  - 未命中但有明确 repo / paper / product 时生成 `ObservationCandidate(scope=project, qualification=needs_primary_confirmation)`。
  - 低置信名称匹配默认不进入 daily 主展示，只能作为 rejected、audit evidence 或低置信观察候选。
  - `topic_key` canonicalization 固定优先级：现有 `userInterestProfile.topics[].name`、现有 weekly trend key / paradigm label、provider `topic_hint` 的小写 kebab-case。
  - 无稳定 `topic_key` 的 topic event 不得进入 weekly direction observation。

- `src/externalDiscovery/aggregate.ts`
  - 把 in-memory canonical events 聚合为 `DailyExternalAggregate`。
  - 固定 `public_safe=true`、`contains_raw_text=false`、`contains_profile_urls=false`、`redaction_policy_version` 和 `source_input_hash`。
  - 只写 public aggregate 与 latest 指针；V1 不写 public `events.jsonl`。
  - 拒绝把 `content_text`、provider raw `text`、`profile_url`、未脱敏 handle 或 private diagnostics 写入 public aggregate。
  - 为每个 `ExternalEvidence(scope + target_key)` 聚合 `named_registry_actors`，只使用 registry/public-safe canonical entity 的 `display_name`，并按 `registry_tier` 优先级、`event_count`、`display_name` 稳定排序。

- `src/externalDiscovery/dailyIntegration.ts`
  - 封装 `run-daily` / `recover-daily` 的 external discovery orchestration。
  - 返回 aggregate、audit status、planned reads/writes，并保持 dry-run 不写盘。

- `src/externalDiscovery/weeklyWindow.ts`
  - 只读取 7 日 `DailyExternalAggregate[]`。
  - 实现 weekly direction gate：4 个收敛条件至少满足 2 个，才可进入 `weekly_direction_observations`。
  - 不读取 provider raw input，不生成 daily aggregate。

### 修改模块

- `src/types.ts`
  - 增加 daily / weekly / run-summary / verify 需要暴露的 external layer 输出类型。
  - 只追加字段，不删除或重命名现有字段。

- `src/storage/files.ts`
  - 增加 `data/external-discovery` 目录。
  - 不把 local raw input 作为默认 public write target；raw 路径只能由 external discovery path helper 显式引用。

- `src/cli.ts`
  - 增加 `--no-external-discovery` 与 `--external-discovery-input <path>`。
  - `run-weekly` 和 `verify-daily` 收到 `--external-discovery-input` 必须 fail-fast。
  - `run-daily` 可读取默认 raw input 或显式 input；`recover-daily` 只在显式 input 时重建 aggregate。

- `src/action/dailyReport.ts`
  - 增加 `external_discovery` section 到 daily JSON / Markdown。
  - daily external section 展示“具名讨论者 + 匿名/未命中汇总”，具名讨论者只能来自 `ExternalEvidence.named_registry_actors`。
  - 外部候选和补证只作为次级观察展示，不进入 `today_star_projects` 的主源确认语义。

- `src/action/runSummary.ts`
  - 增加 external secondary layer 的 status、counts、reason code、public-safe audit 摘要。
  - 不把 external layer 标为 freshness-driving primary source。

- `src/action/weeklyEnhancement.ts`、`src/action/weeklyReport.ts`
  - weekly 只消费 7 日 aggregate window。
  - 输出 direction observation、project evidence summary 和 external window status。
  - weekly direction / project evidence summary 复用同一 `named_registry_actors` 契约，不新增第二套具名讨论者字段。

- `src/action/dailyVerification.ts`
  - skipped / failed 作为 warn。
  - audit 缺失、public aggregate 未脱敏、external evidence 混入主 score 或主源高置信结论时 fail。

### 需要同步的规范与文档

- `docs/specs/system-spec.md`
- `docs/specs/services/signal-ingestion.md`
- `docs/specs/services/normalization.md`
- `docs/specs/services/scoring-engine.md`
- `docs/specs/services/action-output.md`
- `docs/specs/services/cli-runtime.md`
- `docs/specs/constraints/architecture-constraints.md`
- `docs/specs/constraints/structure-tests.md`
- `docs/specs/feedback-loops/observability-contract.md`
- `docs/specs/feedback-loops/failure-recovery-loop.md`
- `README.md`
- `README.en.md`
- `README.zh-CN.md`
- `data/README.md`
- `.gitignore`
- `.github/workflows/trend-radar-daily.yml`
- `.github/workflows/trend-radar-weekly.yml`

### 新增测试

- `src/__tests__/externalDiscoveryAdapter.test.ts`
- `src/__tests__/externalDiscoveryAggregate.test.ts`
- `src/__tests__/externalDiscoveryTypeContract.test.ts`
- `src/__tests__/externalDiscoveryRedaction.test.ts`
- `src/__tests__/externalDiscoveryEntityRegistry.test.ts`
- `src/__tests__/externalDiscoveryMatching.test.ts`
- `src/__tests__/externalDiscoveryDirectionGate.test.ts`
- `src/__tests__/externalDiscoveryCli.test.ts`
- `src/__tests__/externalDiscoveryActionOutput.test.ts`
- `src/__tests__/externalDiscoveryWeekly.test.ts`
- `src/__tests__/externalDiscoveryVerification.test.ts`
- `src/__tests__/externalDiscoveryStructure.test.ts`

## 边界约束

### 允许修改

- 新增 external discovery 模块与测试。
- 追加 daily / weekly / run-summary / verify 的 external secondary layer 字段。
- 更新 CLI flags、文档、结构测试、GitHub Actions artifact path。
- 新增 public-safe sanitized fixture，用于测试，不包含平台原文全文、未脱敏 handle、profile URL、cookie、token、session、password、OAuth 或 private diagnostics。

### 禁止修改

- 不修改主 score 公式。
- 不新增 score component。
- 不把 external event 写入 `RawSignal[]`。
- 不让 external evidence 进入 `discussion_score` 多源确认。
- 不直接调用 X / Twitter、Reddit、Hacker News、official web / blog 或 AgentReach remote API。
- 不读取或保存登录态、cookie、session、OAuth、账号配置或平台 API 凭据。
- 不让外部讨论单独制造高置信主结论、主趋势或高分推荐。
- 不把 `data/raw/external-discovery/` 作为默认公开历史数据提交或上传。
- 不把 `provider_tier_hint` 当作 registry tier 或头部讨论统计依据。
- 不把 `topic` / direction event 强行伪装为项目级结论。

## 当前状态

- 需求分析：`Approved`
- 设计文档：`Approved`
- 实施：`Phase 0-2 Done; Phase 3/4/8 In Progress`
- 验证：`Phase 0-4 named_registry_actors 基座通过 targeted tests / typecheck / preflight check`

## 阶段进度

| 阶段 | 状态 | 目标 | 完成标志 |
| --- | --- | --- | --- |
| Phase 0：执行前对齐 | `DONE` | 固定文件边界、fixture 规则、preflight-sync 和测试入口 | preflight receipt 已刷新并校验；structure test 通过 |
| Phase 1：类型、路径与 redaction 基座 | `DONE` | 建立 frozen enum、类型、路径和 public-safe 验证 | redaction / path / type 单测通过 |
| Phase 2：AgentReach 本地 artifact adapter | `DONE` | 只消费本地 JSON artifact，输出 canonical event/audit/status | adapter 单测覆盖 provider schema、顶层审计字段、非空 `derived_signal_kinds` 与 ok / skipped / partial / failed |
| Phase 3：entity registry、matching 与 topic canonicalization | `IN_PROGRESS` | 落地 tier 维护、项目匹配与方向 topic 归一 | 本轮已完成 registry named actor eligibility、repo 精确匹配和 topic key 基座；低置信 audit 细化留后续 |
| Phase 4：aggregate 与 public artifact 写入 | `IN_PROGRESS` | 生成 public daily aggregate 和 latest 指针，不落盘 public events JSONL | 本轮已完成 in-memory public aggregate 与 `named_registry_actors` 聚合；文件写入/latest 指针接入留后续 |
| Phase 5：CLI command matrix | `Pending` | 落地 `run-daily`、`recover-daily`、`run-weekly`、`verify-daily` flags 语义 | CLI 单测覆盖 flags、fail-fast、dry-run |
| Phase 6：daily / run-summary / verify 输出 | `Pending` | daily 展示、run-summary 审计、verify warn/fail 与污染检测 | action output 与 verification 测试通过 |
| Phase 7：weekly 7 日窗口消费 | `Pending` | weekly 只读 `DailyExternalAggregate[]`，direction gate 4 选 2 | weekly 与 direction gate 测试通过 |
| Phase 8：OSS 文档、gitignore、workflow、spec 同步 | `IN_PROGRESS` | 公共 artifact 策略在文档、spec 和自动化中一致 | 本轮已完成 `.gitignore`、README、data README、workflow 的 external raw/public aggregate 边界；spec 全量同步留后续 |
| Phase 9：总体验收 | `Pending` | typecheck、test、preflight 和关键 CLI dry-run 全部通过 | 验证记录更新到本计划 |

## 实施阶段

### Phase 0：执行前对齐

1. 阅读并记录实施前置材料：
   - `docs/specs/product-specs/外部发现与补证信号层需求分析.md`
   - `docs/specs/design-docs/agent-reach-external-discovery-and-evidence-design.md`
   - `docs/specs/design-docs/architecture-boundaries.md`
   - `README.md`
   - `README.en.md`
   - `data/README.md`
   - `.gitignore`
   - `.github/workflows/trend-radar-daily.yml`
   - `.github/workflows/trend-radar-weekly.yml`
2. 确认本计划不需要新增需求或设计决策；如发现设计缺口，停止实现并回到设计修订。
3. 检查 `scripts/execPlanPreflight.ts` 当前绑定旧 exec-plan 的事实，并在生产代码实现前先完成独立 preflight-sync 步骤：
   - 默认处理方式是让 preflight 指向当前 `agent-reach-external-discovery-and-evidence-v0.1.exec-plan.md`。
   - 若实现阶段选择通用化 preflight，则必须支持显式传入当前 exec-plan path，并在验证记录中写明调用方式。
   - 未完成 preflight-sync 并记录结果前，不得开始生产代码实现；人工 plan review 不作为默认替代路径。
4. 先写 `src/__tests__/externalDiscoveryStructure.test.ts`，断言：
   - `data/raw/external-discovery/` 不得出现在 workflow 默认 upload path。
   - `.gitignore` 必须默认保护 local-only raw input。
   - `data/README.md` 必须说明 external raw input local-only 与 public aggregate contract。
   - `README.md` 和 `README.en.md` 必须说明 OSS 无登录、无账号态 external discovery。
   - 第 14 节要求的 specs 与 README / workflow / artifact 策略一致。
5. 运行 `pnpm test -- externalDiscoveryStructure.test.ts`，预期在实现同步前失败。
6. 不在 Phase 0 修改生产代码。

### Phase 1：类型、路径与 redaction 基座

1. 在 `src/externalDiscovery/types.ts` 定义以下类型：
   - `ExternalPlatform = "x_twitter" | "reddit" | "hacker_news" | "official_web" | "official_blog"`
   - `ExternalProviderStatus = "ok" | "skipped" | "partial" | "failed"`
   - `ExternalSignalKind = "discovery" | "evidence"`
   - `ExternalRawEventKind = "mention" | "discussion" | "official_release" | "blog_post" | "question" | "showcase" | "unknown"`
   - `ExternalTargetType = "project" | "paper" | "product" | "topic"`
   - `ExternalActorType = "institution" | "team" | "person" | "community" | "unknown"`
   - `ExternalActorTier = "core" | "proven" | "watch" | "ordinary" | "unknown"`
   - `ExternalRegistryTier = "core" | "proven" | "watch"`
   - `ExternalProviderTierHint = "core" | "proven" | "watch" | "ordinary" | "unknown"`
   - `ExternalSignalEvent`
   - `ExternalNamedRegistryActor`
   - `ExternalEvidence`
   - `ObservationCandidate`
   - `DailyExternalAggregate`
   - `ExternalDiscoveryAudit`
2. 固定类型约束：
   - `derived_signal_kinds` 必须是非空数组，允许同时包含 `discovery` 与 `evidence`。
   - `direction` 不得出现在 `ExternalTargetType`，方向级表达只能来自 `scope="direction"` 与 `target_type="topic"`。
   - `ObservationCandidate.cannot_be_primary_conclusion` 固定为 `true`。
   - `ExternalNamedRegistryActor.actor_type` 只能是 `"institution" | "team" | "person"`，不得包含 `community` 或 `unknown`。
   - `ExternalEvidence.named_registry_actors` 必须存在；为空数组表示没有可 public-safe 具名展示的 registry 命中讨论者，不代表没有外部讨论。
3. 在 `src/types.ts` 只追加公开消费类型或 re-export，不改变 `RawSignal`、`ScoreBreakdown`、`ScoreComponentName`。
4. 在 `src/externalDiscovery/paths.ts` 定义：
   - `externalRawInputPath(date: string): string`
   - `externalAggregatePath(date: string): string`
   - `externalAggregateLatestPath(): string`
   - `externalEntityRegistryPath(): string`
   - `externalSanitizedFixtureDirPath(): string`
5. 不定义 production `externalEventsPath()`；如测试需要事件 fixture，只能放在 fixture path，并明确 `public_safe=true`。
6. 在 `src/externalDiscovery/redaction.ts` 定义：
   - `assertPublicSafeAggregate(value: unknown): RedactionCheckResult`
   - `containsForbiddenPublicArtifactText(value: unknown): boolean`
   - `stableSourceInputHash(input: string | Buffer): string`
7. 写 `src/__tests__/externalDiscoveryTypeContract.test.ts` 覆盖：
   - 平台枚举必须包含 `x_twitter` 与 `official_blog`，不得包含 `x`。
   - target type 必须包含 `product` / `topic`，不得包含 `direction` / `unknown`。
   - `derived_signal_kinds` 可同时包含 discovery / evidence。
   - `RawSignal.source` 不得新增 external provider。
8. 写 `src/__tests__/externalDiscoveryRedaction.test.ts` 覆盖：
   - raw `content_text` 被 public aggregate redaction 拒绝。
   - provider raw `text` 被 public aggregate redaction 拒绝。
   - `profile_url` 被 public aggregate redaction 拒绝。
   - `named_registry_actors` 中出现 raw handle、profile URL、raw social text、provider diagnostics 或 private metadata 时被拒绝。
   - `named_registry_actors.display_name` 只能来自 registry/public-safe canonical entity，测试 fixture 不得使用 provider raw `actor.display_name` 作为可信身份来源。
   - cookie/session/token/password/OAuth 字样被 public aggregate redaction 拒绝。
   - sanitized aggregate 包含 `public_safe=true`、`contains_raw_text=false`、`contains_profile_urls=false`、`redaction_policy_version`、`source_input_hash` 时通过。
9. 运行：
   - `pnpm test -- externalDiscoveryTypeContract.test.ts`
   - `pnpm test -- externalDiscoveryRedaction.test.ts`
   - `pnpm typecheck`

### Phase 2：AgentReach 本地 artifact adapter

1. 在 `src/externalDiscovery/agentReachProvider.ts` 实现本地 JSON 读取：
   - 默认输入路径不存在：返回 `status="skipped"`、`status_reason="input_missing"`。
   - 显式输入路径不存在、不可读或 JSON 不可解析：返回 `status="failed"`，记录 failure reason。
   - schema 顶层非法：返回 `failed`。
   - provider artifact 声称 ok 但缺少必要审计字段：返回 `failed`。
   - 部分 event 非法：返回 `partial`，合法 event 继续进入 in-memory canonical event 列表。
2. Provider artifact 顶层必须校验：
   - `provider="agent-reach"`
   - `schema_version="agent-reach.external-discovery.v1"`
   - `provider_run_id`
   - `generated_at`
   - `query`
   - `platforms`
   - `status`
   - `items`
   - `diagnostics.warnings`
3. Provider item 必须校验：
   - `platform` 属于 V1 白名单。
   - `url` 与 `raw_ref` 至少存在一个。
   - `observed_at` 必须存在。
   - 如果只提供一个时间字段，adapter 必须映射为 `observed_at`，不得伪装成 `source_published_at`。
   - `actor.type_hint` 可映射为 actor type hint，但最终 actor type 必须经 canonicalization。
   - `actor.tier_hint` 只能进入 `provider_tier_hint`。
4. Adapter 不得让以下字段进入 public aggregate：
   - `content_text`
   - provider raw `text`
   - `profile_url`
   - 未脱敏 handle
   - private diagnostics
5. Adapter 输出必须包含：
   - `provider="agent-reach"`
   - `schema_version`
   - `provider_run_id`
   - `source_input_hash`
   - `events`
   - `rejected_events`
   - `status`
   - `status_reason`
6. 写测试覆盖：
   - ok artifact 生成 canonical events。
   - 默认缺失为 skipped。
   - 显式缺失为 failed。
   - JSON parse error 为 failed。
   - unsupported platform event 被拒绝并导致 partial。
   - 缺少 `url` 和 `raw_ref` 的 item 被拒绝。
   - `provider_tier_hint` 不产生 `effective_tier=core/proven/watch`。
   - adapter 不调用网络、不读取 env credential。
7. 运行：
   - `pnpm test -- externalDiscoveryAdapter.test.ts`
   - `pnpm typecheck`

### Phase 3：entity registry、matching 与 topic canonicalization

1. 在 `src/externalDiscovery/entityRegistry.ts` 实现 registry 读取与 lookup：
   - registry path 固定为 `data/external-discovery/entity-registry.json`。
   - registry 文件缺失或空数组时，external layer 继续运行。
   - 空 registry 产生 `registry_empty` warning。
   - 未命中 actor 产生 `registry_miss` warning。
   - 空 registry 或 miss 时，actor 只能计入 `ordinary` 或 `unknown`。
   - `top_tier_actor_count` 必须为 0，除非 registry 命中 `core/proven/watch`。
   - 只有 `tier_basis="registry"` 且具备 `registry_entity_id` / `registry_tier` 的 canonical event，可进入后续 `named_registry_actors` 聚合。
   - provider `actor.display_name`、`provider_tier_hint`、handle 或 profile URL 不得替代 registry 命中。
2. Registry entry 必须覆盖：
   - `entity_id`
   - `display_name`
   - `actor_type: "institution" | "team" | "person"`
   - `tier: "core" | "proven" | "watch"`
   - `handles`
   - `profile_urls`
   - `updated_at`
3. Registry public-safe 约束：
   - `handles` 与 `profile_urls` 只能保存 curated public entity reference。
   - registry 不得包含私有账号态字段、cookie、token、session、OAuth、私有 diagnostics 或 provider raw profile dump。
   - registry 中的 handle / profile URL 不得复制进 `DailyExternalAggregate` 或 public aggregate。
   - public aggregate 只能保留计数、脱敏 actor summary、tier 统计、`named_registry_actors` 中的 public-safe registry identity 和 audit 状态。
   - 若 `data/external-discovery/entity-registry.json` 作为公开 artifact 维护，必须被 structure / public-safe 测试覆盖。
4. 在 `src/externalDiscovery/matching.ts` 实现项目与方向匹配：
   - repo URL 精确命中现有 `NormalizedProject.repo_url` 时，生成 `ExternalEvidence(scope=project)`。
   - paper / product 明确 URL 可以生成 project-scope 或 evidence candidate，但不得伪造 repo。
   - 低置信名称匹配默认不进入 daily 主展示，只能 rejected 或保留为 low-confidence audit evidence。
   - 未命中但有明确 repo / paper / product 时，生成 `ObservationCandidate(scope=project, qualification=needs_primary_confirmation)`。
5. 固定 topic canonicalization：
   - 优先命中 `userInterestProfile.topics[].name`。
   - 再命中现有 weekly trend key / paradigm label。
   - 再使用 provider `topic_hint` 的小写 kebab-case。
   - 无稳定 `topic_key` 的 topic event 不得进入 weekly direction observation。
6. 固定 `ObservationCandidate` 字段：
   - `candidate_kind`
   - `qualification`
   - `can_enter_daily`
   - `can_enter_weekly`
   - `cannot_be_primary_conclusion=true`
   - direction candidate 必须说明“尚未绑定明确 repo / paper”。
7. 写测试覆盖：
   - 空 registry 不阻塞 external layer。
   - 空 registry 时 `top_tier_actor_count=0`。
   - provider tier hint 不得产生 `effective_tier=core/proven/watch`。
   - registry miss 记录 warning。
   - registry 命中 actor 可进入 `named_registry_actors`，且 `display_name` 来自 registry。
   - registry miss 或仅 provider hint actor 不得进入 `named_registry_actors`。
   - mixed hit/miss 时，命中 actor 仍可进入 `named_registry_actors` 和 top-tier 统计，miss actor 只进入匿名统计。
   - raw display name / handle / profile URL 不得进入具名身份输出。
   - repo URL 精确匹配生成 project evidence。
   - low-confidence name match 不进入 daily 主展示。
   - topic event 必须有稳定 `topic_key`。
   - 无稳定 `topic_key` 的 topic event 不进入 weekly direction observation。
8. 运行：
   - `pnpm test -- externalDiscoveryEntityRegistry.test.ts`
   - `pnpm test -- externalDiscoveryMatching.test.ts`
   - `pnpm typecheck`

### Phase 4：aggregate 与 public artifact 写入

1. 在 `src/externalDiscovery/aggregate.ts` 实现 `buildDailyExternalAggregate(input)`。
2. Aggregate 必须包含：
   - `schema_version="external-discovery.aggregate.v1"`
   - `date`
   - `generated_at`
   - `provider`
   - `provider_run_id`
   - `status`
   - `status_reason`
   - `source_input_hash`
   - `public_safe: true`
   - `redaction_policy_version`
   - `contains_raw_text: false`
   - `contains_profile_urls: false`
   - `event_count`
   - `accepted_event_count`
   - `rejected_event_count`
   - `platform_counts`
   - `derived_signal_kind_counts`
   - `project_evidence`
   - `direction_evidence`
   - `observation_candidates`
   - `audit.rejected_events`
   - `audit.warnings`
3. 每个 `ExternalEvidence` 必须包含 `named_registry_actors`：
   - 同一 `ExternalEvidence(scope + target_key)` 内按 `entity_id` 合并。
   - `event_count` 统计该 entity 对当前 evidence 的参与事件数。
   - `platforms` 去重排序。
   - `first_seen_at` / `last_seen_at` 来自该 entity 在当前 evidence 内的事件时间窗口。
   - 输出按 `registry_tier` 优先级 `core -> proven -> watch`、再按 `event_count` 降序、再按 `display_name` 稳定排序。
   - 字段为空数组时只表示没有可具名展示的 registry 命中 actor，不表示没有外部讨论。
4. Aggregate 不得包含：
   - raw social text
   - full provider text
   - profile URL
   - raw handle
   - provider raw `actor.display_name` 作为可信身份来源
   - cookie/token/session/password/OAuth
   - private diagnostics
5. V1 artifact 策略：
   - 只写 `data/external-discovery/YYYY-MM-DD.aggregate.json`。
   - 只写 `data/external-discovery/latest.aggregate.json`。
   - 不写 `data/external-discovery/YYYY-MM-DD.events.jsonl`。
   - 如果未来需要 canonical events JSONL，必须另开设计或 exec-plan 修订。
6. 在 `src/storage/files.ts` 增加 `data/external-discovery` 到 `DATA_DIRS`。
7. 在 daily integration 中只写 public aggregate 和 latest 指针，不写 raw input。
8. 写测试覆盖：
   - public aggregate 通过 redaction check。
   - aggregate 包含 `source_input_hash`，但不包含 raw input 原文。
   - aggregate 不生成 events JSONL。
   - dry-run 只报告 planned writes，不创建 aggregate/latest 文件。
   - actor tier counts 使用 `effective_tier`，不使用 `provider_tier_hint`。
   - `named_registry_actors` 只由 registry 命中 actor 生成。
   - 空 registry、registry miss、仅 provider hint 时 `named_registry_actors=[]`。
   - mixed hit/miss 时命中 actor 保留，miss actor 只进入匿名统计。
   - raw display name / handle / profile URL / raw social text 不得进入 `named_registry_actors` 或 public aggregate。
9. 运行：
   - `pnpm test -- externalDiscoveryAggregate.test.ts`
   - `pnpm test -- externalDiscoveryRedaction.test.ts`
   - `pnpm typecheck`

### Phase 5：CLI command matrix

1. 在 `src/cli.ts` 的 `CliOptions` 增加：
   - `externalDiscoveryEnabled: boolean`
   - `externalDiscoveryInputPath?: string`
   - `externalDiscoveryInputExplicit: boolean`
2. 在 `FLAG_HANDLERS` 增加：
   - `--no-external-discovery`
   - `--external-discovery-input <path>`
3. 在 command dispatch 前增加 fail-fast guard：
   - `run-weekly` 收到 `--external-discovery-input`：参数错误，退出非零，不生成 weekly artifact。
   - `verify-daily` 收到 `--external-discovery-input`：参数错误，退出非零，不写 verify artifact。
4. `run-daily` 语义：
   - 默认启用 external discovery。
   - 默认读取 `data/raw/external-discovery/YYYY-MM-DD.agent-reach.json`。
   - 默认输入缺失为 skipped。
   - 显式输入失败为 failed。
   - `--no-external-discovery` 跳过读取与聚合，status=`skipped`，reason=`disabled_by_flag`。
5. `recover-daily` 语义：
   - 默认不从 raw 路径补抓。
   - 只有显式 `--external-discovery-input` 时重建 aggregate。
   - `--no-external-discovery` 时恢复产物 external status=`skipped`。
6. `run-weekly` 语义：
   - 只读取 7 日 public daily aggregate。
   - 不读 raw input。
   - `--no-external-discovery` 时 weekly external window status=`skipped`。
7. `verify-daily` 语义：
   - 不读 raw input。
   - skipped / failed 为 warn。
   - public aggregate redaction 失败、audit 缺失或主 score 污染为 fail。
8. 写测试覆盖四个命令的 matrix。
9. 运行：
   - `pnpm test -- externalDiscoveryCli.test.ts`
   - `pnpm typecheck`

### Phase 6：daily / run-summary / verify 输出

1. 在 `DailyReport` 中追加 `external_discovery` 字段。
2. Daily JSON / Markdown 的 `external_discovery` section 必须包含：
   - `external_layer_status`
   - `external_observation_candidates`
   - `external_project_evidence_summaries`
   - `external_direction_signal_summary`
   - `external_audit_summary`
   - `who_is_discussing` 或等价消费字段，来源只能是 `ExternalEvidence.named_registry_actors` 与匿名 actor summary。
3. Daily 输出语义：
   - `external_observation_candidates` 只放 `scope=project` 且 `can_enter_daily=true` 的外部观察候选。
   - external project candidate 不得进入 `today_star_projects`。
   - direction candidate 不得伪装成“今日新项目”。
   - skipped / failed 时列表字段为空数组，`status_reason` 必须说明原因。
   - `named_registry_actors` 非空时展示具名讨论者；为空时只展示 `actor_type / effective_tier / count` 匿名摘要。
   - Daily Markdown 不得从 provider raw actor 字段、未脱敏事件或自由文本里拼接具名讨论者。
4. 在 `DailyRunSummary` 中追加 external secondary layer 状态：
   - provider status
   - aggregate path
   - source input hash
   - event counts
   - rejected reason counts
   - public-safe status
   - registry empty / miss warnings
5. `buildVerifyDailyResult` 增加 external checks：
   - daily 声称使用 external layer 但 audit 缺失：fail。
   - public aggregate 含未脱敏 raw 字段：fail。
   - public aggregate 缺少 required public-safe 字段：fail。
   - `named_registry_actors` 含 raw handle、profile URL、raw social text、provider diagnostics、private metadata 或 provider raw display name：fail。
   - daily / run-summary 输出出现非 `named_registry_actors` 来源的具名讨论者：fail。
   - skipped / failed external layer：warn。
6. Verify score contamination 检测必须覆盖：
   - `RawSignal.source` 没有新增 external provider。
   - `ScoreBreakdown.components` 没有 external component。
   - `discussion_score.evidence` 不引用 external evidence id。
   - daily / weekly 高置信主结论字段不引用 external-only candidate。
7. 写测试覆盖：
   - daily external section 存在。
   - run-summary 记录 external status。
   - verify 对 skipped / failed warn。
   - verify 对 redaction violation fail。
   - verify 对 score contamination fail。
   - provider tier hint 不参与头部讨论统计。
   - daily external section 能同时表达具名讨论者和匿名/未命中汇总。
   - 未命中 registry 的普通账号只进入匿名汇总，不得显示成具体个人或机构。
8. 运行：
   - `pnpm test -- externalDiscoveryActionOutput.test.ts`
   - `pnpm test -- externalDiscoveryVerification.test.ts`
   - `pnpm typecheck`

### Phase 7：weekly 7 日窗口消费

1. 在 `src/externalDiscovery/weeklyWindow.ts` 读取 7 日 `DailyExternalAggregate[]`。
2. 读取缺失日时保留 per-day status：
   - missing aggregate：`skipped`
   - invalid aggregate：`failed`
   - valid aggregate：使用其原 status
3. 在 weekly artifacts 中追加：
   - `external_discovery_window`
   - `weekly_direction_observations`
   - `external_project_evidence_summaries`
   - `external_cross_platform_confirmations`
   - 基于 `named_registry_actors` 派生的 `who_is_discussing` 摘要，字段来源和 daily 保持一致。
4. Weekly direction gate 固定为 4 个收敛条件至少满足 2 个：
   - `cross_platform_confirmation`：同一 `topic_key` 在至少 2 个 V1 平台出现。
   - `multi_actor_confirmation`：同一 `topic_key` 至少有 2 个独立 actor 讨论。
   - `multi_day_persistence`：同一 `topic_key` 在 weekly 7 日窗口内至少 2 个不同日期出现。
   - `registry_tier_participation`：同一 `topic_key` 至少有 1 个 registry 命中的 `core / proven / watch` actor 参与。
5. Gate 失败语义：
   - 满足 1 个条件：只能保留为 `direction_evidence` 或低置信 audit evidence，不进入 weekly direction observation。
   - 满足 0 个条件：rejected 或仅作为 raw event 审计留存。
   - `provider_tier_hint` 不计入 `registry_tier_participation`。
6. Weekly 输出必须保持：
   - 方向级 observation 不成为项目级结论。
   - external cross-platform confirmation 不等同主源多源确认。
   - external evidence 不创建高置信主趋势。
   - weekly direction / project evidence summary 中的具名讨论者只能来自 `ExternalEvidence.named_registry_actors`。
   - `named_registry_actors=[]` 时保留匿名 actor summary，不得把空列表解释成“没有讨论”。
7. 写测试覆盖：
   - weekly 只读 aggregate paths。
   - weekly 不访问 `data/raw/external-discovery/`。
   - 7 日窗口部分缺失仍生成 weekly，并标记 usable day count。
   - direction observation 必须满足 4 个收敛条件中的至少 2 个。
   - 仅 provider tier hint 不满足 registry tier participation。
   - weekly 复用 daily aggregate 中的 `named_registry_actors`，不读取 provider raw input 重新拼接身份。
   - registry miss actor 在 weekly 中只进入匿名汇总。
8. 运行：
   - `pnpm test -- externalDiscoveryWeekly.test.ts`
   - `pnpm test -- externalDiscoveryDirectionGate.test.ts`
   - `pnpm typecheck`

### Phase 8：OSS 文档、gitignore、workflow、spec 同步

1. 更新 `README.md`：
   - OSS 无登录、无注册、无 OAuth、无 session / account settings。
   - external discovery 只消费本地 artifact。
   - local raw input 不应提交。
   - public aggregate 必须通过 redaction/public-safe 验证。
2. 更新 `README.en.md` 同步英文说明。
3. 更新 `README.zh-CN.md`，确保中文入口指向主 README 或直接包含 external discovery OSS 边界。
4. 更新 `data/README.md`：
   - `data/raw/external-discovery/` 默认 local-only。
   - 只有 sanitized fixture 可提交。
   - `data/external-discovery/*.aggregate.json` 可公开提交但必须 public-safe。
   - V1 不默认公开提交 `*.events.jsonl`。
5. 更新 `.gitignore`：
   - 默认忽略 `data/raw/external-discovery/**`。
   - 保留可审计 sanitized fixture 例外路径。
6. 更新 `.github/workflows/trend-radar-daily.yml`：
   - 不 upload provider raw input。
   - 只 upload public aggregate 与 sanitized fixture。
7. 更新 `.github/workflows/trend-radar-weekly.yml`：
   - 不 upload provider raw input。
   - 不读取 raw external input。
8. 更新 specs：
   - `docs/specs/system-spec.md`：补充 external discovery & evidence layer 的系统边界与降级语义。
   - `docs/specs/services/signal-ingestion.md`：补充 external provider / adapter 的 raw 输入、schema、失败语义。
   - `docs/specs/services/normalization.md`：说明外部层不直接替代 repo canonical normalization，并定义项目级匹配边界。
   - `docs/specs/services/scoring-engine.md`：说明 V1 不改主 score，不新增 score component。
   - `docs/specs/services/action-output.md`：补充 daily / weekly 外部发现、补证和方向级观察输出。
   - `docs/specs/services/cli-runtime.md`：同步 external discovery flags 与四命令 matrix。
   - `docs/specs/constraints/architecture-constraints.md`：补充外部层不得成为主裁决链路。
   - `docs/specs/constraints/structure-tests.md`：补充 public-safe / redaction / workflow path / OSS boundary 守护。
   - `docs/specs/feedback-loops/observability-contract.md`：补充 external event count、provider status、rejected events、registry miss 等观测信号。
   - `docs/specs/feedback-loops/failure-recovery-loop.md`：补充 AgentReach 失败、unsupported platform、registry miss 等恢复语义。
9. 运行：
   - `pnpm test -- externalDiscoveryStructure.test.ts`
   - `pnpm typecheck`

### Phase 9：总体验收

1. 运行单元测试：
   - `pnpm test`
2. 运行类型检查：
   - `pnpm typecheck`
3. 运行 exec-plan review preflight：
   - `pnpm exec-plan:review:preflight`
4. 运行关键 CLI dry-run：
   - `pnpm run-daily -- --date 2026-06-13 --dry-run --no-external-discovery`
   - `pnpm run-daily -- --date 2026-06-13 --dry-run --external-discovery-input data/raw/external-discovery/fixtures/sanitized-agent-reach.sample.json`
   - `pnpm recover-daily -- --date 2026-06-13 --dry-run --no-external-discovery`
   - `pnpm run-weekly -- --date 2026-06-13 --dry-run --no-external-discovery`
   - `pnpm verify-daily -- --date 2026-06-13 --dry-run --no-external-discovery`
5. 运行 fail-fast CLI 检查：
   - `pnpm run-weekly -- --date 2026-06-13 --external-discovery-input data/raw/external-discovery/fixtures/sanitized-agent-reach.sample.json`
   - 预期：非零退出，不写 weekly artifact。
   - `pnpm verify-daily -- --date 2026-06-13 --external-discovery-input data/raw/external-discovery/fixtures/sanitized-agent-reach.sample.json`
   - 预期：非零退出，不写 verify artifact。
6. 检查 git diff：
   - 不得出现 provider raw artifact 被提交。
   - 不得出现未脱敏 fixture。
   - 不得出现主 score 公式改动。
   - 不得出现 `RawSignal.source` 新增 external provider。
   - 不得出现 public `events.jsonl` 默认产物。

## 验收标准

1. `run-daily` 能在默认缺失 external raw input 时继续生成主产物，并把 external layer 标为 `skipped`。
2. `run-daily --external-discovery-input <path>` 能消费 sanitized local artifact 并生成 public daily aggregate。
3. 显式输入缺失、不可读或 JSON 不可解析时 external layer 为 `failed`，主 daily 继续。
4. `recover-daily` 默认不读取 external raw input；只有显式输入时重建 aggregate。
5. `run-weekly` 只消费 7 日 `DailyExternalAggregate[]`，不得读取 provider raw input。
6. `verify-daily` 不读取 provider raw input，且对 skipped / failed external layer 输出 warn。
7. `verify-daily` 对 audit 缺失、public aggregate 未脱敏、external evidence 污染主 score 或主源高置信结论输出 fail。
8. Public aggregate 包含 `public_safe=true`、`redaction_policy_version`、`contains_raw_text=false`、`contains_profile_urls=false`、`source_input_hash`。
9. Public aggregate 不包含 `content_text`、provider raw `text`、`profile_url`、cookie、session、token、password、OAuth、未脱敏 handle 或 private diagnostics。
10. `.gitignore`、`data/README.md`、GitHub Actions artifact path 与 external artifact 策略一致。
11. External discovery 不改变 `ScoreBreakdown.total_score`、`discussion_score`、主源多源确认或高置信主结论。
12. `ExternalPlatform`、`ExternalTargetType`、`derived_signal_kinds` 与设计冻结契约一致。
13. Entity registry 可空启动；空 registry 不产生 top-tier 统计。
14. Provider tier hint 不得产生 core / proven / watch 头部判断。
15. `ExternalEvidence.named_registry_actors` 必须存在，且只由 registry/public-safe canonical entity 命中的 actor 生成。
16. `named_registry_actors` 不得包含 raw handle、profile URL、raw social text、provider diagnostics、private metadata 或 provider raw display name。
17. 空 registry、registry miss、仅 provider tier hint 时，UI / daily / weekly 只能展示匿名 actor summary，不得展示具名讨论者。
18. mixed hit/miss 时，registry 命中 actor 仍可进入具名列表和 top-tier 统计，miss actor 只进入匿名统计。
19. Daily / weekly / 项目详情 / 外部发现页复用同一 `named_registry_actors` public contract；本计划只保证 artifact / report / summary 层提供统一消费语义，不新增第二套具名讨论者字段或 UI 侧拼接逻辑。
20. Weekly direction observation 必须满足 4 个收敛条件中的至少 2 个。
21. V1 不默认落盘 public canonical events JSONL。
22. Phase 8 列出的 specs、README、`data/README.md`、`.gitignore` 与 workflows 全部同步。
23. 实现前 preflight-sync 已完成并记录结果，不再悬空。

## 验证矩阵

| 文件位置或类型 | 验证内容 | 验证方式或命令 | 对应 Spec | 通过标准 |
| --- | --- | --- | --- | --- |
| `src/externalDiscovery/types.ts` | frozen enum / target / derived signal / `named_registry_actors` contract | `pnpm test -- externalDiscoveryTypeContract.test.ts` | 设计 4.1、4.2、18 | 平台、target、derived signal 与具名讨论者字段契约一致 |
| `src/externalDiscovery/redaction.ts` | public-safe / redaction / named actor safety 规则 | `pnpm test -- externalDiscoveryRedaction.test.ts` | 设计 3.6、4.2、11、12、14 | 禁止字段全部 fail，sanitized aggregate 和 registry 命中具名 actor pass |
| `src/externalDiscovery/agentReachProvider.ts` | 本地 JSON adapter 状态机与 provider schema | `pnpm test -- externalDiscoveryAdapter.test.ts` | 设计 3.2、3.3、3.4 | ok/skipped/partial/failed 全覆盖 |
| `src/externalDiscovery/entityRegistry.ts` | registry 空启动、tier 维护与 named actor eligibility | `pnpm test -- externalDiscoveryEntityRegistry.test.ts` | 需求 3、设计 4.2、7 | 空 registry 不阻塞，provider hint 不产生 top-tier，只有 registry 命中进入具名列表 |
| `src/externalDiscovery/matching.ts` | repo matching 与 topic canonicalization | `pnpm test -- externalDiscoveryMatching.test.ts` | 需求 7、设计 6 | repo 精确匹配、topic_key、低置信降级全覆盖 |
| `src/externalDiscovery/aggregate.ts` | public daily aggregate 与 `named_registry_actors` 聚合 contract | `pnpm test -- externalDiscoveryAggregate.test.ts` | 设计 4、8、12 | aggregate 字段齐全、无 raw text、不写 events JSONL，具名列表仅来自 registry 命中 |
| `src/cli.ts` | CLI command matrix | `pnpm test -- externalDiscoveryCli.test.ts` | 设计 3.5 | 四个命令 flag 语义一致 |
| `src/action/dailyReport.ts`、`src/action/runSummary.ts` | daily 与 run-summary external section / 谁在讨论消费 | `pnpm test -- externalDiscoveryActionOutput.test.ts` | 设计 4.2、9、11 | 输出 secondary layer 审计，不污染主榜单，具名讨论者和匿名汇总分层 |
| `src/action/dailyVerification.ts` | verify warn/fail、contamination 与 named actor safety 检测 | `pnpm test -- externalDiscoveryVerification.test.ts` | 设计 4.2、11.4、13 | skipped/failed warn，redaction/score/named actor safety violation fail |
| `src/action/weeklyEnhancement.ts`、`src/externalDiscovery/weeklyWindow.ts` | weekly 7 日 aggregate window 与具名讨论者复用 | `pnpm test -- externalDiscoveryWeekly.test.ts` | 设计 4.2、10 | weekly 不读 raw input，复用 daily aggregate 的 `named_registry_actors` |
| `src/externalDiscovery/weeklyWindow.ts` | direction gate 4 选 2 | `pnpm test -- externalDiscoveryDirectionGate.test.ts` | 需求 7、设计 6.2 | 未达 2 个条件不得进入 weekly direction observation |
| README / data README / gitignore / workflows / specs | OSS public artifact 与 spec 同步 | `pnpm test -- externalDiscoveryStructure.test.ts` | 设计 3.6、12、14 | raw input 不默认 commit/upload，spec 同步项齐全 |
| 全仓 | 类型与回归 | `pnpm typecheck`、`pnpm test` | 全设计 | 全部通过 |

## 回滚策略

1. 若 adapter 或 aggregate 引入风险，保留已通过的文档和结构测试，禁用 CLI external discovery 默认启用逻辑，使状态固定为 `skipped`。
2. 若 public-safe 验证误伤，停止发布 `data/external-discovery/*.aggregate.json`，保留 raw local-only 保护和 verify fail 规则。
3. 若 entity registry 或 tier lookup 引入风险，允许 registry 空启动并把所有 actor 降级为 `ordinary / unknown`，不得回退到 provider hint 产生 top-tier 判断。
4. 若 weekly 输出语义污染主趋势，回滚 weekly integration，只保留 daily aggregate 与 run-summary audit。
5. 任意回滚不得恢复 provider raw input 默认上传或提交。

## 当前残余风险

- Phase 3 仍需在后续实现中补齐 low-confidence name match 的 rejected / audit evidence 细化，不能让低置信名称匹配进入 daily 主展示。
- Phase 4 仍需接入 public aggregate / latest 指针文件写入；当前只完成 in-memory aggregate 和 public-safe 校验。
- Phase 5-7 尚未开始，CLI、daily / run-summary / verify、weekly 7 日窗口仍未接入 external discovery。
- `scripts/execPlanPreflight.ts` 默认路径仍是旧计划；当前已通过显式 `--exec-plan` 方式完成本计划 receipt。若后续要依赖默认命令，仍需通用化。

## 下一阶段入口

ExecPlan Review 已通过。进入实现时从 Phase 0 开始执行，并在每个 Phase 完成后更新本计划的阶段状态与验证记录；未完成 preflight-sync 并记录结果前，不得开始生产代码实现。

## 验证记录

| 日期 | 命令 | 结果 | 备注 |
| --- | --- | --- | --- |
| 2026-06-13 | 未运行 | `Not Started` | 本轮修订 exec-plan 初稿；未改实现代码 |
| 2026-06-30 | `corepack pnpm run code-implementation:preflight -- --exec-plan docs/specs/exec-plans/agent-reach-external-discovery-and-evidence-v0.1.exec-plan.md --write` | `Passed` | 生成当前 exec-plan 对应 receipt：`docs/specs/agent-work/code-implementation-preflight.agent-reach-external-discovery-and-evidence-v0.1.json` |
| 2026-06-30 | `.\\node_modules\\.bin\\vitest.cmd run src/__tests__/externalDiscoveryTypeContract.test.ts src/__tests__/externalDiscoveryRedaction.test.ts src/__tests__/externalDiscoveryAdapter.test.ts src/__tests__/externalDiscoveryEntityRegistry.test.ts src/__tests__/externalDiscoveryMatching.test.ts src/__tests__/externalDiscoveryAggregate.test.ts src/__tests__/externalDiscoveryStructure.test.ts` | `Passed` | 7 files / 21 tests passed；覆盖 Phase 0-4 的 named_registry_actors 基座 |
| 2026-06-30 | `.\\node_modules\\.bin\\tsc.cmd --noEmit` | `Passed` | 类型检查通过 |
| 2026-06-30 | `.\\node_modules\\.bin\\tsx.cmd scripts\\execPlanPreflight.ts --exec-plan docs/specs/exec-plans/agent-reach-external-discovery-and-evidence-v0.1.exec-plan.md --check` | `Passed` | preflight receipt 校验通过 |
| 2026-06-30 | `.\\node_modules\\.bin\\vitest.cmd run src/__tests__/externalDiscoveryAdapter.test.ts` | `Passed` | 1 file / 5 tests passed；修复 Phase 2 审核问题后，adapter 负例覆盖缺失顶层审计字段与空 `derived_signal_kinds` |
| 2026-06-30 | `.\\node_modules\\.bin\\vitest.cmd run src/__tests__/externalDiscoveryTypeContract.test.ts src/__tests__/externalDiscoveryRedaction.test.ts src/__tests__/externalDiscoveryAdapter.test.ts src/__tests__/externalDiscoveryEntityRegistry.test.ts src/__tests__/externalDiscoveryMatching.test.ts src/__tests__/externalDiscoveryAggregate.test.ts src/__tests__/externalDiscoveryStructure.test.ts` | `Passed` | 7 files / 23 tests passed；Phase 2 adapter 合同校验重新通过 |
| 2026-06-30 | `.\\node_modules\\.bin\\tsc.cmd --noEmit` | `Passed` | Phase 2 adapter 类型收窄修复后类型检查通过 |

## 本轮实现记录

| 阶段 | 状态 | 文件 | 说明 |
| --- | --- | --- | --- |
| Phase 0 | `DONE` | `docs/specs/agent-work/code-implementation-preflight.agent-reach-external-discovery-and-evidence-v0.1.json`、`src/__tests__/externalDiscoveryStructure.test.ts`、`.gitignore`、`data/README.md`、`.github/workflows/trend-radar-daily.yml`、`.github/workflows/trend-radar-weekly.yml`、`README.md`、`README.en.md` | 完成 preflight receipt、external raw local-only、public aggregate 上传边界和 OSS no-account 说明 |
| Phase 1 | `DONE` | `src/externalDiscovery/types.ts`、`src/externalDiscovery/paths.ts`、`src/externalDiscovery/redaction.ts`、`src/__tests__/externalDiscoveryTypeContract.test.ts`、`src/__tests__/externalDiscoveryRedaction.test.ts` | 建立 V1 enum、路径、`ExternalNamedRegistryActor`、`ExternalEvidence.named_registry_actors` 与 public-safe redaction |
| Phase 2 | `DONE` | `src/externalDiscovery/agentReachProvider.ts`、`src/__tests__/externalDiscoveryAdapter.test.ts` | 实现本地 JSON adapter 的 missing/default skipped、explicit failed、ok、partial 语义；已补齐顶层 provider contract 校验与空 `derived_signal_kinds` 负例 |
| Phase 3 | `IN_PROGRESS` | `src/externalDiscovery/entityRegistry.ts`、`src/externalDiscovery/matching.ts`、`src/__tests__/externalDiscoveryEntityRegistry.test.ts`、`src/__tests__/externalDiscoveryMatching.test.ts` | 完成 registry hit/miss、provider hint 不升级、repo 精确匹配和 topic key 基座 |
| Phase 4 | `IN_PROGRESS` | `src/externalDiscovery/aggregate.ts`、`src/__tests__/externalDiscoveryAggregate.test.ts` | 完成 in-memory public aggregate、`named_registry_actors` 聚合、空 registry/miss/provider hint 匿名降级和 mixed hit/miss 统计 |
