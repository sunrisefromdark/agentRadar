# 执行计划：AgentReach 候选解释增强层

## 文档状态

- 版本：`v0.1`
- 当前状态：`Approved for Implementation`
- 关联需求：`docs/specs/product-specs/外部发现与补证信号层需求分析.md`
- 关联设计：`docs/specs/design-docs/agentreach-candidate-explanation-enhancement-design.md`
- 计划范围：为 AgentReach 外部发现候选新增后端 display-only 解释增强层，生成“它是什么 / 为什么值得看”的 public-safe explanation artifact，并让 `/agentreach` view-model 可优先消费该产物。
- 非目标：不做外部讨论趋势，不扩 Agent-Reach 上游，不新增平台 API，不修改主评分，不让前端直接调用 DeepSeek，不提交本地真实运行生成的 explanation artifact。

## 任务信息

| 字段 | 内容 |
| --- | --- |
| 任务名称 | AgentReach Candidate Explanation Enhancement |
| 负责人 | Codex |
| 风险等级 | `High` |
| 关联设计 | `docs/specs/design-docs/agentreach-candidate-explanation-enhancement-design.md` |
| 主要影响范围 | `src/externalDiscovery/`、`src/action/*`、`src/visualConsole/*`、`app/client/*`、`src/__tests__/*`、`docs/specs/*` |
| 主要产物 | `external-discovery.candidate-explanations.v1` artifact、候选解释 input builder、public-safe 校验、LLM 摘要生成与 fallback、view-model merge |

## 目标

在现有 AgentReach external discovery aggregate 基础上，补齐候选解释增强层，让 `/agentreach` 页面能够基于后端产物展示：

- `它是什么`：候选项目、产品、论文或方向线索的可读说明。
- `为什么值得看`：今天进入外部发现页面的外部层原因。
- `还需要确认什么`：外部层作为次级信号的限制与 caveat。

该增强层只消费 public-safe aggregate、项目库/observer 已有简介、sanitized title 等安全输入；LLM 失败或输出不合格时必须回退规则文案，且不得影响 `DailyExternalAggregate` 生成。

## 设计冻结摘要

1. 新增旁路 artifact，而不是把 LLM 摘要直接写入 `DailyExternalAggregate`。
2. `CandidateExplanationInput` 是 LLM prompt 的唯一输入包；必须先通过 public-safe 校验。
3. `public_evidence_titles` / `public_source_titles`、`existing_project_brief_cn`、`repo_description` 是解释“它是什么”的关键输入，不得被实现阶段跳过。
4. 默认 eligible candidate 覆盖 `top_n=30`；增强覆盖率低于 70% 时 artifact `status=partial`。
5. `rules_fallback` 只保证页面不空，不计入增强覆盖率。
6. `summary_confidence` 只表示解释输入是否足够，不表示项目质量或主榜可信度。
7. 方向候选必须显示为方向线索，不得伪装成项目。
8. 前端不直接调用 LLM，不暴露 `DEEPSEEK_API_KEY`。

## 新增 / 修改模块

### 新增模块

- `src/externalDiscovery/explanations.ts`
  - 定义 `ExternalCandidateExplanationArtifact`、`ExternalCandidateExplanation`、`CandidateExplanationInput` 等类型。
  - 实现 candidate key、scope、summary source、confidence、status / reason code 的基础 helper。
  - 实现 `buildCandidateExplanationInputs`。
  - 实现 `generateExternalCandidateExplanations`。
  - 实现 LLM 输出解析、校验、fallback、audit 聚合。

- `src/externalDiscovery/explanationPrompts.ts`
  - 构建固定中文 prompt。
  - 只接收 `CandidateExplanationInput[]`。
  - 要求 JSON-only 输出，不允许 markdown。
  - 固定禁止过度结论、方向伪装项目、无依据功能编造。

- `src/externalDiscovery/explanationRedaction.ts`
  - 实现 `assertPublicSafeCandidateExplanationInputs`。
  - 实现 `assertPublicSafeCandidateExplanations`。
  - 复用或调用 `src/externalDiscovery/redaction.ts` 中已有敏感字符串检测能力。
  - 输出稳定 reason code。

- `src/externalDiscovery/explanationPaths.ts` 或扩展 `src/externalDiscovery/paths.ts`
  - 增加：
    - `externalCandidateExplanationsPath(date)`
    - `externalCandidateExplanationsLatestPath()`
  - 路径固定为：
    - `data/external-discovery/YYYY-MM-DD.candidate-explanations.json`
    - `data/external-discovery/latest.candidate-explanations.json`

### 修改模块

- `src/externalDiscovery/agentReachProvider.ts`
  - 如当前 canonical event / aggregate 缺少 public-safe title 上下文，保留现有行为，不回读 raw body。
  - 若已有 provider item title 可安全使用，映射到 explanation input builder 可消费的 sanitized title context。
  - 不得把 raw post body、评论全文、handle、profile URL 写入 public aggregate 或 explanation input。

- `src/externalDiscovery/aggregate.ts`
  - 不反向写入 LLM 摘要。
  - 可暴露 input builder 所需的 project / direction evidence lookup helper。

- `src/externalDiscovery/dailyIntegration.ts`
  - 在 daily external aggregate 生成并通过 public-safe 校验后，调用 explanation generator。
  - 作为 explanation generation 的唯一 orchestration owner。
  - dry-run 时不得写真实 explanation artifact。
  - LLM disabled 时可返回 skipped artifact 或 null，由 exec 阶段按现有 action 风格选择。

- `src/action/dailyReport.ts`
  - 只消费 external discovery orchestration result。
  - 不负责构建 `CandidateExplanationInput`。
  - 不直接调用 LLM 或写 explanation artifact。

- `src/visualConsole/agentReachViewModel.ts`
  - 读取 `latest.candidate-explanations.json` 或对应日期 artifact。
  - 校验 `aggregate_source_input_hash` / `input_context_hash` 与当前 aggregate 匹配。
  - merge explanation 到候选 view-model。
  - 中文页优先展示 `what_it_is_cn` / `why_watch_cn`；英文页继续使用英文规则 fallback。

- `app/client/AgentReachView.tsx`
  - 只消费 view-model 字段。
  - 不发起 LLM 请求。
  - 不改变当前布局大结构；只让“它是什么 / 为什么值得看”区域优先使用后端解释摘要。

- `src/visualConsole/types.ts`
  - 如 UI worktree 当前已有 `intro_line`、`appearance_reason`、`why_watch_reasons`，新增 explanation 字段时保持兼容。
  - 建议新增 display 字段：
    - `what_it_is`
    - `why_watch`
    - `summary_confidence`
    - `summary_source`
    - `explanation_caveats`

## 阶段进度

| 阶段 | 状态 | 目标 | 完成标志 |
| --- | --- | --- | --- |
| Phase 0：实现前护栏 | `Done` | 锁定分支、输入文档、禁止触碰主评分和产品生态工作 | 结构检查确认只在 AgentReach 后端/UI 相关边界内改动 |
| Phase 1：类型、路径与 public-safe 契约 | `Done` | 建立 explanation artifact 类型、路径、reason code 和安全校验 | 类型测试与 redaction 测试通过 |
| Phase 2：CandidateExplanationInput 构建 | `Done` | 从 aggregate、项目库/observer、sanitized title context 构建 LLM 输入包 | input builder 测试覆盖项目、方向、外部补证、缺 title 降级 |
| Phase 3：LLM 生成、校验与 fallback | `Done` | 复用 `callStructuredEnhancement` 生成中文摘要，并按规则拒绝/回退 | 测试覆盖 existing brief、全 fallback 不得 ok、LLM disabled |
| Phase 4：daily orchestration 与 artifact 写入 | `Done` | aggregate 生成后写 candidate explanations 与 latest 指针 | integration smoke 覆盖 sanitized fixture 写入 |
| Phase 5：Visual Console / UI merge | `Done` | `/agentreach` 中文页优先展示后端解释；英文页规则 fallback | 当前 worktree 无 React AgentReach 页面，已提供 readLayer 消费入口与 verification 契约 |
| Phase 6：验证、真实 dry-run 与清理 | `Done` | focused tests、typecheck、preflight、真实样本检查 | focused tests、external discovery regression、typecheck、preflight check 已通过 |

## 实施阶段

### Phase 0：实现前护栏

1. 确认当前工作区和分支：
   - 后端分支：`codex/agentreach-backend-named-actors` 或本任务专用 AgentReach 分支。
   - UI worktree 如需改展示，只触碰 AgentReach view-model / view 文件。
2. 阅读并记录设计依据：
   - `docs/specs/design-docs/agentreach-candidate-explanation-enhancement-design.md`
   - `docs/specs/design-docs/agent-reach-external-discovery-and-evidence-design.md`
   - `docs/specs/product-specs/外部发现与补证信号层需求分析.md`
3. 结构护栏：
   - 不改 `ScoreBreakdown`。
   - 不改 `RawSignal` 主链路语义。
   - 不新增 live GitHub / X / Reddit / HN API 请求。
   - 不让 React / browser 直接读取 `DEEPSEEK_API_KEY`。
4. 若发现当前分支混入产品生态任务改动，停止并先整理工作区。

### Phase 1：类型、路径与 public-safe 契约

1. 新增或扩展类型：
   - `ExternalCandidateExplanationArtifact`
   - `ExternalCandidateExplanation`
   - `CandidateExplanationInput`
   - `ExternalCandidateExplanationStatus`
   - reason code 类型：
     - `llm_disabled`
     - `no_candidates`
     - `candidate_explanation_ok`
     - `partial_llm_failure`
     - `summary_generation_failed`
     - `summary_validation_failed`
     - `input_context_insufficient`
     - `public_safe_validation_failed`
     - `provider_unavailable`
     - `unexpected_exception`
     - `candidate_key_missing`
     - `candidate_not_eligible`
     - `public_title_context_missing`
     - `project_brief_reused`
     - `llm_output_rejected`
     - `rules_fallback_used`
     - `direction_candidate_low_confidence`
     - `primary_source_confirmation_required`
2. 增加路径 helper：
   - `externalCandidateExplanationsPath(date)`
   - `externalCandidateExplanationsLatestPath()`
3. 实现 public-safe 校验：
   - input 校验拒绝 token、profile URL、raw handle、长正文、markdown link、未脱敏 URL 列表。
   - output 校验拒绝 token、profile URL、raw handle、markdown link、过度结论、方向语义缺失、重复摘要、无依据机构/功能声明。
4. 测试：
   - unsafe input title 被拒绝。
   - unsafe explanation 被拒绝。
   - artifact 缺少 `public_safe=true` 或 `contains_raw_text=false` 时失败。

### Phase 2：CandidateExplanationInput 构建

1. 冻结 sanitized title context contract：
   - `agentReachProvider.ts` 只提取 provider item 中可 public-safe 使用的 `title` / target name，不保留 raw body、评论全文、handle、profile URL。
   - title context 不反写 `DailyExternalAggregate`。
   - title context 只作为 `buildCandidateExplanationInputs` 的第二输入：`aggregate + titleContext`。
   - title context 必须参与 `input_context_hash`。
   - 如果只有 `DailyExternalAggregate` 而没有 title context，input builder 必须继续运行，但对应候选记录 `public_title_context_missing`，并将 `input_confidence` 降为 `medium` 或 `low`。
   - title context 结构建议为：

```ts
interface CandidateExplanationTitleContext {
  event_id?: string;
  target_key: string;
  target_display_name?: string;
  public_evidence_title?: string;
  public_source_title?: string;
  source_platform: ExternalPlatform;
}
```

2. 从 `DailyExternalAggregate` 构建候选索引：
   - `observation_candidates` 作为候选基准。
   - `project_evidence` / `direction_evidence` 按 `target_key` 关联。
   - 无法关联 evidence 的候选保留，但 `input_confidence=low`。
3. 生成 `candidate_key`：
   - 格式固定为 `${candidate_kind}:${target_key}`。
   - 同一 aggregate 内冲突时记录 warning 并稳定去重。
4. 判定 `explanation_scope`：
   - `external_evidence_boost`：已有候选补证语义或 evidence `derived_signal_kinds` 包含 `evidence` 且对象已知。
   - `bound_object`：项目 / 产品 / 论文候选有 repo/object URL 或已知 project brief。
   - `direction_signal`：direction candidate、direction evidence、无明确对象绑定。
5. 收集语义输入：
   - `existing_project_brief_cn`：从 project library / observer / daily report 复用。
   - `repo_description`：只从已有主链路项目数据读取，不新增 live GitHub 请求。
   - `public_evidence_titles` / `public_source_titles`：只使用 sanitized title context；最多 5 条，每条不超过 160 字符。
   - `evidence_reason_facts`：规则生成外部层原因，如平台、跨平台、具名讨论者、可进日报/周报、需主源确认。
6. 排序和 eligible selection：
   - 默认 `top_n=30`。
   - 排序：`external_evidence_boost` > `bound_object` > `direction_signal`。
   - 同类按 evidence 数、平台数、`top_tier_actor_count`、`mention_count` 降序。
   - direction eligible 至少前 5 个。
7. 测试：
   - 项目候选含 repo URL 和 title 时 `input_confidence` 至少 `medium`。
   - 有 `project_brief_cn` 的候选 `input_confidence=high`。
   - 方向候选 scope 固定为 `direction_signal`。
   - 缺 title / description 时记录 `public_title_context_missing`。
   - 只有 aggregate、没有 title context 时仍可生成 fallback input，但不得标记 high confidence。

### Phase 3：LLM 生成、校验与 fallback

1. 复用 `callStructuredEnhancement`：
   - 不新增新的 provider 注册方式。
   - 读取现有 `config.llm` 和 `LLM_PROVIDER=deepseek` 等配置。
2. Prompt 规则：
   - 输入为 `CandidateExplanationInput[]`。
   - 输出 JSON object：`{ explanations: [...] }`。
   - 禁止 markdown。
   - 禁止访问互联网、禁止推测未提供功能。
   - 方向候选必须写“方向线索”。
   - 证据不足必须写“仍需 GitHub / Trendshift 主链路确认”。
3. 输出校验：
   - candidate key 必须匹配。
   - 中文字段非空，建议 30-140 中文字符。
   - 不得包含 URL / markdown / token / profile URL。
   - 不得包含主榜结论、确定爆发、趋势已成等表达。
   - 未提供功能描述时不得编造具体能力。
   - 重复摘要拒绝或回退。
4. Fallback：
   - `existing_project_brief_cn` 直接生成 `summary_source=existing_project_brief`。
   - LLM disabled：artifact `status=skipped` 或 generator 返回 null，按 action 风格在 Phase 4 冻结。
   - 单候选失败：`rules_fallback`。
   - 增强覆盖率低于 70%：artifact `status=partial`。
   - 增强覆盖率为 0 且候选数大于 0：artifact `status=failed` 或 `skipped`。
5. 测试：
   - LLM stub 成功返回项目简介。
   - LLM stub 返回非法 JSON，repair 或 fallback。
   - LLM 输出“已经成为趋势”被拒绝。
   - 方向候选不含“方向/线索”被拒绝。
   - 全部 fallback 不得标记为 `ok`。

### Phase 4：daily orchestration 与 artifact 写入

1. 在 daily external aggregate 生成并通过 `assertPublicSafeAggregate` 后执行：
   - `buildCandidateExplanationInputs`
   - `assertPublicSafeCandidateExplanationInputs`
   - `generateExternalCandidateExplanations`
   - `assertPublicSafeCandidateExplanations`
   - 写入 date artifact 和 latest artifact
2. 写入策略：
   - 非 dry-run 写：
     - `data/external-discovery/YYYY-MM-DD.candidate-explanations.json`
     - `data/external-discovery/latest.candidate-explanations.json`
   - dry-run 不写盘，只返回 planned writes。
   - 本地真实运行产物默认不提交。
3. `input_context_hash`：
   - 对排序后的 `CandidateExplanationInput[]` 做稳定 hash。
   - UI merge 时必须匹配。
4. run-summary / verification：
   - 记录 explanation status、eligible、attempted、enhanced、fallback、warnings。
   - explanation failed 不阻断主 daily。
5. 测试：
   - dry-run 不写 explanation artifact。
   - latest 指针写入正确。
   - source hash / input context hash 不匹配时 verify warning 或 fail。

### Phase 5：Visual Console / UI merge

1. view-model 读取：
   - 当前 date 对应 explanation artifact 优先。
   - fallback 到 `latest.candidate-explanations.json` 时必须与当前 aggregate hash 匹配。
2. merge 规则：
   - `what_it_is_cn` -> 中文页 `它是什么`。
   - `why_watch_cn` -> 中文页 `为什么值得看`。
   - `caveats` -> `还需要确认什么`。
   - `summary_source` / `summary_confidence` 可作为低调 chip 或调试字段，不抢主内容。
3. 英文页：
   - 不展示中文 LLM 摘要。
   - 继续使用英文规则 fallback。
   - 后续英文摘要需新增 `what_it_is_en` / `why_watch_en`。
4. UI 约束：
   - 不改变当前 `/agentreach` 页面大布局。
   - 不新增搜索框。
   - 不把外部层写成主榜结论。
5. 测试：
   - 中文页展示 LLM `它是什么` 和 `为什么值得看`。
   - 英文页不泄漏中文摘要。
   - artifact 缺失时规则 fallback 正常。
   - hash 不匹配时不使用 stale explanation。

### Phase 6：验证、真实 dry-run 与清理

1. focused tests：

```powershell
corepack pnpm exec vitest run src/__tests__/externalDiscoveryCandidateExplanations.test.ts src/__tests__/externalDiscoveryCandidateExplanationRedaction.test.ts src/__tests__/externalDiscoveryCandidateExplanationInput.test.ts src/__tests__/visualConsoleAgentReachViewModel.test.ts src/__tests__/visualConsoleAgentReachPresentation.test.ts
```

2. existing external discovery regression：

```powershell
corepack pnpm exec vitest run src/__tests__/externalDiscoveryAdapter.test.ts src/__tests__/externalDiscoveryAggregate.test.ts src/__tests__/externalDiscoveryRedaction.test.ts src/__tests__/externalDiscoveryVerification.test.ts
```

3. typecheck：

```powershell
corepack pnpm run typecheck
```

4. implementation preflight：

```powershell
corepack pnpm run code-implementation:preflight -- --write
corepack pnpm run code-implementation:preflight -- --check
```

5. 真实或近真实 dry-run：

```powershell
corepack pnpm exec tsx src/cli.ts run-daily --date <YYYY-MM-DD> --external-discovery-input data/raw/external-discovery/<YYYY-MM-DD>.agent-reach.json --dry-run
```

dry-run 验收检查：

- planned writes 中包含 date explanation artifact 和 latest explanation artifact。
- dry-run 不写入真实 `*.candidate-explanations.json`。
- 输出包含 explanation status、eligible、attempted、enhanced、fallback、warnings。

6. non-dry local smoke：

```powershell
corepack pnpm exec tsx src/cli.ts run-daily --date <YYYY-MM-DD> --external-discovery-input data/raw/external-discovery/fixtures/<fixture>.agent-reach.json
```

non-dry local smoke 只允许使用 sanitized fixture，不允许使用包含 raw social text、profile URL、handle、token 或 private diagnostics 的真实 raw input。

non-dry 验收检查：

- 生成 `data/external-discovery/<YYYY-MM-DD>.candidate-explanations.json`。
- 生成或更新 `data/external-discovery/latest.candidate-explanations.json`。
- `aggregate_source_input_hash` 和 `input_context_hash` 存在。
- artifact 通过 `assertPublicSafeCandidateExplanations`。
- 至少 5 个真实候选的 `what_it_is_cn` 不得全部退化为“被外部讨论提到的候选”。
- 有 `project_brief_cn` 的候选必须使用 `existing_project_brief`。
- 方向候选必须保留“方向线索”语义。
- explanation artifact 不包含 raw handle、profile URL、token、markdown link、长正文。
- LLM 失败不影响 external aggregate。

7. 清理：
   - 不提交 `data/external-discovery/*.candidate-explanations.json` 本地真实运行产物。
   - non-dry local smoke 后删除本次生成的 date explanation artifact；如 latest 指针被更新，应恢复到测试前状态或删除测试 latest。
   - 只保留 sanitized fixture 和测试需要的小样本。

## 新增测试文件建议

- `src/__tests__/externalDiscoveryCandidateExplanations.test.ts`
- `src/__tests__/externalDiscoveryCandidateExplanationInput.test.ts`
- `src/__tests__/externalDiscoveryCandidateExplanationRedaction.test.ts`
- `src/__tests__/externalDiscoveryCandidateExplanationPaths.test.ts`
- 更新：
  - `src/__tests__/externalDiscoveryVerification.test.ts`
  - `src/__tests__/visualConsoleAgentReachViewModel.test.ts`
  - `src/__tests__/visualConsoleAgentReachPresentation.test.ts`

## 验收标准

1. 生成 `external-discovery.candidate-explanations.v1` artifact。
2. explanation artifact 包含 `public_safe=true`、`contains_raw_text=false`、`contains_profile_urls=false`。
3. `CandidateExplanationInput` 通过 public-safe 校验后才进入 LLM prompt。
4. 启用 LLM 且存在候选时，eligible top 30 的增强覆盖率低于 70% 不得标记 `ok`。
5. `rules_fallback` 不计入增强覆盖率。
6. 有 `existing_project_brief_cn` 的候选必须生成 `summary_source=existing_project_brief`。
7. 方向候选不得被写成明确项目。
8. LLM 输出过度结论、重复摘要、无依据功能声明时必须被拒绝。
9. 前端中文页优先展示后端解释摘要；英文页不泄漏中文摘要。
10. 外部解释增强不改变主 score、`RawSignal`、`DailyExternalAggregate` 事实契约或 primary conclusion。

## 回滚策略

1. 如果 explanation generator 出现问题：
   - 禁用 LLM 或跳过 explanation artifact 生成。
   - `/agentreach` UI 回退现有规则字段。
   - external aggregate 和 daily 主产物继续可用。
2. 如果 public-safe 校验误伤：
   - 保留 explanation generation skipped / partial 状态。
   - 不放宽 raw text / profile URL / token 禁止项。
3. 如果 UI merge 出现 stale artifact：
   - 通过 `aggregate_source_input_hash` / `input_context_hash` 禁用该 explanation artifact。
   - 回退规则 fallback。
4. 回滚不得删除或修改 `DailyExternalAggregate` 既有字段。

## 验证记录

| 日期 | 命令 | 结果 | 备注 |
| --- | --- | --- | --- |
| 2026-07-01 | `ExecPlan created` | `Pending review` | 仅生成计划，尚未执行代码实现 |
| 2026-07-01 | `ExecPlan review` | `Approved with nits` | 已确认可进入代码实现；实现时优先扩展 `paths.ts`，并在 `dailyIntegration` 归一 LLM disabled 为 `skipped` |
| 2026-07-01 | `corepack pnpm exec vitest run src/__tests__/externalDiscoveryCandidateExplanationInput.test.ts src/__tests__/externalDiscoveryCandidateExplanationRedaction.test.ts src/__tests__/externalDiscoveryCandidateExplanations.test.ts src/__tests__/externalDiscoveryDailyIntegration.test.ts src/__tests__/externalDiscoveryTypeContract.test.ts src/__tests__/externalDiscoveryStructure.test.ts src/__tests__/externalDiscoveryVerification.test.ts` | `Passed` | 7 files / 17 tests |
| 2026-07-01 | `corepack pnpm run typecheck` | `Passed` | TypeScript noEmit 通过 |
| 2026-07-01 | `corepack pnpm exec vitest run src/__tests__/externalDiscoveryAdapter.test.ts src/__tests__/externalDiscoveryAggregate.test.ts src/__tests__/externalDiscoveryRedaction.test.ts src/__tests__/externalDiscoveryVerification.test.ts` | `Passed` | 4 files / 23 tests |
| 2026-07-01 | `corepack pnpm run code-implementation:preflight -- --check` | `Passed` | skill and exec-plan receipt verified |
