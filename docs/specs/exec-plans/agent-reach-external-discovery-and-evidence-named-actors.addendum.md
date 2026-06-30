# 临时 Addendum：AgentReach “谁在讨论”具名讨论者契约

## 文档状态

- 状态：`Merged into Main ExecPlan / Design Review Passed`
- 适用范围：`AgentReach External Discovery & Evidence` 中“谁在讨论”的具名讨论者展示与 public aggregate 契约。
- 关联需求：`docs/specs/product-specs/外部发现与补证信号层需求分析.md`
- 关联设计：
  - `docs/specs/design-docs/agent-reach-external-discovery-and-evidence-design.md`
  - `docs/specs/design-docs/trend-radar-ui-v3-stage-redesign-design.md`
- 关联主计划：`docs/specs/exec-plans/agent-reach-external-discovery-and-evidence-v0.1.exec-plan.md`

本文件原为临时补充。2026-06-30 设计复审通过后，成熟内容已合入主 exec-plan；本文件仅作为审计记录保留，不再作为独立实现入口。实现阶段仍应以主 exec-plan 为准，不得仅凭本 addendum 直接写代码。

## 背景

需求要求系统能表达“谁在讨论”，并区分机构、团队、个人和普通社区讨论层级。原主 exec-plan 已覆盖 entity registry、tier 统计和 public aggregate，但当前公开聚合契约主要表达 actor tier/type/count，尚不足以让 UI 安全展示具名讨论者。

为避免 UI 从 provider raw actor 字段、未脱敏事件或自由文本中临时拼接身份，本 addendum 暂存一个候选执行补充：由聚合层产出 public-safe 的 `named_registry_actors`，UI 只消费该字段。

## 设计复审确认结果

1. 允许 public aggregate 展示 registry 命中的 `display_name + actor_type + registry_tier`，前提是 `display_name` 来自 entity registry 或等价 public-safe canonical entity。
2. `named_registry_actors` 作为 `ExternalEvidence` 的正式字段进入 V1 contract。
3. 空 registry、registry miss、仅 provider tier hint 时，UI 只展示匿名摘要。
4. 具名讨论者需要在 daily、weekly、项目详情和外部发现页复用同一字段。
5. 相关设计文档已更新为 `Approved for ExecPlan`；本补充已合入主 exec-plan，后续复审主 exec-plan。

## 候选契约

```ts
interface ExternalNamedRegistryActor {
  entity_id: string;
  display_name: string;
  actor_type: "institution" | "team" | "person";
  registry_tier: ExternalRegistryTier;
  event_count: number;
  platforms: ExternalPlatform[];
  first_seen_at: string;
  last_seen_at: string;
}

interface ExternalEvidence {
  named_registry_actors: ExternalNamedRegistryActor[];
}
```

`named_registry_actors` 是“谁在讨论”的唯一具名数据入口。字段为空时，不代表没有讨论，只代表没有可 public-safe 具名展示的 registry 命中讨论者。

## 生成规则

1. 仅 `tier_basis="registry"` 且存在 `registry_entity_id` / `registry_tier` 的 canonical event 可以进入 `named_registry_actors`。
2. `display_name` 必须来自 entity registry 或等价 public-safe canonical entity，不得直接复制 provider raw `actor.display_name`。
3. 同一 `ExternalEvidence(scope + target_key)` 内按 `entity_id` 合并。
4. `event_count` 统计该 entity 对当前 evidence 的参与事件数。
5. `platforms` 去重排序。
6. `first_seen_at` / `last_seen_at` 来自该 entity 的事件时间窗口。
7. 输出按 `registry_tier` 优先级 `core -> proven -> watch`、再按 `event_count` 降序、再按 `display_name` 稳定排序。

## 禁止项

- provider raw `actor.display_name` 不得直接成为可信身份。
- raw handle、profile URL、raw social text、provider diagnostics、private metadata 不得进入 `named_registry_actors`。
- 未命中 registry、仅有 `provider_tier_hint`、仅有 provider display name 的 actor 不得具名展示。
- provider hint 不得伪装成 registry tier。
- UI 不得从 provider raw actor 字段、未脱敏事件或自由文本里临时拼接“具名讨论者”。

## 匿名降级

1. 空 registry：`named_registry_actors=[]`，所有 actor 只能进入 `ordinary / unknown` 或匿名统计；`registry_tier_participation` 不成立。
2. 单个 actor registry miss：该 actor 不贡献 `core/proven/watch`，但不影响同一 aggregate 中其他 registry 命中 actor 的统计。
3. 混合 hit/miss：`top_tier_actor_count` 只统计 registry 命中的 `core / proven / watch` actor；miss actor 仅进入 `actor_tiers` / `actor_types` / `distinct_actor_count`。
4. UI 展示：`named_registry_actors` 非空时展示 `具名讨论者`；为空时只展示 `actor_type / effective_tier / count` 匿名摘要。

## 已合入主 exec-plan 的位置

设计复审通过后，本补充已按以下位置合入主 exec-plan：

1. `Phase 1：类型、路径与 redaction 基座`
   - 增加 `ExternalNamedRegistryActor`。
   - 要求 `ExternalEvidence.named_registry_actors` 存在。
   - 增加 public-safe 字段测试。
2. `Phase 3：entity registry、matching 与 topic canonicalization`
   - 增加 registry 命中到 public-safe actor match 的规则。
   - 增加 raw display name / handle / profile URL 不得进入具名身份的测试。
   - 澄清 mixed hit/miss 下 `top_tier_actor_count` 统计口径。
3. `Phase 4：aggregate 与 public artifact 写入`
   - 增加 `named_registry_actors` 聚合规则。
   - 增加空 registry / miss / provider hint 负例。
4. `Phase 6：daily / run-summary / verify 输出`
   - 要求 daily / run-summary 的 external evidence summary 保留或派生“具名讨论者 + 匿名汇总”。
   - verify 检查 public aggregate 不含未脱敏身份字段。
5. `Phase 7：weekly 7 日窗口消费`
   - 要求 weekly direction / project evidence summary 复用同一 `named_registry_actors` 契约。
6. `验收标准 / 验证矩阵`
   - 增加“具名讨论者只来自 registry 命中，未命中只匿名统计”的通过标准。

## 合入验收口径

本 addendum 已在以下条件满足后合入主 exec-plan：

1. 关联设计文档完成复审，并明确允许 public-safe 具名展示 registry 命中实体。
2. 主 exec-plan 的设计来源与实际设计状态一致。
3. `provider_run_id` 可选/必填契约与设计文档对齐，不在本补充中顺手收紧。
4. Phase 6/7 的消费输出承接补齐，避免只生成 aggregate 但用户看不到“谁在讨论”。
5. 合入后重新运行 ExecPlan Review。

## 当前结论

`named_registry_actors` 已从候选方向升级为主 exec-plan 承接的 V1 契约补充。本文件只保留补充来源和边界说明；代码实现必须等待主 exec-plan 复审通过后再开始。
