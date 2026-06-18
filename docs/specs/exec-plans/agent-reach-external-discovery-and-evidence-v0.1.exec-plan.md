# 执行计划：AgentReach External Discovery & Evidence v0.1

## 文档状态

- 版本：`v0.1`
- 当前状态：`Phase 10 Completed`
- 设计来源：
  - `docs/specs/product-specs/外部发现与补证信号层需求分析.md`
  - `docs/specs/design-docs/agent-reach-external-discovery-and-evidence-design.md`
- 说明：本计划只负责把已获批设计落到可执行实现阶段，不新增产品行为，不直接调用外部平台 API，不创建登录、OAuth、session 或账号配置能力。

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

Post-Phase 9 scope update：AgentReach external discovery 必须支持 label-driven focus policy。科研相关 Agent、通用办公提效 Agent、个人办公助手和行业专用办公 Agent 方向必须先沉淀为稳定 `direction_labels`，再用于偏好适配、聚合、weekly observation 和展示；这些 label 仍只属于 external secondary evidence layer。

## 架构落点

### 新增模块

- `src/externalDiscovery/types.ts`
  - 定义 external discovery 内部类型、provider raw input 类型、canonical event 类型、aggregate 类型、status / reason code 枚举。
  - 冻结 `ExternalPlatform = "x_twitter" | "reddit" | "hacker_news" | "official_web" | "official_blog"`。
  - 冻结 `ExternalTargetType = "project" | "paper" | "product" | "topic"`；`direction` 只能作为 `scope` / consumption 语义，不得作为 target type。
  - 冻结 `derived_signal_kinds: ExternalSignalKind[]`，允许同一事件同时具备 `discovery` 与 `evidence`。
  - Phase 10 新增冻结 `ExternalDirectionLabel` closed union，完全以设计文档 3.7 的 priority labels 为准。
  - `ExternalSignalEvent.direction_labels`、`ExternalEvidence.direction_labels`、`ObservationCandidate.direction_labels` 必须为 canonical `ExternalDirectionLabel[]`，缺省时使用空数组。
  - `DailyExternalAggregate.direction_label_counts` 必须统计 public-safe label counts。
  - 定义 `ObservationCandidate`，并固定 `cannot_be_primary_conclusion: true`。
  - 只承接 external layer，不扩展 `RawSignal.source`。

- `src/externalDiscovery/paths.ts`
  - 统一生成 `data/raw/external-discovery/`、`data/external-discovery/`、aggregate latest 指针、entity registry 和 sanitized fixture 路径。
  - V1 不定义 production `externalEventsPath()`，不默认落盘 `YYYY-MM-DD.events.jsonl`。
  - 所有路径函数必须只返回本地文件路径，不包含远程 URL 或平台 API endpoint。

- `src/externalDiscovery/redaction.ts`
  - 实现 public-safe 字段扫描、raw text/profile URL/token/cookie/session/password/OAuth 字样拦截、public aggregate 验证。
  - 输出稳定 reason code，供 adapter、aggregate、verify 和结构测试复用。

- `src/externalDiscovery/agentReachProvider.ts`
  - 只读取本地 JSON artifact。
  - 校验 provider artifact 顶层 contract：`provider="agent-reach"`、`schema_version="agent-reach.external-discovery.v1"`、`provider_run_id`、`generated_at`、`platforms`、`status`、`items`。
  - 不调用 AgentReach CLI，不请求 X / Reddit / HN / official web，不读取 cookie/token/session/OAuth。
  - 默认输入缺失返回 `skipped`；显式输入缺失、不可读或 JSON 不可解析返回 `failed`。
  - `url` 与 `raw_ref` 至少存在一个；`source_published_at`、`observed_at`、`ingested_at` 不得混写。
  - `provider_tier_hint` 只能进入审计，不得产生 `effective_tier=core/proven/watch`。
  - Phase 10 起读取可选 `AgentReachProviderItem.direction_labels?: string[]`，仅接受白名单或明确同义映射后的稳定 label。
  - 非法 direction label 必须丢弃并写入 audit warning，不得导致缺少 label 的合法 item 失败。

- `src/externalDiscovery/entityRegistry.ts`
  - 读取 `data/external-discovery/entity-registry.json`，registry 可空启动。
  - 只有 registry 命中的实体可产生 `registry_tier=core/proven/watch` 与 `effective_tier=core/proven/watch`。
  - 空 registry 或 registry miss 不阻塞 external layer，但必须记录 `registry_empty` / `registry_miss` warning，且 `top_tier_actor_count=0`。
  - 覆盖机构、团队、个人三类主体，不得收缩为仅机构账号。

- `src/externalDiscovery/matching.ts`
  - 实现 project / paper / product / topic matching 与 `topic_key` canonicalization。
  - repo URL 精确匹配已有 `NormalizedProject` 时生成 `ExternalEvidence(scope=project)`。
  - 未命中但有明确 repo / paper / product 时生成 `ObservationCandidate(scope=project, qualification=needs_primary_confirmation)`。
  - 低置信名称匹配默认不进入 daily 主展示，只能作为 rejected、audit evidence 或低置信观察候选。
  - `topic_key` canonicalization 固定优先级：现有 `userInterestProfile.topics[].name`、现有 weekly trend key / paradigm label、provider `topic_hint` 的小写 kebab-case。
  - 无稳定 `topic_key` 的 topic event 不得进入 weekly direction observation。
  - Phase 10 起实现 direction label canonicalization；`tags` 保留普通辅助标签，`direction_labels` 才是稳定方向语义。
  - `agent-runtime`、`agent-memory`、`mcp`、`browser-agent` 等技术能力词默认不得进入 `direction_labels`。

- `src/externalDiscovery/aggregate.ts`
  - 把 in-memory canonical events 聚合为 `DailyExternalAggregate`。
  - 固定 `public_safe=true`、`contains_raw_text=false`、`contains_profile_urls=false`、`redaction_policy_version` 和 `source_input_hash`。
  - Phase 10 起写入 `direction_label_counts: Record<ExternalDirectionLabel, number>`，只保留 sanitized label 与 counts。
  - 只写 public aggregate 与 latest 指针；V1 不写 public `events.jsonl`。
  - 拒绝把 `content_text`、provider raw `text`、`profile_url`、未脱敏 handle 或 private diagnostics 写入 public aggregate。

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
  - 外部候选和补证只作为次级观察展示，不进入 `today_star_projects` 的主源确认语义。

- `src/action/runSummary.ts`
  - 增加 external secondary layer 的 status、counts、reason code、public-safe audit 摘要。
  - 不把 external layer 标为 freshness-driving primary source。

- `src/action/weeklyEnhancement.ts`、`src/action/weeklyReport.ts`
  - weekly 只消费 7 日 aggregate window。
  - 输出 direction observation、project evidence summary 和 external window status。

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

- 实施：`Phase 10 Completed`
- 验证：`Phase 10 Completed`
- 复审修订：Phase 0-9 已补齐真实 daily topic -> direction evidence 链路，并收紧 weekly multi-actor gate 的 public aggregate 去重语义。
- Post-Phase 9 scope update：上游需求 / 设计新增的 research / office `direction_labels` 已通过 Phase 10 落地；可进入总体验收、人工代码审核、提交与 PR。

## 阶段进度

| 阶段 | 状态 | 目标 | 完成标志 |
| --- | --- | --- | --- |
| Phase 0：执行前对齐 | `Completed` | 固定文件边界、fixture 规则、preflight-sync 和测试入口 | 结构测试先失败；preflight-sync 已指向当前 ExecPlan 并刷新 receipt；结构测试、typecheck、全量测试通过 |
| Phase 1：类型、路径与 redaction 基座 | `Completed` | 建立 frozen enum、类型、路径和 public-safe 验证 | redaction / path / type 单测通过；typecheck 与全量测试通过 |
| Phase 2：AgentReach 本地 artifact adapter | `Completed` | 只消费本地 JSON artifact，输出 canonical event/audit/status | adapter 单测覆盖 provider schema 与 ok / skipped / partial / failed；typecheck 与全量测试通过 |
| Phase 3：entity registry、matching 与 topic canonicalization | `Completed` | 落地 tier 维护、项目匹配与方向 topic 归一 | registry / matching / topic 测试通过；typecheck 与前序 external discovery 护栏通过 |
| Phase 4：aggregate 与 public artifact 写入 | `Completed` | 生成 public daily aggregate 和 latest 指针，不落盘 public events JSONL | aggregate / redaction / typecheck 通过；dry-run 不写盘，V1 不生成 public events JSONL |
| Phase 5：CLI command matrix | `Completed` | 落地 `run-daily`、`recover-daily`、`run-weekly`、`verify-daily` flags 语义 | CLI 单测覆盖 flags、fail-fast、dry-run、resolver contract、missing path 与 flag conflict；typecheck 与 externalDiscovery 回归通过 |
| Phase 6：daily / run-summary / verify 输出 | `Completed` | daily 展示、run-summary 审计、verify warn/fail 与污染检测 | action output、verification、CLI 回归、typecheck 与 diff check 通过 |
| Phase 7：weekly 7 日窗口消费 | `Completed` | weekly 只读 `DailyExternalAggregate[]`，direction gate 4 选 2 | weekly 与 direction gate 测试、typecheck、externalDiscovery 回归、全量测试与 diff check 通过 |
| Phase 8：OSS 文档、gitignore、workflow、spec 同步 | `Completed` | 公共 artifact 策略在文档、spec 和自动化中一致 | structure test、typecheck、diff check 与 preflight 通过 |
| Phase 9：总体验收 | `Completed` | typecheck、test、preflight 和关键 CLI dry-run 全部通过 | 全量测试、typecheck、preflight、CLI dry-run、fail-fast 与 diff review 均已记录 |
| Phase 10：Research / Office Direction Labels | `Completed` | 将上游新增 research / office focus 固化为 stable `direction_labels` | type / adapter / matching / aggregate / daily / weekly / verify / structure 测试覆盖 label canonicalization、counts、display 与 non-contamination；externalDiscovery、typecheck、全量测试通过 |

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
   - `ExternalEvidence`
   - `ObservationCandidate`
   - `DailyExternalAggregate`
   - `ExternalDiscoveryAudit`
2. 固定类型约束：
   - `derived_signal_kinds` 必须是非空数组，允许同时包含 `discovery` 与 `evidence`。
   - `direction` 不得出现在 `ExternalTargetType`，方向级表达只能来自 `scope="direction"` 与 `target_type="topic"`。
   - `ObservationCandidate.cannot_be_primary_conclusion` 固定为 `true`。
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
   - public aggregate 只能保留计数、脱敏 actor summary、tier 统计和 audit 状态。
   - 若 `data/external-discovery/entity-registry.json` 作为公开 artifact 维护，必须被 structure / public-safe 测试覆盖。
4. 在 `src/externalDiscovery/matching.ts` 实现项目与方向匹配：
   - repo URL 精确命中现有 `NormalizedProject.repo_url` 时，生成 `ExternalEvidence(scope=project)`。
   - paper / product 明确 URL 可以生成 project-scope 或 evidence candidate，但不得伪造 repo。
   - 低置信名称匹配默认不进入 daily 主展示，只能 rejected 或保留为 low-confidence audit evidence。
   - 未命中但有明确 repo / paper / product 时，生成 `ObservationCandidate(scope=project, qualification=needs_primary_confirmation)`。
4. 固定 topic canonicalization：
   - 优先命中 `userInterestProfile.topics[].name`。
   - 再命中现有 weekly trend key / paradigm label。
   - 再使用 provider `topic_hint` 的小写 kebab-case。
   - 无稳定 `topic_key` 的 topic event 不得进入 weekly direction observation。
5. 固定 `ObservationCandidate` 字段：
   - `candidate_kind`
   - `qualification`
   - `can_enter_daily`
   - `can_enter_weekly`
   - `cannot_be_primary_conclusion=true`
   - direction candidate 必须说明“尚未绑定明确 repo / paper”。
6. 写测试覆盖：
   - 空 registry 不阻塞 external layer。
   - 空 registry 时 `top_tier_actor_count=0`。
   - provider tier hint 不得产生 `effective_tier=core/proven/watch`。
   - registry miss 记录 warning。
   - repo URL 精确匹配生成 project evidence。
   - low-confidence name match 不进入 daily 主展示。
   - topic event 必须有稳定 `topic_key`。
   - 无稳定 `topic_key` 的 topic event 不进入 weekly direction observation。
7. 运行：
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
3. `source_input_hash` 在 missing-input 场景必须固定处理：
   - 当 adapter 已有真实 `source_input_hash` 时，aggregate 必须原样沿用该 hash。
   - 当默认输入缺失导致 `status="skipped"`、`status_reason="input_missing"`，或显式输入缺失 / 不可读导致还没有可读取 raw bytes 时，aggregate 仍必须包含 `source_input_hash`，但不得伪造 raw artifact hash。
   - missing-input 下的 `source_input_hash` 必须是稳定 absence marker：对公开元数据 `{ provider, date, source_input_ref, status, status_reason }` 做 `stableSourceInputHash(JSON.stringify(...))`，格式保持 `sha256:<hex>`。
   - aggregate 必须在 `audit.warnings` 增加稳定 warning，例如 `source_input_hash_absence_marker`，说明该 hash 只表示“该日期该路径缺失输入”的可审计状态，不表示存在可追溯 raw input 文件。
   - missing-input aggregate 的 `event_count`、`accepted_event_count`、`rejected_event_count` 必须为 `0`，`project_evidence`、`direction_evidence`、`observation_candidates` 必须为空数组。
   - 显式输入 JSON parse error 已读取 raw bytes 时，必须使用真实 raw bytes hash，不得使用 absence marker。
4. Aggregate 不得包含：
   - raw social text
   - full provider text
   - profile URL
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
   - 默认输入缺失生成 skipped aggregate 时，`source_input_hash` 使用稳定 absence marker，`audit.warnings` 包含 `source_input_hash_absence_marker`，且不声称存在 raw input hash。
   - 显式输入缺失 / 不可读且没有 raw bytes 时，`source_input_hash` 使用稳定 absence marker；JSON parse error 已有 raw bytes 时使用真实 raw bytes hash。
   - aggregate 不生成 events JSONL。
   - dry-run 只报告 planned writes，不创建 aggregate/latest 文件。
   - actor tier counts 使用 `effective_tier`，不使用 `provider_tier_hint`。
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
10. Phase 5 完成记录：
   - Files changed：`src/cli.ts`、`src/__tests__/externalDiscoveryCli.test.ts`。
   - Verification：`.\node_modules\.bin\vitest.cmd run externalDiscoveryCli.test.ts`、`.\node_modules\.bin\tsc.cmd --noEmit`、`.\node_modules\.bin\vitest.cmd run externalDiscovery`、`git diff --check`。
   - Result：CLI flags、fail-fast guard、dry-run matrix、resolver contract、missing path 与 flag conflict 测试通过；未接入 provider、aggregate、daily / weekly / verify 业务写入。

### Phase 6：daily / run-summary / verify 输出

1. 在 `DailyReport` 中追加 `external_discovery` 字段。
2. Daily JSON / Markdown 的 `external_discovery` section 必须包含：
   - `external_layer_status`
   - `external_observation_candidates`
   - `external_project_evidence_summaries`
   - `external_direction_signal_summary`
   - `external_audit_summary`
3. Daily 输出语义：
   - `external_observation_candidates` 只放 `scope=project` 且 `can_enter_daily=true` 的外部观察候选。
   - external project candidate 不得进入 `today_star_projects`。
   - direction candidate 不得伪装成“今日新项目”。
   - skipped / failed 时列表字段为空数组，`status_reason` 必须说明原因。
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
8. 运行：
   - `pnpm test -- externalDiscoveryActionOutput.test.ts`
   - `pnpm test -- externalDiscoveryVerification.test.ts`
   - `pnpm typecheck`
9. Phase 6 完成记录：
   - Files changed：`src/types.ts`、`src/cli.ts`、`src/action/dailyReport.ts`、`src/action/runSummary.ts`、`src/action/dailyVerification.ts`、`src/externalDiscovery/types.ts`、`src/__tests__/externalDiscoveryActionOutput.test.ts`、`src/__tests__/externalDiscoveryVerification.test.ts`、`src/__tests__/externalDiscoveryTypeContract.test.ts`。
   - Verification：`.\node_modules\.bin\vitest.cmd run externalDiscovery`、`.\node_modules\.bin\vitest.cmd run externalDiscoveryCli.test.ts`、`.\node_modules\.bin\vitest.cmd run dailyVerificationProjectSearch.test.ts projectSearchExposurePlanner.test.ts runSummaryObserver.test.ts`、`.\node_modules\.bin\tsc.cmd --noEmit`、`git diff --check`。
   - Result：daily report 输出 secondary external section；run-summary 记录 external audit；`verify-daily` 对 skipped/failed warn，对 public aggregate redaction、daily audit 缺失和主榜/score 污染 fail；`run-daily` / `recover-daily` 仅消费本地 AgentReach JSON artifact，不调用平台 API，不写 `RawSignal[]`，不改变主 score。

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
7. 写测试覆盖：
   - weekly 只读 aggregate paths。
   - weekly 不访问 `data/raw/external-discovery/`。
   - 7 日窗口部分缺失仍生成 weekly，并标记 usable day count。
   - direction observation 必须满足 4 个收敛条件中的至少 2 个。
   - 仅 provider tier hint 不满足 registry tier participation。
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
   - run-daily 验收使用 `--no-github --no-agents-radar --no-trendshift` 和临时 local config，避免 unrelated GitHub realtime / LLM / upstream source 网络链路影响 AgentReach CLI matrix 验证。
   - `pnpm run-daily -- --config <phase9-local-config> --date 2026-06-13 --dry-run --no-github --no-agents-radar --no-trendshift --no-external-discovery`
   - `pnpm run-daily -- --config <phase9-local-config> --date 2026-06-13 --dry-run --no-github --no-agents-radar --no-trendshift --external-discovery-input data/raw/external-discovery/fixtures/agent-reach.sample.sanitized.json`
   - `pnpm recover-daily -- --date 2026-06-13 --dry-run --no-external-discovery`
   - `pnpm run-weekly -- --date 2026-06-13 --dry-run --no-external-discovery`
   - `pnpm verify-daily -- --date 2026-06-13 --dry-run --no-external-discovery`
5. 运行 fail-fast CLI 检查：
   - `pnpm run-weekly -- --date 2026-06-13 --external-discovery-input data/raw/external-discovery/fixtures/agent-reach.sample.sanitized.json`
   - 预期：非零退出，不写 weekly artifact。
   - `pnpm verify-daily -- --date 2026-06-13 --external-discovery-input data/raw/external-discovery/fixtures/agent-reach.sample.sanitized.json`
   - 预期：非零退出，不写 verify artifact。
6. 检查 git diff：
   - 不得出现 provider raw artifact 被提交。
   - 不得出现未脱敏 fixture。
   - 不得出现主 score 公式改动。
   - 不得出现 `RawSignal.source` 新增 external provider。
   - 不得出现 public `events.jsonl` 默认产物。

### Phase 10：Research / Office Direction Labels

Phase 10 是上游需求 / 设计在 Phase 9 后新增的 scope update，不回写 Phase 0-9 的历史完成记录。Phase 10 完成前，不进入总体验收后的人工代码审核、提交与 PR 阶段。

1. 在 `src/externalDiscovery/types.ts` 冻结 `ExternalDirectionLabel` closed union：

   ```ts
   type ExternalDirectionLabel =
     | "research-agent"
     | "literature-review-agent"
     | "research-data-analysis-agent"
     | "academic-writing-agent"
     | "office-agent"
     | "personal-assistant-agent"
     | "office-productivity-agent"
     | "document-agent"
     | "spreadsheet-agent"
     | "meeting-agent"
     | "workflow-automation-agent"
     | "vertical-office-agent"
     | "legal-agent"
     | "finance-agent"
     | "sales-crm-agent"
     | "hr-agent"
     | "healthcare-admin-agent"
     | "education-agent"
     | "enterprise-ops-agent";
   ```

2. 扩展冻结类型契约：
   - `AgentReachProviderItem.direction_labels?: string[]`。
   - `ExternalSignalEvent.direction_labels: ExternalDirectionLabel[]`。
   - `ExternalEvidence.direction_labels: ExternalDirectionLabel[]`。
   - `ObservationCandidate.direction_labels: ExternalDirectionLabel[]`。
   - `DailyExternalAggregate.direction_label_counts: Record<ExternalDirectionLabel, number>`。
   - daily / weekly 输出增加 `direction_label_counts` 或等价的 label summary。
3. 更新 adapter 与 canonicalization：
   - Provider `direction_labels` 只接受白名单值或明确同义映射后的 canonical label。
   - 非法 label 必须丢弃并写入 audit warning，例如 `invalid_direction_label` / `dropped_direction_label`。
   - 缺少有效 `direction_labels` 不得导致合法 item 进入 `failed`；该 item 可保留在 daily audit / observation。
   - `tags` 是普通辅助标签；`direction_labels` 是稳定方向语义。
   - `agent-runtime`、`agent-memory`、`mcp`、`browser-agent` 默认不得进入 `direction_labels`，只可作为普通 `tags`。
4. 更新 matching / aggregate：
   - `topic_key` 继续服务 topic canonicalization；`direction_labels` 服务方向归类和偏好适配。
   - topic / direction event 没有稳定 `topic_key` 时，仍不得进入 weekly direction observation。
   - 没有有效 `direction_labels` 的事件，不得作为 label-driven weekly direction observation。
   - daily aggregate 必须统计 `direction_label_counts`，且 public aggregate 只保留 sanitized labels / counts，不得引入 raw social text、profile URL、未脱敏 handle 或 private diagnostics。
5. 更新 daily / weekly / verify：
   - daily 可展示 label summary / counts，但不生成方向级主结论。
   - weekly 可按 label group / display / observation，但不得降低原 4 选 2 direction gate。
   - `direction_labels` 不得进入 `RawSignal.source`、主 score、`discussion_score`、主源多源确认或高置信主结论。
   - 非法 label、label 过散或无法 canonicalize 的情况必须通过 audit / warning 暴露。
6. 更新测试：
   - `externalDiscoveryTypeContract.test.ts` 覆盖 `ExternalDirectionLabel` closed union、模型字段、score non-contamination。
   - `externalDiscoveryAdapter.test.ts` 覆盖 provider `direction_labels` schema、非法 label warning、缺少 label 不导致 failed。
   - `externalDiscoveryMatching.test.ts` 覆盖 label canonicalization、`tags` 与 `direction_labels` 分层、技术能力词不默认进 direction labels。
   - `externalDiscoveryAggregate.test.ts` 覆盖 `direction_label_counts` 统计、public aggregate 只保留 sanitized labels / counts。
   - `externalDiscoveryActionOutput.test.ts` 覆盖 daily label summary / counts 可见但不生成方向级主结论。
   - `externalDiscoveryWeekly.test.ts` 覆盖 weekly label grouping / display 不绕过 4 选 2 gate。
   - `externalDiscoveryVerification.test.ts` 覆盖 label 不污染主 score、`discussion_score`、主源确认或主结论。
   - `externalDiscoveryStructure.test.ts` 覆盖 spec / README / fixture policy 对 direction labels 保持一致。

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
15. Weekly direction observation 必须满足 4 个收敛条件中的至少 2 个。
16. V1 不默认落盘 public canonical events JSONL。
17. Phase 8 列出的 specs、README、`data/README.md`、`.gitignore` 与 workflows 全部同步。
18. 实现前 preflight-sync 已完成并记录结果，不再悬空。
19. `ExternalDirectionLabel` 与设计 3.7 的 19 个 priority labels 完全一致，不新增、不删减、不把技术能力词默认纳入 direction labels。
20. Provider `direction_labels` 可被 canonicalize；非法 label 被丢弃并写入 warning，缺少 label 不导致合法 item failed。
21. Public aggregate 包含 `direction_label_counts`，且只保留 sanitized labels / counts。
22. Daily / weekly 可基于 label 做 summary、group、display 或 observation，但不得绕过 weekly 4 选 2 gate。
23. `direction_labels` 不进入 `RawSignal.source`、主 score、`discussion_score`、主源多源确认或高置信主结论。

## 验证矩阵

| 文件位置或类型 | 验证内容 | 验证方式或命令 | 对应 Spec | 通过标准 |
| --- | --- | --- | --- | --- |
| `src/externalDiscovery/types.ts` | frozen enum / target / derived signal / `ExternalDirectionLabel` contract | `pnpm test -- externalDiscoveryTypeContract.test.ts` | 设计 3.7、4.1、18 | 平台、target、derived signal、direction labels 与设计一致；不污染 score / RawSignal |
| `src/externalDiscovery/redaction.ts` | public-safe / redaction 规则 | `pnpm test -- externalDiscoveryRedaction.test.ts` | 设计 3.6、11、12、14 | 禁止字段全部 fail，sanitized aggregate pass |
| `src/externalDiscovery/agentReachProvider.ts` | 本地 JSON adapter 状态机、provider schema 与 `direction_labels` 读取 | `pnpm test -- externalDiscoveryAdapter.test.ts` | 设计 3.2、3.3、3.4、3.7 | ok/skipped/partial/failed 全覆盖；非法 label warning；缺少 label 不 failed |
| `src/externalDiscovery/entityRegistry.ts` | registry 空启动与 tier 维护 | `pnpm test -- externalDiscoveryEntityRegistry.test.ts` | 需求 3、设计 7 | 空 registry 不阻塞，provider hint 不产生 top-tier |
| `src/externalDiscovery/matching.ts` | repo matching、topic canonicalization 与 label canonicalization | `pnpm test -- externalDiscoveryMatching.test.ts` | 需求 7、7.1、设计 3.7、6 | repo 精确匹配、topic_key、低置信降级、tags / direction_labels 分层、技术能力词排除全覆盖 |
| `src/externalDiscovery/aggregate.ts` | public daily aggregate contract 与 `direction_label_counts` | `pnpm test -- externalDiscoveryAggregate.test.ts` | 设计 4、8、12 | aggregate 字段齐全、无 raw text、不写 events JSONL，只保留 sanitized labels / counts |
| `src/cli.ts` | CLI command matrix | `pnpm test -- externalDiscoveryCli.test.ts` | 设计 3.5 | 四个命令 flag 语义一致 |
| `src/action/dailyReport.ts`、`src/action/runSummary.ts` | daily 与 run-summary external section / label summary | `pnpm test -- externalDiscoveryActionOutput.test.ts` | 设计 9、11 | 输出 secondary layer 审计和 label counts，不污染主榜单，不生成方向级主结论 |
| `src/action/dailyVerification.ts` | verify warn/fail 与 contamination 检测 | `pnpm test -- externalDiscoveryVerification.test.ts` | 设计 11.4、13 | skipped/failed warn，redaction/score/label contamination fail |
| `src/action/weeklyEnhancement.ts`、`src/externalDiscovery/weeklyWindow.ts` | weekly 7 日 aggregate window 与 label grouping | `pnpm test -- externalDiscoveryWeekly.test.ts` | 设计 10 | weekly 不读 raw input；label grouping/display 不绕过 4 选 2 gate |
| `src/externalDiscovery/weeklyWindow.ts` | direction gate 4 选 2 | `pnpm test -- externalDiscoveryDirectionGate.test.ts` | 需求 7、设计 6.2 | 未达 2 个条件不得进入 weekly direction observation |
| README / data README / gitignore / workflows / specs | OSS public artifact、spec 同步与 direction label policy | `pnpm test -- externalDiscoveryStructure.test.ts` | 设计 3.6、3.7、12、14 | raw input 不默认 commit/upload，spec 同步项齐全，fixture / README label policy 一致 |
| 全仓 | 类型与回归 | `pnpm typecheck`、`pnpm test` | 全设计 | 全部通过 |

## 回滚策略

1. 若 adapter 或 aggregate 引入风险，保留已通过的文档和结构测试，禁用 CLI external discovery 默认启用逻辑，使状态固定为 `skipped`。
2. 若 public-safe 验证误伤，停止发布 `data/external-discovery/*.aggregate.json`，保留 raw local-only 保护和 verify fail 规则。
3. 若 entity registry 或 tier lookup 引入风险，允许 registry 空启动并把所有 actor 降级为 `ordinary / unknown`，不得回退到 provider hint 产生 top-tier 判断。
4. 若 weekly 输出语义污染主趋势，回滚 weekly integration，只保留 daily aggregate 与 run-summary audit。
5. 任意回滚不得恢复 provider raw input 默认上传或提交。

## 当前残余风险

- Phase 8 已补 OSS 文档、`data/README.md`、GitHub Actions public aggregate 上传路径和相关 specs 同步；Phase 9 已完成总体验收，但上游新增的 research / office `direction_labels` 仍需先通过 Phase 10 落地。
- `scripts/execPlanPreflight.ts` 已指向当前 `agent-reach-external-discovery-and-evidence-v0.1.exec-plan.md` 并刷新 receipt；后续生产代码实现前必须保持 preflight check 通过。
- README 当前仍描述托管版登录能力；实现阶段需要精确区分 hosted app 与 OSS local console，避免把 hosted 登录说明误删。
- Phase 10 已完成；后续进入总体验收后的人工代码审核、提交与 PR 阶段时，仍需守住 direction label 不污染主评分链路的边界。

## 下一阶段入口

Phase 9 与 Phase 10 已完成。下一阶段可以进入总体验收后的人工代码审核、提交与 PR 阶段；后续仍不得扩大 AgentReach v0.1 到直接平台采集、登录态处理或主评分链路。

## 验证记录

| 日期 | 命令 | 结果 | 备注 |
| --- | --- | --- | --- |
| 2026-06-13 | `corepack pnpm test -- externalDiscoveryStructure.test.ts` | `Failed as expected` | Phase 0 先写结构测试；失败点为 `.gitignore`、`data/README.md`、README OSS external discovery 边界未同步 |
| 2026-06-13 | `corepack pnpm run code-implementation:preflight -- --write` | `Passed` | 刷新 receipt，绑定当前 AgentReach ExecPlan |
| 2026-06-13 | `corepack pnpm run code-implementation:preflight -- --check` | `Passed` | preflight-sync check 通过 |
| 2026-06-13 | `corepack pnpm test -- externalDiscoveryStructure.test.ts` | `Passed` | 5 tests passed；raw external input 不在默认 upload path，`.gitignore` / README / data README / sync list 对齐 |
| 2026-06-13 | `corepack pnpm typecheck` | `Passed` | `tsc --noEmit` 通过 |
| 2026-06-13 | `corepack pnpm test` | `Passed` | 4 test files / 21 tests passed |
| 2026-06-14 | `corepack pnpm test -- externalDiscoveryTypeContract.test.ts` | `Failed as expected` | Phase 1 先写 type/path contract 测试；失败点为 `src/externalDiscovery/types.ts` 与 `paths.ts` 尚不存在 |
| 2026-06-14 | `corepack pnpm test -- externalDiscoveryRedaction.test.ts` | `Failed as expected` | Phase 1 先写 redaction 测试；失败点为 `src/externalDiscovery/redaction.ts` 尚不存在 |
| 2026-06-14 | `corepack pnpm test -- externalDiscoveryTypeContract.test.ts` | `Passed` | 6 tests passed；frozen enum、direction scope、RawSignal / score component 不污染、path contract 通过 |
| 2026-06-14 | `corepack pnpm test -- externalDiscoveryRedaction.test.ts` | `Passed` | 14 tests passed；public-safe 必填字段、forbidden raw fields、profile URL variants、敏感字样与 stable hash 通过 |
| 2026-06-14 | `corepack pnpm test -- externalDiscoveryStructure.test.ts` | `Passed` | 5 tests passed；Phase 0 OSS artifact 护栏仍通过 |
| 2026-06-14 | `corepack pnpm typecheck` | `Passed` | `tsc --noEmit` 通过 |
| 2026-06-14 | `corepack pnpm test` | `Passed` | 6 test files / 41 tests passed |
| 2026-06-14 | `corepack pnpm run code-implementation:preflight -- --write` | `Passed` | Phase 1 更新 ExecPlan 后刷新 receipt |
| 2026-06-14 | `corepack pnpm run code-implementation:preflight -- --check` | `Passed` | preflight-sync check 通过 |
| 2026-06-14 | `git diff --check` | `Passed` | 无 whitespace error；仅 Windows CRLF 提示 |
| 2026-06-14 | `corepack pnpm test -- externalDiscoveryAdapter.test.ts` | `Failed as expected` | Phase 2 先写 adapter schema/status 测试；失败点为 `src/externalDiscovery/agentReachProvider.ts` 尚不存在 |
| 2026-06-14 | `corepack pnpm test -- externalDiscoveryAdapter.test.ts` | `Passed` | 18 tests passed；覆盖 ok、默认缺失 skipped、显式缺失/parse/schema failed、非法 item partial、provider hint 不产生 effective tier、无网络/env credential 读取 |
| 2026-06-14 | `corepack pnpm typecheck` | `Passed` | `tsc --noEmit` 通过 |
| 2026-06-14 | `corepack pnpm test` | `Passed` | 7 test files / 59 tests passed |
| 2026-06-14 | `corepack pnpm test -- externalDiscoveryRedaction.test.ts` | `Failed as expected` | Phase 3 前置 redaction 回归测试；失败点为标点前缀未脱敏 handle 未被识别 |
| 2026-06-14 | `corepack pnpm test -- externalDiscoveryEntityRegistry.test.ts` | `Failed as expected` | Phase 3 先写 registry 测试；失败点为 `src/externalDiscovery/entityRegistry.ts` 尚不存在 |
| 2026-06-14 | `corepack pnpm test -- externalDiscoveryMatching.test.ts` | `Failed as expected` | Phase 3 先写 matching/topic 测试；失败点为 `src/externalDiscovery/matching.ts` 尚不存在 |
| 2026-06-14 | `corepack pnpm test -- externalDiscoveryEntityRegistry.test.ts externalDiscoveryMatching.test.ts externalDiscoveryRedaction.test.ts` | `Passed` | 3 test files / 30 tests passed；registry 空启动、miss、tier 命中、unsafe registry 拒绝、public-safe、repo 精确匹配、low-confidence name 降级、topic_key 生成与 direction candidate 边界通过 |
| 2026-06-14 | `corepack pnpm test -- externalDiscoveryTypeContract.test.ts` | `Passed` | 6 tests passed；Phase 1 type/path contract 仍通过 |
| 2026-06-14 | `corepack pnpm test -- externalDiscoveryAdapter.test.ts` | `Passed` | 18 tests passed；Phase 2 adapter 状态机仍通过 |
| 2026-06-14 | `corepack pnpm test -- externalDiscoveryStructure.test.ts` | `Passed` | 5 tests passed；OSS artifact 结构护栏仍通过 |
| 2026-06-14 | `corepack pnpm typecheck` | `Passed` | `tsc --noEmit` 通过 |
| 2026-06-14 | `corepack pnpm test` | `Passed` | 9 test files / 75 tests passed |
| 2026-06-14 | `.\node_modules\.bin\vitest.cmd run externalDiscoveryAggregate.test.ts externalDiscoveryRedaction.test.ts` | `Passed` | 2 test files / 25 tests passed；Phase 4 aggregate public-safe、absence marker、no events JSONL、dry-run 写入边界通过 |
| 2026-06-14 | `.\node_modules\.bin\tsc.cmd --noEmit` | `Passed` | TypeScript typecheck 通过 |
| 2026-06-14 | `.\node_modules\.bin\vitest.cmd run externalDiscovery` | `Passed` | 7 test files / 71 tests passed；externalDiscovery 前序护栏与 aggregate 回归通过 |
| 2026-06-14 | `git diff --check` | `Passed` | 无 whitespace error；仅 Windows CRLF 提示 |
| 2026-06-14 | `.\node_modules\.bin\tsx.cmd scripts\execPlanPreflight.ts --write` | `Passed` | Phase 4 更新 ExecPlan 后刷新 implementation preflight receipt |
| 2026-06-14 | `.\node_modules\.bin\tsx.cmd scripts\execPlanPreflight.ts --check` | `Passed` | implementation preflight receipt verified |
| 2026-06-14 | `.\node_modules\.bin\vitest.cmd run externalDiscoveryCli.test.ts` | `Failed as expected` | Phase 5 先写 CLI matrix 测试；失败点为 `parseArgs` 未导出且 resolver / fail-fast guard 尚不存在 |
| 2026-06-14 | `.\node_modules\.bin\vitest.cmd run externalDiscoveryCli.test.ts` | `Passed` | 1 test file / 20 tests passed；覆盖四命令 flags、fail-fast、dry-run、resolver contract、missing path 与 flag conflict |
| 2026-06-14 | `.\node_modules\.bin\tsc.cmd --noEmit` | `Passed` | TypeScript typecheck 通过 |
| 2026-06-14 | `.\node_modules\.bin\vitest.cmd run externalDiscovery` | `Passed` | 8 test files / 91 tests passed；Phase 0-5 external discovery 护栏回归通过 |
| 2026-06-14 | `git diff --check` | `Passed` | 无 whitespace error；仅 Windows CRLF 提示 |
| 2026-06-14 | `.\node_modules\.bin\tsx.cmd scripts\execPlanPreflight.ts --write` | `Passed` | Phase 5 更新 ExecPlan 后刷新 implementation preflight receipt |
| 2026-06-14 | `.\node_modules\.bin\tsx.cmd scripts\execPlanPreflight.ts --check` | `Passed` | implementation preflight receipt verified |
| 2026-06-14 | `.\node_modules\.bin\vitest.cmd run externalDiscoveryActionOutput.test.ts` | `Failed as expected` | Phase 6 先写 daily / run-summary 输出测试；失败点为 `DailyReport.external_discovery` 与 `DailyRunSummary.external_discovery` 尚未接线 |
| 2026-06-14 | `.\node_modules\.bin\vitest.cmd run externalDiscoveryVerification.test.ts` | `Failed as expected` | Phase 6 先写 verify 检测测试；失败点为 external status / public aggregate / audit / contamination checks 尚不存在 |
| 2026-06-14 | `.\node_modules\.bin\vitest.cmd run externalDiscoveryActionOutput.test.ts` | `Passed` | 1 test file / 3 tests passed；daily secondary section 与 run-summary external audit 输出通过 |
| 2026-06-14 | `.\node_modules\.bin\vitest.cmd run externalDiscoveryVerification.test.ts` | `Passed` | 1 test file / 4 tests passed；skipped warn、public aggregate unsafe fail、audit missing fail、score contamination fail 通过 |
| 2026-06-14 | `.\node_modules\.bin\vitest.cmd run externalDiscoveryTypeContract.test.ts` | `Passed` | 1 test file / 7 tests passed；public aggregate `public_safe=true` 与 `source_input_hash` 必填契约通过 |
| 2026-06-14 | `.\node_modules\.bin\vitest.cmd run externalDiscovery` | `Passed` | 10 test files / 99 tests passed；Phase 0-6 external discovery 护栏回归通过 |
| 2026-06-14 | `.\node_modules\.bin\vitest.cmd run externalDiscoveryCli.test.ts` | `Passed` | 1 test file / 20 tests passed；CLI command matrix 回归通过 |
| 2026-06-14 | `.\node_modules\.bin\vitest.cmd run dailyVerificationProjectSearch.test.ts projectSearchExposurePlanner.test.ts runSummaryObserver.test.ts` | `Passed` | 3 test files / 6 tests passed；daily verification、project-search 和 run-summary 兼容回归通过 |
| 2026-06-14 | `.\node_modules\.bin\tsc.cmd --noEmit` | `Passed` | TypeScript typecheck 通过 |
| 2026-06-14 | `git diff --check` | `Passed` | 无 whitespace error；仅 Windows CRLF 提示 |
| 2026-06-14 | `.\node_modules\.bin\tsx.cmd scripts\execPlanPreflight.ts --write` | `Passed` | Phase 6 更新 ExecPlan 后刷新 implementation preflight receipt |
| 2026-06-14 | `.\node_modules\.bin\tsx.cmd scripts\execPlanPreflight.ts --check` | `Passed` | implementation preflight receipt verified |
| 2026-06-15 | `.\node_modules\.bin\vitest.cmd run externalDiscoveryWeekly.test.ts externalDiscoveryDirectionGate.test.ts` | `Failed as expected` | Phase 7 先写 weekly window / direction gate 测试；失败点为 `src/externalDiscovery/weeklyWindow.ts` 尚不存在 |
| 2026-06-15 | `.\node_modules\.bin\vitest.cmd run externalDiscoveryWeekly.test.ts externalDiscoveryDirectionGate.test.ts` | `Passed` | 2 test files / 7 tests passed；覆盖 7 日 public aggregate window、缺失/失败降级、direction gate 4 选 2、provider tier hint 不计 registry gate、weekly Markdown secondary section |
| 2026-06-15 | `.\node_modules\.bin\tsc.cmd --noEmit` | `Passed` | TypeScript typecheck 通过 |
| 2026-06-15 | `.\node_modules\.bin\vitest.cmd run externalDiscovery` | `Passed` | 12 test files / 106 tests passed；Phase 0-7 external discovery 回归通过 |
| 2026-06-15 | `.\node_modules\.bin\vitest.cmd run` | `Passed` | 30 test files / 172 tests passed |
| 2026-06-15 | `git diff --check` | `Passed` | 无 whitespace error；仅 Windows CRLF 提示 |
| 2026-06-15 | `.\node_modules\.bin\tsx.cmd scripts\execPlanPreflight.ts --write` | `Passed` | Phase 7 更新 ExecPlan 后刷新 implementation preflight receipt |
| 2026-06-15 | `.\node_modules\.bin\tsx.cmd scripts\execPlanPreflight.ts --check` | `Passed` | implementation preflight receipt verified |
| 2026-06-15 | `.\node_modules\.bin\vitest.cmd run externalDiscoveryStructure.test.ts` | `Failed as expected` | Phase 8 先扩展结构测试；失败点为 daily workflow public aggregate upload、`data/README.md` events JSONL 边界、spec sync 缺口 |
| 2026-06-15 | `.\node_modules\.bin\vitest.cmd run externalDiscoveryStructure.test.ts` | `Passed` | 1 test file / 6 tests passed；覆盖 README、data README、`.gitignore`、workflow path 与 Phase 8 spec sync |
| 2026-06-15 | `.\node_modules\.bin\tsc.cmd --noEmit` | `Passed` | TypeScript typecheck 通过 |
| 2026-06-15 | `git diff --check` | `Passed` | 无 whitespace error；仅 Windows CRLF 提示 |
| 2026-06-15 | `.\node_modules\.bin\tsx.cmd scripts\execPlanPreflight.ts --write` | `Passed` | Phase 8 更新 ExecPlan 后刷新 implementation preflight receipt |
| 2026-06-15 | `.\node_modules\.bin\tsx.cmd scripts\execPlanPreflight.ts --check` | `Passed` | implementation preflight receipt verified |
| 2026-06-15 | `.\node_modules\.bin\vitest.cmd run externalDiscoveryVerification.test.ts` | `Passed` | 1 test file / 5 tests passed；收紧 external contamination 检测，避免普通 primary-source `external-*` 文本误伤 |
| 2026-06-15 | `.\node_modules\.bin\vitest.cmd run src\__tests__` | `Passed` | 30 test files / 174 tests passed |
| 2026-06-15 | `.\node_modules\.bin\tsc.cmd --noEmit` | `Passed` | TypeScript typecheck 通过 |
| 2026-06-15 | `.\node_modules\.bin\tsx.cmd scripts\execPlanReviewPreflight.ts` | `Passed` | exec-plan review skill and receipt verified |
| 2026-06-15 | `.\node_modules\.bin\tsx.cmd src\cli.ts run-daily --config <phase9-local-config> --date 2026-06-13 --dry-run --no-github --no-agents-radar --no-trendshift --no-external-discovery` | `Passed` | local-only dry-run 返回 0；external layer disabled；未写入 data diff |
| 2026-06-15 | `.\node_modules\.bin\tsx.cmd src\cli.ts run-daily --config <phase9-local-config> --date 2026-06-13 --dry-run --no-github --no-agents-radar --no-trendshift --external-discovery-input data/raw/external-discovery/fixtures/agent-reach.sample.sanitized.json` | `Passed` | sanitized fixture 显式输入 dry-run 返回 0；未写入 data diff |
| 2026-06-15 | `.\node_modules\.bin\tsx.cmd src\cli.ts recover-daily --config <phase9-local-config> --date 2026-06-13 --dry-run --no-external-discovery` | `Passed` | recovery dry-run 返回 0；external disabled |
| 2026-06-15 | `.\node_modules\.bin\tsx.cmd src\cli.ts run-weekly --config <phase9-local-config> --date 2026-06-13 --dry-run --no-external-discovery` | `Passed` | weekly dry-run 返回 0；external_discovery_status=skipped |
| 2026-06-15 | `.\node_modules\.bin\tsx.cmd src\cli.ts verify-daily --config <phase9-local-config> --date 2026-06-13 --dry-run --no-external-discovery` | `Passed` | verify-daily 返回 0；总体 status=warn，external skipped/missing aggregate 为 warn，primary contamination pass |
| 2026-06-15 | `.\node_modules\.bin\tsx.cmd src\cli.ts run-weekly --date 2026-06-13 --external-discovery-input data/raw/external-discovery/fixtures/agent-reach.sample.sanitized.json` | `Failed as expected` | fail-fast：runner 前拒绝 run-weekly 显式 provider raw input |
| 2026-06-15 | `.\node_modules\.bin\tsx.cmd src\cli.ts verify-daily --date 2026-06-13 --external-discovery-input data/raw/external-discovery/fixtures/agent-reach.sample.sanitized.json` | `Failed as expected` | fail-fast：runner 前拒绝 verify-daily 显式 provider raw input |
| 2026-06-15 | `git diff --check` | `Passed` | 无 whitespace error；仅 Windows CRLF 提示 |
| 2026-06-15 | `.\node_modules\.bin\tsx.cmd scripts\execPlanPreflight.ts --write` | `Passed` | Phase 9 更新 ExecPlan 后刷新 implementation preflight receipt |
| 2026-06-15 | `.\node_modules\.bin\tsx.cmd scripts\execPlanPreflight.ts --check` | `Passed` | implementation preflight receipt verified |
| 2026-06-16 | `.\node_modules\.bin\vitest.cmd run externalDiscovery` | `Passed` | Phase 10 direction labels regression: 13 test files / 119 tests passed |
| 2026-06-16 | `.\node_modules\.bin\tsc.cmd --noEmit` | `Passed` | TypeScript typecheck passed after direction label model/output wiring |
| 2026-06-16 | `.\node_modules\.bin\vitest.cmd run` | `Passed` | Full test suite passed: 31 test files / 185 tests |
| 2026-06-16 | `.\node_modules\.bin\tsx.cmd scripts\execPlanPreflight.ts --write` | `Passed` | Refreshed implementation preflight receipt after Phase 10 ExecPlan completion |
| 2026-06-16 | `.\node_modules\.bin\tsx.cmd scripts\execPlanPreflight.ts --check` | `Passed` | implementation preflight receipt verified |
| 2026-06-16 | `git diff --check` | `Passed` | No whitespace errors; Windows CRLF warnings only |
| 2026-06-15 | `.\node_modules\.bin\vitest.cmd run externalDiscoveryDailyEvidence.test.ts` | `Passed` | Post-review 修补 provider `topic_hint` 经 topic context canonicalization 后再进入 weekly topic；2 tests passed |
| 2026-06-15 | `.\node_modules\.bin\vitest.cmd run externalDiscovery` | `Passed` | 13 test files / 111 tests passed；external discovery 回归通过 |
| 2026-06-15 | `.\node_modules\.bin\tsc.cmd --noEmit` | `Passed` | TypeScript typecheck 通过；覆盖 internal `target.topic_hint` 类型补充 |
| 2026-06-15 | `.\node_modules\.bin\vitest.cmd run` | `Passed` | 31 test files / 177 tests passed |
| 2026-06-15 | `git diff --name-status main -- data/raw/github-stars/2026-06-13.json data/raw/github-stars/latest.json` | `Passed` | 无输出；已移除无关 GitHub stars raw artifact diff |
| 2026-06-15 | `git diff --check main` | `Passed` | 无 whitespace error；仅 Windows CRLF 提示 |
| 2026-06-15 | `.\node_modules\.bin\tsx.cmd scripts\execPlanPreflight.ts --write` | `Passed` | Post-review 修补后刷新 implementation preflight receipt |
| 2026-06-15 | `.\node_modules\.bin\tsx.cmd scripts\execPlanPreflight.ts --check` | `Passed` | implementation preflight receipt verified |
