# 执行计划：AgentReach Artifact Producer v0.1

## 文档状态

- 当前状态：`In Progress`
- 对应需求：`docs/specs/product-specs/外部发现与补证信号层需求分析.md`
- 对应设计：`docs/specs/design-docs/agent-reach-external-discovery-and-evidence-design.md` 第 16 节
- 前置完成项：`agent-reach-external-discovery-and-evidence-v0.1.exec-plan.md` 已完成 AgentReach artifact consumer backend
- 本计划范围：本仓库内 opt-in AgentReach artifact producer；实现设计文档中的 V1.5 producer addendum

## Implementation Checkpoint

截至 2026-06-18，已落地：

- `src/agentReach/` producer 模块、独立 `agentreach:discover` package script 和完整 coverage artifact writer。
- `external-import`、`rss-blog`、`official-web`、`hacker-news` 的本地 sanitized JSON / fixture adapter。
- `xTwitterProvider`、`redditProvider` reserved `manual_import_only` descriptors；未实现平台抓取。
- consumer adapter、daily aggregate、daily/run-summary/weekly report 和 `verify-daily` coverage 贯通。
- public-safe runtime guards：完整 coverage、items、query、diagnostics 写入前校验。
- PR1 foundation 已收口为统一 `AgentReachProducerProvider` / `ProviderContext`，`providerRegistry.ts` 固定 provider 顺序，`orchestrator.ts` 隔离 provider 失败并聚合 artifact-ready run summary，`transport.ts` 提供默认 disabled transport 与 fake/in-memory transport 测试入口。
- `AgentReachProviderError` 安全错误分类覆盖 `configuration_invalid`、`input_missing`、`input_invalid`、`timeout`、`http`、`unavailable`、`response_too_large`、`unexpected`；公开 diagnostics 只暴露 safe code，不暴露 path、response body、cookie、session、OAuth、token 或账号配置。

尚未纳入本 checkpoint：

- 在线 RSS / Atom fetch、official sitemap fetch、Hacker News API fetch。
- X / Twitter 官方 API provider、Reddit API provider。
- 大规模 crawler、登录态、cookie、session、OAuth 或平台账号配置。

## 目标

在不破坏已完成 `src/externalDiscovery/` consumer 边界的前提下，新增本仓库内 opt-in AgentReach artifact producer。Producer 只负责低风险公开发现、provider 归一化、脱敏、coverage audit 和本地 artifact 写入；consumer 继续通过 `agent-reach.external-discovery.v1` JSON 读取、聚合、报告和校验。

## 核心边界

- Producer 输出路径固定为 `data/raw/external-discovery/YYYY-MM-DD.agent-reach.json`。
- Producer 不写 `RawSignal[]`，不改主 score、`discussion_score`、primary freshness 或主榜排序。
- `run-daily` 不得默认启动 producer；用户必须先显式运行 `pnpm agentreach:discover`，再用 `run-daily --external-discovery-input <path>` 消费。
- 不保存、不读取、不暴露 cookie、session、OAuth、token、账号配置、平台 API 凭据或私有 provider diagnostics。
- 不内置 X / Twitter 深度搜索、Reddit OAuth 搜索、大规模网页 crawler 或绕平台限制的采集。
- `provider_tier_hint` 只保留为 hint，不得升级成 `registry_tier` 或 `effective_tier=core/proven/watch`。
- 不新增默认 raw latest 指针；如果用户维护 `latest.agent-reach.json`，只能作为显式 `--external-discovery-input` 使用。

## Artifact Contract

V0.1 producer 必须写出当前 consumer adapter 可读的 artifact：

```ts
interface AgentReachProviderArtifact {
  provider: "agent-reach";
  schema_version: "agent-reach.external-discovery.v1";
  provider_run_id: string;
  generated_at: string;
  query: unknown;
  platforms: ExternalPlatform[];
  status: ExternalProviderStatus;
  items: AgentReachProviderItem[];
  diagnostics: {
    warnings: string[];
  };
  coverage: Record<ExternalPlatform, AgentReachPlatformCoverage>;
}

type AgentReachCoverageStatus =
  | "ok"
  | "partial"
  | "not_configured"
  | "manual_import_only"
  | "unavailable"
  | "failed";

interface AgentReachPlatformCoverage {
  status: AgentReachCoverageStatus;
  reason?: string;
  warnings?: string[];
}
```

Producer 写出的 `coverage` 必须覆盖全部 V1 平台：`x_twitter`、`reddit`、`hacker_news`、`official_web`、`official_blog`。Consumer adapter 扩展后必须继续兼容旧 V1 sanitized fixtures 缺少 `coverage` 的情况。

Artifact 顶层 `status` 只表达 provider artifact / producer run 是否可消费；per-platform coverage status 只表达平台覆盖范围。`not_configured` 与 `manual_import_only` 不应自动把顶层 `status` 降级为 `partial` 或 `failed`。只有所有 selected active provider 运行失败但 producer 仍能生成 schema-valid、public-safe failure artifact 时，顶层 status 才应为 `failed`；无法生成可消费 artifact 的情况必须 fail-fast 且不写盘。

顶层 status 映射固定如下：

| Producer 情况 | 顶层 `status` | 是否写 artifact |
| --- | --- | --- |
| 至少一个 selected active provider 成功，且没有 provider-level failure 或 item rejection | `ok` | 是 |
| 至少一个 selected active provider 有可用输出，但存在 item rejection、provider `partial`、`unavailable` 或 selected active provider `failed` | `partial` | 是 |
| 只选择 reserved provider，例如 `x_twitter` / `reddit`，且没有 external import 输入；producer 不抓取平台，只写完整 coverage | `ok` | 是 |
| `--providers` 为空、包含未知 provider、或所有 selected active provider 在运行前配置非法 | fail-fast，无顶层 status | 否 |
| 所有 selected active provider 运行失败，但 producer 仍能生成 schema-valid、public-safe failure artifact 与完整 coverage | `failed` | 是 |
| Producer 无法生成 schema-valid 或 public-safe artifact | fail-fast，无顶层 status | 否 |
| `skipped` | V0.1 producer 不主动写出；`skipped` 仍由 consumer 的 missing input / disabled flag 语义使用 | 否 |

## 架构落点

### 新增模块

`src/agentReach/`

- `types.ts`
  - 定义 producer provider interface、coverage type、producer run summary、artifact writer input。
  - PR1 固定 `AgentReachProducerProvider`、`ProviderContext`、`AgentReachProviderResult`、provider mode 和 provider run status。
- `providerErrors.ts`
  - 定义 `AgentReachProviderError`、安全错误分类和 public-safe serialization；错误分类至少覆盖 configuration / input / timeout / HTTP / unavailable / response-too-large / unexpected。
- `providerRegistry.ts`
  - 作为 provider 注册顺序的单一来源；用户传入 providers 的顺序不得改变执行顺序。
- `orchestrator.ts`
  - 稳定顺序执行选中的 providers，隔离单 provider 失败，聚合 items / warnings / rejections / coverage，计算 `ok` / `partial` / `failed`，并补齐全部 V1 平台 coverage。
- `transport.ts`
  - 定义 injectable transport contract、`createDisabledAgentReachTransport` 默认禁用实现和 fake/in-memory transport 测试入口；PR1 不执行真实网络请求。
- `queryPack.ts`
  - 管理 research / office focus policy、方向词、provider 查询模板和 provider allowlist。
  - 每个 query entry 必须绑定稳定 `direction_labels`。
- `providers/externalImportProvider.ts`
  - 读取本地 sanitized import JSON。
  - 支持 `x_twitter` / `reddit` manual import，不做平台抓取。
- `providers/rssBlogProvider.ts`
  - 读取公开 RSS / Atom / release feed。
- `providers/officialWebProvider.ts`
  - 只处理 allowlist URL / sitemap 输入，不做无限递归 crawler。
- `providers/hackerNewsProvider.ts`
  - 只使用公开输入或 mockable fetch adapter；测试不得依赖实时网络。
- `providers/xTwitterProvider.ts`
  - V0.1 只保留 opt-in interface / reserved entry point，不实现默认抓取；X / Twitter 信号只能来自 `externalImportProvider` 手工 sanitized import。
- `providers/redditProvider.ts`
  - V0.1 只保留 opt-in interface / reserved entry point，不实现默认 OAuth / 登录态搜索；Reddit 信号只能来自 `externalImportProvider` 手工 sanitized import。
- `normalizer.ts`
  - 将 provider raw result 转成 `AgentReachProviderItem`。
- `sanitizer.ts`
  - 删除 raw social text、未脱敏 handle、profile URL、cookie、session、OAuth、token、账号配置和私有 diagnostics。
- `coverageAudit.ts`
  - 汇总全部 V1 平台 coverage，并补齐未配置平台。
- `artifactWriter.ts`
  - 写入 dated raw artifact；dry-run 只返回 planned writes。
- `cli.ts`
  - 实现 producer CLI command handler。
  - PR1 后 CLI 只负责参数、配置、registry/context、调用 orchestrator、writer 和输出；不得包含 provider-specific 分支、coverage 聚合或 status 计算逻辑。

### 修改模块

- `src/externalDiscovery/agentReachProvider.ts`
  - 允许读取 public-safe `coverage` block。
  - 旧 fixture 缺少 coverage 时继续可读。
  - coverage 含 forbidden text、private diagnostics、credential、raw handle 或 profile URL 时必须 fail public-safe validation；不得仅 warning 后继续进入 public aggregate。
- `src/externalDiscovery/types.ts`
  - 增加 consumer 可读取的 coverage audit 类型；不改变 `ExternalProviderStatus`。
- `src/externalDiscovery/aggregate.ts`
  - 将 public-safe coverage 摘要写入 daily aggregate audit。
- `src/action/dailyReport.ts`、`src/action/runSummary.ts`、`src/action/weeklyReport.ts`、`src/action/dailyVerification.ts`
  - 展示或验证 coverage 摘要，明确“未覆盖”不等于“无讨论”。
- `package.json`
  - 新增 opt-in script：`"agentreach:discover": "tsx src/agentReach/cli.ts"`。
  - 用户命令固定为：`pnpm agentreach:discover -- --date YYYY-MM-DD --providers external-import,rss-blog,official-web,hacker-news`。
- `src/cli.ts`
  - 不新增 producer command；主 CLI 继续只承载 daily / weekly / verify / score 等 consumer 和 action 命令。
- README、`data/README.md`、`docs/specs/services/cli-runtime.md`、observability / recovery specs
  - 同步 producer 与 consumer 边界、raw artifact local-only 策略和 coverage audit 语义。

## 实施阶段

### Phase 0：结构护栏与文档同步先行

1. 扩展 `externalDiscoveryStructure.test.ts`，检查：
   - producer exec-plan 存在并引用设计第 16 节。
   - README / data README / `.gitignore` 仍表达 raw input local-only。
   - docs 明确 `agentreach:discover` 是 opt-in，`run-daily` 不默认启动 producer。
   - docs 明确 coverage 覆盖全部 V1 平台，且未覆盖不等于无信号。
   - `package.json` 中 `agentreach:discover` 必须指向 `tsx src/agentReach/cli.ts`。
   - `src/cli.ts` 不得注册 `agentreach:discover` command。
2. 明确 producer exec-plan 护栏归属：现有 `scripts/execPlanPreflight.ts` 仍绑定已完成的 consumer v0.1 exec-plan；producer v0.1 的 plan sync 由 `externalDiscoveryStructure.test.ts` 守护，除非后续单独泛化 preflight 脚本。
3. 运行结构测试，先看到新增断言失败。
4. 同步文档和 README，使结构测试通过。

### Phase 1：Producer 类型与 coverage contract

1. 新增 `src/agentReach/types.ts`。
2. 定义：
   - `AgentReachProducerProvider`
   - `ProviderContext`
   - `AgentReachProviderResult`
   - provider mode / run status
   - `AgentReachCoverageStatus`
   - `AgentReachPlatformCoverage`
   - `AgentReachProducerRunSummary`
3. 扩展 consumer adapter coverage 读取：
   - producer artifact 必须完整 coverage。
   - legacy artifact 缺少 coverage 仍可读。
   - unknown coverage status 产生 warning / rejected metadata。
4. 单测覆盖：
   - coverage status 白名单。
   - coverage 必须覆盖全部 V1 平台。
   - top-level status 与 coverage status 不互相误降级。
   - forbidden fields 出现在 coverage reason / warning 时必须拒绝写入，或在写入前完成脱敏；无法脱敏时 producer run failed 且不写 artifact。

### Phase 2：Query pack 与 direction labels

1. 新增 `src/agentReach/queryPack.ts`。
2. 建立 research / office focused query pack，至少覆盖：
   - research agent / literature review / research data analysis / academic writing
   - office agent / personal assistant / document / spreadsheet / meeting / workflow automation
   - vertical office: legal / finance / sales-crm / hr / healthcare-admin / education / enterprise-ops
3. 每个 query entry 必须绑定 `ExternalDirectionLabel[]`，不得只写 `tags`。
4. 单测覆盖：
   - 所有 query labels 在 `ExternalDirectionLabel` 白名单内。
   - `tags` 与 `direction_labels` 分层清晰。
   - 无效 label 不进入 artifact writer。

### Phase 3：Provider interface 与 external import

1. 定义统一 provider interface：provider 只返回 producer result，不直接写 artifact。
2. 实现 `externalImportProvider`：
   - 读取本地 sanitized import JSON。
   - 支持全部 V1 platform 字段。
   - X / Reddit 只能通过 import 进入，coverage 标记 `manual_import_only` 或 import 成功后的 `ok`。
3. 单测覆盖：
   - 手工导入有效 item。
   - 无效 platform 被拒绝。
   - 缺少 `url` 且缺少 `raw_ref` 被拒绝。
   - raw text、handle、profile URL、cookie / OAuth / token 被拒绝或脱敏。

### Phase 4：低风险公开 providers

1. 实现 `rssBlogProvider`：
   - 读取公开 RSS / Atom fixture 或 allowlist feed。
   - 不保存 raw feed 全文，只保留 public-safe title / URL / timestamp / target hint。
2. 实现 `officialWebProvider`：
   - 只处理 allowlist URL / sitemap 输入。
   - 不做递归 crawler，不跨域扩散。
3. 实现 `hackerNewsProvider`：
   - 通过 mockable fetch adapter 或 fixture 输入测试。
   - 测试不得依赖实时网络。
4. 单测覆盖 provider coverage：
   - 全部成功：`ok`
   - 部分解析失败：`partial`
   - 未配置：`not_configured`
   - 来源不可访问：`unavailable`
   - provider 异常：`failed`

### Phase 4.5：Provider foundation、transport 与 orchestrator

1. 新增 `providerErrors.ts`，定义 `AgentReachProviderError` 安全错误分类：
   - `configuration_invalid`
   - `input_missing`
   - `input_invalid`
   - `timeout`
   - `http`
   - `unavailable`
   - `response_too_large`
   - `unexpected`
2. 新增 `transport.ts`，定义 injectable transport contract、`createDisabledAgentReachTransport` 与 fake/in-memory transport 测试；PR1 中默认 transport 必须不调用 `fetch`，不做真实 RSS/Atom、sitemap、HN API、X 或 Reddit 网络请求。
3. 新增 `providerRegistry.ts`，固定 canonical provider order：`external-import`、`rss-blog`、`official-web`、`hacker-news`、`x_twitter`、`reddit`。
4. 新增 `orchestrator.ts`：
   - 稳定顺序执行选中的 providers。
   - 隔离单 provider 失败，后续 provider 必须继续。
   - 聚合 items、warnings、rejections、coverage。
   - 同平台成功与失败并存时 coverage 为 `partial`。
   - `manual_import_only` 与 `not_configured` 不自动降级顶层 status。
   - 所有 attempted active provider 均 failed / unavailable 时顶层 status 为 `failed`。
5. 单测覆盖：
   - registry order 不受 CLI 顺序影响。
   - safe warning 格式为 `provider_failed:<provider_id>:<safe_code>`。
   - `provider_execution_failed` 与 `provider_transport_unavailable` reason 不泄露原始异常。
   - fake/in-memory transport 的 timeout、HTTP、unavailable、response_too_large 均类型化。

### Phase 5：Normalizer、sanitizer 与 artifact writer

1. 实现 `normalizer.ts`：
   - provider result -> `AgentReachProviderItem`
   - 明确 `observed_at`、`source_published_at`、`platform`、`target`、`direction_labels` 映射。
2. 实现 `sanitizer.ts`：
   - 复用 externalDiscovery redaction policy。
   - artifact 写入前检查 forbidden fields。
3. 实现 `coverageAudit.ts`：
   - 将 active / reserved provider 结果汇总为完整 `coverage`。
   - reserved X / Reddit 默认 `not_configured` 或 `manual_import_only`。
4. 实现 `artifactWriter.ts`：
   - 写入 `data/raw/external-discovery/YYYY-MM-DD.agent-reach.json`。
   - dry-run 只返回 planned write，不写盘。
   - 不写默认 `latest.agent-reach.json`。
5. 单测覆盖 ok / partial / failed artifact、完整 coverage、legacy consumer compatibility、dry-run 不写盘。

### Phase 6：CLI 与运行边界

1. 新增 package script：

```bash
pnpm agentreach:discover -- --date YYYY-MM-DD --providers external-import,rss-blog,official-web,hacker-news
```

2. 支持参数：
   - `--date YYYY-MM-DD`
   - `--providers <comma-list>`
   - `--output <path>`
   - `--dry-run`
   - `--external-import <path>`
   - `--config <path>`
3. CLI 不读取平台账号态，不读取 cookie/session/OAuth/token。
4. `run-daily` 不调用 producer；显式消费仍走 `--external-discovery-input <path>`。
5. CLI 测试覆盖 dry-run、无 provider、reserved provider、输出路径、raw artifact local-only、与 run-daily 解耦。
   - 空 `--providers` 或 unknown provider 必须 fail-fast，且不写 artifact。
   - 仅选择 reserved `x_twitter` / `reddit` 时不得抓取平台；只能写完整 coverage，相关平台为 `not_configured` 或 `manual_import_only`。
   - `src/cli.ts agentreach:discover` 必须保持 unknown command，防止 producer 误接入主 CLI。
   - `src/agentReach/cli.ts` 必须委托 `runAgentReachProviders`；不得包含 provider-specific branch、`computeStatus` 或 `runProvider`。

### Phase 7：Consumer coverage 表达

1. Daily aggregate audit 写入 public-safe coverage summary。
2. Daily markdown / JSON 表达：
   - 本次外部覆盖不完整。
   - 哪些平台 `not_configured` / `manual_import_only` / `unavailable` / `failed`。
3. Run-summary 记录 coverage status counts。
4. Weekly 读取 7 日 aggregate 时保留 daily coverage summary，窗口级表达 usable external coverage。
5. Verify：
   - coverage 缺失的 legacy artifact 只 warn。
   - coverage 含 private text / credentials / raw handles / profile URL 时 fail。
   - coverage 缺口不得被当作 no-signal 结论。

### Phase 8：总体验收与文档同步

1. 同步 README、`data/README.md`、CLI runtime spec、observability contract、failure recovery loop。
2. 运行验证矩阵。
3. 检查 `git status --short`，确认没有 production raw artifact 被误写入提交候选。
4. 运行 `corepack pnpm run code-implementation:preflight -- --check` 只验证旧 consumer preflight receipt；producer plan 是否同步以 structure test 为准。

### Phase 9：PR2 / C 低风险 live provider 与配置体验

1. `transport.ts` 新增 `createFetchAgentReachTransport`，但 default remains disabled；没有显式 live 配置时 CLI 继续使用 `createDisabledAgentReachTransport`，不得调用 `fetch`。
2. `rss-blog`、`official-web`、`hacker-news` 支持 `live.enabled=true` 和 allowlist URL；测试必须通过 fake/in-memory transport，不依赖真实网络。
3. `input_path` 与 `live.enabled=true` 互斥；非法 `urls`、`timeout_ms`、`max_response_bytes`、`query_limit` fail-fast 且不写 artifact。
4. RSS / Atom 解析 title、link、published / updated；official web 只提取配置页面的 title、canonical URL、meta description；Hacker News 只使用配置 search endpoint。
5. CLI dry-run 输出 public-safe coverage summary；artifact 不包含 config path、account settings、cookie、session、OAuth、token、response body。
6. `run-daily` 继续不自动启动 producer；未来如需集成，只能新增显式 `run-daily --external-discovery-generate --agentreach-config <path>`。
7. V2 high-risk provider 不在本阶段实现：X / Twitter API、Reddit API、scoped crawler、authority registry 和 actor graph 必须另开设计和测试 fixture。

## 验收标准

1. `pnpm agentreach:discover -- --date <date> --dry-run` 返回 planned artifact summary，且不写盘。
2. `pnpm agentreach:discover -- --date <date> --providers external-import,rss-blog,official-web,hacker-news` 写入 dated local raw AgentReach artifact。
3. 写出的 artifact 顶层包含 `provider`、`schema_version`、`provider_run_id`、`generated_at`、`query`、`platforms`、`status`、`items`、`diagnostics.warnings`、完整 `coverage`。
4. `coverage` 覆盖全部 V1 平台，并能区分 `not_configured`、`manual_import_only`、`partial`、`unavailable`、`failed`。
5. 顶层 `status` 不因 `not_configured` / `manual_import_only` 自动降级。
6. 写出的 artifact 可被 `run-daily --external-discovery-input <path>` 消费。
7. `run-daily` 默认不会启动 producer。
8. X / Reddit 只能通过 external import 或 reserved provider coverage 表达，不默认抓取。
9. 空 provider、unknown provider、或 producer 无法生成 public-safe artifact 时 fail-fast，不写 artifact。
10. public-safe 检查能阻止 cookie、session、OAuth、token、profile URL、未脱敏 handle、raw social text 和私有 diagnostics；无法脱敏时 producer run failed 且不写 artifact。
11. `provider_tier_hint` 只保留为 hint，不能参与 registry tier 或头部讨论判断。
12. 旧 consumer fixtures 与 V1 daily / weekly / verify 回归测试仍通过。
13. README、data README、specs、structure tests 与 artifact local-only 策略一致。

## 验证矩阵

| 范围 | 命令 | 预期 |
| --- | --- | --- |
| Structure guard | `pnpm test -- externalDiscoveryStructure.test.ts` | docs / gitignore / fixture / workflow / producer plan 边界一致 |
| Producer types / coverage | `pnpm test -- agentReachProducerTypes.test.ts` | coverage enum、provider interface、legacy artifact compatibility 通过 |
| Query pack | `pnpm test -- agentReachQueryPack.test.ts` | 所有 query entry 的 `direction_labels` 合法 |
| Providers | `pnpm test -- agentReachProviders.test.ts` | import / RSS / official web / HN mock fixture 通过 |
| Sanitizer / writer | `pnpm test -- agentReachArtifactWriter.test.ts` | forbidden fields 被拒绝或脱敏，完整 coverage，dry-run 不写盘 |
| CLI | `pnpm test -- agentReachCli.test.ts` | 独立 producer CLI、参数校验、空 / unknown provider fail-fast、reserved provider 不抓取、run-daily 解耦通过 |
| Consumer compatibility | `pnpm test -- externalDiscovery` | 已有 consumer 回归通过 |
| Typecheck | `pnpm run typecheck` | 通过 |
| Preflight | `pnpm run code-implementation:preflight -- --check` | 旧 consumer preflight receipt 仍通过；producer plan sync 不依赖该脚本 |

## 回滚策略

1. 若 producer CLI 或 provider 实现不稳定，回滚 `src/agentReach/**`、package script 和 CLI 入口；保留已完成 consumer。
2. 若 coverage block 破坏旧 artifact 读取，回滚 adapter coverage 扩展，继续允许旧 `agent-reach.external-discovery.v1` artifact。
3. 若 daily / weekly coverage 展示不稳定，先回滚展示层接线，保留 producer artifact writer 与 consumer adapter 兼容。
4. 任意回滚不得恢复平台登录态采集、不得把 raw artifact 加入公开历史、不得修改主 score。

## 下一阶段入口

本计划获得确认后，下一步先按 Phase 0 写结构测试与文档同步检查，再进入 producer 类型和 provider interface 实现。实现时优先保持 consumer 回归稳定，再逐步接入 low-risk providers。
