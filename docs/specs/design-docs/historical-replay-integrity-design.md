# 设计文档：历史日报与周报补跑可信性设计

## 文档状态

- 版本：`v0.1`
- 状态：`Proposed for Review`
- 设计输入：
  - [历史日报与周报补跑可信性需求分析.md](../product-specs/历史日报与周报补跑可信性需求分析.md#L1)
  - [agent-trend-radar-product-spec.md](../product-specs/agent-trend-radar-product-spec.md#L1)
  - [daily-report-freshness-readability-design.md](daily-report-freshness-readability-design.md#L1)
  - [signal-filter-action-version-design.md](signal-filter-action-version-design.md#L1)
  - [signal-ingestion.md](../services/signal-ingestion.md#L1)
  - [cli-runtime.md](../services/cli-runtime.md#L1)
- 目标：把历史 `run-daily --date <past-date>` 与 `run-weekly --backfill-missing-days` 从“日期参数传下去了”提升为“source 证据对目标日期可审计、可分级、不可伪装”的可信历史回放能力。

## 一句话设计

将当前“live collector 兼任历史回放”的模式拆成“当天 live 采集 + 历史 adapter 回放 + 归档/观察回执 + 独立验证”四层体系，使系统只在持有目标日期证据时宣称历史命中，否则明确降级、失败或转入推断区。

## 需求对齐映射

| 需求分析项 | 本设计对应章节 |
| --- | --- |
| 历史真实性优先于补齐率 | `核心判断`、`失败与拒绝策略` |
| source 历史能力必须分级可见 | `历史能力模型`、`source 级方案` |
| 历史运行与当天实时运行必须语义分离 | `运行模式路由`、`report 与 verify 契约` |
| 从现在开始构建可回放归档 | `归档层设计`、`观察回执` |
| 缺历史证据时必须显式降级 | `主榜单准入规则`、`失败与拒绝策略` |
| weekly 只能消费可信 daily | `weekly backfill 规则` |
| verify 必须独立证明历史证据 | `验证设计` |

## 问题定义

当前历史日期运行存在两个结构性问题：

1. `--date` 已进入 pipeline，但部分 source 仍通过 live fetch 取得执行当天数据，再把结果写成目标日期。
2. report / run-summary / verify 的主要校验对象仍是“字段是否自洽”，而不是“source 证据是否独立存在且属于目标日期”。

因此当前系统可以补齐历史文件，但不能稳定回答“这份历史日报到底有多真”。

## 范围

### 包含

- `run-daily` 的 live / historical 双运行模式设计
- source 历史能力分级模型
- 归档、事件仓库、观察回执与元数据格式
- 历史 daily 主榜单准入规则
- weekly backfill 对历史 daily 的消费规则
- `run-summary` / `verify-daily` / 后续 weekly audit 的独立验证契约
- 按 source 的落地路径与阶段迁移策略

### 不包含

- 直接实现新的外部 SaaS 历史接口
- 重新设计 scoring 公式
- 重做 visual console 页面结构
- 把所有历史日期一次性补全
- 引入新的大型非 GitHub / Trendshift source

## 非目标

- 不承诺“过去任意一天都能完全还原所有 source 的真历史”。
- 不用代理推断结果冒充原始历史结果。
- 不让历史 replay 为了非空而继续复用 live fetch 结果。
- 不把这轮设计扩展成 weekly 趋势算法重写。

## 核心判断

本设计冻结三个高优先级判断：

1. `历史真实性` 比 `历史产物完整度` 更重要。
2. `无证据` 是一种必须显式呈现的结果，不是可以自动补位的缺口。
3. `live` 与 `historical replay` 必须走不同契约；同一 collector 不能继续同时承担两种语义。

## 现状与关键假设

### 现状

- `run-daily` 当前统一调用 `collectRawSignalsDetailed()`，没有 live / historical adapter 分层。
- `agents-radar` 已具备按日期 digest 读取能力，是真历史基础最好的一条 source。
- `trendshift` 默认运行在 `http` 模式，历史日期下会把当前抓到的 live 页面落成目标日 snapshot。
- `github_trending` 与 `watchlist_live_activity` 当前本质上仍是“执行时即时查询”，不是目标日历史查询。
- `github_live_star_delta` 当前是运行时计算，不是长期可回放事件仓库。

### 关键假设

- 当 `requestedDate < currentLocalDate` 时，系统必须进入 `historical_replay` 模式。
- 历史模式下，任何 source 都不得主动发起“为了回放过去一天而重新抓当前 live 页面”的行为。
- 未来可回放能力依赖归档与观察回执积累，因此设计必须覆盖“从今天开始逐日变真”。

## 总体方案

```text
CLI mode router
  -> live collection path
  -> historical replay path

live collection path
  -> current collectors
  -> archive writers
  -> observation receipts

historical replay path
  -> per-source historical adapters
  -> replay-safe source filtering
  -> report / weekly generation
  -> independent verification
```

## 运行模式路由

### 1. Report Generation Mode

新增顶层运行模式：

- `live_daily`
  条件：`requestedDate == currentLocalDate`
- `historical_replay`
  条件：`requestedDate < currentLocalDate`

CLI 路由规则：

- `run-daily --date <today>` 走 `live_daily`
- `run-daily --date <past-date>` 走 `historical_replay`
- `run-weekly --date <past-date>` 对窗口内缺失日补跑时，一律调用 `historical_replay`
- `run-weekly --backfill-missing-days` 对非当天缺失日同样走 `historical_replay`

禁止行为：

- `historical_replay` 内调用 live HTML / live API collector 并把结果标成目标日

## 历史能力模型

### 2. Source Historical Capability

对每个 source 冻结如下能力等级：

- `exact`
  - source 直接持有目标日证据
  - 允许进入历史主榜单
- `bounded`
  - source 仅在有限条件下可持有目标日证据
  - 是否允许进入主榜单，由 source-specific 规则决定
- `derived`
  - 仅能重建代理信号
  - 不允许进入历史主榜单
- `unavailable`
  - 无法证明目标日
  - 不允许进入历史主榜单

### 3. Historical Source Evidence Contract

新增 `HistoricalSourceEvidence`：

```ts
interface HistoricalSourceEvidence {
  source: string;
  requested_date: string;
  effective_date: string | null;
  acquired_at: string | null;
  report_generation_mode: "live_daily" | "historical_replay";
  history_mode: "exact" | "bounded" | "derived" | "unavailable";
  evidence_kind:
    | "digest"
    | "archived_snapshot"
    | "official_historical_api"
    | "event_log"
    | "adjacent_snapshots"
    | "derived_proxy"
    | "none";
  replay_safe: boolean;
  artifact_ref: string | null;
  observation_receipt_ref: string | null;
  fallback_reason?: string;
}
```

契约：

- `replay_safe=true` 才允许作为历史主榜单新鲜来源
- `artifact_ref` 必须指向独立归档或源证据
- `observation_receipt_ref` 用于证明“当天确实观察到了空结果”

## 归档层设计

### 4. Archive Store

新增 `data/archive/`，按 source 分层：

```text
data/archive/
  agents-radar/
    digests/YYYY-MM-DD/
    manifests/YYYY-MM-DD.json
  trendshift/
    snapshots/YYYY-MM-DD/{page.html, extracted.json, metadata.json}
    receipts/YYYY-MM-DD.json
  github-trending/
    snapshots/YYYY-MM-DD/{html, parsed.json, metadata.json}
    receipts/YYYY-MM-DD.json
  watchlist/
    events/YYYY-MM-DD.ndjson
    receipts/YYYY-MM-DD.json
  github-stars/
    snapshots/YYYY-MM-DD.json
    star-events/YYYY-MM-DD.ndjson
    receipts/YYYY-MM-DD.json
```

### 5. Observation Receipt

每个支持历史回放的 source 在 live run 当天必须写观察回执，即使结果为空。

```ts
interface ObservationReceipt {
  source: string;
  observed_date: string;
  acquired_at: string;
  run_mode: "live_daily";
  outcome: "non_empty" | "empty" | "failed";
  query_scope: string;
  artifact_ref: string | null;
  notes: string[];
}
```

作用：

- 证明“当天确实做过观察”
- 证明“empty”是观察结果，不是缺文件
- 为历史 replay 提供“可声明零结果”的最小证据

## Source 级方案

### 6. `agents-radar`

历史能力：

- `exact`

设计：

- 继续按 `manifest + digests/YYYY-MM-DD/*.md` 读取
- 额外归档当日 `manifest` 与 repo sync 元数据
- 若目标日 digest 不存在，可向过去回退为 `effective_date < requested_date`
- 回退后的 `history_mode` 仍可视为 `exact` 对 `effective_date` 成立，但对 `requested_date` 需标注 `fallback_reason`

主榜单规则：

- 若业务仍允许 `agents-radar` 在历史 replay 中参与候选池，它只能以 `context` 或显式冻结后的历史 source 角色进入
- 不得冒充“当日实时发现”

### 7. `trendshift_live`

历史能力：

- `exact`：仅当存在目标日 archived snapshot 或官方历史 API
- `unavailable`：只有当前 live 页面、无目标日归档时
- `derived`：若未来基于其它数据重建代理榜单

设计：

- live mode 成功抓取后，保存：
  - 原始 HTML
  - 解析后的结构化结果
  - metadata
  - observation receipt
- historical replay 只允许读取：
  - `data/archive/trendshift/snapshots/<requested-date>/...`
  - 或官方历史 API 结果
- 禁止在历史模式下重新抓 `trendshift.io` 当前页面并保存成过去日期

主榜单规则：

- `exact + replay_safe=true` 才可进入历史主榜单
- `derived` 只能进入补充观察区

### 8. `github_trending`

历史能力：

- `exact`：仅当存在目标日 archived trending snapshot
- `derived`：基于 Search / stars / events 重建的代理 trending
- `unavailable`：无目标日归档，且未启用代理模式

设计：

- live mode 每天固定抓取 GitHub Trending HTML，并归档解析结果与观察回执
- historical replay 优先读 archived snapshot
- 当前基于 Search API 的 `pushed:>=date` 查询不再被视为历史 `github_trending`
- 若要保留该能力，必须改名为独立 source，例如 `github_trending_proxy`

主榜单规则：

- `github_trending` 仅在 archived snapshot 存在时才是历史主榜单合法来源
- `github_trending_proxy` 永远不得冒充原始 GitHub Trending 历史榜单

### 9. `watchlist_live_activity`

历史能力：

- `bounded`
  - 最近窗口内可由事件流或已归档回执提供真历史
- `unavailable`
  - 超出保留范围且无自有仓库存档

设计：

- live mode 新增 watchlist event ingester
- 写入：
  - 当日 repo events / org events 的 append-only NDJSON
  - 观察回执
- historical replay 对“有活动 / 无活动”的判断只允许依赖：
  - 目标日 event log
  - 或目标日 empty receipt
- 不再通过“今天查 repo 的 `pushed_at` 恰好等于过去日期”来宣称真历史

主榜单规则：

- `bounded + replay_safe=true` 允许进入历史主榜单
- `bounded` 的时间边界与数据来源必须写入 metadata，不能隐藏

### 10. `github_live_star_delta`

历史能力：

- `exact`
  - 有目标日 star event journal
- `bounded`
  - 有相邻日 snapshot 链条
- `unavailable`
  - 无事件、无相邻快照

设计：

- 指标拆分为两个独立概念：
  - `gross_star_additions_daily`
  - `net_star_count_delta_daily`
- live mode：
  - 保存目标日 repo star snapshots
  - 对重点候选保存 stargazer event 增量
  - 写 observation receipt
- historical replay：
  - 优先用 event journal 计算 `gross additions`
  - 其次用 `snapshot(today) - snapshot(yesterday)` 计算 `net delta`
  - 若两者都不存在，则标 `unavailable`

主榜单规则：

- 历史 daily 使用该 source 时，必须清楚说明它是 `gross additions` 还是 `net delta`
- 不能继续用模糊的单个 `star_delta_daily` 掩盖来源差异

## Historical Adapter 接口

### 11. Adapter Contract

新增 source 历史 adapter：

```ts
interface HistoricalSourceAdapter<TArtifact> {
  source: string;
  supports(requestedDate: string): Promise<{
    history_mode: "exact" | "bounded" | "derived" | "unavailable";
    replay_safe: boolean;
    reason: string;
  }>;
  fetch(requestedDate: string): Promise<{
    rows: RawSignal[];
    evidence: HistoricalSourceEvidence;
  }>;
}
```

规则：

- `supports()` 必须先给出可用性与边界
- `fetch()` 不允许在 historical mode 中做新的 live 采集决策
- 每个 adapter 必须返回独立 `evidence`

## 主榜单准入规则

### 12. Historical Main Board

历史 daily 的“当天明星项目”改为“目标日主榜单”，其准入规则冻结为：

1. 项目至少命中一个 `replay_safe=true` 的 freshness-driving source
2. 该 source 的 `history_mode` 必须为：
   - `exact`
   - 或设计明确允许进主榜单的 `bounded`
3. 仅 `derived` 或 `unavailable` source 命中的项目不得进入主榜单
4. `context` source 只能进补充观察区

本设计在此进一步冻结 `bounded` 的准入边界：

- 允许进入历史主榜单的 `bounded` 仅限：
  - `watchlist_live_activity`，且 `evidence_kind=event_log`
  - `github_live_star_delta`，且 `evidence_kind=adjacent_snapshots` 或 `event_log`
- 其它 `bounded` source 一律只允许进入补充观察区，直到后续设计另行批准

### 13. Historical Empty Board

若历史模式下没有满足准入规则的主榜单项目：

- 允许主榜单为空
- 必须显式输出“目标日缺少可回放的新鲜主榜单证据”
- 不允许自动用 context / derived 项目填满主榜单

## Report 与 Verify 契约

### 14. Daily Report Additions

新增 report 字段：

- `report_generation_mode`
- `historical_integrity_status`
- `historical_integrity_summary_cn`
- `source_history_evidence[]`

其中：

- `historical_integrity_status`
  - `replay_exact`
  - `replay_bounded`
  - `replay_mixed`
  - `replay_unavailable`

表达规则：

- `live_daily` 继续使用现有 freshness 文案
- `historical_replay` 不再使用 `fresh_today` 作为用户首层语义

### 15. Verify-Daily

`verify-daily` 在历史模式下必须做独立校验：

1. 读取 `source_history_evidence`
2. 检查 `artifact_ref` 是否存在
3. 检查 `artifact_ref` 对应 metadata 的 `observed_date/effective_date`
4. 检查空结果是否有 `observation_receipt_ref`
5. 检查主榜单项目是否只依赖 `replay_safe=true` source

失败条件：

- evidence 缺失
- evidence 与 report 自述不一致
- 主榜单混入 `derived` / `unavailable` freshness-driving source

## Weekly Backfill 规则

### 16. Historical Daily Eligibility

weekly window 中的 day 只有满足以下条件才算“可消费历史 daily”：

- daily artifact 存在
- 结构契约满足 weekly 消费要求
- `report_generation_mode` 已写明
- 若为 `historical_replay`，则 `historical_integrity_status` 不能是 `replay_unavailable`
- daily 主榜单未使用不合法的伪历史 freshness-driving source

### 17. Weekly Failure Policy

当窗口内存在以下情况，weekly 必须失败并给出待处理日期：

- 缺失 daily artifact
- daily 为旧版不兼容结构
- daily 的历史完整性状态不满足最低要求

本设计选择：

- 对 weekly，采用“失败即阻断”，而不是“带伪历史继续生成但提示一下”

原因：

- weekly 比 daily 更强调跨天一致性
- 若继续吞下伪历史日，会把单日污染放大为趋势污染

## 失败与拒绝策略

### 18. 明确失败的场景

以下情况必须显式失败或拒绝主榜单准入：

- 历史 replay 过程中试图调用 live-only source collector
- source 仅有执行当天结果，无目标日归档/事件/回执
- 缺少 empty receipt，却试图声明“目标日没有该类事件”
- 使用 `derived proxy` 冒充原始 source
- weekly window 内含不可信历史 daily

### 19. 显式降级的场景

以下情况允许继续生成历史 daily，但必须降级：

- 只有部分 freshness-driving source 具备回放能力
- 仅能形成补充观察区，无法形成主榜单
- star delta 只能以 snapshot net delta 形式提供，而非事件级 additions

## 测试与验证设计

### 20. 单元与集成

必须新增的验证类型：

- historical mode route 测试
- per-source adapter capability 测试
- archive writer / receipt writer 测试
- verify-daily 独立 evidence 测试
- weekly 对历史 integrity 的拒绝测试
- “空主榜单但补充观察存在”测试
- “不得把 live fetch 标成 past-date exact”回归测试

### 21. 关键回归场景

1. `run-daily --date <past-date>` 在 Trendshift 无归档时，不再抓当前 live 页面冒充过去结果
2. `run-daily --date <past-date>` 在 GitHub Trending 无快照时，不再把 Search API 结果当历史 Trending
3. `watchlist` 没有目标日事件也没有回执时，不能宣布“当天无活动”
4. `run-weekly --backfill-missing-days` 遇到伪历史 daily 时阻断生成
5. live run 写空回执后，历史 replay 可以合法得出“该日观察为空”

## 实施阶段

### Phase 1：语义止血

- 引入 `report_generation_mode`
- 引入 `HistoricalSourceEvidence`
- 历史模式禁用 live collector
- verify 增加最小独立校验

### Phase 2：归档与回执

- 新增 `data/archive/`
- Trendshift / GitHub Trending / watchlist / stars 的 archive writer
- 新增 empty / non-empty receipts

### Phase 3：Historical Adapters

- 为各 source 实现 `HistoricalSourceAdapter`
- 替换历史 replay 路径上的现有 collector 直连

### Phase 4：Weekly Gate

- weekly window 增加历史完整性门禁
- 对不可信历史 daily 明确阻断

## 取舍

### 取舍 1：不追求立即补齐所有过去日期

接受：

- 过去若没有归档，部分 source 只能返回 `unavailable`

不接受：

- 用当天 live 结果伪装成过去 exact 历史

### 取舍 2：代理趋势与原始趋势分名

接受：

- 引入 `github_trending_proxy` 这类名字，承认它是代理重建

不接受：

- 继续把代理查询结果叫 `github_trending`

### 取舍 3：weekly 从宽还是从严

本设计选择从严：

- 历史 daily 不可信时，weekly 阻断

原因：

- 周趋势结论比单日报更容易被误信为稳定事实

## 设计完成定义

当以下条件满足时，本设计可进入 ExecPlan：

1. live / historical 双模式路由已冻结
2. source 历史能力与准入规则已冻结
3. archive / receipt / evidence 契约已冻结
4. weekly 对历史 daily 的门禁策略已冻结
5. verify 的独立校验对象已冻结

## 后续扩展

- visual console 是否需要独立的历史完整性展示模型，不阻塞本设计进入 ExecPlan；当前默认复用 daily / run-summary 的 replay 字段。
