# 执行计划：侧边助手自然语言搜索

## 文档状态

- 版本：`v0.1`
- 当前状态：`Proposed`
- 设计来源：
  - [侧边助手自然语言搜索需求分析.md](../product-specs/侧边助手自然语言搜索需求分析.md#L1)
  - [自然语言模糊搜索与推荐需求分析.md](../product-specs/自然语言模糊搜索与推荐需求分析.md#L1)
  - [side-assistant-natural-language-search-design.md](../design-docs/side-assistant-natural-language-search-design.md#L1)
  - [natural-language-fuzzy-search-recommendation-design.md](../design-docs/natural-language-fuzzy-search-recommendation-design.md#L1)
- 上游设计门禁：`side-assistant-natural-language-search-design.md` 当前状态为 `Approved for ExecPlan`；本计划以该冻结版本为唯一产品基线，不在实施阶段自行补设计。
- 说明：本计划负责把现有 `/api/projects/fuzzy-search` 从主搜索框 zero-result fallback 中剥离，重组为全局右侧 `AI 搜项目` 助手；不新增后端 endpoint、不新增数据库会话、不扩展 fuzzy response contract、不把助手扩成通用聊天产品。

## 任务信息

| 字段 | 内容 |
| --- | --- |
| 任务名称 | 侧边助手自然语言搜索 |
| 负责人 | Codex |
| 风险等级 | `High` |
| 关联需求 | `docs/specs/product-specs/侧边助手自然语言搜索需求分析.md` |
| 关联设计 | `docs/specs/design-docs/side-assistant-natural-language-search-design.md` |
| 影响范围 | `app/visualConsole/clientScript.ts`、`app/visualConsole/ossPages.ts`、`app/visualConsole/ossProjectsPage.ts`、`app/styles.css`、`src/__tests__/visualConsoleFuzzySearch.test.ts`、`src/__tests__/visualConsoleSearchAlignment.test.ts`、必要时补充同主题 DOM/集成测试 |

## 目标

本计划只落地设计已经冻结的 7 件事：

1. 主项目搜索框只保留现有关键词过滤，普通无结果不再触发 `/api/projects/fuzzy-search`。
2. `AI 搜项目` 成为所有一级视图共享的唯一自然语言搜索入口，而不是第二套项目列表。
3. 助手 runtime 从 `Projects` workbench 生命周期中拆出，变成 route-agnostic 的全局控制器。
4. 助手会话、搜索上下文、主列表结果态、拖动位置都只保存在当前浏览器标签页会话内。
5. 每轮只展示简短说明、最多 3 个项目预览链接和 `查看全部结果`，完整结果统一回到 `Projects` 承接。
6. 在 `Projects` 页点链接优先页内开详情；在其他页点链接则跳到 `Projects` 对应位置，并恢复会话。
7. 用可执行测试守住入口剥离、状态机、scope 恢复、拖动契约、失败降级和 URL 边界，避免实现阶段语义漂移。

## 设计对齐

### 一句话产品 framing

这不是聊天机器人，也不是重做项目搜索页，而是把现有 fuzzy search 包成一个“全局可发现、轻量预览、最终回到 `Projects` 承接”的导览员入口。

### 设计冻结映射

| 设计冻结项 | 落地阶段 | 主落地模块 | 验证锚点 |
| --- | --- | --- | --- |
| 主搜索框剥离 fuzzy | Phase 0 | `clientScript.ts`、`ossProjectsPage.ts` | 普通无结果不再 fetch `/api/projects/fuzzy-search` |
| 全局入口 + route-agnostic runtime | Phase 1 | `ossPages.ts`、`clientScript.ts` | `Overview / Weekly / Observer / KB / Run Health / Projects` 都可打开助手 |
| 右侧全高服务抽屉，而非旧浮层 | Phase 1 | `ossPages.ts`、`ossProjectsPage.ts`、`clientScript.ts` | 助手挂在 app shell/body 级 host，不随 detail 替换而卸载 |
| `collapsed -> open_idle -> submitting -> success_preview -> clarification -> empty_or_hot_fallback -> error` 状态机 | Phase 2 | `clientScript.ts` | 成功/澄清/空/失败都可见且不空白 |
| `sessionStorage` 会话记忆与 `SideAssistantSearchSession` | Phase 2 | `clientScript.ts` | 刷新恢复会话；关闭标签页后自然丢失 |
| 最多 3 条预览链接与 `more` 去重 | Phase 2 | `clientScript.ts` | 不重复 `seen_project_ids`，无新项时明确提示 |
| `查看全部结果` 切主列表，`返回普通项目库` 只清结果态 | Phase 3 | `clientScript.ts`、`ossProjectsPage.ts` | 主列表完全切换 / 结果态可撤销 / 对话保留 |
| `Projects` 页内开详情，非 `Projects` 页跳转承接 | Phase 3 | `clientScript.ts` | 点击结果后助手不丢失，URL 不写入对话 |
| 拖动定位与 `SideAssistantPlacementState` 独立存储 | Phase 4 | `clientScript.ts` | 同一 host、只存 `{ left, top }`、位置始终 clamp 在视口内 |
| scope 匹配才恢复 `active_main_result` | Phase 4 | `clientScript.ts` | 切换 `date/lang/filters/sort/path` 后不会错误恢复旧结果 |

## 范围边界

### 允许修改

- `app/visualConsole/clientScript.ts`
- `app/visualConsole/ossPages.ts`
- `app/visualConsole/ossProjectsPage.ts`
- `app/styles.css`
- `src/__tests__/visualConsoleFuzzySearch.test.ts`
- `src/__tests__/visualConsoleSearchAlignment.test.ts`
- 必要时新增一个只覆盖侧边助手行为的测试文件
- 本 exec-plan 文档与 `docs/specs/exec-plans/README.md`

### 禁止修改

- 不新增 `/api/projects/fuzzy-search` 之外的搜索 endpoint。
- 不扩展 `FuzzyProjectSearchResponse`、LLM prompt schema 或服务端 fuzzy contract。
- 不修改 `src/search/fuzzyQueryTypes.ts`、`app/server.ts` 的 fuzzy endpoint 语义。
- 不让 LLM 生成项目事实、项目链接、项目排序或站外建议。
- 不把助手做成通用聊天问答、第二套项目列表、面板内分页或复杂筛选器。
- 不把拖动实现成第二套 overlay/portal 系统，不引入第三方拖拽库。
- 不把会话、`conversation_id`、完整 `project_ids` 或长自然语言上下文写进 URL。
- 不引入 `localStorage`、账号同步、跨设备记忆或数据库会话表。

### 兼容性约束

- 一级路由保持现有 `Overview / Weekly / Observer / KB / Run Health / Projects` 体系不变。
- `Projects` 页既有 detail dock、`data-project-card-link="true"` 和详情 URL 语义保持可用。
- 普通搜索框原有关键词过滤继续工作；只是去掉隐式 fuzzy fallback。
- `/api/projects/fuzzy-search` 继续只消费现有请求字段、只返回现有响应字段。

## 当前状态

- 上游设计已经明确冻结：`AI 搜项目` 是唯一自然语言入口，结果承接只认 `Projects`，V1 记忆只用 `sessionStorage`，拖动位置与会话状态分开保存。
- 仓库已有 `/api/projects/fuzzy-search`、`project_ids -> 项目卡` 映射、项目卡链接/dock 打开链路，以及页面级 `sessionStorage` 先例。
- 仓库中已出现侧边助手相关代码与测试基线，但尚未把它们当作“已通过最新设计冻结”的证明；本计划仍以设计冻结项为验收真源。
- 当前最大实现风险不是“能力不存在”，而是旧入口、旧挂载位置、旧浮层心智、拖动契约和恢复边界没有被统一写成可执行账本。

## 当前进度

- 需求分析：`Done`
- 设计冻结：`Done`
- 执行计划：`In Progress`
- 实施：`Not Started`
- 验证：`Not Started`

## 已落地内容

- 已完成需求与设计文档，明确本计划不需要新后端能力。
- 已冻结 `AI 搜项目` 命名、主搜索框剥离规则、会话作用域、结果承接面、拖动位置存储规则和 URL 边界。
- 已确认本计划的主要实现面集中在 `clientScript.ts + ossPages.ts + ossProjectsPage.ts + app/styles.css + tests`，不需要扩散到搜索服务端或 LLM schema。

## 实施阶段

| 阶段 | 状态 | 目标 | 完成标志 |
| --- | --- | --- | --- |
| Phase 0：剥离旧入口与冻结边界 | `Not Started` | 主搜索框退出 fuzzy 路径，明确模块与状态边界 | 普通无结果不调 fuzzy；执行面与禁改面固定 |
| Phase 1：全局 host 与抽屉壳层 | `Not Started` | 助手变成所有一级视图共享的右侧服务抽屉 | 入口全局可用；不再依赖 `Projects` 初始化 |
| Phase 2：会话状态机与搜索预览 | `Not Started` | 落地 `sessionStorage`、query composition、最多 3 条预览与失败降级 | 成功/澄清/空/失败都可见；`more` 不重复 |
| Phase 3：主区联动与结果承接 | `Not Started` | 页内开详情、跨页跳转、查看全部结果、返回普通项目库 | 主列表切换可恢复；对话不丢 |
| Phase 4：拖动定位与恢复边界 | `Not Started` | 落地拖动契约、placement 存储、scope 恢复与移动端退化 | 位置独立恢复；scope 不匹配不恢复旧结果 |
| Phase 5：验证与账本收口 | `Not Started` | 补齐测试、preflight、typecheck 和 smoke | 设计冻结项全部有验证证据 |

## 实施步骤

### Phase 0：剥离旧入口与冻结边界

1. 在 `clientScript.ts` 找到当前主搜索框 `apply()`、zero-result 处理和 `/api/projects/fuzzy-search` 的耦合点，移除“普通搜索无结果自动进入 fuzzy”的旧路径。
2. 在 `ossProjectsPage.ts` 保留普通空结果态与 `AI 搜项目` 引导，但不再由主搜索框直接发起 fuzzy 请求。
3. 固定本计划的状态与存储边界：
   - 搜索会话使用 `SideAssistantSearchSession`
   - 拖动位置使用独立 `SideAssistantPlacementState`
   - `active_main_result` 只负责主列表结果态恢复
4. 固定本计划的文件归属：
   - `ossPages.ts` 负责全局 host 挂载位
   - `clientScript.ts` 负责 runtime、状态机、请求、拖动、恢复与联动
   - `ossProjectsPage.ts` 只负责 `Projects` 承接面和普通搜索引导
5. 补一条回归断言：普通搜索框无结果时，网络层不再出现 `/api/projects/fuzzy-search`。

### Phase 1：全局 host 与抽屉壳层

1. 把助手 host 挂到 app shell/body 级，而不是 `.primary-content`、项目列表或 `.detail-column` 内。
2. 把助手 runtime 从 `Projects` workbench 初始化中拆出，解决“其他页面看得到入口但点了没反应”的根因。
3. 收起态实现为右侧窄入口；展开态实现为右侧全高服务抽屉，桌面宽度保持设计冻结的 `360px - 420px`。
4. 面板结构固定为五块：
   - 头部：标题、状态说明、`新对话`、收起/关闭
   - 欢迎区：一句说明与 2-4 个快捷问题卡
   - 对话区：用户提问、助手短回复、项目预览、边界提示
   - 输入区：输入框、发送按钮
   - 结果动作：`查看全部结果`
5. 在 `app/styles.css` 落地抽屉样式所有权：
   - 右侧全高抽屉与贴边收起入口
   - 桌面端 `360px - 420px` 宽度约束
   - 拖动后固定尺寸浮层态
   - pointer-events、cursor、user-select 与可见层级
   - 移动端底部抽屉 / 轻面板退化
6. 首轮实现只复用现有 host，不新建 portal、overlay manager 或第二套浮层组件。

### Phase 2：会话状态机与搜索预览

1. 用 `sessionStorage` 实现 `SideAssistantSearchSession` 的读写、schema 归一化和异常兜底。
2. 按设计冻结实现状态机：
   - `collapsed`
   - `open_idle`
   - `submitting`
   - `success_preview`
   - `clarification`
   - `empty_or_hot_fallback`
   - `error`
3. 助手提交时只展示用户原始输入，发送给 `/api/projects/fuzzy-search` 的是 `composed_query`。
4. 落地四类追问：
   - `new_search`
   - `refine`
   - `more`
   - `switch`
5. 成功态只从 `project_ids` 映射现有项目记录，最多展示 3 条链接；映射不到就跳过，不补造项目。
6. `more` 模式必须排除 `seen_project_ids`；如果没有新项，明确告诉用户“这轮没有更多未展示项目”，但保留 `查看全部结果`。
7. `needs_clarification`、空结果、endpoint 失败、`boundary_message_cn` 都必须转成用户可见状态，不允许静默失败或清空上下文。

### Phase 3：主区联动与结果承接

1. 助手预览链接复用现有 project card href / detail flow，不生成新详情页。
2. 当前就在 `Projects` 页时：
   - 点击链接后页内打开详情
   - 助手 host 继续挂载
   - 会话继续保留
3. 当前不在 `Projects` 页时：
   - 跳转到 `Projects` 对应位置
   - 保留现有 `date/lang/theme` 等最小路由上下文
   - 从 `sessionStorage` 恢复会话
   - 打开目标项目详情
4. 点击 `查看全部结果` 后：
   - 主列表完全切换为本轮 `project_ids` 顺序
   - 页面出现 `AI 助手结果` 状态条
   - `active_main_result` 写入 `sessionStorage`
5. 点击 `返回普通项目库` 后：
   - 只清 `active_main_result`
   - 主列表恢复默认项目库态
   - `messages` 与 `search_context` 保留
6. 点击 `新对话` 后：
   - 清空 `messages / search_context / active_main_result`
   - abort 当前请求
   - 主列表回到默认项目库态

### Phase 4：拖动定位与恢复边界

1. 拖动只作用于同一个 assistant host；收起态入口和展开态面板共享同一位置源。
2. 使用 Pointer Events 实现拖动，不维护 mouse/touch 两套分支。
3. 触发约束必须与设计一致：
   - 收起态只允许入口触发拖动
   - 展开态只允许面板头部触发拖动
   - 输入框、按钮、快捷卡、项目链接、`查看全部结果` 不得误触拖动
4. 拖动后只保存 `{ left, top }`；不把路径、查询、项目结果或对话内容写进 placement state。
5. 位置结束后必须 clamp 到当前视口内；窗口尺寸变化后必须重新 clamp。
6. 双击拖动区域恢复默认右侧贴边位置。
7. 页面恢复时：
   - 始终可恢复 `panel_state/messages/search_context`
   - 只有 `scope_key` 匹配当前 `date/lang/filters/sort/path` 时才恢复 `active_main_result`
   - scope 不匹配时清掉旧结果态，但保留对话
8. 移动端只要求退化为底部抽屉或轻面板，不要求展开态可拖；点击结果后允许自动收起，但对话必须保留。

### Phase 5：验证与账本收口

1. 更新/补充 DOM 与行为测试，确保每个冻结机制都有至少一个自动化验证锚点。
2. 跑 exec-plan 结构 preflight、目标测试、类型检查；如相关回归会被触发，再追加普通搜索和 fuzzy endpoint 的回归测试。
3. 手动 smoke 至少覆盖：
   - 所有一级视图打开入口
   - 自然语言搜索成功态
   - `more` 去重
   - `Projects` 页页内开详情
   - 非 `Projects` 页跳转承接
   - `查看全部结果`
   - `返回普通项目库`
   - 双击恢复默认位置
   - resize 后 re-clamp
   - 移动端点结果后自动收起但会话保留
   - 拖动、刷新恢复、scope mismatch
4. 更新本计划的验证记录、结论记录和 `README` 索引状态，不把它留成一次性草稿。

## 验收标准

### 验收 1：自然语言入口唯一化成立

- 可观测结果：主搜索框继续做关键词过滤；只有 `AI 搜项目` 才会触发 `/api/projects/fuzzy-search`。
- 失败条件：普通搜索无结果仍隐式触发 fuzzy，或出现两个自然语言入口并存。

### 验收 2：全局入口与助手心智成立

- 可观测结果：所有一级视图都能打开同一个右侧助手，且它是“轻量预览 + Projects 承接”而不是第二套项目库。
- 失败条件：助手仍绑死在 `Projects` 生命周期上，或面板直接膨胀成完整列表页。

### 验收 3：多轮预览语义成立

- 可观测结果：助手每轮只展示短说明、最多 3 条链接、`查看全部结果`，`more` 不重复上一轮已预览项目。
- 失败条件：展示完整列表、重复旧链接冒充新结果，或把 `composed_query` 原样暴露给用户。

### 验收 4：Projects 承接语义成立

- 可观测结果：`Projects` 页点链接优先页内开详情；其他页点链接跳到 `Projects` 对应位置；会话不丢。
- 失败条件：新开独立详情页、当前页点链接无效、跳转后助手消失，或 URL 泄露对话。

### 验收 5：结果态恢复边界成立

- 可观测结果：`查看全部结果` 会切主列表并可刷新恢复；`返回普通项目库` 只清结果态；scope 不匹配不恢复旧结果。
- 失败条件：刷新后旧结果误恢复，或返回普通项目库时连对话一起丢失。

### 验收 6：拖动契约成立

- 可观测结果：入口和面板共享同一位置；拖动不误伤交互控件；位置始终在视口内；双击可恢复默认位置。
- 失败条件：点击按钮触发拖动、位置跑出屏幕、placement 与会话混存，或移动端因为拖动让输入区不可用。

## 关键负例

- 主搜索框无结果仍发起 `/api/projects/fuzzy-search`，判定失败。
- 助手入口只能在 `Projects` 页响应，判定失败。
- 助手在 `Projects` 详情联动时被卸载，判定失败。
- `more` 模式重复展示 `seen_project_ids` 中的项目，判定失败。
- 预览链接映射不到本地项目时仍生成假链接，判定失败。
- `查看全部结果` 后主列表与默认项目库混排，判定失败。
- `返回普通项目库` 后刷新仍恢复旧 AI 结果态，判定失败。
- `conversation_id`、完整对话或完整 `project_ids` 出现在 URL 中，判定失败。
- 输入框、发送按钮、链接、快捷卡片会误触拖动，判定失败。
- 拖动位置保存在 `SideAssistantSearchSession` 里，导致新对话或 schema 修复误伤 placement，判定失败。

## 验证矩阵

| 类型 | 验证内容 | 命令 / 方法 | 通过标准 |
| --- | --- | --- | --- |
| 计划 | ExecPlan 结构 preflight | `npm.cmd run exec-plan:preflight` | 计划结构与索引规则通过 |
| 类型 | 目标模块类型检查 | `npm.cmd run typecheck` | 无新增类型错误 |
| 行为 | 主搜索框剥离 fuzzy | `npm.cmd test -- visualConsoleFuzzySearch` | 普通无结果不 fetch fuzzy endpoint |
| 行为 | 全局入口可用 | `npm.cmd test -- visualConsoleFuzzySearch` | 所有一级视图都能打开助手 |
| 行为 | query composition | `npm.cmd test -- visualConsoleFuzzySearch` | `refine / more / switch` 使用冻结规则 |
| 行为 | 预览上限与去重 | `npm.cmd test -- visualConsoleFuzzySearch` | 最多 3 条链接，`more` 不重复 `seen_project_ids` |
| 行为 | 项目详情联动 | `npm.cmd test -- visualConsoleFuzzySearch` | `Projects` 页页内开详情，非 `Projects` 页跳转承接 |
| 行为 | 查看全部结果 / 返回普通项目库 | `npm.cmd test -- visualConsoleFuzzySearch` | 主列表切换与撤销语义正确 |
| 行为 | scope 恢复 | `npm.cmd test -- visualConsoleFuzzySearch` | scope 不匹配时不恢复旧结果 |
| 行为 | placement 触发区 | `npm.cmd test -- visualConsoleFuzzySearch` | 仅入口/面板头部允许拖动，输入框/按钮/链接/快捷卡不误触 |
| 行为 | placement 双击恢复 | `npm.cmd test -- visualConsoleFuzzySearch` | 双击拖动区域后恢复默认右侧贴边位置 |
| 行为 | placement resize re-clamp | `npm.cmd test -- visualConsoleFuzzySearch` | 窗口尺寸变化后位置仍留在可见视口内 |
| 行为 | 移动端自动收起与会话保留 | `npm.cmd test -- visualConsoleFuzzySearch` | 移动端点结果后允许收起，但消息和上下文不丢 |
| 回归 | 普通搜索关键词过滤 | `npm.cmd test -- visualConsoleSearchAlignment` | 普通搜索能力不退化 |
| 回归 | fuzzy endpoint contract | `npm.cmd test -- fuzzyProjectSearch` | schema 与降级路径不变 |
| 冒烟 | 浏览器手测 | `npm.cmd run visual-console:web` | 助手流程、拖动、详情联动、结果承接可走通 |

## 验证记录

| 日期 | 验证项 | 状态 | 记录 |
| --- | --- | --- | --- |
| 2026-06-27 | ExecPlan 改写 | 已完成 | 按最新设计冻结项重写计划，补齐拖动、scope、结果承接和负例 |
| 2026-06-27 | 上游设计门禁确认 | 已完成 | `side-assistant-natural-language-search-design.md` 当前状态为 `Approved for ExecPlan` |

## 风险与缓解

### 风险 1：旧 zero-result fallback 残留，导致双入口并存

- 缓解：直接用测试断言普通搜索路径不再 fetch fuzzy endpoint。

### 风险 2：助手 host 仍挂在会被详情替换的 DOM 内

- 缓解：host 固定放在 app shell/body 级；把 `Projects` 页缩回承接面而不是生命周期控制器。

### 风险 3：拖动实现把助手重新做成第二套浮层系统

- 缓解：复用同一个 host，只记录 `left/top`，不引入 portal/overlay manager/第三方库。

### 风险 4：结果态恢复和会话恢复互相污染

- 缓解：`active_main_result` 与 placement 独立存储；只有 `scope_key` 匹配才恢复旧结果态。

### 风险 5：实现者把 V1 多轮追问升级成隐式复杂会话系统

- 缓解：V1 只允许客户端 `composed_query`；需要更强语义时另开 V2 conversation summarizer 设计。

## 回滚策略

1. 如果 Phase 0 失败：
   - 保留主搜索框关键词过滤和普通空状态。
   - 不恢复旧的隐式 fuzzy fallback。
2. 如果 Phase 1 / 2 失败：
   - 隐藏全局助手 host。
   - 保留服务端 fuzzy endpoint 与普通项目库能力。
3. 如果 Phase 3 失败：
   - 暂时禁用 `查看全部结果` 或结果链接分流。
   - 保留侧边助手基础搜索预览，不伪装主区联动已完成。
4. 如果 Phase 4 失败：
   - 允许临时回退为固定右侧抽屉。
   - 不保留半成品拖动或错误恢复逻辑。
5. 任意阶段都不得通过修改 fuzzy endpoint contract、扩 URL 状态或引入长期记忆来“绕过当前问题”。

## 结论记录

- 本计划保护的不是“再做一个搜索 UI”，而是设计冻结的一句话产品心智：全局入口、轻量预览、结果回到 `Projects` 承接。
- 本计划把最容易在实现时偷换语义的部分前置写死了：旧入口剥离、route-agnostic host、样式层所有权、最多 3 条预览、`more` 去重、scope 恢复、拖动边界、URL 不落会话。
- 本计划选择最小可落地路径：复用既有 fuzzy endpoint、项目卡映射和 detail dock，不新增后端会话系统、不重做主项目页。

## 下一阶段入口

1. 先跑 `exec-plan:preflight`，确认文档结构与索引规则通过。
2. 然后进入 exec-plan review；若评审通过，再按 `Phase 0 -> Phase 5` 顺序实施。
3. 若后续需要更强的多轮语义、长期记忆或更复杂的移动端交互，必须单开 follow-up 设计与 exec-plan，不在本计划里偷扩 scope。
