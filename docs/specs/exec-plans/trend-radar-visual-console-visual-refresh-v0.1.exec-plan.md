# 执行计划：Trend Radar Visual Console Visual Refresh

## 文档状态

- 版本：`v0.2`
- 当前状态：`Proposed for Review`
- 设计来源：
  - `docs/specs/design-docs/trend-radar-visual-console-design.md`
  - `docs/specs/exec-plans/trend-radar-visual-console-v0.1.exec-plan.md`
- 说明：本计划是 `Trend Radar Visual Console` 浏览器版的视觉改版 follow-up，只承接设计文档 `18. 浏览器前端视觉改版补充设计（2026-05-04 Addendum）` 与 `18.12 浏览器交互与性能修复补充（2026-05-04 Addendum B）`，不重开信息架构、artifact 所有权、状态模型或业务判断语义。

## 任务信息

| 字段 | 内容 |
| --- | --- |
| 任务名称 | Trend Radar Visual Console Visual Refresh |
| 负责人 | Codex |
| 风险等级 | `High` |
| 关联设计 | `docs/specs/design-docs/trend-radar-visual-console-design.md` |
| 关联基线 | `docs/specs/exec-plans/trend-radar-visual-console-v0.1.exec-plan.md` |
| 影响范围 | `app/server.ts`、`app/styles.css`、浏览器承载层模板/样式、`src/__tests__/visualConsoleWeb.test.ts`、必要时的启动与视觉回归脚本、exec-plan 文档索引 |

## 目标

在不改变浏览器版 Visual Console 既有 artifact-first、只读消费和五个一级视图语义的前提下，完成与设计文档第 18 节完全一致的前端页面设计美化：

1. 把当前偏“暖棕色大卡片 + 表单感较强”的页面，收敛为设计规定的 `Theme-aware Workspace`、`Soft depth & Frosted Glass`、`Type-first hierarchy`、`Calm & Contextual motion`。
2. 为浏览器端建立统一的 Light / Dark 双主题 design tokens、字体栈、宽度约束、间距系统、圆角层级和阴影层级。
3. 按设计冻结的顺序改造顶层 `Dynamic Floating Header`、`Immersive Context Strip`、`Bento Insight Grid` 和 `Seamless Secondary Content`，避免继续沿用通栏堆叠卡片。
4. 把 `兴趣方向` 模块改造成设计指定的 `Preference Card`，包含三段式结构、内联编辑、键盘保存/取消和非阻断式成功反馈。
5. 让 `Overview / Projects / Weekly / Run Health / Knowledge Base` 五个一级视图在视觉语言、详情侧栏、阅读宽度、状态表现、响应式行为上保持统一。
6. 在不引入新业务语义和复杂交互噪声的前提下，补齐设计指定的微型可视化、Skeleton Screen、Focus 态和响应式 / 可访问性要求。
7. 把“视觉是否真的达成”的验证方式从现有 HTML 字符串断言中拆出来，补成可执行的真实浏览器视觉验证层，避免实现者自行猜测完成标准。
8. 修复桌面端 Header 长时间跟随滚动、持续遮挡正文的问题，使一级壳层回到“低干扰导航”而不是“常驻阅读遮挡层”。
9. 把 `Projects`、`Weekly`、`Knowledge Base` 中的详情承载区冻结为独立滚动容器，避免滚轮落到主页面根滚动。
10. 修复 `Projects` 列表、`Source Health Summary` 与 KB 相关元信息中人为拼接的 `?` 分隔符，并把 KB 详情升级为可读的 reader 结构。
11. 收敛一级视图和详情切换的卡顿，尤其是 `Projects` 页的同步读盘和整页重建带来的延迟。

## 边界约束

### 允许修改

- `app/server.ts`
- `app/styles.css`
- `src/__tests__/visualConsoleWeb.test.ts`
- 仅用于视觉回归或样式守护的新增测试文件
- 仅用于真实浏览器视觉验证的测试夹具、快照基线与测试脚本
- `package.json` 中与浏览器视觉回归测试直接相关的脚本
- `docs/specs/exec-plans/*`

### 禁止修改

- 不改动 `src/visualConsole/build.ts`、`src/visualConsole/context.ts`、`src/visualConsole/status.ts` 中任何会改变读取、状态优先级、`latest` 解析、跨视图对象语义的逻辑，除非只是为了给现有模板暴露设计已要求的只读展示字段。
- 不改动 `src/filter/*`、`src/signal/*`、`src/normalize.ts`、评分、freshness、weekly judgment、risk flags、verify 口径。
- 不新增数据库、服务端写回、实时 websocket、大盘监控式新模块、第二真相源或新的一级视图。
- 不把视觉改版实现为“更厚的大卡片”或“更花哨的动效”；禁止偏离设计文档第 18 节冻结的视觉语言。
- 不把 `兴趣方向` 继续维持为横向铺满的大表单，不把设置区做成页面主角。
- 不用颜色单独传达状态；所有状态仍需保留文字标签。
- 不因为美化而降低 `Run Trust Summary`、`Source Health Summary`、状态 Banner、上下文信息的首屏优先级。
- 不把“通过字符串测试”误当成“视觉验收已完成”；涉及断点、computed style、focus-visible、主题切换和布局尺寸的要求，必须进入真实浏览器验证层。
- 不允许为微型可视化新增前端解释层、跨日趋势重算、KB 文本推断得分或新 tooltip 结论。

### 兼容性约束

- 五个一级视图、URL / query、详情侧栏、`lang` 参数、`date / anchor / project / trend_key / slug` 恢复行为保持不变。
- 浏览器版入口仍为 `npm run visual-console:web`，默认本地地址与端口冲突输出协议不变。
- 现有浏览器测试仍需覆盖核心消费语义；视觉改版只允许新增守护，不允许替换掉语义守护。
- 若新增微型可视化，只能消费已有 artifact 字段，不得引入 tooltip 推导、趋势重算或额外解释层。

## 当前状态

- 浏览器版 Visual Console 已具备完整的五个一级视图、详情承载、双语切换、URL 恢复和本地启动能力。
- 当前视觉实现仍明显偏向第一阶段可用性样式：
  - 主色和表面层级仍接近“单一暖棕色页面”
  - 顶栏、上下文栏、状态区和主内容仍以矩形大卡片顺序堆叠为主
  - `兴趣方向` 仍占据过大的首屏面积并保留强表单感
  - 五个一级视图的气质尚未统一到设计要求的 “Vercel / Linear-like 编辑型工作台”
- 设计文档第 18 节已经冻结视觉目标、设计语言、布局策略、tokens、`兴趣方向` 改版、微型可视化、响应式要求、实施优先级与验收标准，因此本计划不再自行新增设计决策。

## 本次增量范围

本计划只覆盖 `docs/specs/design-docs/trend-radar-visual-console-design.md` 中以下新增章节：

- `18.1 视觉目标`
- `18.2 整体设计语言`
- `18.3 页面骨架与密度策略：Bento 布局与空间收敛`
- `18.4 极致渲染与视觉层级系统`
- `18.5 设计令牌建议`
- `18.6 Interest Profile 模块专项改版`
- `18.7 微型可视化（Micro-Visualization）注入`
- `18.8 五个一级视图的美化一致性`
- `18.9 响应式与可访问性要求`
- `18.10 实施优先级`
- `18.11 验收标准`
- `18.12 浏览器交互与性能修复补充（2026-05-04 Addendum B）`

以下内容明确不在本计划内：

- 不重新定义 `Overview / Projects / Weekly / Run Health / Knowledge Base` 的信息结构
- 不调整状态模型、artifact 映射、weekly 语义、钻取契约
- 不新增新的配置能力，`兴趣方向` 仅改承载形式与编辑体验
- 不为性能优化引入新的业务缓存语义、趋势重算口径或前端自由推导的结论

## 当前进度

- 设计补充编写：`Done`
- 设计补充评审：`Pending`
- Visual refresh ExecPlan 编写：`Done`
- 代码实施：`Pending`
- 浏览器视觉验证：`Pending`

## 实施阶段

### Phase V0：视觉边界冻结与基线盘点

对应设计章节：

- `18.1 视觉目标`
- `18.8 五个一级视图的美化一致性`
- `18.10 实施优先级`

1. 先把本轮交付定义锁定为“视觉承载改版”，不是信息结构重写，也不是新功能迭代。
2. 为当前浏览器版建立基线清单，逐项映射设计中已冻结的缺口：
   - 主题系统
   - 顶层骨架
   - `兴趣方向`
   - 五个一级视图的一致性
   - 微型可视化
   - 响应式与可访问性
3. 把所有待改造项都回链到设计章节，不允许出现“顺手优化”“顺手统一一下”这类没有设计来源的泛化任务。
4. 固定本轮只允许在现有浏览器承载层与测试层落地，不越界到 artifact 组装层。

### Phase V1：双主题 tokens、排版和空间体系

对应设计章节：

- `18.2 整体设计语言`
- `18.4 极致渲染与视觉层级系统`
- `18.5 设计令牌建议`
- `18.10 实施优先级`

1. 先收敛并替换当前单一暖棕色主题，建立设计要求的 Light / Dark 双主题基础。
2. 新增或收敛以下 tokens，并确保命名和职责与设计一致：
   - `--page-max-width`
   - `--content-max-width`
   - `--surface-1`
   - `--surface-2`
   - `--surface-glass`
   - `--border-subtle`
   - `--shadow-soft`
   - `--shadow-focus`
   - `--radius-shell`
   - `--radius-card`
   - `--space-1` ~ `--space-8`
   - `--text-strong`
   - `--text-muted`
   - `--accent-amber`
   - `--accent-sage`
   - `--font-sans`
   - `--font-mono`
3. 页面最大宽度、正文阅读宽度、详情侧栏宽度必须按设计收敛，避免继续使用过宽全屏拉伸。
4. 所有数字和状态指标必须切换到等宽数字，保证列表、表格和状态芯片的纵向对齐。
5. 颜色、阴影、边框和模糊必须按“柔和深度”体系统一，禁止回退到高对比硬描边或廉价玻璃拟态。

### Phase V2：顶层骨架、Bento 布局与层级重组

对应设计章节：

- `18.3 页面骨架与密度策略：Bento 布局与空间收敛`
- `18.4 极致渲染与视觉层级系统`
- `18.8 五个一级视图的美化一致性`
- `18.10 实施优先级`

1. 把当前顶栏改造成设计要求的 `Dynamic Floating Header`：
   - 桌面端脱离页面硬贴边
   - 毛玻璃浮动胶囊外观
   - 保持产品名、环境属性、一级导航、语言切换
2. 把上下文区收敛成 `Immersive Context Strip`：
   - 高度显著压缩
   - 采用 inline-flex 元信息带
   - 优先使用图标与 badge，而不是冗长段落
3. 把首屏主内容区改造成 `Bento Insight Grid`：
   - `Overview` 首屏的主洞察模块采用非对称网格
   - 最关键的可信度卡片采用跨格布局
   - 次级模块缩为辅助卡片，打破均质化卡片墙
4. 把列表、趋势列表、KB 阅读区收敛到 `Seamless Secondary Content` 风格：
   - 弱化笨重外层包裹
   - 用细分割线、隐形边界和 hover 响应表达层次
5. 固化 `Atmosphere / Shell / Content / Focus` 四层视觉层级，确保只有详情侧栏、focus 和 hover 获得明显抬升。
6. 桌面端 Header 不再长期 `sticky` 跟随正文滚动；若保留壳层悬浮效果，也只能是低干扰、不会持续遮挡正文的实现。

### Phase V2.5：滚动契约与详情承载修复

对应设计章节：

- `17.2 详情承载区契约`
- `18.3.2 黄金比例阅读宽度控制`
- `18.9 响应式与可访问性要求`
- `18.12.1 问题 1：可视控制台头部跟随页面下滑，持续遮挡阅读视线`
- `18.12.2 问题 2：详情承载区不能独立滚动，滚轮被主页面接管`

1. 桌面端一级 Header 必须从“持续跟随正文滚动的常驻层”收敛为“默认不遮挡正文的静态或低干扰壳层”。
2. `Projects`、`Weekly`、`Knowledge Base` 的 `Detail Surface` 必须冻结为独立滚动容器：
   - 详情列自身受视口高度约束
   - 详情列内部启用 `overflow-y: auto`
   - 主列与详情列形成并列滚动上下文
3. 详情区内部允许局部 sticky 的详情头部，但不得再让整个详情列相对整页 sticky 造成滚动接管混乱。
4. 小屏下详情全屏态仍必须保留关闭与返回路径，同时保证详情正文自身能顺畅滚动。
5. 所有滚动改造不得破坏既有 URL 驱动钻取、返回行为和 `data-preserve-scroll` 上下文恢复协议。

### Phase V3：`兴趣方向` 模块改造为 `Preference Card`

对应设计章节：

- `18.6 Interest Profile 模块专项改版`
- `18.9 响应式与可访问性要求`
- `18.10 实施优先级`

1. 把 `兴趣方向` 从大表单块改造成三段式 `Preference Card`：
   - `Card Header`
   - `Current Interests Preview`
   - `Compact Edit Area`
2. 默认态优先显示摘要和已保存兴趣，不默认展开完整编辑区。
3. 已保存兴趣必须使用 badge/chip 预览，超过两行时折叠，并提供“展开更多”。
4. 编辑态改为内联编辑，不再出现横向铺满的大 textarea 视觉主角。
5. 键盘交互必须显式支持：
   - `Cmd/Ctrl + Enter` 保存
   - `ESC` 取消
6. 保存成功反馈必须使用内联淡出 notice / toast，不额外撑高整体布局。
7. 清空兴趣时必须显式提示“将关闭个性化兴趣加权”，并用柔和收起动画表达状态变化。
8. 桌面端卡片宽度与布局位置必须遵守设计给出的 `360px - 480px` 侧向卡规格或作为 Overview Hero 右侧辅助卡，而不是重新放回通栏。

### Phase V4：五个一级视图统一美化、文案清晰化与 KB Reader 升级

对应设计章节：

- `18.7 微型可视化（Micro-Visualization）注入`
- `18.8 五个一级视图的美化一致性`
- `18.9 响应式与可访问性要求`
- `18.10 实施优先级`
- `18.12.3 问题 3：项目列表与来源健康摘要中出现大量 ? 分隔符，造成歧义`
- `18.12.5 问题 5：知识库详情承载区像玩具，阅读价值不足`

1. 按设计分别收敛五个一级视图的视觉气质：
   - `Overview` 更像“今日判断首页”
   - `Projects` 更像“研究列表 + 右侧详情”的分析工作台
   - `Weekly` 更像“周报编辑页”
   - `Run Health` 更像“系统体检页”
   - `Knowledge Base` 更像“阅读器”
2. 在不重算业务语义的前提下，为合适位置注入设计指定的微型可视化：
   - `Inline Sparklines`
   - `Radar Rating Hexagon`
   - `Sentiment/Freshness Heat Bar`
3. 微型可视化只作为趋势体感补充，不引入复杂 tooltip、交互噪声或新增判断。
4. 详情侧栏必须继续保持“编辑侧栏”感，而不是变成另一整页大卡片。
5. 响应式规则必须逐条落地：
   - 小屏下 Header / Context Strip / Status Banner 可折叠重排
   - 详情面板全屏态时关闭与返回路径始终可见
   - 长中文与英文 repo 名混排时不挤爆按钮与 chip
6. Focus 态必须统一落地到输入框、按钮、chip 和链接，确保 `:focus-visible` 明确可见。
7. 加载态应逐步改为 Skeleton Screen，避免继续依赖白屏或全屏 Spinner。
8. 所有展示层元信息必须清除人工 `?` 分隔符：
   - `Projects` 列表中的 `confidence / paradigm / persistence`
   - `Source Health Summary` 中的 `enabled / count`
   - KB 元信息中的标签对
9. `Knowledge Base` 详情必须从“字段堆叠”升级为“可读 reader”：
   - 首屏先给出摘要与价值判断
   - 机器区按主题压缩为可读段落或要点
   - 人工区保持正文阅读器风格
   - Linked Context 不再只剩更新时间和范式标签

### Phase V4.5：微型可视化字段边界冻结

对应设计章节：

- `18.7 微型可视化（Micro-Visualization）注入`
- `18.8 五个一级视图的美化一致性`

1. 在开始实现任何微型图形前，先把三类图形允许读取的字段、来源文件、缺失降级和禁行行为写死到实现切片与测试中。
2. `Inline Sparklines` 第一版只允许绘制“artifact 已显式给出的离散历史点”，不允许前端从任意历史文件扫描后自行拼趋势。
3. `Radar Rating Hexagon` 第一版只允许消费当前项目已有的结构化多维评分，不允许从 KB 正文、标签或自由文本提取维度。
4. `Sentiment / Freshness Heat Bar` 第一版只允许消费当前 artifact 已声明的新鲜度状态，不允许从文件时间、抓取时间或 generated_at 反推新鲜度等级。
5. 若任一图形所需字段不存在，默认降级为“不展示该图形，继续展示已有文本信息”，而不是前端发明替代口径。

### Phase V4.8：切换性能与读盘收敛

对应设计章节：

- `18.12.4 问题 4：模块切换延迟明显变长，尤其切到 Projects 时卡顿`

1. 先把当前浏览器版切换成本拆为两类并分别治理：
   - 一级视图切换的整页重建成本
   - `Projects` 页面 sparkline 逐项目逐日期同步读盘成本
2. 视觉增强不得再建立在“每次点击都整页重建 + 同步重复读盘”的前提上；实现必须优先复用同一请求内已读取的数据。
3. `Projects` 页的 sparkline 数据必须改为批量加载、按请求 memoization 或 artifact 预计算三选一，禁止维持当前逐项目逐日期同步扫盘模型。
4. 详情切换必须优先局部更新 `Detail Surface` 对应内容，不允许为了切换右栏而重建与重算整个壳层。
5. 性能优化不得修改 artifact-first 边界，不得把“提速”变成新的前端业务缓存语义或结论推导层。
6. 执行期必须给出可运行的性能验证方法，证明：
   - 一级视图切换主内容可见更新时间收敛
   - `Projects` 页不再是最明显的切换瓶颈

## 微型可视化字段契约

### `Inline Sparklines`

- 允许来源文件：
  - 当前已选项目 `project.project.appearance_dates` 所列日期对应的 `data/scores/YYYY-MM-DD.json`
  - 当前视图已绑定的 `data/reports/YYYY-MM-DD.daily.json` 中同一项目身份字段，仅用于确定项目 identity，不用于补历史点
- 允许读取字段：
  - `appearance_dates`
  - 对应历史 score artifact 中同 repo 项的 `score.total_score`
  - 可选使用同日 `project.star_delta_daily` 或 `project.star_delta_weekly` 作为文案补充，但不得作为补点规则
- 绘制规则：
  - 只绘制 `appearance_dates` 已显式列出的日期点
  - 最多读取最近 `7` 个日期点
  - 不插值、不平滑、不补齐缺失日期
- 缺失降级：
  - 任一日期文件不存在
  - 对应日期的 score artifact 中不存在该项目
  - 历史点少于 `2` 个
  - 以上任一情况成立时，直接不显示 sparkline，仅保留现有文本字段
- 明确禁止：
  - 扫描未被 `appearance_dates` 引用的跨日 artifact 自行补历史
  - 根据 `stars`、`forks` 或 `generated_at` 推导新点
  - 生成“上升/下降/震荡”以外的新增业务标签
  - 引入复杂 tooltip 或二级解释层

### `Radar Rating Hexagon`

- 允许来源文件：
  - 当前项目所在 `data/reports/YYYY-MM-DD.daily.json`
  - 若 daily 中未携带组件明细，可回读同日 `data/scores/YYYY-MM-DD.json` 的同项目条目
- 允许读取字段：
  - `score.components[].name`
  - `score.components[].score`
  - `score.total_score` 仅可用于中心文案，不得作为新增维度
- 绘制规则：
  - 仅使用 artifact 中已存在的组件名作为轴名
  - 最多展示 `6` 个组件轴
  - 若组件超过 `6` 个，只允许按 artifact 中原始顺序截取前 `6` 个，不得按前端规则二次排序
- 缺失降级：
  - 可用组件少于 `3` 个
  - 组件缺少 `name` 或 `score`
  - 以上任一情况成立时，不渲染 hexagon，仅保留文本版 score / evidence 展示
- 明确禁止：
  - 从 KB `Machine Section` / `Human Section` 文本提炼维度
  - 从 `paradigm`、`tags`、`matched_interest_topics` 推导新轴
  - 新增“能力成熟度”“生态完整度”等 artifact 中不存在的维度命名

### `Sentiment / Freshness Heat Bar`

- 允许来源文件：
  - 当前 daily 上下文的 `data/reports/YYYY-MM-DD.daily.json`
- 允许读取字段：
  - `freshness_sources[].source`
  - `freshness_sources[].effective_date`
  - `freshness_sources[].freshness_state`
  - `freshness_sources[].from_realtime_run`
  - `freshness_sources[].source_role`
- 绘制规则：
  - 每个 heat block 只对应一个已存在的 `freshness_sources[]` 条目
  - block 顺序固定跟随 artifact 原始顺序
  - 颜色只表达已有 `freshness_state`，且必须搭配文字标签
- 缺失降级：
  - `freshness_sources` 缺失或为空时，不显示 heat bar，只保留既有 freshness 文案
- 明确禁止：
  - 通过文件修改时间、抓取时间、`generated_at` 或当前系统时间反推 freshness
  - 把 `run-summary` 的 source status 映射成新的 freshness 等级
  - 新增 tooltip 解释层，把 heat bar 变成新的判断入口

### Phase V5：视觉验收、回归与收口

对应设计章节：

- `18.11 验收标准`
- `15. 测试设计`

1. 把验证明确拆成两层：
   - `test:visual-console:web` 继续只负责语义守护、路由、URL、上下文、状态和文案承接
   - 新增真实浏览器视觉验证脚本负责断点、computed style、主题切换、focus-visible、尺寸和截图回归
2. 用真实浏览器断点测试证明 `1440px+` 桌面宽度、小屏重排和详情全屏态行为都满足设计要求。
3. 用结构守护证明视觉改版没有触碰 artifact 解释层、状态模型或 URL / query 恢复协议。
4. 把 Dark mode 纯黑白回退、`兴趣方向` 默认展开大表单、小屏无返回路径、状态只靠颜色等情况写成显式负例。
5. 若任一视觉改造需要新业务字段或新交互语义，停止实施并回到设计评审，而不是在实现期自行发明。

## 验收标准

### 验收 1：双主题与设计令牌体系冻结

- 可观测结果：页面支持 Light / Dark 模式，字体、颜色、圆角、阴影、间距、阅读宽度都由统一 tokens 驱动。
- 成功条件：不再依赖单一暖棕色主题；核心宽度、字体栈、等宽数字、柔和边界和玻璃表面全部按设计落地。
- 失败条件：页面仍主要依赖旧版配色和零散样式覆写，或暗色模式退化为纯黑白高对比。

### 验收 2：首屏骨架改造成悬浮工作台

- 可观测结果：桌面端存在 `Dynamic Floating Header`、紧凑 `Context Strip` 与非对称 `Bento Insight Grid`。
- 成功条件：首屏不再是顺序堆叠的大矩形卡片；可信度主卡片具有明确主次层级。
- 失败条件：Header、Context Bar、状态区和主内容仍维持旧版通栏卡片堆叠感，或桌面端 Header 长时间跟随正文滚动并遮挡阅读。

### 验收 3：`兴趣方向` 不再是首屏最大表单块

- 可观测结果：`兴趣方向` 默认态是短卡配置，优先展示摘要、状态和已保存兴趣。
- 成功条件：桌面端不再出现横向铺满的大表单；编辑态为内联交互；保存/取消支持键盘快捷键。
- 失败条件：模块仍长期展开、继续压缩可信度主信息或以表单块占据主要视觉面积。

### 验收 4：五个一级视图视觉语言统一

- 可观测结果：`Overview / Projects / Weekly / Run Health / Knowledge Base` 在导航、上下文、卡片、详情栏上呈现统一的前沿工作台风格。
- 成功条件：各视图保留自身角色差异，但共享同一套表面材质、排版层级、详情侧栏和状态表达。
- 失败条件：只有 Overview 改版，其余页面仍保留旧版后台感。

### 验收 5：微型可视化存在但不过度

- 可观测结果：项目或知识区域出现 sparklines、hexagon 或 heat bar 等轻量趋势补充。
- 成功条件：图形只强化趋势体感，不引入新判断、复杂 tooltip 或喧宾夺主的彩色图表。
- 失败条件：完全缺失微型可视化，或为了美观引入大面积高饱和图表和新解释层。

### 验收 5.5：详情承载区滚动正确且可读

- 可观测结果：`Projects`、`Weekly`、`Knowledge Base` 的详情区超出一屏时可独立滚动。
- 成功条件：鼠标位于详情区时，滚轮优先驱动详情区；主页面列表位置在详情阅读期间保持稳定。
- 失败条件：用户在详情区滚动时主页面被带走，或详情正文无法顺畅阅读。

### 验收 5.6：元信息文案清晰且无人工问号分隔

- 可观测结果：项目列表、来源健康摘要、KB 元信息均以 badge、key-value 或中性分隔符展示。
- 成功条件：展示层不再出现人为拼接的 `?` 分隔符，空值改用冻结词汇而不是问号占位。
- 失败条件：用户仍能在 UI 中看到 `置信度 ? 高 ? 范式 ? ...` 之类的歧义表达。

### 验收 5.7：KB 详情承载区具备阅读价值

- 可观测结果：KB 详情首屏先出现摘要、价值判断与上下文关系，再进入机器区/人工区正文。
- 成功条件：KB 详情更像阅读器而不是字段堆砌，机器区与人工区都具备实际阅读价值。
- 失败条件：KB 详情仍然只是 `Card Reader / Machine Section / Human Section / Linked Context` 的机械顺排。

### 验收 6：响应式与可访问性达标

- 可观测结果：小屏下顶层壳层可重排，详情面板全屏态的返回路径始终可见，所有交互元素均有可见 focus。
- 成功条件：状态颜色均带文字标签；中文与英文混排稳定；按钮、chip、链接不因长 repo 名破版。
- 失败条件：小屏布局断裂、键盘焦点不可见、状态仅靠颜色传达或详情面板缺乏可返回路径。

### 验收 7：美化不影响可判断性

- 可观测结果：`Run Trust Summary`、`Source Health Summary`、状态 Banner 和关键判断内容仍在信息层级最前。
- 成功条件：用户进入首页后仍优先获得“结果能不能信”的答案。
- 失败条件：视觉改版导致状态与可信度退到次级区域，或被装饰性模块遮蔽。

### 验收 8：切换与详情更新体感收敛

- 可观测结果：一级视图切换和详情切换不再表现为明显卡顿或整页停顿后跳变。
- 成功条件：`Projects` 页切换体感明显优于现状，且主内容更新与详情更新都能在可接受时延内完成。
- 失败条件：`Projects` 仍是最明显的切换性能瓶颈，或详情切换仍需要重建整页。

## 当前残余风险

- 视觉改版最容易失控的地方，是在“统一风格”的名义下顺手改动了信息结构或状态优先级。
- `兴趣方向` 的交互收敛如果只改样式、不改布局和默认态，很容易继续保留大表单问题。
- 微型可视化如果没有字段边界守护，最容易滑向 UI 侧趋势重算。
- 双主题若只做变量替换、不处理阴影、边界光泽和文本对比，会出现暗色模式糊边或阅读性下降。
- 如果继续沿用当前仅基于 HTML 字符串的 Web 测试，执行完成后也无法证明第 18 节的大部分视觉要求已经达成。
- 若不显式修复 Header sticky 与详情滚动契约，视觉升级后的阅读遮挡和错误滚动会继续成为桌面端主体验缺陷。
- 若不把 `Projects` 页 sparkline 读盘成本显式纳入计划，后续实现容易继续在“视觉已升级、切换更卡”状态下交付。

## 设计测试映射

- `18.1` 对应首页信息优先级、可信工作台感测试。
- `18.2 / 18.5` 对应 tokens、主题切换、字体栈、等宽数字和表面材质测试。
- `18.3 / 18.4` 对应 Header / Context Strip / Bento Grid / 详情侧栏层级测试。
- `18.6` 对应 `兴趣方向` 默认态、折叠预览、内联编辑、快捷键和成功反馈测试。
- `18.7` 对应微型可视化存在性、字段 allow-list、缺失降级与禁行行为测试。
- `18.8` 对应五个一级视图的一致性快照与布局测试。
- `18.9` 对应响应式、focus-visible、状态文本标签和中英混排稳定性测试。
- `18.11` 对应桌面宽屏、暗色模式、首页首屏和五视图统一风格验收。
- `18.12.1 / 18.12.2` 对应桌面端 Header 遮挡回归、详情区独立滚动与小屏详情正文滚动测试。
- `18.12.3` 对应 `Projects` / `Source Health Summary` / KB 元信息问号分隔清理测试。
- `18.12.4` 对应一级视图切换、详情更新与 `Projects` 页读盘性能验证。
- `18.12.5` 对应 KB 详情 reader 层级、摘要优先级与阅读宽度测试。

## 关键负例

- Dark mode 若退化为纯黑 `#000` / 纯白 `#FFF` 高对比页，判定失败。
- `兴趣方向` 默认态若仍是横向铺满的大表单或首屏最大模块之一，判定失败。
- 小屏详情面板进入全屏态后，若关闭与返回路径不持续可见，判定失败。
- 任一状态若只靠颜色而缺少文字标签，判定失败。
- 微型可视化若在缺字段时改用前端推算或自由文本推断，判定失败。
- `Overview` 首屏若被装饰性卡片、图形或设置区压过 `Run Trust Summary`，判定失败。
- 桌面端 Header 若继续随正文滚动长期遮挡视线，判定失败。
- 详情区若视觉上是侧栏、交互上却无法独立滚动，判定失败。
- `Projects` 列表、来源健康摘要或 KB 元信息若继续出现人为 `?` 分隔，判定失败。
- `Projects` 切换若仍因 sparkline 重复同步读盘导致明显卡顿，判定失败。
- KB 详情若仍停留在字段堆叠、首屏无摘要无价值判断，判定失败。

## 验证矩阵

| 类型 | 验证内容 | 命令 / 方法 | 通过标准 |
| --- | --- | --- | --- |
| 计划 | ExecPlan 预检 | `npm run exec-plan:preflight` | 新计划与索引通过预检 |
| 静态 | 类型检查 | `npm run typecheck` | 视觉改版未引入类型错误 |
| 质量 | 样式与仓库质量门禁 | `npm run lint` | 视觉改版不绕过现有质量门禁 |
| 结构 | 语义边界未漂移 | `npm run test:visual-console:web` | 既有 URL、状态、详情承载和钻取测试继续通过 |
| 结构 | 微型可视化字段边界守护 | `npm run test:visual-console:web` | 三类图形只读取 allow-list 字段；缺字段时按计划降级 |
| 浏览器-真实 | Light / Dark 主题切换 | 新增 `npm run test:visual-console:web:visual -- theme` | 真实浏览器下 theme 切换生效，CSS token、背景和文本对比不回退到纯黑白 |
| 浏览器-真实 | Header / Context Strip / Status Banner 骨架 | 新增 `npm run test:visual-console:web:visual -- shell` | 浮动 Header、紧凑 Context Strip、状态 Banner 层级满足设计，且不压过主结论卡片 |
| 浏览器-真实 | Overview Bento 布局 | 新增 `npm run test:visual-console:web:visual -- overview-layout` | `Run Trust Summary` 主卡 span、主次模块宽度和容器最大宽度满足设计 |
| 浏览器-真实 | `兴趣方向` 默认态与编辑态 | 新增 `npm run test:visual-console:web:visual -- preferences` | 默认态高度显著收敛；编辑态为内联卡；支持快捷键和非阻断式反馈 |
| 浏览器-真实 | 五个一级视图一致性 | 新增 `npm run test:visual-console:web:visual -- routes` | 五个视图共享设计语言，同时保持各自的视觉角色差异 |
| 浏览器-真实 | 微型可视化存在性 | 新增 `npm run test:visual-console:web:visual -- micro-viz` | sparklines / hexagon / heat bar 在指定区域可见，且无新增 tooltip 判断 |
| 浏览器-真实 | Header 遮挡与详情独立滚动 | 新增 `npm run test:visual-console:web:visual -- scroll-behavior` | 桌面端 Header 不长期遮挡正文；详情区可独立滚动；小屏详情正文可滚动 |
| 浏览器-真实 | 元信息文案清晰度 | 新增 `npm run test:visual-console:web:visual -- copy-clarity` | `Projects`、来源健康摘要、KB 元信息中不再出现人工 `?` 分隔 |
| 浏览器-真实 | KB Reader 承载 | 新增 `npm run test:visual-console:web:visual -- kb-reader` | KB 首屏先展示摘要和价值判断，机器区/人工区具备阅读层级 |
| 浏览器-真实 | 响应式布局 | 新增 `npm run test:visual-console:web:visual -- responsive` | `1440px+`、平板、小屏断点下布局、阅读宽度和详情全屏态均正确 |
| 浏览器-真实 | 可访问性 | 新增 `npm run test:visual-console:web:visual -- accessibility` | 所有交互元素具备 `focus-visible`；状态颜色均伴随文案标签 |
| 浏览器-真实 | 截图回归 | 新增 `npm run test:visual-console:web:visual -- screenshots` | 关键页面在 Light / Dark、桌面 / 小屏下截图基线无非预期漂移 |
| 性能 | 一级视图切换与详情更新时延 | 新增 `npm run test:visual-console:web:visual -- performance` | 可证明 `Projects` 视图切换与详情更新较当前基线明显收敛，且不再由重复同步读盘主导 |
| 回归 | 宽屏阅读聚焦 | 真实浏览器 `1440px+` 断点 + 截图基线 | 页面仍保持阅读焦点，不因留白和阴影导致内容飘散 |
| 回归 | 语义不变 | 对照现有 artifact 和既有网页测试 | 可判断性、状态语义和钻取协议与改版前一致 |
| 负例 | Dark mode 纯黑白回退 | 新增真实浏览器断言 | 出现纯黑白回退即失败 |
| 负例 | `兴趣方向` 仍默认展开大表单 | 新增真实浏览器断言 | 默认态高度、宽度或首屏占比超过计划约束即失败 |
| 负例 | 小屏无返回路径 | 新增真实浏览器断言 | 详情全屏态下关闭 / 返回不可见即失败 |
| 负例 | 状态只靠颜色 | 新增 DOM + 浏览器断言 | 缺少状态文案标签即失败 |
| 负例 | Header 遮挡正文 | 新增真实浏览器断言 | 连续下滑后 Header 持续覆盖正文阅读区即失败 |
| 负例 | 详情区滚动被主页面接管 | 新增真实浏览器断言 | 鼠标位于详情区时主页面发生滚动即失败 |
| 负例 | 人工 `?` 分隔符回归 | 结构断言 + 真实浏览器断言 | 出现 `?` 作为字段分隔符即失败 |
| 负例 | `Projects` 切换性能回退 | 真实浏览器性能断言 | 切换仍由同步重复读盘主导、体感无改善即失败 |

## 验证记录

| 时间 | 事实 | 结果 | 说明 |
| --- | --- | --- | --- |
| 2026-05-04 | 设计文档第 18 节增量范围复核 | 已完成 | 已确认本次新增范围只覆盖前端视觉改版补充设计，不涉及业务语义重写 |
| 2026-05-04 | 既有浏览器版实现现状盘点 | 已完成 | 已确认当前浏览器版能力完整，但视觉语言、首屏密度和 `兴趣方向` 承载与新增设计不一致 |
| 2026-05-04 | 既有 exec-plan 结构与 follow-up 方式复核 | 已完成 | 已确认本次应以独立 visual refresh exec-plan 推进，而不是覆写已完成的主计划 |
| 2026-05-04 | 设计文档 `18.12` 对 ExecPlan 覆盖面复核 | 已完成 | 已确认现有 visual refresh plan 只覆盖到 `18.11`，需把滚动契约、文案清晰度、切换性能与 KB reader 升级补入 phase、验收和验证矩阵 |
| 2026-05-04 | 视觉改版代码与浏览器验收复核 | 部分完成 | 已完成 `18.12` 对应的滚动契约、文案清晰度、KB reader 承载与切换性能实现；`typecheck`、`test:visual-console:web`、`test:visual-console:web:visual` 与 `exec-plan:preflight` 通过，但 `lint` 仍被仓库既有质量门禁债务阻塞 |

## ExecPlan Progress Update

- Task: Phase V0：视觉边界冻结与基线盘点
- Status: DONE
- Files Changed: `docs/specs/exec-plans/trend-radar-visual-console-visual-refresh-v0.1.exec-plan.md`
- Verification: `npm run exec-plan:preflight`
- Result: 已把视觉改版边界锁定为浏览器承载层与测试层，不越界到 artifact 语义层。

- Task: Phase V1 - V5：视觉实现与验证
- Status: BLOCKED
- Files Changed: `app/server.ts`, `app/styles.css`, `src/__tests__/visualConsoleWeb.test.ts`, `src/__tests__/visualConsoleWeb.visual.test.ts`, `package.json`, `docs/specs/exec-plans/trend-radar-visual-console-visual-refresh-v0.1.exec-plan.md`
- Verification: `npm run exec-plan:preflight`、`npm run typecheck`、`npm run test:visual-console:web`、`npm run test:visual-console:web:visual` 通过；`npm run lint` 失败
- Result: 已按执行计划补齐桌面 Header 非 sticky、详情独立滚动、`Projects` / `Source Health Summary` / KB 元信息去 `?` 分隔、KB summary-first reader 结构、sparkline 请求内 memoization，以及 `scroll-behavior` / `copy-clarity` / `kb-reader` / `performance` 独立浏览器验证；当前唯一阻塞为仓库级 `quality:gate` 仍报告 `src/action/*`、`src/signal/*`、`src/visualConsole/build.ts` 等本计划禁改范围外的既有复杂度与长度债务。
## 回滚策略

- 若双主题与 tokens 改造引起全局视觉回归，允许先回退到“保留新宽度/间距体系，但暂时只启用单一稳定主题”，前提是不破坏设计要求的阅读宽度和层级重组。
- 若 Bento 首屏布局导致信息优先级受损，必须优先回退布局跨度与模块占比，不允许回退到旧版通栏大卡片。
- 若 `兴趣方向` 新交互影响保存稳定性，允许先回退到更保守的内联编辑态，但不得回退到横向铺满的大表单块。
- 若微型可视化字段来源不稳定，允许暂缓对应图形展示，但不得用前端重算替代。

## 结论记录

- 2026-05-04：本计划只执行设计文档第 18 节已冻结的视觉改版，不补做新的产品设计。
- 2026-05-04：五个一级视图必须一起收敛到统一设计语言，不能只修 Overview 或只修 `兴趣方向`。
- 2026-05-04：视觉改版的第一优先级仍然是“可判断性”，不是表面装饰。

## 下一阶段入口

- 先执行 `npm run exec-plan:preflight`，确认计划文件和索引通过预检。
- 通过预检后，再进入视觉实现；实现顺序必须严格遵守 `18.10`：
  1. design tokens / 双主题 / 字体栈 / 宽度体系
  2. Header / Context Strip / Status Banner / Bento 骨架
  3. Header 遮挡修复与详情独立滚动契约
  4. `兴趣方向` `Preference Card`
  5. 五个一级视图细化、文案清晰化与 KB reader 升级
  6. 微型可视化字段边界冻结
  7. 切换性能与读盘收敛
  8. 真实浏览器视觉验证与性能验证
