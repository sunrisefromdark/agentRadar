# 执行计划：Visual Console 内容真实性与详情承载修复 v0.1

## 文档状态

- 版本：`v0.1`
- 当前状态：`Completed`
- 负责人：`Codex`
- 风险等级：`High`
- 设计来源：
  - `docs/specs/design-docs/trend-radar-visual-console-design.md`
  - `docs/specs/design-docs/agent-enhancement-layer-and-weekly-trend-design.md`
  - `docs/specs/exec-plans/trend-radar-visual-console-visual-refresh-v0.1.exec-plan.md`
  - `docs/specs/exec-plans/report-output-remediation-v0.1.exec-plan.md`
- 说明：用户已明确要求暂时冻结 KB / `Decision Memory` 重构，因此本计划当前只包含两个已批准实现目标：项目介绍真实性修复、详情承载区滚动回归修复。KB 相关内容仅保留为冻结说明，不进入本轮实现。

## 任务信息

| 字段 | 内容 |
| --- | --- |
| 任务名称 | Visual Console 内容真实性与详情承载修复 |
| 用户触发问题 | `Projects` 项目介绍同质化且误导、详情承载区滚动回归、知识卡片/知识库可读性差且意义不清 |
| 主要影响面 | `Projects`、`Weekly supporting project detail`、daily/weekly 项目说明生成链路 |
| 交付目标 | 在不改变 artifact-first 的前提下，修复项目介绍真实性与详情区滚动契约；KB / `Decision Memory` 重构暂不实现 |

## 目标

本计划只解决以下三个可复现问题，并把它们收敛为一次可验证的修复交付：

1. `project_brief_cn` 必须重新回答“它是做什么的”，不能再把不同项目压平成同一类空泛模板，尤其不能把 `TauricResearch/TradingAgents` 误写成通用代理调度后台。
2. 桌面端 `Detail Surface` 必须恢复为真正可独立滚动、可持续阅读的详情承载区；用户在长列表中打开详情后，不应被迫回到页面顶部才能继续阅读。
3. KB / `Decision Memory` 的产品定位存在关键语义未决：
  - 它到底服务“系统自动记忆”还是“用户判断记忆”
  - 如果用户只看日报、不写人工笔记，它是否仍然有独立价值
  - 它与 `Projects` / `Weekly` 的差异边界如何显式成立
4. 在上述问题没有被需求和设计文档明确回答前，KB 不进入本轮实现，也不作为当前交付物的验收项。

## 设计对齐

本计划严格继承以下冻结设计，不新增实现层设计决策：

- `trend-radar-visual-console-design.md / 17.2`：详情承载区是 **URL 可寻址的同页详情面板**，不是临时弹窗或不可深链抽屉。
- `trend-radar-visual-console-design.md / 18.12.2`：桌面端 `Detail Surface` 必须是独立滚动容器，鼠标位于详情区时滚轮优先作用于详情区。
- `trend-radar-visual-console-design.md / 18.12.5`：KB 详情必须采用 `Reader Header -> Executive Summary -> Machine Notes -> Human Notes -> Linked Context` 的阅读顺序。
- `agent-enhancement-layer-and-weekly-trend-design.md`：`project_brief_cn` 必须回答“它是做什么的”，并遵循“项目证据优先，范式模板兜底”；来源只允许使用 `project_name`、`repo_full_name`、`description`、结构化 `tags`、`score.paradigm`、`score.components` 等本地分类证据。
- `report-output-remediation-v0.1.exec-plan.md / 验收 10`：项目用途摘要必须优先描述产品用途、类别或解决的问题，不能再用“值得继续观察”替代“它是做什么的”。

## 范围边界

### 允许修改

- `src/action/projectBriefs.ts`
- `src/action/dailyReport.ts`
- `src/action/weeklyEnhancement.ts`
- `app/server.ts`
- `app/styles.css`
- `src/__tests__/actionOutput.test.ts`
- `src/__tests__/dailyEnhancement.test.ts`
- `src/__tests__/weeklyEnhancement.test.ts`
- `src/__tests__/visualConsoleWeb.test.ts`
- `src/__tests__/visualConsoleWeb.visual.test.ts`
- 与本计划直接对应的 `docs/specs/exec-plans/*` 索引与进度账本

### 禁止修改

- 不改动 `src/signal/*`、`src/filter/*`、`src/normalize.ts`、`src/score/*` 的信号、打分、freshness 与候选筛选语义。
- 不新增新的 artifact schema、一级视图、实时推送、前端重算评分/趋势、第二真相源。
- 不把项目介绍修复扩展为“读取 README 或联网抓取仓库说明”；`project_brief_cn` 输入边界保持设计冻结。
- KB / `Decision Memory` 重构在本计划中冻结：不修改 `knowledge card` schema、不改 `src/action/knowledgeCard.ts`、不改 `src/cli.ts` 的 `build-kb` 产物契约、不改 KB 首页或详情的产品定位。
- 不通过放宽测试或删除回归用例来掩盖滚动/可读性问题。

### 兼容性约束

- 所有现有 URL/query 语义保持不变：`lang`、`date`、`anchor`、`project`、`trend_key`、`slug`、`source_view`、`theme`。
- `Overview -> Projects`、`Weekly -> supporting project detail`、`Project detail -> KB` 的现有钻取路径必须继续成立。
- `data-preserve-scroll`、局部 `Detail Surface` 更新、移动端全屏详情页退化行为必须继续保留。
- `project_brief_cn`、`why_today_cn`、`why_this_week_cn` 仍然由增强层/模板兜底负责，UI 不发明新的自然语言字段。
- 现有 KB 与人工区内容必须原样保留，不允许在本轮修复中覆盖、重命名或迁移。

## 当前状态

- `Projects` 与详情页当前直接消费 artifact 中的 `project_brief_cn`，UI 本身不具备区分项目真实用途的能力，因此根因在生成与校验链路，不在展示层。
- 修复前的 `src/action/projectBriefs.ts` 曾优先按主题/标签/范式返回固定模板，导致 `agent-runtime` 类项目容易出现高度同质化说明；当前已切换为先消费项目证据，再用范式模板兜底。
- 详情承载区当前依赖 `detail-column` 局部滚动与客户端局部替换，但桌面端 drilldown 后详情自身可见性、滚动焦点与滚动状态保持不够稳定，已经出现回归。
- 用户已明确指出：当前 KB 模块的必要性、差异性与用户价值都未被说服，因此本轮不再尝试通过实现硬推进这部分产品定义。

## 非目标

- 不在本计划中重做整个 daily/weekly 增强架构。
- 不处理 `Source Health Summary` 之外的全局 copy 改写。
- 不顺手处理与这三项问题无关的样式美化或性能优化。
- 不在本计划内重跑历史所有 artifact；历史补跑如有需要，转入独立 follow-up。

## 阶段进度

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| Phase R0：基线与边界冻结 | `DONE` | 固定问题场景、设计映射、允许修改范围与回归样本 |
| Phase R1：项目介绍真实性修复 | `DONE` | 调整 `project_brief_cn` 生成与校验，减少同质化与误导 |
| Phase R2：详情承载区滚动回归修复 | `DONE` | 修复桌面端详情区可见性、独立滚动与局部切换保持 |
| Phase R3：KB / Decision Memory 重构 | `Frozen` | 产品定位、必要性与用户判断显化方式存在关键未决问题，暂不进入实现 |
| Phase R4：验证、收口与账本同步 | `DONE` | 运行测试矩阵、记录残余风险、同步 exec-plan 状态 |

## 已落地内容

- Phase R1：`src/action/projectBriefs.ts` 改为“项目证据优先，范式模板兜底”的用途归类；先消费 `description`、`tags`、`score.components`、repo 名称语义，再决定 brief。`project_brief_cn` 现在能区分多代理编排、金融交易 agent、终端/自托管 AI 助手、coding agent、RAG/知识工具、MCP/工具接入、基础设施/平台与开发者资源包等语义。
- Phase R1：`src/action/dailyReport.ts` 与 `src/action/weeklyEnhancement.ts` 补强 `project_brief_cn` 校验，继续拦截把“值得关注/值得继续观察”写进“它是做什么的”的错位输出，并新增去同质化约束，拒绝同批项目复用空泛通用句。
- Phase R2：`app/server.ts` 与 `app/styles.css` 为桌面端 `Detail Surface` 补充可聚焦 detail 容器、`data-detail-key`、drilldown 后自动进入视口、局部替换滚动恢复与 PageDown 优先滚动。
- Phase R2：`src/__tests__/visualConsoleWeb.test.ts` 与 `src/__tests__/visualConsoleWeb.visual.test.ts` 新增/升级了 detail 可见性、键盘滚动优先级和独立滚动回归断言。

## 执行进度同步

### Phase R1：项目介绍真实性修复

- Status: `DONE`
- Files Changed: `src/action/projectBriefs.ts`、`src/action/dailyReport.ts`、`src/action/weeklyEnhancement.ts`、`src/__tests__/actionOutput.test.ts`、`src/__tests__/dailyEnhancement.test.ts`、`src/__tests__/weeklyEnhancement.test.ts`
- Verification: `npm run typecheck`；`npm run test -- actionOutput dailyEnhancement weeklyEnhancement`
- Result: `ruvnet/ruflo`、`TauricResearch/TradingAgents`、`openclaw/openclaw` 已能输出可区分用途；daily/weekly enhancement 校验会拒绝把“值得继续关注”类文案写入 `project_brief_cn`

### Phase R2：详情承载区滚动回归修复

- Status: `DONE`
- Files Changed: `app/server.ts`、`app/styles.css`、`src/__tests__/visualConsoleWeb.test.ts`、`src/__tests__/visualConsoleWeb.visual.test.ts`
- Verification: `npm run test:visual-console:web`；`npm run test:visual-console:web:visual`
- Result: 桌面端 detail drilldown 后会进入当前视口、获得焦点并优先响应 `PageDown`；详情区保持独立滚动，局部替换不破坏 URL 钻取与移动端全屏详情路径

### Phase R4：验证、收口与账本同步

- Status: `DONE`
- Files Changed: `docs/specs/exec-plans/visual-console-content-and-detail-remediation-v0.1.exec-plan.md`
- Verification: `npm run exec-plan:preflight`；`npm run typecheck`；`npm run test -- actionOutput dailyEnhancement weeklyEnhancement`；`npm run test:visual-console:web`；`npm run test:visual-console:web:visual`
- Result: 本计划要求的验证矩阵全部通过；本轮未发现需要阻塞交付的额外环境问题

## 实施阶段

### Phase R0：基线与边界冻结

目的：
- 把用户反馈映射到设计与现有代码入口，避免实施阶段再做额外设计决策。

决策：
- 固定三个主回归样本：`ruvnet/ruflo`、`TauricResearch/TradingAgents`、`openclaw/openclaw`。
- 固定两个实现详情场景：`Projects`、`Weekly supporting project`。
- `Knowledge Base` 只保留冻结说明，不作为当前实现对象。

约束：
- 所有修复必须可回链到上文列出的设计章节与现有 exec-plan。
- 不允许出现“顺手统一更多文案”“顺手做更大交互重构”这类脱离问题闭环的增量。

### Phase R1：项目介绍真实性修复

目的：
- 让 `project_brief_cn` 在 daily/weekly 里优先回答项目用途，而不是只复述热门范式标签。

决策：
- 把 `src/action/projectBriefs.ts` 从“主题模板优先”调整为“项目证据优先，范式模板兜底”。
- `project_brief_cn` 先消费 `description`、`tags`、`score.components`、repo 名称语义等项目证据，只有证据不足时才回退到范式模板。
- 对 `project_brief_cn` 的模板兜底至少区分以下用途族：
  - 多代理编排/工作流运行时
  - 金融交易 agent/研究框架
  - 终端助手/自托管 agent shell
  - coding agent
  - RAG/知识工具
  - 基础设施/平台能力
- 对 `TradingAgents` 这类项目，必须由已有 `description / tags / score.components / paradigm` 明确落到金融交易语义，而不是泛化成“调度后台”。
- 保持 daily 与 weekly 的项目介绍生成逻辑来源对称；如果复用共享 helper，则 weekly 一并受益，不再维护两套漂移规则。
- daily 与 weekly 的文案校验都要加入“去同质化”约束：同一批项目不能复用同一句空泛介绍，也不能只复述“这是一个 AI 代理调度后台”这类泛化结论。

约束：
- 不能引入 README、联网抓取或仓库外推断。
- 校验必须继续拦截营销口号、未验证能力、把“为什么值得看”写进“它是做什么的”的错位输出。
- 若 Agent 输出不可用，`template_fallback` 也必须满足“它是做什么的”而不是“值不值得看”。

### Phase R2：详情承载区滚动回归修复

目的：
- 恢复桌面端详情区作为可持续阅读容器的交互契约。

决策：
- 桌面端 `Detail Surface` 继续保持独立滚动容器，但要补齐 drilldown 后的可见性、焦点与滚动状态保持。
- 局部 `Detail Surface` 替换时，必须同时保证：
  - 详情列仍处于当前视口可见区域
  - 详情容器自身滚动状态可预测
  - 主页面列表位置在阅读详情期间保持稳定
- `detail-head` 仅允许作为详情容器内部 sticky，不得重新把整列变成相对整页的强 sticky 壳层。
- 移动端全屏详情模式继续保留，但不能因桌面修复破坏移动端滚动和关闭路径。

约束：
- 不改变 URL 驱动与 `data-preserve-scroll` 协议语义。
- 不通过“取消局部替换、退回全页刷新”来规避问题。
- 不允许让主页面根滚动重新接管详情阅读行为。

### Phase R3：KB / Decision Memory 重构（冻结）

目的：
- 记录一个尚未澄清完成的产品方向，暂不实施。

决策：
- 冻结原因不是技术阻塞，而是产品语义未决。当前至少有以下问题尚未明确：
  1. “上次判断”究竟指系统自动摘要、人工批注，还是两者混合。
  2. 如果用户只读日报、从未写人工笔记，这个模块是空白、背景索引，还是仍然应该给出稳定价值。
  3. “避免重复思考”具体避免的是系统重复总结，还是用户重复判断；两者需要完全不同的 artifact 契约。
  4. 是否需要显式用户身份、个人判断隔离或多用户视角；当前产品没有冻结这部分前提。
  5. 现有 `knowledge card` schema 是否足够承接“变化摘要 / 未决问题 / 连续判断”，还是应该先做产品与数据契约重设。
- 在这些问题没有被需求和设计文档明确回答前，本阶段不再推进任何 KB 重构实现。

约束：
- 本计划的实现、测试、验收、回滚都不再包含 KB 重构。
- 若后续要重启这部分，必须先补需求澄清或 design addendum，再开独立 follow-up exec-plan。

### Phase R4：验证、收口与账本同步

目的：
- 证明计划对应行为真实成立，而不是只通过结构字符串断言自证。

决策：
- 单测覆盖文案真实性与边界。
- Web 测试覆盖 drilldown 后详情可见与详情独立滚动。
- 真正记录验证命令结果、残余风险和是否需要 follow-up。

约束：
- 不能跳过 `typecheck`、单测、Web 测试与 exec-plan preflight。
- 若某一类验证被环境或仓库既有债务阻塞，必须显式记录阻塞面与影响范围。

## 验收标准

### 验收 1：项目介绍重新回答“它是做什么的”

- 可观测结果：`Projects` 列表与项目详情中的 `项目介绍` 对 `ruvnet/ruflo`、`TauricResearch/TradingAgents`、`openclaw/openclaw` 呈现出可区分的用途描述。
- 成功条件：
  - `TradingAgents` 明确呈现为金融交易/研究多代理框架。
  - `ruflo` 呈现为多代理编排/工作流运行时，而非金融或助手语义。
  - `openclaw` 呈现为终端助手/自托管 agent shell 之类的承载语义，而非“调度后台”。
- 失败条件：不同项目仍共享同一段通用模板、同批项目 brief 高度重复，或“项目介绍”继续写成“值得继续关注”。

### 验收 2：详情承载区恢复独立滚动且不再逼用户回顶

- 可观测结果：在 `Projects`、`Weekly -> supporting project` 两类 drilldown 中，详情区超出一屏时都能独立滚动。
- 成功条件：
  - 用户在主列表中段或底部打开详情后，不需要回到页面顶部才能看到并阅读详情。
  - 鼠标位于详情区时，滚轮/触控板/PageDown 优先作用于详情区，直到详情区到达边界。
  - 阅读详情期间主列表位置保持稳定。
- 失败条件：详情视觉上打开了，但滚轮仍然带走主页面；或者局部切换后详情跑出当前视口。

### 验收 3：修复不破坏既有 artifact-first 和钻取契约

- 可观测结果：`project` / `slug` / `trend_key` / `source_view` 查询参数、关闭详情、返回列表、跳转 KB 的路径仍然成立。
- 成功条件：现有 URL 驱动语义、滚动恢复语义与移动端全屏详情行为继续工作。
- 失败条件：为修复滚动或 KB reader 引入新的前端结论层，或破坏既有 drilldown 协议。

### 验收 4：验证矩阵可执行且先于收口

- 可观测结果：本计划对应的类型检查、单测、Web 测试和 exec-plan gate 有明确命令与记录。
- 成功条件：至少能证明文案差异化与滚动行为两条主路径成立。
- 失败条件：只保留人工口头判断，或只靠 HTML 字符串断言宣布“可读性已提升”。

## 验证矩阵

| 类型 | 验证内容 | 命令 / 方法 | 通过标准 |
| --- | --- | --- | --- |
| 结构 | ExecPlan 结构门禁 | `npm run exec-plan:preflight` | 计划包含必需章节，结构通过 |
| 类型 | 仓库类型检查 | `npm run typecheck` | 无新类型错误 |
| 单元 | 项目介绍用途语义 | `npm run test -- actionOutput dailyEnhancement weeklyEnhancement` | `project_brief_cn` 对用途语义有区分，且不把“值得看”混入“它是做什么的” |
| Web | 项目详情与 drilldown HTML 结构 | `npm run test:visual-console:web` | 项目详情、weekly supporting project drilldown、scroll wiring 与既有 KB 路径断言通过 |
| 浏览器 | 详情滚动体感 | `npm run test:visual-console:web:visual` | `scroll-behavior` 与相关布局/定位断言通过 |
| 冒烟 | 本地页面访问 | `npm run visual-console:web` 后人工打开 `Projects`/`KB` 样例路由 | 可复现并确认 drilldown、关闭、详情阅读链路正常 |

## 回滚策略

1. 若 `project_brief_cn` 新规则导致大面积回落为不可读空值或错误类别，优先回滚到上一个稳定 helper 版本，再保留新增测试样本，单独继续细化分类分支。
2. 若详情区滚动修复破坏移动端全屏详情、关闭路径或 URL 恢复，优先回滚局部 `Detail Surface` 交互改动，不回滚文案修复。

## 验证记录

| 日期 | 项目 | 状态 | 记录 |
| --- | --- | --- | --- |
| 2026-05-05 | 执行计划编写与设计对齐 | 已完成 | 已将三个问题分别对齐到 `visual console` 与 `agent enhancement` 设计来源，避免计划混入未冻结设计 |
| 2026-05-05 | ExecPlan 结构门禁 | 已完成 | `wsl bash -lc "cd /home/adduser/AgentProjection/agent-trend-radar && npm run exec-plan:preflight"` 通过，确认计划包含最小结构与账本项 |
| 2026-05-05 | KB / Decision Memory 方向冻结 | 已完成 | 根据用户最新反馈，确认 KB 模块的必要性、差异性、用户判断显化方式尚未被明确回答，因此从当前执行计划移出实现范围 |
| 2026-05-05 | 类型检查 | 已完成 | `wsl bash -lc "cd /home/adduser/AgentProjection/agent-trend-radar && npm run typecheck"` 通过，无新增类型错误 |
| 2026-05-05 | 文案/增强层单测 | 已完成 | `wsl bash -lc "cd /home/adduser/AgentProjection/agent-trend-radar && npm run test -- actionOutput dailyEnhancement weeklyEnhancement"` 通过，确认用途语义区分与 brief 边界校验生效 |
| 2026-05-05 | Visual Console Web 测试 | 已完成 | `wsl bash -lc "cd /home/adduser/AgentProjection/agent-trend-radar && npm run test:visual-console:web"` 通过，确认 detail HTML 结构、钻取链路与 scroll wiring 正常 |
| 2026-05-05 | Visual Console 浏览器回归 | 已完成 | `wsl bash -lc "cd /home/adduser/AgentProjection/agent-trend-radar && npm run test:visual-console:web:visual"` 通过，确认 detail 打开后可见、独立滚动且 `PageDown` 优先作用于详情区 |
| 2026-05-05 | 实现验证 | 已完成 | 本轮实现要求的 `exec-plan:preflight`、`typecheck`、目标单测、web 测试与浏览器级回归已全部通过 |
| 2026-05-05 | ExecPlan 与设计/实现二次同步 | 已完成 | 已把“项目证据优先，范式模板兜底”、`score.components` 分类证据、强特征拆分与批次去同质化约束回写到本 exec-plan，保证账本与已落地代码一致 |

## 当前残余风险

- `project_brief_cn` 的真实区分度受限于结构化输入本身；若 `description/tags/paradigm` 过于贫弱，模板兜底仍可能只能达到“弱区分”，不能伪装成高精度知识。
- 详情区滚动问题与客户端局部替换耦合较深；若只修 CSS 而不修可见性/状态保持，回归风险仍高。
- KB 模块的产品语义冻结在“待重新定义”状态：当前不实施，避免把未澄清的产品假设写死进代码和产物。
- 仓库现存无关门禁债务可能阻塞 `quality:gate`；本计划默认以 `exec-plan:preflight`、`typecheck`、目标测试矩阵作为本次实施收口条件。

## 结论记录

- 本计划当前是一个跨 daily/weekly 文案生成与 Visual Console 承载层的联合修复计划，但边界仍然清晰：
  - 文案真实性只改增强层与其测试。
  - 滚动修复只改浏览器承载层与其测试。
- 相比上一版，本计划明确把 KB / `Decision Memory` 重构冻结，避免在产品语义未决时误推进实现。

## 下一阶段入口

1. 本计划已完成并与当前代码、设计文档、验证记录对齐。
2. 若后续继续细化项目介绍语义，应在不突破本地证据边界的前提下扩充强特征规则与去同质化校验，不回退到范式模板优先。
3. KB 若后续重启，仍需单开 addendum 与 follow-up exec-plan。
