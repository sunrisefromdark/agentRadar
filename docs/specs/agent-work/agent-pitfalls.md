# AI Agent 已知坑与恢复手册

## 目标

本文件记录 AI Agent 在 agents-radar-system、相邻 Harness 项目和当前 agent-trend-radar 项目里已经踩过的通用坑。它的目的不是约束创造力，而是避免未来 Agent 在同一类工具链、编码、测试、注册表和 Spec 漂移问题上反复试错。

如果你是 AI Agent，在编辑文件、运行测试、修改评分逻辑、接入 source 或改报告输出前，必须先读取本文件，并把这里的恢复路径当成默认处理策略。

## 不可协商规则

- 优先做最小变更，不要用一次巨型改动覆盖多个系统边界。
- 工具失败不等于仓库坏了，先区分是环境、命令长度、编码、导入副作用、网络还是代码逻辑。
- 非平凡修改后，先跑最小语法检查、目标测试或结构检查，再扩大验证范围。
- 代码、测试、Spec、执行计划状态必须同步；不要让文档继续写着“未覆盖”，而实现已经落地。
- 不要把“测试通过”误认为“实现正确”，尤其是评分、降级、dry-run、source 解析、KB 增量和注册表一致性这类强语义区域。
- 不要让 LLM 直接决定最终分数；LLM 只能做 semantic classification，且 rules-only 模式必须可运行。

## 当前环境坑

### WSL / UNC 工作区

- 症状：工作区通过 UNC 路径访问 WSL，例如 `\\wsl.localhost\Ubuntu-22.04\home\adduser\AgentProjection\agent-trend-radar`。
- 风险：PowerShell、WSL、Node、Git、pnpm 的可见路径和 PATH 可能不一致。
- 恢复：先确认命令运行在哪个环境；Node/Pnpm 命令优先在 WSL 项目路径下执行。
- 预防：最终说明里要区分“命令不存在/环境缺依赖”和“代码测试失败”。

### 当前目录可能不是完整 Git checkout

- 症状：`git status` 报 `fatal: not a git repository`。
- 原因：当前挂载目录可能缺少 `.git` 元数据，或者不是完整 checkout。
- 恢复：不要使用破坏性 git 命令；用文件枚举、关键引用搜索和测试命令替代状态确认。
- 预防：除非 `.git` 明确存在，否则不要承诺已检查 git diff。

### `pnpm` 不可用或 corepack 下载失败

- 症状：PowerShell 或 WSL 报 `pnpm: command not found`，或 corepack 下载 `pnpm@9.15.9` 时连接 `registry.npmjs.org` 超时。
- 原因：包管理器未预装，或网络无法访问 npm registry。
- 恢复：先尝试 `corepack pnpm --version`；若仍失败，在最终说明中明确测试未运行原因，并使用文件枚举、结构搜索、TypeScript 源码审查作为替代验证。
- 预防：不要把 `pnpm` 缺失误报成项目测试失败。

### Agent 环境无法代表真实外网连通性

- 症状：在 Agent 运行环境里执行 `run-daily`、`run-weekly`、`visual-console:web` 或相关 smoke 时，命令卡住、超时，或无法成功访问 MiniMax、GitHub API / HTML、npm registry 等外部服务。
- 原因：当前 Agent 运行环境的外网访问能力受限，不能把它当作用户本机网络环境的真实代表。
- 恢复：把这类验证拆成两层。Agent 只负责本地代码修复、类型检查、纯单测/集成测和无需外网的结构验证；涉及 MiniMax / GitHub / registry 的真实链路验证改由用户在本机执行，并回传命令输出或产物结果。
- 预防：不要因为 Agent 环境访问不了 MiniMax 或 GitHub 就下结论说功能本身有问题；最终说明里必须明确哪些真实联网验证尚需用户本机复验。

## 文件编辑与编码

### 大文件不要一次性巨型写入

- 症状：PowerShell 报长命令或参数长度问题，或一次性 here-string 写入失败。
- 原因：命令体过长，超过 shell 或传输层限制。
- 恢复：拆成多个小补丁，或只替换目标块。
- 预防：长文档、长 Prompt、长报告模板修改优先用结构锚点和局部 patch，不要整文件重写。

### 中文内容容易被命令链路写坏

- 症状：中文被写成 `?`、乱码，或显示乱码但不确定真实文件是否损坏。
- 原因：PowerShell / WSL / 终端显示或命令通道没有端到端保持 UTF-8。
- 恢复：用 UTF-8 回读、`repr`、字节或十六进制确认真实内容；必要时用 ASCII 结构锚点重写目标块。
- 预防：修改中文文档时，写完必须回读确认；不要只相信终端渲染。

### 中文补丁失败时优先使用 ASCII 结构锚点

- 症状：`apply_patch` 用中文上下文无法命中。
- 原因：终端显示编码和真实文件字节不一致，中文上下文变脆弱。
- 恢复：使用文件名、标题、英文标识、代码符号、Markdown 标题等 ASCII 锚点定位。
- 预防：含大量中文的文件，优先用“上一段 ASCII 标题 + 下一段 ASCII 标题”做小范围补丁。

### 写完后必须核验真实状态

- 症状：工具返回成功，但文件内容没有按预期变化，或工作区刷新异常。
- 原因：挂载同步、沙盒刷新或命令通道导致可见状态不可信。
- 恢复：立即重新读取目标文件关键片段；必要时换 PowerShell/WSL 另一侧核验。
- 预防：不要把“我执行了 patch”当成“文件已正确修改”。

## 测试与验证

### 不要画靶射箭

- 症状：测试很多但只覆盖 happy path，无法发现异常输入、降级失败、伪成功、注册表漂移或不可解释高分。
- 原因：先看当前实现再写测试，测试变成替实现找理由。
- 恢复：回到 Spec，列出用户契约、禁止行为、失败信号，再反推测试样例。
- 预防：新增测试至少考虑成功、失败、跳过、降级、异常输入、边界值和“看似成功但语义错误”的场景。

### Mock 通过不等于生产语义正确

- 症状：mock 测试全绿，但真实 source 解析、Trendshift 抓取、agents-radar digest 读取、storage 或 report 行为不符合 Spec。
- 原因：mock 过度简化了外部服务、文件系统、Markdown 结构、HTML 页面或历史状态。
- 恢复：先断言核心状态转换和对外契约，再断言 mock 调用细节。
- 预防：mock 测试要写清哪些生产语义被简化，并用 snapshot、结构测试或集成检查补位。

### 测试替身容易漂移

- 症状：真实模块新增导出、参数、score component、source 字段或 CLI 参数后，测试桩仍停留在旧结构，导致假失败或漏检。
- 原因：测试替身手写了部分接口，但没有随真实接口更新。
- 恢复：对照真实模块，补齐测试桩当前真正用到的最小接口形状。
- 预防：新增 source、score component、CLI 命令、report 类型时，同步检查对应测试替身。

### 按语言和工具链验证，不能混用

- 症状：用错误工具检查文件，制造本不存在的语法失败。
- 原因：把 Python 工具拿去检查 TypeScript，或把 Node 工具假定能覆盖 Markdown、HTML source、Actions 全部语义。
- 恢复：TypeScript 走 `pnpm typecheck`、`pnpm test`、`pnpm lint`；Markdown 走结构检查；source snapshot 走 parser 测试；CLI 走 dry-run。
- 预防：运行验证前先问“这个命令验证的是哪种语言、哪些文件、哪个运行时”。

### 测试环境缺依赖时不要直接放弃

- 症状：包管理器、运行时或外部 SDK 缺失导致测试无法启动。
- 原因：环境前置条件不足，而不是代码必然失败。
- 恢复：先找最小替代验证，例如文件枚举、关键引用搜索、JSON 解析、直接读取目标模块、结构一致性检查。
- 预防：最终说明必须明确“未运行原因”和“替代验证已做什么”。

## Spec 与代码同步

### 代码落地后必须同步 Spec 状态

- 症状：代码已经实现，但 `exec-plan`、`system-spec` 或服务 Spec 仍写着“待做/未覆盖”。
- 原因：把代码修改当作唯一终点，忽略 Spec 是系统意图和状态的来源。
- 恢复：回到对应 Spec，更新完成状态、验证矩阵和 Open Question。
- 预防：每完成一个行为或边界，立刻更新文档，不要留给下一轮。

### 新 score component 最容易造成语义漂移

- 症状：`config.yaml` 里有权重，但实现、测试、Spec 或报告说明缺失。
- 原因：评分组件横跨 config、engine、explanation、report、tests，任何一处遗漏都会让分数不可审查。
- 恢复：按 `services/scoring-engine.md` 和 `constraints/structure-tests.md` 逐项补齐。
- 预防：新增或改名组件前先更新 Spec，明确 value、weight、weighted、evidence 和 mode。

### 新 source 最容易造成事实漂移

- 症状：source connector 解析出了项目，但 raw snapshot、失败语义、去重 key 或 evidence 没写清。
- 原因：把“能抓到数据”误认为“数据能成为评分事实”。
- 恢复：补 `services/signal-ingestion.md`、snapshot 测试和 source failure policy。
- 预防：任何 source 都必须先定义 raw -> normalized 的契约。

### Prompt / LLM 语义不能越权

- 症状：LLM 开始对缺失正文、空数据、Trendshift 页面或 agents-radar 摘要做推测，并影响总分。
- 原因：Prompt 或调用边界没有写清“只做 semantic classification”。
- 恢复：恢复 LLM 禁止语义，并补 rules-only 回归测试。
- 预防：改 LLM 分类时先搜索并保护 `rules-only`、`semantic classification`、`不得直接决定最终分数` 等关键语义。

## 任务拆分与收口

### 不要把长程任务塞进同一轮

- 症状：依赖安装、全量抓取、端到端跑真实网络数据、批量重构和大规模测试混在一次执行里，命令一等就是几分钟，用户无法判断当前阶段是否已经有可审查成果。
- 原因：Agent 想“一口气做完”，但长程任务会吞掉反馈点，网络/registry/API 抖动时尤其容易把实现阶段和验证阶段混成一团。
- 约定：任何可能超过 60 秒的任务都必须先拆阶段；本轮只完成一个可审查闭环，例如“代码骨架落地”“依赖安装验证”“真实数据 dry-run”“补测试与修错”。
- 约定：如果安装或外部网络命令超时一次，立刻停止继续重试，把结果记录为验证阻塞，后续单独开短阶段处理。
- 恢复：输出当前阶段已完成内容、未完成验证、下一阶段入口命令，不要继续启动新的长程命令。

### 大改必须主动拆小

- 症状：一次改动跨 Signal、Filter、Action、Storage、CLI、测试和 Spec，收口时出现多处隐式 bug。
- 原因：模型同时处理太多边界，容易局部正确但整体漂移。
- 恢复：按“Signal parser -> Normalization -> Score engine -> Action report -> CLI/storage -> 测试与文档收口”拆成小闭环。
- 预防：跨模块大改默认控制单轮改动规模，先让一个边界可验证，再进入下一层。

### 不要把临时排障逻辑写成长期契约

- 症状：为了让本地环境跑通，往生产代码加入临时 fallback、硬编码路径或静默跳过。
- 原因：把当前机器问题误当成产品需求。
- 恢复：把环境问题记录到本文件或执行计划，不污染生产逻辑。
- 预防：只有产品 Spec 明确需要的 fallback 才能进业务代码。

## Git 与工作区

### Git ownership 或 safe directory 问题

- 症状：Git 报 `dubious ownership`。
- 恢复：优先使用命令级 `-c safe.directory=...`，不要随意改全局 Git 配置。
- 预防：只在需要 Git 信息时处理，不要为了文档任务强行修 Git 环境。

### 不要使用破坏性恢复命令

- 症状：为了解决状态异常，想运行 `git reset --hard`、`git checkout --` 或删除目录。
- 风险：会覆盖用户或其他 Agent 的工作。
- 恢复：停下来说明风险，除非用户明确要求，否则只做只读检查或局部补丁。
- 预防：默认假设工作区有他人改动。

## 从 agents-radar-system 继承的可复用经验

### Markdown 是上游事实载体，但不是唯一事实

- 风险：agents-radar 的 Markdown digest 是 LLM 生成文本，适合作为 signal evidence，不适合直接当结构化事实。
- 规则：本项目必须把 Markdown link/table/list 解析为 RawSignal，并用 Trendshift 或 GitHub 结构化数据补充 stars/forks/issues/PR。

### MCP / 发布层经验可参考，但不应直接复制运行面

- 风险：agents-radar 的 MCP、Issue、RSS 是发布消费面；agent-trend-radar 第一阶段只做本地 CLI 和 data/ 落盘。
- 规则：不要过早搬 GitHub Issue、MCP Worker 或 RSS 发布逻辑，先完成 Signal -> Score -> Daily Report。

### 可选数据源不能拖垮主链路

- 风险：Trendshift HTTP、未来 GitHub API、LLM classification 不可用时导致 daily loop 整体失败。
- 规则：可选源按 Spec 跳过或降级；rules-only 和 agents-radar local source 应能支撑最小闭环。

### metadata-only / summary-only 不得编造

- 风险：Trendshift 页面缺字段、agents-radar 摘要缺结构化指标时，Agent 或 LLM 编造 stars、forks、issues、PR。
- 规则：缺失字段必须保持缺失，并在 evidence 中说明。

## 恢复顺序

当修改或测试失败时，按这个顺序处理：

1. 判断失败来自环境、命令长度、编码、导入副作用、网络还是代码逻辑。
2. 用最小命令复现。
3. 如果是环境问题，使用本文件的恢复路径，不要改业务代码掩盖。
4. 如果是契约问题，先回到 Spec 明确正确行为。
5. 完成修改后，先做目标验证，再扩大到全量验证。
6. 无法运行验证时，说明原因、替代检查和剩余风险。

## 成功标准

- Agent 不重复已知工具链和编码失败。
- 文档、代码、测试和执行计划状态保持一致。
- 测试不是只证明当前实现，而是能发现契约违例。
- 新 source、新 score component、新 CLI、新 report 和新 data output 不会造成注册漂移。
- 环境缺失被清楚标注，不被误报成代码失败。
