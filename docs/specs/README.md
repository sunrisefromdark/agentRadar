# agent-trend-radar Spec 索引

这是仓库当前仍然生效的 SDD / Harness 文档地图。它描述的重点不是“代码曾经怎么设计过”，而是“今天这套仓库默认怎样运行、Agent 应按什么顺序阅读、哪些契约必须与代码保持同步”。

## 文档分层

- `system-spec.md`：系统级地图，定义 `Signal -> Normalize -> Filter -> Action` 闭环、Web 承载面、自动化入口和稳定契约。
- `agent-work-spec.md`：Agent 作业总规范，定义阅读顺序、修改纪律、验证要求和文档同步要求。
- `agent-work/`：Agent 子规范目录，存放 review / implementation / testing / routing 等专项规则。
- `product-specs/`：产品级规格，定义用户目标、使用场景、验收口径和失败条件。
- `services/`：服务级规格，定义输入输出、边界、错误语义和运行约束。
- `exec-plans/`：执行计划账本，记录阶段进度、已落地内容、验证记录和剩余风险。
- `design-docs/`：设计文档，记录架构决策、取舍和未来变更入口。
- `constraints/`：架构约束和结构测试守护。
- `feedback-loops/`：可观测性、漂移检测和失败恢复策略。

## 当前系统地图

`agent-trend-radar` 当前是一个“可解释趋势判断 + 可浏览工作台”系统：

- `Signal`：读取 `agents-radar` 与其他公开来源信号。
- `Normalize`：把多源数据归并为稳定的项目视图。
- `Filter`：计算可解释评分与辅助分类。
- `Action`：产出 daily / weekly / run-summary / verify / knowledge-base / observer 等工件。
- `Workbench`：通过终端视图和本地 Web 视图消费这些工件。
- `Auth + User State`：在启用内建认证时，为偏好、关注仓库和账户绑定提供持久化入口。

当前默认数据源语义如下：

- `agents-radar` 的默认 source 是 `github-http`。
- `github-http` 通过 GitHub direct-read path 读取已提交的 upstream digest 与 manifest，而不是要求本地必须存在邻居仓库。
- 上游公开入口以 `GitHub` 仓库为准：`https://github.com/duanyytop/agents-radar`
- `repo-sync` / `local-refresh` 仍然保留，但只作为显式启用的兼容或恢复路径。
- 本地 fresh clone 可以只靠当前单仓库完成静态检查、测试和默认只读浏览。
- GitHub Actions 的 daily 自动化目前会额外拉起 producer workspace 做兼容 / 恢复级校验，但这不改变默认 public source 仍然是 `github-http` 的事实。

## 当前入口面

当前仓库已经不止早期 CLI 四件套，规范必须覆盖以下入口：

- 数据主链路：`run-daily`、`recover-daily`、`score`、`run-weekly`、`sync-weekly`、`verify-daily`
- 数据补充链路：`capture-github-stars`、`build-kb`
- Agent memory / receipt：`record-agent-task`
- 本地终端视图：`visual-console`
- 本地 Web 视图：`visual-console:web`
- 启用认证的 Web 视图：`visual-console:web:auth`
- 本地认证与数据库辅助：`auth:doctor`、`auth:setup-local`、`auth:bootstrap-local-db`

如果新增、删除或重命名这些入口，必须同步更新：

- `docs/specs/services/cli-runtime.md`
- `README.md`
- 相关 `exec-plan`
- 对应测试或结构守护

## Agent 必读顺序

1. `docs/specs/README.md`
2. `docs/specs/system-spec.md`
3. 与任务相关的 `product-specs/` 或 `services/`
4. `docs/specs/constraints/architecture-constraints.md`
5. `docs/specs/constraints/structure-tests.md`
6. 与任务相关的 `feedback-loops/`
7. 与任务相关的 `exec-plans/`
8. `docs/specs/agent-work/agent-pitfalls.md`
9. 必要时再读取实现代码与测试

## 使用原则

- 先读地图，再改实现。
- Spec 写“稳定语义与边界”，不是逐行复述代码。
- 当前代码已经存在的入口、路径、产物和失败模式，Spec 不得继续停留在旧版本假设。
- 能被测试守护的契约，尽量写成可验证场景。
- 历史设计稿可以保留，但当前态文档必须与主分支代码一致。

## 维护原则

- 改代码时，相关 Spec 和 exec-plan 必须在同一轮同步。
- 改默认运行方式时，优先更新 `system-spec.md`、`services/cli-runtime.md`、`README.md`。
- 改用户入口或工作台行为时，必须同步更新产品 / 服务级文档。
- 若代码与当前态 Spec 冲突，先修正文档或实现其一，不能让漂移长期悬置。
