# 执行计划：自然语言模糊搜索与 LLM 查询扩展

## 文档状态

- 版本：`v0.1`
- 当前状态：`Implemented / Verified`
- 设计来源：
  - [自然语言模糊搜索与推荐需求分析.md](../product-specs/自然语言模糊搜索与推荐需求分析.md#L1)
  - [natural-language-fuzzy-search-recommendation-design.md](../design-docs/natural-language-fuzzy-search-recommendation-design.md#L1)
  - [architecture-boundaries.md](../design-docs/architecture-boundaries.md#L1)
  - [llm-classification.md](../services/llm-classification.md#L1)
- 上游设计门禁：`natural-language-fuzzy-search-recommendation-design.md` 已于 `2026-06-16` 标记为 `Approved`，并明确“下一阶段可以直接进入 ExecPlan”。
- 说明：本计划只负责把已批准的 `direct search first + zero-result LLM routing` 设计落地，不新增新的产品分类、排序事实、外部搜索源或数据库项目库。

## 任务信息

| 字段 | 内容 |
| --- | --- |
| 任务名称 | 自然语言模糊搜索与 LLM 查询扩展 |
| 负责人 | Codex |
| 风险等级 | `Medium` |
| 关联需求 | `docs/specs/product-specs/自然语言模糊搜索与推荐需求分析.md` |
| 关联设计 | `docs/specs/design-docs/natural-language-fuzzy-search-recommendation-design.md` |
| 影响范围 | `src/search/`、`src/visualConsole/`、`app/server.ts`、`app/visualConsole/clientScript.ts`、`app/visualConsole/ossProjectsPage.ts`、`src/__tests__/`、`docs/specs/exec-plans/` |

## 目标

在保持当前项目库 artifact/file-first 存储与本地搜索体验不变的前提下，完成以下交付：

1. 抽出前后端共享的项目搜索 kernel，让 direct gate 和扩展检索使用同一套 normalize/tokenize/rank/filter/sort 口径。
2. 新增 zero-result LLM 查询解释链路：仅当当前 direct search 结果数为 `0` 且查询满足触发阈值时，才调用 LLM。
3. 落地 7 类 `semantic_class`、LLM JSON schema、repair 调用、合法性校验、缓存键与诊断字段。
4. 对 `regulated_keyword_search` 按查询句关键词直接扩展站内项目库搜索，不判断用户是否请求站外建议；但必须展示项目搜索边界提示，且不得输出真实专业建议。
5. 新增只读 fuzzy search endpoint，读取当前 Projects view / daily artifact，不写入 `data/`，不引入项目库数据库。
6. 前端 Projects 搜索在 direct result 为 `0` 时接入 fuzzy endpoint，展示 expanded / hot-only / clarification / LLM failed fallback 等用户可见状态。
7. 通过单元、集成、前端行为、失败路径和回归测试证明设计冻结项没有被实现阶段削弱。

## 边界约束

### 允许修改

- `src/search/*`
- `src/visualConsole/build.ts`
- `src/visualConsole/types.ts`
- `app/server.ts`
- `app/visualConsole/clientScript.ts`
- `app/visualConsole/ossProjectsPage.ts`
- `src/__tests__/*`
- `docs/specs/exec-plans/*`

### 谨慎修改

- `src/visualConsole/readLayer.ts`
  - 仅当 endpoint 需要复用现有 Projects view 读取入口时允许补只读 helper。
- `src/config.ts` / `config.yaml`
  - 仅允许新增 LLM fuzzy search 的运行时开关、超时、debounce、endpoint 相关配置。
  - 不允许把产品分类、触发原则、排序规则或敏感领域策略下放为可随意配置。

### 禁止修改

- 不把项目库主存储迁移到数据库。
- 不修改 `data/reports/YYYY-MM-DD.daily.json`、weekly、run-summary 等 artifact schema。
- 不引入外部搜索源作为项目结果来源。
- 不让 LLM 生成项目、repo、事实、评分、排序或专业建议。
- 不新增 LLM score，不改写现有 `score/growth/order/final_rank` 排序事实。
- 不允许 direct search 有结果时触发 LLM 或追加 LLM 补充结果。
- 不删除或弱化现有 `src/__tests__/visualConsoleSearchAlignment.test.ts` 守护的别名搜索能力。

### 兼容性约束

- `visual-console` 与 `visual-console:web` 仍能在无 LLM key 环境启动并完成直接搜索。
- 旧的本地 Projects 搜索行为保持：已有命中查询不显示 LLM 解释、不出现 LLM loading。
- LLM 不可用、超时、非法 JSON、schema 校验失败时，直接搜索仍保持，zero-result 路径展示热门项目和降级状态。
- endpoint 必须是只读行为，不写入 `data/`，不修改当前 daily artifact。
- LLM 查询解释必须复用仓库现有 `src/llm.ts`、`src/providers/*`、`AppConfig["llm"]` 与 provider registry；不得在 fuzzy search 模块中直连 SDK、硬编码 provider 或新增第二套 LLM 配置语义。
- fuzzy 缓存可保存 raw LLM output 作为审计证据，但 raw output 不得进入 `FuzzyProjectSearchResponse`、DOM、用户可见日志或项目事实字段。

## 设计覆盖映射

| 设计冻结项 | 落地阶段 | 主落地模块 | 验证锚点 |
| --- | --- | --- | --- |
| direct search gate 优先级最高 | Phase 1 / 3 / 4 | `src/search/projectSearchKernel.ts`、`fuzzyProjectSearchService`、`clientScript.ts` | direct hit 查询 LLM 调用数为 0 |
| zero-result 才触发 LLM | Phase 3 / 4 | `fuzzyProjectSearchService`、endpoint、前端绑定 | direct result 为 0 且输入达阈值才请求 endpoint |
| 7 类 `semantic_class` | Phase 2 | `fuzzyQueryTypes.ts`、schema validator | 枚举越界测试失败并进入 repair/fallback |
| LLM 只输出查询解释和扩展计划 | Phase 2 / 3 | `fuzzyQueryPrompt.ts`、`fuzzyQueryInterpreter.ts` | LLM 项目名/事实输出被忽略或判非法 |
| `regulated_keyword_search` 关键词搜索 | Phase 2 / 3 / 5 | prompt、validator、service、UI | “美股今天买什么”“给我诊断这个病”扩展搜索项目库并显示边界 |
| hot-only low semantic / open discovery | Phase 3 / 4 | service、client UI state | “这怎么哈哈了”“最近有什么值得看”展示热门项目，不生成扩展词 |
| `ambiguous` 澄清选项 | Phase 2 / 3 / 4 | types、validator、service、UI | 返回 2-3 个可执行查询改写，不直接执行搜索 |
| 过滤与排序边界 | Phase 3 | `fuzzyProjectSearchService` | unsupported filters 进入 diagnostics，不新增排序分 |
| LLM provider/config 边界 | Phase 0 / 2 / 5 | `fuzzyQueryInterpreter`、现有 `src/llm.ts`、provider registry | 无 key、`provider=none`、provider error 均进入受控 fallback；测试注入 fake provider，不直连 SDK |
| 缓存键和诊断字段 | Phase 3 / 5 | interpreter/service | `date + normalized_query + lang + active_filters + schema_version` 命中缓存，raw LLM output 仅用于审计，diagnostics 可断言 |
| endpoint 只读边界 | Phase 3 / 5 | endpoint 集成测试 | 请求前后 daily artifact hash/mtime 不变，且不新增 `data/` 写入 |
| LLM 不可用/超时/非法输出降级 | Phase 2 / 3 / 5 | interpreter/service/UI | llm_unconfigured、llm_timeout、invalid_json、schema_invalid 路径均可测 |

## 文件与职责

### 建议新增

- `src/search/projectSearchKernel.ts`
  - 从 `app/visualConsole/clientScript.ts` 抽出可共享的 normalize、tokenize、rank、filter/sort、pagination 逻辑。
  - 前端脚本和服务端 fuzzy search 都必须使用该模块或其同源序列化函数，避免两套搜索口径。
- `src/search/projectSearchIndex.ts`
  - 从 `ProjectsViewModel["projects"]` 投影搜索索引，字段来自现有项目对象和 `data-project-search` 等价内容。
- `src/search/fuzzyQueryTypes.ts`
  - 冻结 LLM interpretation schema、response schema、diagnostics、7 类 `semantic_class`、decision/result mode 枚举。
- `src/search/fuzzyQueryPrompt.ts`
  - 维护主 prompt、repair prompt、`search_fields_summary`、`direction_alias_summary` 压缩逻辑。
- `src/search/fuzzyQueryInterpreter.ts`
  - 通过现有 LLM provider 抽象调用 LLM、解析 JSON、校验合法性规则、最多一次 repair、处理 timeout/unconfigured/invalid/schema_invalid。
  - 必须支持 fake provider / stub provider 注入以便单测，不得在模块内直连 OpenAI/Anthropic/DeepSeek SDK。
- `src/search/fuzzyProjectSearchService.ts`
  - 编排 direct gate、LLM 路由、扩展检索、hot fallback、clarification、regulated boundary、diagnostics、缓存。
  - 缓存允许保存 raw LLM output 与校验后 interpretation 作为审计证据，但不得把 raw LLM output 传给 UI 或作为项目事实来源。
- `src/__tests__/fuzzyQueryTypes.test.ts`
- `src/__tests__/fuzzyQueryInterpreter.test.ts`
- `src/__tests__/fuzzyProjectSearchService.test.ts`
- `src/__tests__/visualConsoleFuzzySearch.test.ts`

### 建议修改

- `app/visualConsole/clientScript.ts`
  - 改为消费共享 search kernel，保留当前本地 direct search 行为。
  - 新增 zero-result debounce / Enter 触发 / abort stale request / fuzzy response 渲染。
- `app/visualConsole/ossProjectsPage.ts`
  - 如需新增 UI 节点或 data attributes，只允许为 fuzzy 状态、解释摘要、边界提示、澄清选项服务。
  - 不修改项目卡片事实字段和现有 `data-project-search` 语义。
- `app/server.ts`
  - 新增只读 `POST /api/projects/fuzzy-search` endpoint。
  - endpoint 读取当前 date 的 Projects view，不写 artifact。
  - 有效请求的受控失败必须返回 `FuzzyProjectSearchResponse`，其中 `source="llm_failed_fallback"`、`diagnostics.fallback_reason="endpoint_error"`，前端据此展示 hot fallback。
  - malformed payload 必须返回稳定 4xx JSON 错误，例如 `{ "error": "invalid_fuzzy_search_request", "message": string }`；该路径不得写入 `data/`。
- `src/visualConsole/build.ts`
  - 如 endpoint 需要，暴露可复用的 Projects view / hot projects 获取方式。
- `src/visualConsole/types.ts`
  - 如需要，补充只读 fuzzy endpoint payload 类型，不改 daily artifact 类型。

## 当前状态

当前仓库已经具备：

- Projects 页面本地搜索：`app/visualConsole/clientScript.ts`
- 项目搜索元数据投影：`app/visualConsole/ossProjectsPage.ts`
- 项目 view model 构建：`src/visualConsole/build.ts`
- 搜索对齐测试：`src/__tests__/visualConsoleSearchAlignment.test.ts`
- server/client 共享搜索 kernel：`src/search/projectSearchKernel.ts`
- Projects view 搜索索引投影：`src/search/projectSearchIndex.ts`
- LLM 查询解释 schema、prompt、repair、timeout/fallback：`src/search/fuzzyQueryTypes.ts`、`src/search/fuzzyQueryPrompt.ts`、`src/search/fuzzyQueryInterpreter.ts`
- zero-result fuzzy search 编排服务与 endpoint：`src/search/fuzzyProjectSearchService.ts`、`app/server.ts`
- Projects 前端 zero-result fuzzy 请求、debounce、abort/stale guard、状态渲染：`app/visualConsole/clientScript.ts`、`app/visualConsole/ossProjectsPage.ts`
- fuzzy 专项测试：`src/__tests__/fuzzyQuery.test.ts`、`src/__tests__/fuzzyProjectSearch.test.ts`、`src/__tests__/visualConsoleFuzzySearch.test.ts`

当前验证收口：

- targeted code-implementation preflight receipt 已在本 ExecPlan 更新后重新写入并校验。
- `visual-console:web` 真实 smoke 与 `/api/projects/fuzzy-search` 请求验证已完成。

## 当前进度

- 需求分析：`Done`
- 设计冻结：`Done`
- 执行计划：`Done`
- 实施：`Done`
- 验证：`Done`

## 已落地内容

- 已完成需求文档与设计文档对齐，设计状态为 `Approved`。
- 已确认项目库当前是 artifact/file-first，不是数据库项目库。
- 已确认当前搜索实现和测试入口，计划应优先落在 `src/search/`、`app/visualConsole/*`、`app/server.ts` 和 `src/__tests__/`。
- 已抽出 `src/search/projectSearchKernel.ts` 并让前端 direct search 与服务端 fuzzy search 复用同一 normalize/tokenize/rank/filter/sort/pagination 口径。
- 已新增 `src/search/projectSearchIndex.ts`，从 `ProjectsViewModel["projects"]` 投影 searchable records，并复用现有 company/direction alias 语义。
- 已冻结 fuzzy interpretation/response schema、7 类 `semantic_class`、触发阈值、缓存键、diagnostics 与合法性校验。
- 已新增 LLM interpreter，复用 `src/llm.ts` / provider registry；单测通过 fake caller 覆盖 success、repair、schema invalid、provider error、timeout 与 unconfigured fallback。
- 已新增 fuzzy service，覆盖 direct gate、expanded search、regulated boundary、hot-only、needs clarification、LLM failed fallback、cache hit/miss 与 raw output 不进入 response。
- 已新增 `POST /api/projects/fuzzy-search`，malformed payload 返回稳定 4xx JSON；有效请求内部失败返回 `source="llm_failed_fallback"` 与 `diagnostics.fallback_reason="endpoint_error"`。
- 已新增 Projects 前端 zero-result fuzzy request：direct result 非 0 不触发；zero-result 达阈值后 debounce 请求；Enter/示例词可立即触发；AbortController 与 sequence/key guard 防止 stale response 覆盖新查询。
- 已新增 fuzzy UI 状态区：expanded、regulated boundary、hot-only、needs clarification、LLM failed fallback 均有用户可见状态；direct results 不展示 LLM 解释或“AI 已优化搜索”。
- 已修复 Projects 前端 threshold 判断的浏览器脚本注入问题，生成脚本不再包含 Node/tsx import alias。

## 实施阶段

| 阶段 | 状态 | 目标 | 完成标志 |
| --- | --- | --- | --- |
| Phase 0：契约与计划门禁 | `Done` | 固定类型、schema、运行时边界和测试夹具，不接入 UI | fuzzy schema、response schema、diagnostics、fixtures 可被测试直接引用 |
| Phase 1：共享 Search Kernel | `Done` | 抽出 direct search kernel 并保持现有搜索结果一致 | `visualConsoleSearchAlignment` 通过，新增 kernel 等价测试通过 |
| Phase 2：LLM Interpreter 与 Prompt | `Done` | 落地 prompt、JSON 解析、合法性校验、repair、timeout/unconfigured 降级 | interpreter 单测覆盖 7 类、非法输出、repair 失败 |
| Phase 3：Fuzzy Search Service 与 Endpoint | `Done` | 编排 direct gate、LLM 路由、扩展检索、缓存、diagnostics，只读 endpoint | service/endpoint 集成测试覆盖 direct/expanded/regulated/hot/ambiguous/failure |
| Phase 4：Projects 前端集成 | `Done` | zero-result 时触发 endpoint 并展示解释、边界、澄清和降级状态 | 前端行为测试或 DOM 测试能验证用户可见语义 |
| Phase 5：验证、回归与账本收口 | `Done` | 补齐门禁、测试矩阵、验证记录和后续入口 | preflight、typecheck、目标测试通过，ExecPlan 更新验证记录 |

## 实施步骤

### Phase 0：契约与计划门禁

1. 在 `src/search/fuzzyQueryTypes.ts` 冻结设计中的类型：
   - `FuzzySearchSemanticClass`
   - `FuzzySearchDecision`
   - `FuzzySearchResultMode`
   - `LlmFuzzyQueryInterpretation`
   - `FuzzyProjectSearchResponse`
   - `FuzzyProjectSearchDiagnostics`
2. 冻结 7 类 `semantic_class`，不得保留旧的 `regulated_in_scope`、`regulated_out_of_scope` 或 `boundary_response`。
3. 冻结触发常量：
   - 中文最小长度 `2`
   - 英文最小长度 `3`
   - debounce `600ms`
   - LLM 单查询超时 `5000ms`
   - repair 调用最多 `1` 次
4. 冻结缓存键：
   - `date + normalized_query + lang + active_filters + fuzzy_schema_version`
5. 准备测试 fixtures：
   - direct hit：`电商` / `UI-TARS`
   - task use case：`帮客服处理工单的 agent`
   - low semantic：`这怎么哈哈了`
   - open discovery：`最近有什么值得看`
   - regulated keyword：`美股今天买什么` / `给我诊断这个病`
   - ambiguous：需要澄清的多义查询
6. 冻结 LLM provider/config 边界：
   - fuzzy search 只能消费 `AppConfig["llm"]`、`src/llm.ts`、`src/providers/index.ts` 暴露的 provider registry。
   - 单测必须可注入 fake provider / stub provider，不得通过真实 OpenAI/Anthropic/DeepSeek SDK 完成 fuzzy interpreter 测试。
   - `llm.enabled=false`、`provider="none"`、缺失 API key、provider error、provider timeout 都必须映射为受控 fallback diagnostics。
7. 运行并记录：
   - `npm.cmd run exec-plan:review:preflight`
   - `npm.cmd run code-implementation:preflight -- --write --exec-plan docs/specs/exec-plans/natural-language-fuzzy-search-recommendation-v0.1.exec-plan.md`
   - `npm.cmd run code-implementation:preflight -- --check --exec-plan docs/specs/exec-plans/natural-language-fuzzy-search-recommendation-v0.1.exec-plan.md`

### Phase 1：共享 Search Kernel

1. 将 `normalizeProjectSearchText`、tokenize、`rankProjectSearchMatch`、`filterAndSortProjectCards`、`paginateProjectCards` 从 `app/visualConsole/clientScript.ts` 抽到 `src/search/projectSearchKernel.ts`。
2. `app/visualConsole/clientScript.ts` 继续导出当前测试使用的函数名，避免破坏既有 import。
3. 如果浏览器内联脚本仍需函数源码序列化，必须从共享 kernel 派生，不得复制第二套逻辑。
4. 新增或扩展测试，证明：
   - 既有别名、repo、公司、方向搜索命中不变。
   - direct hit 查询返回结果时，后续 fuzzy service 不会调用 LLM。
5. 完成标志：
   - `src/__tests__/visualConsoleSearchAlignment.test.ts` 通过。
   - 新增 kernel 等价测试通过。

### Phase 2：LLM Interpreter 与 Prompt

1. 在 `src/search/fuzzyQueryPrompt.ts` 落地主 prompt 和 repair prompt。
2. prompt 必须保持设计冻结语义：
   - LLM 只解释查询，不生成项目、事实、分数、排名或专业建议。
   - 敏感领域必须优先归类为 `regulated_keyword_search`，只抽关键词并附边界提示。
   - `ambiguous` 必须返回 2-3 个可执行 query rewrite。
3. 在 `fuzzyQueryInterpreter.ts` 落地：
   - JSON parse
   - schema 校验
   - 合法性规则校验
   - repair once
   - timeout
   - unconfigured fallback
4. 合法性规则必须包括：
   - `low_semantic/open_discovery`：`hot_only`、`hot_projects`、无扩展词。
   - `topic_keyword/task_use_case/attribute_filter/regulated_keyword_search`：`expand_query`、`projects`、至少一个扩展查询。
   - `regulated_keyword_search`：`boundary.is_sensitive_domain=true`、`sensitive_domain` 非空、`user_message_cn` 非空。
   - `ambiguous`：`needs_clarification`、`none`、无扩展查询、2-3 个澄清选项。
5. 单测必须覆盖：
   - 7 类合法输出。
   - 枚举越界。
   - JSON 非法。
   - regulated 输出缺边界提示。
   - ambiguous 缺澄清选项。
   - repair 后仍非法降级。
   - `llm.enabled=false` 与 `provider="none"` 返回 `diagnostics.fallback_reason="llm_unconfigured"`。
   - 缺失 API key、provider error 返回受控 provider fallback，不向上泄漏 SDK 原始错误。
   - provider timeout 返回 `diagnostics.fallback_reason="llm_timeout"`。
   - fake provider / stub provider 可驱动成功、repair、error、timeout 路径。

### Phase 3：Fuzzy Search Service 与 Endpoint

1. 在 `fuzzyProjectSearchService.ts` 编排完整状态机：
   - normalize
   - direct search gate
   - LLM interpretation
   - route by `semantic_class`
   - execute expanded search / hot fallback / clarification
   - build response
2. direct gate 必须使用 Phase 1 的共享 search kernel。
3. 扩展查询执行规则：
   - 对每个 `expanded_queries[].query` 搜索项目库。
   - 合并去重。
   - 默认保留扩展结果的相关性顺序；仅在 `sort_preference` 明确为 `score` 或 `growth` 时使用现有分数/增长排序。
   - `boost_terms` 只能用于同分微调或解释，不得生成新 LLM score。
4. 过滤规则：
   - 仅执行设计中冻结的 `time_window`、`risk_preference`、`freshness_preference`、`sort_preference` 可执行映射。
   - 无法执行的过滤项必须写入 `diagnostics.unsupported_filters`。
5. 缓存规则：
   - 缓存解释结果、扩展查询、策略、命中数和失败原因。
   - 可以缓存 raw LLM output 与校验后 interpretation 作为审计证据。
   - raw LLM output 不得出现在 `FuzzyProjectSearchResponse`、前端 DOM、用户可见状态或项目事实字段。
   - 不缓存不存在于项目库的最终项目事实。
6. 在 `app/server.ts` 新增 `POST /api/projects/fuzzy-search`：
   - 输入包含 raw query、date/lang/filter/sort/page context。
   - 输出 `FuzzyProjectSearchResponse`。
   - 只读当前 Projects view / daily artifact。
   - 有效请求下的 endpoint 内部受控失败必须返回 `FuzzyProjectSearchResponse`，其中 `source="llm_failed_fallback"`、`diagnostics.fallback_reason="endpoint_error"`，并携带 hot projects 供前端降级展示。
   - malformed payload 必须返回稳定 4xx JSON 错误，错误码为 `invalid_fuzzy_search_request` 或等价冻结枚举，不进入 LLM、不写入 `data/`。
7. 集成测试必须覆盖：
   - direct hit 不触发 LLM。
   - zero-result task use case 触发 LLM 并扩展命中。
   - regulated keyword 返回 `source="regulated_keyword_search"` 和边界提示。
   - low semantic/open discovery 返回 hot projects。
   - ambiguous 返回澄清选项且不直接搜索。
   - LLM unavailable/timeout/invalid/schema_invalid 降级为 hot fallback。
   - endpoint 请求前后当前 daily artifact hash 与 mtime 不变。
   - endpoint 请求前后 `data/` 文件清单不新增，既有文件 mtime 不变化。
   - malformed payload 返回定义好的 4xx JSON 错误。
   - 有效请求触发内部异常时返回 `source="llm_failed_fallback"` 与 `fallback_reason="endpoint_error"`。

### Phase 4：Projects 前端集成

1. 在 Projects 搜索交互中保留现有 direct search 优先逻辑。
2. 只有当本地 direct result 为 `0` 且查询满足最小长度时，才启动 fuzzy request。
3. 自动触发必须 debounce `600ms`，Enter / 点击搜索可立即触发。
4. 每次新输入必须取消或忽略旧请求，防止 stale fuzzy response 覆盖较新的 direct results。
5. 前端必须展示：
   - expanded results：简短关键词/解释摘要。
   - regulated keyword search：紧凑边界提示。
   - hot-only：保留原查询，展示热门项目，不显示扩展词。
   - ambiguous：2-3 个可执行改写选项。
   - llm failed fallback：热门项目 + 降级状态。
6. 前端禁止展示：
   - LLM 原始长文本。
   - LLM 生成项目答案。
   - direct results 上的“AI 已优化搜索”。
7. 测试必须证明：
   - 输入 `电商` 不触发 fuzzy endpoint。
   - 输入 zero-result task query 会请求 endpoint。
   - endpoint 返回 hot-only 时原查询保留且卡片不被原查询继续隐藏。
   - regulated boundary message 可见。
   - stale response 不覆盖新查询状态。

### Phase 5：验证、回归与账本收口

1. 运行结构与技能门禁：
   - `npm.cmd run exec-plan:review:preflight`
   - `npm.cmd run code-implementation:preflight -- --write --exec-plan docs/specs/exec-plans/natural-language-fuzzy-search-recommendation-v0.1.exec-plan.md`
   - `npm.cmd run code-implementation:preflight -- --check --exec-plan docs/specs/exec-plans/natural-language-fuzzy-search-recommendation-v0.1.exec-plan.md`
2. 运行类型与目标测试：
   - `npm.cmd run typecheck`
   - `npm.cmd test -- visualConsoleSearchAlignment fuzzyQuery fuzzyProjectSearch visualConsoleFuzzySearch`
3. 如已有全量测试仍可承受，运行：
   - `npm.cmd test`
4. 手动或自动 smoke：
   - 无 LLM key 启动 `visual-console:web`，确认 direct search 可用。
   - 使用 mock LLM 或 stub service 验证 zero-result UI 状态。
5. 更新本 ExecPlan：
   - 当前状态
   - 已落地内容
   - 验证记录
   - 残余风险
   - 下一阶段入口
6. 收口前必须确认：
   - targeted code-implementation preflight 的 receipt 指向本 ExecPlan，而不是其他计划。
   - endpoint 只读测试通过，证明 daily artifact hash/mtime 与 `data/` 文件清单未变化。
   - provider 边界测试通过，证明 fuzzy 模块没有 direct SDK import，也没有第二套 provider/config registry。
   - raw LLM output 只存在于审计缓存，不存在于 UI response、DOM 或项目事实字段。

## 验收标准

1. 已有直接搜索词不触发 LLM。
   - 输入 `电商`、`UI-TARS`、`memory` 等已有命中词，LLM 调用计数为 `0`，结果与当前搜索一致。
2. 原始无结果且有明确任务/名词的查询可扩展命中。
   - 输入“帮客服处理工单的 agent”后，LLM 输出 `task_use_case`，系统扩展到客服/工单方向并返回项目库项目。
3. 无意义查询不生成扩展词。
   - 输入“这怎么哈哈了”后，`expanded_queries=[]`，展示热门项目。
4. 泛探索查询展示热门项目。
   - 输入“最近有什么值得看”后，展示默认热门项目流，不要求用户重新输入关键词。
5. 敏感领域按关键词承接为站内项目搜索。
   - 输入“美股今天买什么”“给我诊断这个病”后，系统返回 `regulated_keyword_search`，抽取金融/医疗关键词，搜索项目库，并显示边界提示。
6. LLM 输出不可越权。
   - LLM 返回项目名、排序、事实或专业建议时，系统不得直接展示这些内容。
7. LLM 不可用时可降级。
   - 无 key / timeout / invalid JSON / schema invalid 均不破坏 direct search，zero-result 可展示热门项目和降级状态。
8. 调用链路可审计。
   - response diagnostics 可区分 direct-search、llm-expanded、regulated-keyword-search、hot-only、needs-clarification、llm-failed fallback。
   - raw LLM output 仅可作为缓存中的审计证据存在，不暴露给 UI。
9. endpoint 只读行为可证明。
   - 对 `POST /api/projects/fuzzy-search` 的 direct、expanded、hot、failure 请求前后，当前 daily artifact hash/mtime 不变，`data/` 下不新增或修改文件。
10. endpoint 失败合同稳定。
   - malformed payload 返回定义好的 4xx JSON 错误；有效请求内部失败返回 `source="llm_failed_fallback"` 与 `diagnostics.fallback_reason="endpoint_error"`。

## 验证矩阵

| 类型 | 验证项 | 命令/方式 | 成功标准 |
| --- | --- | --- | --- |
| 计划 | ExecPlan review 预检 | `npm.cmd run exec-plan:review:preflight` | ExecPlan review skill 与 receipt 通过 |
| 计划 | 本计划实现门禁 receipt 写入 | `npm.cmd run code-implementation:preflight -- --write --exec-plan docs/specs/exec-plans/natural-language-fuzzy-search-recommendation-v0.1.exec-plan.md` | receipt 指向本 ExecPlan，且不覆盖默认旧计划 receipt |
| 计划 | 本计划实现门禁 receipt 校验 | `npm.cmd run code-implementation:preflight -- --check --exec-plan docs/specs/exec-plans/natural-language-fuzzy-search-recommendation-v0.1.exec-plan.md` | CodeImplementation skill 与本 ExecPlan hash 一致 |
| 结构 | TypeScript 类型检查 | `npm.cmd run typecheck` | 无类型错误 |
| 回归 | 现有项目搜索对齐 | `npm.cmd test -- visualConsoleSearchAlignment` | 既有别名、方向、repo 搜索仍命中 |
| 单元 | fuzzy schema / validator | `npm.cmd test -- fuzzyQueryTypes` | 7 类合法/非法输出均符合预期 |
| 单元 | LLM interpreter | `npm.cmd test -- fuzzyQueryInterpreter` | parse/repair/timeout/unconfigured 路径可测 |
| 单元 | LLM provider/config 边界 | `npm.cmd test -- fuzzyQueryInterpreter` | fake provider 可注入；无 key、`provider=none`、provider error、timeout 均进入受控 fallback；fuzzy 模块不 direct import SDK |
| 集成 | fuzzy search service | `npm.cmd test -- fuzzyProjectSearchService` | direct/expanded/regulated/hot/ambiguous/failure 全覆盖 |
| 集成 | endpoint 只读边界 | `npm.cmd test -- fuzzyProjectSearchService` 或 endpoint 专项测试 | 请求前后 daily artifact hash/mtime 不变，`data/` 无新增/修改 |
| 集成 | endpoint 失败合同 | `npm.cmd test -- fuzzyProjectSearchService` 或 endpoint 专项测试 | malformed payload 返回稳定 4xx JSON；内部异常返回 `llm_failed_fallback` + `endpoint_error` |
| 前端 | Projects fuzzy UI | `npm.cmd test -- visualConsoleFuzzySearch` | 用户可见状态、stale request、边界提示可验证 |
| 全量 | 仓库测试 | `npm.cmd test` | 如运行，目标测试和既有测试全部通过 |
| 手动 smoke | 无 LLM key visual console | `npm.cmd run visual-console:web` | 页面可启动，direct search 可用，zero-result 有降级状态 |

## 验证记录

| 日期 | 验证项 | 状态 | 记录 |
| --- | --- | --- | --- |
| 2026-06-16 | 设计 review 预检 | 已完成 | `npm.cmd run design-review:preflight` 通过，设计已批准进入 ExecPlan |
| 2026-06-16 | ExecPlan 创建 | 已完成 | 新增本计划并登记到 `docs/specs/exec-plans/README.md` |
| 2026-06-16 | ExecPlan review 预检 | 已完成 | `npm.cmd run exec-plan:review:preflight` 通过，确认 review skill 与 receipt 可用 |
| 2026-06-16 | CodeImplementation targeted preflight | 已完成 | `npm.cmd run code-implementation:preflight -- --write --exec-plan docs/specs/exec-plans/natural-language-fuzzy-search-recommendation-v0.1.exec-plan.md` 与对应 `--check` 通过，receipt 绑定本计划 |
| 2026-06-16 | TypeScript 类型检查 | 已完成 | `npm.cmd run typecheck` 通过 |
| 2026-06-16 | Diff 空白检查 | 已完成 | `git diff --check` 通过，仅有 CRLF 提示 |
| 2026-06-17 | TypeScript 类型检查 | 已完成 | `npm.cmd run typecheck` 通过 |
| 2026-06-17 | 目标测试矩阵 | 已完成 | `npm.cmd test -- visualConsoleSearchAlignment fuzzyQuery fuzzyProjectSearch visualConsoleFuzzySearch` 通过，21 files / 86 tests |
| 2026-06-17 | direct gate / provider / raw output 边界 | 已完成 | `fuzzyQuery` 与 `fuzzyProjectSearch` 覆盖 direct hit 不调用 LLM、fake provider 注入、timeout/unconfigured fallback、raw LLM output 不进入 response |
| 2026-06-17 | endpoint 合同测试 | 已完成 | `fuzzyProjectSearch` 覆盖 malformed payload 4xx JSON、内部异常 `llm_failed_fallback + endpoint_error`、有效 no-key fallback 请求不修改 `data/` 文件清单/mtime |
| 2026-06-17 | Projects fuzzy UI 契约测试 | 已完成 | `visualConsoleFuzzySearch` 覆盖 fuzzy 状态节点、zero-result gate、debounce、AbortController、stale guard、hot-only 不继续按原查询隐藏卡片 |
| 2026-06-17 | Projects fuzzy 前端运行时修复 | 已完成 | `queryMeetsFuzzyTriggerThreshold` 改为浏览器脚本内自包含实现，渲染检查返回 `NO_IMPORT_ALIASES` |
| 2026-06-17 | CodeImplementation targeted preflight 刷新 | 已完成 | `npm.cmd run code-implementation:preflight -- --write --exec-plan docs/specs/exec-plans/natural-language-fuzzy-search-recommendation-v0.1.exec-plan.md` 与对应 `--check` 通过，receipt 已刷新 |
| 2026-06-17 | visual-console:web smoke | 已完成 | 临时启动 `visual-console:web`，`GET /projects` 返回 200，`POST /api/projects/fuzzy-search` 返回 200 与 fuzzy response |

## 回滚策略

1. Phase 1 失败时：
   - 保留 `app/visualConsole/clientScript.ts` 现有本地搜索函数导出。
   - 不接入 fuzzy endpoint。
2. Phase 2 失败时：
   - 不启用 LLM interpreter。
   - zero-result 路径只允许 hot fallback，并记录 `llm_unconfigured` 或 `schema_invalid`。
3. Phase 3 失败时：
   - 不挂载 `/api/projects/fuzzy-search`；如已挂载，有效请求必须返回 `source="llm_failed_fallback"` 与 `diagnostics.fallback_reason="endpoint_error"`，malformed payload 返回定义好的 4xx JSON。
   - 前端仍只运行现有 direct search。
4. Phase 4 失败时：
   - 通过 feature flag 或前端开关禁用 fuzzy request。
   - 保留 direct search UI 和现有项目卡片渲染。
5. 任何阶段不得通过回滚删除或修改 daily/weekly artifact。

## 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 搜索 kernel 抽取导致现有搜索行为漂移 | 直接破坏 Projects 页面可用性 | 先落 kernel 等价测试，再改消费者 |
| LLM 输出越权或自由文本泄漏到 UI | 用户误读为项目事实或专业建议 | schema validation + 合法性规则 + UI 禁止展示原始 LLM 文本 |
| 敏感领域关键词扩展过宽 | 返回低相关项目 | diagnostics、边界提示、只用项目库检索、unsupported filter 记录 |
| 前端请求竞争 | 旧 response 覆盖新查询 | abort/sequence id 守护 stale response |
| LLM 不可用影响搜索入口 | 搜索入口卡死或空白 | direct search 独立，zero-result hot fallback |
| endpoint 读取当前项目数据不一致 | direct gate 与扩展检索分裂 | 共享 kernel + 从同一 Projects view/index 投影 |

## 结论记录

当前实现已完成 Phase 0-5：共享搜索 kernel、LLM 查询解释器、fuzzy service、只读 endpoint、Projects 前端 zero-result fuzzy 状态、targeted CodeImplementation receipt 刷新与真实 `visual-console:web` smoke 均已收口。

## 下一阶段入口

1. 进入代码审核复核或提交准备。
2. 如需更高置信度，可在真实浏览器中手动输入 zero-result 查询观察 fuzzy 状态区。
