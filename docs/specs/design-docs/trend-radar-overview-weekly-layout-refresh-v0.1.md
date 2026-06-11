# 设计补充：Overview / Weekly 布局刷新

## 文档状态

- 版本：`v0.3`
- 状态：`Proposed for Review`
- 归属：`UI V2.5 page-level addendum`
- 上位文档：
  - [trend-radar-ui-v2-visual-redesign-design.md](trend-radar-ui-v2-visual-redesign-design.md#L1)
  - [trend-radar-ui-v2-visual-redesign-requirements.md](../product-specs/trend-radar-ui-v2-visual-redesign-requirements.md#L1)

## 目标

这个补充文档只解决一个问题：把当前 `Overview` 和 `Weekly` 从“卡片堆叠页”提升成“有明确阅读顺序、主从明确、表面预算受控的工作台”。

冻结后的目标很具体：

1. `Overview` 必须先回答“今天这轮结果能不能信”，再回答“先看什么”，最后给出“接下来怎么继续研究”。
2. `Weekly` 必须先建立“本周主判断”的编辑台语气，再让证据矩阵与核心趋势卡形成连续主叙事，而不是把最重要的信息拆成半屏。
3. 两个页面都必须显式限制首屏表面数量，避免重新退化为大中小卡混排的拼盘。
4. 这两个页面都必须保留 `artifact-first`、显式 URL、状态模型与钻取契约，不允许为了视觉改造新增前端推断层。

## 问题归纳

### Overview 当前问题

1. 首屏虽然有 trust hero，但“今日主判断”“周视图入口”“风险动作”散落在下方，阅读路径被打断。
2. `Weekly Entry`、`Risks Rail`、`Source Ribbon` 一度退化为隐藏模块，导致总览失去“继续行动”的工作台感。
3. 下半区缺少一个稳定的“研究续航区”，用户从首屏判断过渡到项目流时没有明确的版式节奏。
4. 更根本的问题是：当前设计仍把 `What To Watch First`、`Weekly Entry`、`Risks Rail`、`Source Ribbon`、`Preference` 视为多个平级模块位，导致实现天然会退化为“很多白卡拼一屏”。
5. `Overview` 当前缺少“面”级编排，只有“卡”级编排；这会让重要信息变得零碎，也会让页面看起来廉价。
6. 首屏混用了大卡、中卡、提示卡和配置卡，用户需要先识别容器，再识别信息，体感上会显得拥挤、杂乱、没有主视觉。

### Weekly 当前问题

1. “周封面”“主判断”“证据矩阵”都是重要模块，但此前彼此并列过于均质，没有形成主从关系。
2. 六轴矩阵缺少足够明确的轴位映射提示，雷达与证据卡的对应关系不够一眼可读。
3. `Weak Signals` 和 `Watchpoints` 混在同一层级里，容易把“本周形成了什么”和“下周继续跟什么”混成一团。
4. 更严重的问题是：`Core Trend` 与 `Weak Signals` 曾被允许处于同一横向故事带，导致核心趋势卡只能拿到半屏宽度，主趋势叙事被次级信息挤压。
5. 当前 `Weekly` 仍然可能出现“大卡讲主趋势、小卡讲弱信号、微卡讲证据”的多尺度拼贴，这种布局不利于用户形成稳定阅读节奏。

## 布局冻结

## 1. Overview

### 1.1 页面骨架

`Overview` 改为三段式，但这里的“三段”指的是三个阅读区，不是三组平级卡片：

1. `Judgment Canvas`
   - 必须是首屏主舞台。
   - 左侧是 `Run Trust Summary`。
   - 右侧是唯一的 `What To Watch First / Featured Decision`。
   - 这两部分必须处于一个连续 Hero 语境里，不允许再漂成两三张互不相干的卡。
2. `Continuation Rail`
   - 位于 Hero 右侧或其后续区域。
   - 只承载：
     - `Weekly Entry`
     - `Risks And Next Actions`
   - 该区的职责是“继续往哪里走”，不是再开一个新的信息主战场。
3. `Research Stream`
   - 上方是压缩态 `Source Ribbon`
   - 下方是 `Decision Stream`
   - 这里才是完整项目流与研究续航区。

`Preference / Interests` 从 `Overview` 页面骨架中移除，不再作为 P0 内容区模块存在。

### 1.2 模块职责

- `Run Trust Summary`
  - 只负责信任判断、freshness、verify、mode 与跳去 `Run Health`。
  - 不负责承载 `Weekly Entry` 或兴趣偏好。
- `What To Watch First / Featured Decision`
  - 只承载一个 featured decision。
  - 它是“今天先读哪一个项目”，不是完整项目流。
  - 首屏不得同时摆出多张同类 decision 卡。
- `Weekly Entry`
  - 必须恢复为正式入口，而不是隐藏或降级成附属按钮。
  - 但它必须收敛在 `Continuation Rail` 中，不再以独立大卡抢夺首屏主位。
  - 文案语气必须强调“把今日判断接到本周脉络”。
- `Risks And Next Actions`
  - 只保留 2-3 条高信号风险动作，作为行动提醒侧轨。
  - 这一区块要短、准、可执行，不能长成第二个正文区。
- `Source Ribbon`
  - 只做来源健康补充。
  - 必须是压缩条带、chip 阵列或微卡阵列，而不是几张与主卡等权的大白卡。
- `Decision Stream`
  - 承担“继续研究的项目流”，不与 lead decision 争抢首屏主位。
- `Preference / Interests`
  - 移入全局壳层、设置抽屉或折叠控制区。
  - 不再属于 `Overview` 页面级内容编排。

### 1.3 表面预算

1. 首屏除壳层外，只允许三个阅读区：`Judgment Canvas`、`Continuation Rail`、`Research Stream`。
2. `Judgment Canvas` 内部可以细分 micro-panel，但不得再切成多张彼此独立的大卡。
3. `Continuation Rail` 默认不超过两个次表面，不得继续长出第三张“也很重要”的卡。
4. `Research Stream` 之前不允许再插入新的独立大卡。
5. 一旦页面同时出现大卡、中卡、小卡并排且彼此都试图成为主视觉，就应视为设计失败。

### 1.4 视觉原则

1. 页面优先编排“面”，再编排“卡”；首屏应该先被感知为 2-3 个阅读区，而不是 5-6 张白卡。
2. `Judgment Canvas` 必须具有连续表面感，不能被多个圆角白块切碎。
3. `Continuation Rail` 使用比主舞台更克制的对比度，避免和主判断争抢注意力。
4. `Weekly Entry` 可以使用更强的冷色渐层，但应服务“门户感”，不能做成装饰性大卡。
5. `Source Ribbon` 应像状态仪表条，而不是 mini dashboard。

## 2. Weekly

### 2.1 页面骨架

`Weekly` 冻结为六段式：

1. `Cover Stage`
   - 左侧是 `Weekly Cover`
   - 右侧是 `Overview Rail`
     - `Overall Weekly Judgment`
2. `Matrix Stage`
   - 全宽承载 `Trend Evidence Matrix`
3. `Core Trend Stage`
   - 全宽承载 `Core Trend Storyline`
4. `Weak Signal Strip`
   - 后置承载 `Weak Signals`
5. `Watchpoints Strip`
   - 单独承载 `Next Week Watchpoints`
6. `Detail Surface`
   - 继续沿用已有 weekly -> project detail 钻取，不改变 URL 契约

### 2.2 模块职责

- `Weekly Cover`
  - 只负责建立“本周主叙事”的封面语气。
  - 必须包含当前周窗口的主判断 lead copy 与 judgeable / enhancement / audit / counts 元信息。
- `Overall Weekly Judgment`
  - 作为右侧信息密度更高的判断面板，承接总结与状态整理。
- `Trend Evidence Matrix`
  - 必须成为页面签名模块。
  - 必须位于核心趋势卡之前。
- `Core Trend Stage`
  - 必须是页面主叙事舞台。
  - 每张核心趋势卡都必须占据完整内容宽度。
  - 允许在单卡内部划分 narrative column 与 meta rail，但它们必须属于同一连续表面，而不是两张并列大卡。
  - 若存在多个核心趋势卡，只允许纵向堆叠，或采用“1 张展开 + 若干折叠队列”的同轴结构；不允许多列拼盘。
- `Weak Signal Strip`
  - 只讲尚未稳定但值得观察的方向。
  - 只能出现在 `Core Trend Stage` 之后。
  - 视觉权重必须低于核心趋势区。
- `Watchpoints Strip`
  - 单独承载“下周继续跟什么”，不再与 `Weak Signals` 混在同一面板里。

### 2.3 六轴矩阵映射规则

1. 雷达图必须保留 6 轴，不允许前端擅自增删轴。
2. 雷达上的每一轴都必须有显式编号提示。
3. 六张证据卡必须与雷达轴位使用同一编号顺序。
4. 若某轴无结构化数据，页面必须显式展示 `Insufficient Evidence`，不能补算。
5. `Delta` 仍然只能在上游提供结构化输入时展示；否则继续显式写 `unavailable / insufficient sample`。

### 2.4 版式权重规则

1. 当存在稳定核心趋势时，`Weak Signals` 不得与 `Core Trend Stage` 共享同一横向带宽。
2. 核心趋势卡默认应形成清晰的纵向阅读路径，用户不应在左列读主趋势、右列读弱信号之间来回横跳。
3. `Weak Signal Strip` 可以在桌面端用 `2-3` 列压缩卡承载，但只能作为核心趋势之后的次级区。
4. 如果当周没有稳定核心趋势，则 `Weak Signal Strip` 升级为全宽主内容区，矩阵保留缺证轮廓。

## 3. 响应式规则

1. `Overview`
   - `Judgment Canvas + Continuation Rail` 在桌面端维持双栏。
   - `Research Stream` 在中小屏降级为单栏。
2. `Weekly`
   - `Cover Stage` 在桌面端为封面 + 侧轨双栏。
   - `Core Trend Stage` 在所有断点都保持单列主舞台，不得因为窄屏而把主趋势拆成并列小卡。
   - `Weak Signal Strip` 在窄屏下从压缩多列降级为单列。
   - `Overview Rail` 在单栏布局下取消 sticky。

## 4. 视觉走查与体感自检

### 4.1 Overview

作为用户打开 `Overview` 时，理想体感应该是：

1. 我先看到“这轮结果靠不靠谱”，而不是先看到一堆卡。
2. 我能立刻理解“今天先看哪个项目”，而不是在多个大小不同的模块之间来回比较。
3. 我继续往下时，会自然接到 weekly 入口、风险动作和项目流，而不是被新的大卡不断打断。

如果出现以下现象，应判定为版式不舒服：

1. 首屏有 4 张以上相互独立的大表面同时抢注意力。
2. `Weekly Entry`、`Source Ribbon`、`Preference` 看起来和主判断一样重要。
3. 用户需要先理解容器排列，才能理解信息本身。

### 4.2 Weekly

作为用户打开 `Weekly` 时，理想体感应该是：

1. 我先被带入“本周到底发生了什么”的封面与总判断。
2. 我随后看到证据矩阵，理解这条主趋势的证据骨架。
3. 我再读到一张真正展开、足够宽、足够像正文的核心趋势卡，而不是半张卡。
4. 弱信号应该出现在主趋势之后，像次级观察带，而不是和主趋势平起平坐。

如果出现以下现象，应判定为版式不舒服：

1. `Weak Signals` 与 `Core Trend` 同时占据一条左右双栏主故事带。
2. 核心趋势卡因为右侧弱信号区存在，只剩半屏宽度。
3. 页面在同一可视区内出现过多不同尺寸卡片，导致眼睛不断切换阅读模式。
4. 次级信息的视觉压强超过主趋势正文。

## 5. 验收口径

### 5.1 Overview

实现后必须满足：

1. 桌面端首屏默认只允许三个阅读区：`Judgment Canvas`、`Continuation Rail`、`Research Stream`。
2. 首屏不得出现 5 个以上彼此独立、且权重接近的白卡表面。
3. `Run Trust Summary` 与 featured decision 必须处于同一 Hero 语境，形成明确主从，而不是两个漂浮模块。
4. `Weekly Entry`、`Risks Rail`、`Source Ribbon` 不能再被隐藏，但也不能再被实现成三张并列大卡。
5. `Preference / Interests` 不再出现在 `Overview` 首屏内容区。
6. 用户在不展开详情时，也能顺序读到：可信度、featured decision、weekly 入口、风险动作、项目流。

### 5.2 Weekly

实现后必须满足：

1. `Weekly Cover` 与 `Overall Weekly Judgment` 在首屏形成明确主从。
2. 矩阵模块必须先于核心趋势区出现。
3. 雷达轴位和 6 张证据卡之间存在一眼可读的编号映射。
4. 当存在稳定核心趋势时，首张核心趋势卡必须占据完整内容宽度，`Weak Signals` 不得与其左右等权并排。
5. `Watchpoints` 独立于 `Weak Signals`，不再混在同一面板里。

## 6. 实现触达面

- [app/server.ts](../../../app/server.ts#L1)
- [app/styles.css](../../../app/styles.css#L1)
- [src/__tests__/visualConsoleWeb.test.ts](../../../src/__tests__/visualConsoleWeb.test.ts#L1)
- [src/__tests__/visualConsoleWeb.visual.test.ts](../../../src/__tests__/visualConsoleWeb.visual.test.ts#L1)

## 7. 禁止事项

1. 不允许通过隐藏模块来“简化页面”。
2. 不允许把 `Weekly` 的证据矩阵降回附属图块。
3. 不允许前端基于 prose、supporting projects 或 score JSON 重新推导新的 weekly 结论。
4. 不允许让 `Preference / Interests` 重新回到 `Overview` 页面级内容编排。
5. 不允许把 `Overview` 首屏再次实现成多个平级白卡拼盘。
6. 不允许把 `Source Ribbon` 做成与主判断等权的大卡阵列。
7. 不允许在存在稳定核心趋势时，让 `Weak Signals` 与 `Core Trend Stage` 共用同一横向主舞台。
