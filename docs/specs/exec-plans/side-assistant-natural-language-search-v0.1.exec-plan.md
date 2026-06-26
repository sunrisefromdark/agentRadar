# 执行计划：侧边助手自然语言搜索

## 文档状态

- 版本：`v0.1`
- 当前状态：`Proposed`
- 设计来源：
  - [侧边助手自然语言搜索需求分析.md](../product-specs/侧边助手自然语言搜索需求分析.md#L1)
  - [side-assistant-natural-language-search-design.md](../design-docs/side-assistant-natural-language-search-design.md#L1)
  - [natural-language-fuzzy-search-recommendation-design.md](../design-docs/natural-language-fuzzy-search-recommendation-design.md#L1)
- 上游设计门禁：`side-assistant-natural-language-search-design.md` 已完成 review，当前设计冻结为 `AI 搜项目` 全局入口、主搜索框剥离 fuzzy、会话级多轮记忆、3 条预览、`Projects` 承接结果、点查看全部结果切主列表。
- 说明：本计划只负责把已有 `/api/projects/fuzzy-search` 从主搜索框的 zero-result fallback 中剥离出来，并包装进右侧 `AI 搜项目` 助手；不新增后端 endpoint、不新增数据库会话、不扩展 fuzzy response contract。

## 任务信息

| 字段 | 内容 |
| --- | --- |
| 任务名称 | 侧边助手自然语言搜索 |
| 负责人 | Codex |
| 风险等级 | `Medium` |
| 关联需求 | `docs/specs/product-specs/侧边助手自然语言搜索需求分析.md` |
| 关联设计 | `docs/specs/design-docs/side-assistant-natural-language-search-design.md` |
| 影响范围 | `app/visualConsole/clientScript.ts`、`app/visualConsole/ossProjectsPage.ts`、`src/__tests__/visualConsoleFuzzySearch.test.ts`、必要时补充 `src/__tests__/*` |

## 目标

1. 主项目搜索框只保留现有关键词过滤，普通无结果时不再触发 `/api/projects/fuzzy-search`。
2. 新增右侧 `AI 搜项目` 全局入口与面板，作为唯一自然语言 fuzzy search 入口。
3. 使用 `sessionStorage` 保存当前浏览器会话内的面板状态、消息、搜索上下文和主列表 AI 结果态。
4. 助手成功态只展示简短回复、最多 3 个项目链接和 `查看全部结果`。
5. 在 `Projects` 页点击项目链接时打开已有项目详情；在其他页点击时跳转到 `Projects` 对应位置，助手会话不丢。
6. 点击 `查看全部结果` 后主列表完全切换为本轮 `project_ids`，并支持 `返回普通项目库`。
7. 通过 DOM/行为测试守住入口剥离、会话恢复、详情联动和结果态切换。

## 边界约束

### 允许修改

- `app/visualConsole/clientScript.ts`
- `app/visualConsole/ossProjectsPage.ts`
- `src/__tests__/visualConsoleFuzzySearch.test.ts`
- 新增或扩展一个聚焦助手行为的测试组

### 禁止修改

- 不新增 `/api/projects/fuzzy-search` 以外的搜索 endpoint。
- 不扩展 `FuzzyProjectSearchResponse`。
- 不修改 `src/search/fuzzyQueryTypes.ts`、LLM prompt schema 或服务端 fuzzy search contract。
- 不把项目事实、排序、链接理由交给 LLM 生成。
- 不把助手做成完整聊天产品或第二套项目列表。
- 不让主搜索框继续自动触发 fuzzy endpoint。
- 不新增长期用户画像、账号同步或数据库会话表。

## 设计覆盖映射

| 设计冻结项 | 落地阶段 | 主落地模块 | 验证锚点 |
| --- | --- | --- | --- |
| 主搜索框剥离 fuzzy | Phase 0 | `clientScript.ts` | 普通无结果不 fetch `/api/projects/fuzzy-search` |
| `AI 搜项目` 全局入口与面板 | Phase 1 | `ossPages.ts`、`clientScript.ts` | 所有一级视图都能打开 collapsed/open states |
| sessionStorage 会话记忆 | Phase 2 | `clientScript.ts` | 刷新/关闭重开恢复会话 |
| 最多 3 条链接预览 | Phase 2 | `clientScript.ts` | 映射 `project_ids` 前 3 个本地项目 |
| `Projects` 页点链接开详情 / 非 `Projects` 页跳转承接 | Phase 3 | `clientScript.ts` | `Projects` 页 detail dock 更新；其他页跳到 `Projects` |
| 查看全部结果切主列表 | Phase 3 | `clientScript.ts` | 主列表只显示本轮 `project_ids` |
| 返回普通项目库 | Phase 3 | `clientScript.ts` | 只清 `active_main_result`，不清对话 |
| 异常/澄清/敏感边界 | Phase 4 | `clientScript.ts` | 用户可见状态不空白 |

## 文件与职责

### 建议修改

- `app/visualConsole/ossPages.ts`
  - 维持 assistant host 的全局挂载位置，确保所有一级视图都能看到并打开入口。
- `app/visualConsole/ossProjectsPage.ts`
  - 只保留 `Projects` 结果承接 DOM 和主搜索框无结果时打开 `AI 搜项目` 的引导。
- `app/visualConsole/clientScript.ts`
  - 删除或禁用主搜索框 zero-result 自动 fuzzy 触发。
  - 把助手 runtime 从 `Projects` workbench 初始化里拆出来，避免 `if (!(search instanceof HTMLInputElement)) return;` 让其他页面入口失活。
  - 新增助手打开/关闭、提交、请求、预览、查看全部结果、返回普通项目库、项目链接分流和 sessionStorage 恢复逻辑。
  - 复用现有 project card records、detail link/dock flow、`/api/projects/fuzzy-search` endpoint。
- `src/__tests__/visualConsoleFuzzySearch.test.ts`
  - 更新旧 fuzzy 入口测试，证明 endpoint 只由助手触发。
  - 增加主搜索框无结果不触发 fuzzy、助手提交触发 fuzzy、结果最多 3 条链接、查看全部结果切主列表、返回普通项目库不清对话等守护。

## 当前状态

当前仓库已经具备：

- `/api/projects/fuzzy-search` endpoint。
- 主项目搜索框 zero-result fuzzy 自动触发逻辑。
- 项目卡片搜索 metadata 与 `project_ids -> cards` 映射能力。
- 项目卡链接和当前页详情打开能力。
- `sessionStorage` 页面级临时状态读写先例。

当前缺口：

- fuzzy 仍挂在主搜索框 zero-result 路径上。
- 没有 `AI 搜项目` 独立助手入口。
- 没有助手会话状态、预览链接、多轮上下文和主列表 AI 结果态。

## 当前进度

- 需求分析：`Done`
- 设计冻结：`Done`（`side-assistant-natural-language-search-design.md` 已进入 `Approved for ExecPlan`）
- 执行计划：`Proposed`
- 实施：`Not Started`
- 验证：`Not Started`

## 已落地内容

- 已完成需求文档与设计文档。
- 已冻结 `AI 搜项目` 命名、主搜索框剥离规则、`返回普通项目库` 状态语义。
- 已确认本计划不需要新增后端搜索能力。

## 实施阶段

| 阶段 | 状态 | 目标 | 完成标志 |
| --- | --- | --- | --- |
| Phase 0：剥离主搜索框 fuzzy | `Not Started` | 主搜索框只做关键词过滤，无结果只展示引导 | 普通无结果不调用 `/api/projects/fuzzy-search` |
| Phase 1：助手壳层 | `Not Started` | 增加 `AI 搜项目` 收起入口、展开面板和基础样式 | 可打开/关闭，状态可持久化 |
| Phase 2：助手请求与预览 | `Not Started` | 助手提交调用 fuzzy endpoint，展示短回复和最多 3 条链接 | 成功/澄清/空/失败都有用户可见状态 |
| Phase 3：主区联动 | `Not Started` | 点项目开详情、查看全部结果切主列表、返回普通项目库 | 助手不卸载，会话不丢 |
| Phase 4：恢复与移动降级 | `Not Started` | 刷新恢复会话和有效结果态，移动端退化为抽屉/轻面板 | scope 不匹配时不恢复旧结果 |
| Phase 5：验证收口 | `Not Started` | 补齐目标测试、typecheck 和手动 smoke | 目标测试与 typecheck 通过 |

## 实施步骤

### Phase 0：剥离主搜索框 fuzzy

1. 在 `clientScript.ts` 找到当前 `syncFuzzySearch/startFuzzySearch` 与主搜索框 `apply()` 的耦合点。
2. 主搜索框路径保留 direct keyword filter 和普通 empty state。
3. 主搜索框无结果时只显示 `AI 搜项目` 引导，不调 `/api/projects/fuzzy-search`。
4. 保留 fuzzy endpoint helper 能力，但调用入口改由助手提交触发。
5. 更新 `visualConsoleFuzzySearch.test.ts` 中旧的主搜索框 fuzzy 断言。

### Phase 1：助手壳层

1. assistant host 保持挂在全局 shell，不再依赖 `Projects` 局部 DOM 生命周期。
2. 收起态显示右侧 `AI 搜项目` 入口，所有一级视图都可打开。
3. 展开态显示标题 `AI 搜项目`、关闭按钮、输入框、`新对话` 和快捷问题卡片。
4. 桌面端改为参考华为云 `云宝助手` 的右侧全高服务抽屉，不再做遮挡正文的短浮层。
5. 面板宽度桌面端控制在设计冻结的 `360px - 420px`。
6. 移动端先使用同一 DOM 退化为底部/全屏轻面板，不新增第二套组件。

### Phase 2：助手请求与预览

1. 定义最小 `SideAssistantSearchSession` 读写函数，存入 `sessionStorage`。
2. 助手提交时先生成 `composed_query`，请求体使用 `raw_query: composed_query` 调用 `/api/projects/fuzzy-search`，面板只展示用户原始输入。
3. 多轮追问在前端组合 `composed_query`，不新增后端 conversation API。
4. 成功时从 `project_ids` 映射本地项目记录，最多展示 3 条项目链接。
5. `more` 模式排除 `seen_project_ids`，没有新预览时说明没有更多未展示项目。
6. `needs_clarification` 展示 2-3 个可点击改写选项。
7. endpoint 失败、空结果、敏感边界都保留用户输入和当前上下文。

### Phase 3：主区联动

1. 助手项目链接复用现有 project card href/detail flow。
2. 如果当前就在 `Projects` 页，点击链接后在当前页打开详情，助手 host 不卸载。
3. 如果当前不在 `Projects` 页，点击链接后跳转到 `Projects` 对应位置，并通过 sessionStorage 恢复当前会话。
4. 点击 `查看全部结果` 后，将主列表完全切换为本轮 `project_ids` 顺序。
5. 写入 `active_main_result`，状态条显示 `AI 助手结果`、本轮 query 和 `返回普通项目库`。
6. 点击 `返回普通项目库` 只清 `active_main_result` 和状态条，保留 `messages/search_context`。
7. 点击 `新对话` 清空 `messages/search_context/active_main_result`，并恢复默认项目库态。

### Phase 4：恢复与移动降级

1. 页面加载时恢复 `panel_state/messages/search_context`。
2. 仅当 `active_main_result.scope_key` 匹配当前 `date/lang/filters/sort/path` 时恢复 AI 结果态。
3. scope 不匹配时清空 `active_main_result`，保留会话消息。
4. 移动端点击项目链接后允许助手自动收起，但会话必须保留。
5. `sessionStorage` 不可用时本轮仍可使用，只是不保证刷新恢复。

### Phase 5：验证收口

1. 运行目标测试：
   - `npm.cmd test -- visualConsoleFuzzySearch`
2. 新增或扩展助手行为测试，覆盖：
   - 所有一级视图都能打开 `AI 搜项目`。
   - 多轮 `raw_query` composition。
   - `more` 不重复 `seen_project_ids`。
   - 非 `Projects` 页点击结果会跳转到 `Projects` 承接。
   - `active_main_result.scope_key` 不匹配时不恢复旧结果。
   - `新对话` 清空 `messages/search_context/active_main_result`。
   - 敏感边界提示可见。
3. 运行类型检查：
   - `npm.cmd run typecheck`
4. 如改动触及项目详情或搜索 kernel，追加：
   - `npm.cmd test -- visualConsoleSearchAlignment fuzzyProjectSearch`
5. 手动 smoke：
   - 主搜索框输入无结果查询，不应发起 fuzzy 请求。
   - `AI 搜项目` 输入自然语言，展示最多 3 条链接。
   - 点击项目链接后详情打开且助手仍在。
   - 点击 `查看全部结果` 后主列表完全切换。
   - 点击 `返回普通项目库` 后刷新不恢复旧 AI 结果态。

## 验收标准

1. 主搜索框已有命中时按关键词过滤，不显示 AI 解释。
2. 主搜索框无结果时不调用 `/api/projects/fuzzy-search`。
3. 主搜索框无结果时展示普通空状态和 `AI 搜项目` 引导。
4. 只有 `AI 搜项目` 提交自然语言时才调用 `/api/projects/fuzzy-search`。
5. 助手成功态最多展示 3 条项目链接，不渲染完整项目列表。
6. 在 `Projects` 页点击助手项目链接会在当前页打开详情，助手仍可见且对话保留。
7. 在非 `Projects` 页点击助手项目链接会跳转到 `Projects` 对应位置。
8. 点击 `查看全部结果` 后主列表完全切换为本轮 AI 结果集，不混排默认列表。
9. 点击 `返回普通项目库` 后刷新不会恢复旧 AI 结果态。
10. 点击 `新对话` 清空会话并恢复默认项目库态。
11. 敏感领域查询仍展示站内项目搜索边界提示。

## 验证矩阵

| 类型 | 验证项 | 命令/方式 | 成功标准 |
| --- | --- | --- | --- |
| 前端行为 | 主搜索框剥离 fuzzy | `npm.cmd test -- visualConsoleFuzzySearch` | 无结果不 fetch fuzzy endpoint |
| 前端行为 | 助手提交 fuzzy | `npm.cmd test -- visualConsoleFuzzySearch` | 只有助手提交 fetch fuzzy endpoint |
| 前端行为 | 多轮 query composition | `npm.cmd test -- visualConsoleFuzzySearch` | 请求体 `raw_query` 使用 `composed_query` |
| 前端行为 | more 不重复预览 | `npm.cmd test -- visualConsoleFuzzySearch` | 不重复 `seen_project_ids` |
| 前端行为 | 预览链接上限 | `npm.cmd test -- visualConsoleFuzzySearch` | 最多 3 条链接 |
| 前端行为 | 查看全部结果 | `npm.cmd test -- visualConsoleFuzzySearch` | 主列表完全替换为 AI 结果 |
| 前端行为 | 返回普通项目库 | `npm.cmd test -- visualConsoleFuzzySearch` | 清结果态不清对话，刷新不恢复旧结果 |
| 前端行为 | scope mismatch 恢复 | `npm.cmd test -- visualConsoleFuzzySearch` | scope 不匹配时不恢复旧 AI 结果 |
| 前端行为 | 新对话 | `npm.cmd test -- visualConsoleFuzzySearch` | 清空会话并恢复默认项目库态 |
| 前端行为 | 敏感边界 | `npm.cmd test -- visualConsoleFuzzySearch` | 边界提示可见 |
| 回归 | 普通搜索对齐 | `npm.cmd test -- visualConsoleSearchAlignment` | 关键词搜索能力不退化 |
| 回归 | fuzzy endpoint contract | `npm.cmd test -- fuzzyProjectSearch` | endpoint schema 和降级路径不变 |
| 类型 | TypeScript | `npm.cmd run typecheck` | 无类型错误 |
| 手动 | visual-console smoke | `npm.cmd run visual-console:web` | 页面可用，助手流程可走通 |

## 验证记录

| 日期 | 验证项 | 状态 | 记录 |
| --- | --- | --- | --- |
| 2026-06-24 | ExecPlan 创建 | 已完成 | 新增本计划，尚未实施代码 |
| 2026-06-24 | 设计门禁确认 | 已完成 | 上游设计状态更新为 `Approved for ExecPlan` |

## 回滚策略

1. Phase 0 失败时：
   - 保留主搜索框 direct keyword filter。
   - 禁用助手入口，不恢复主搜索框自动 fuzzy。
2. Phase 1/2 失败时：
   - 隐藏 `AI 搜项目` host。
   - endpoint 继续保留给后续实现使用。
3. Phase 3 失败时：
   - 暂时禁用 `查看全部结果` 和助手链接拦截。
   - 保留助手预览和普通项目库。
4. 任意阶段不得修改 fuzzy endpoint contract 或删除现有搜索 kernel。

## 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 主搜索框旧 fuzzy 触发残留 | 两个自然语言入口并存 | 测试直接断言普通无结果不 fetch endpoint |
| 助手 host 挂载位置错误 | 打开详情时助手消失 | host 挂在 app shell/body 级，不挂 `.detail-column` |
| `返回普通项目库` 只做 UI 切换 | 刷新后旧 AI 结果复活 | 清除 `active_main_result` 并测试刷新恢复 |
| project_id 映射缺失 | 面板展示假链接 | 映射不到就跳过，不补造项目 |
| 多轮组合噪声 | 后续查询偏离用户意图 | V1 只做简单 query composition，必要时进入 V2 summarizer |

## 结论记录

本计划采用最小可落地路径：保留已验证的 fuzzy endpoint 和搜索服务，只移动前端触发入口并新增侧边助手状态层。实现阶段不应新增后端搜索能力，也不应重做主项目页面。

## 下一阶段入口

进入 ExecPlan review；通过后再进入代码实施。
