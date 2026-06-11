# Agent 工作子规范索引

**AI Notice:** 在执行本项目任何代码修改、结构分析或审核之前，先阅读根目录 `agentReadme.md` 和本目录的 `agent-pitfalls.md`。它们是本项目的第一信条、执行纪律和防翻车指南。之后再回到这里按任务类型下钻。

本目录承接 `agent-work-spec.md` 中的细则，目标是让 Agent 不需要一次性读完整个作业规范，而是按任务性质读取对应节点。

## 当前文件

- `flow.md`：任务接收、地图阅读、下钻和作业理解。
- `change-policy.md`：修改纪律、范围控制和契约保护。
- `verification-policy.md`：验证闭环、测试分层和失败说明。
- `runtime-routing.md`：什么时候只读局部节点，什么时候回到总地图重新下钻。
- `agent-pitfalls.md`：当前项目继承和新增的 AI Agent、终端、环境坑。

## 使用规则

- 每次任务先读 `agent-work-spec.md`，再按任务性质读取本目录中的具体节点。
- 如果任务属于“审核代码落地是否和 exec-plan 一致”、`code review`、实现审查、落地一致性审查，必须先读取 `docs/specs/agent-work/codeReviewSkill.md`。
- `codeReviewSkill.md` 只用于“代码落地审查”场景；不得把它泛化为 design review、exec-plan review 或普通文档审查的统一技能书。
- 代码落地审查任务的默认顺序是：先读 `codeReviewSkill.md`，再看 exec-plan、diff / 相关代码 / 测试 / 执行证据，最后给出 code review 结论。
- 代码落地审查任务的机器可检查硬约束是 `npm run code-review:preflight`，不通过就不得继续进入正式 code review 结论输出。

- `design review`、`exec-plan review`、代码实现、测试验证各自使用对应技能书，不共享 `codeReviewSkill.md` 的任务定义。
- 多类技能任务共用的仓库级门禁入口是 `npm run skills:preflight`，但具体读取哪一本技能书，必须由任务类型决定。
- 如果任务属于 `design doc review`、`design audit`、`设计文档审核`，或者需要输出 `docs/specs/design-docs/*.md` 的审查结论，必须先读取 `docs/specs/design-docs/DesignDocument_ReviewSkill.md`。
- `DesignDocument_ReviewSkill.md` 是 design-doc review 任务的技能书和硬约束来源，不得被通用作业规范替代。
- design-doc review 任务的默认顺序是：先读 `DesignDocument_ReviewSkill.md`，再看目标 design doc、需求分析、相关架构与项目规则，最后给出结论。
- design-doc review 任务在输出结论前必须先通过 `npm run design-review:preflight`。


- 如果任务属于 `exec-plan review`、`exec-plan audit`，或者需要输出 `docs/specs/exec-plans/*.exec-plan.md` 的审查结论，必须先读取 `docs/specs/exec-plans/ExecPlan_ReviewSkill.md`。
- `ExecPlan_ReviewSkill.md` 是 exec-plan 审核任务的技能书和硬约束来源，不得被通用作业规范替代。
- exec-plan 审核任务的默认顺序是：先读 `ExecPlan_ReviewSkill.md`，再看目标 exec-plan、相关 spec 与项目规则，最后给出结论。
- exec-plan review 任务在输出结论前必须先通过 `npm run exec-plan:review:preflight`。
- 如果任务属于“根据 exec-plan 实施代码落地”，必须先读取 `CodeImplementation_Skill.md` 并通过 `npm run code-implementation:preflight`。


- `CodeImplementation_Skill.md` 只用于按 exec-plan 执行实现任务，不用于代码审查、design review 或 exec-plan review。

- 如果任务属于测试设计、补测、回归验证，必须先读取 `TestingSkill.md` 并通过 `npm run testing-skill:preflight`。
- 如果任务超过一个短阶段，必须更新对应 exec-plan 的“当前进度”和“下一阶段入口”。
- 如果遇到可复用经验，必须沉淀到本目录，而不是只留在聊天记录里。
- 禁止主观宣告“已完成”：必须以 `verification-policy.md` 中的脚本验证通过作为完成判定依据。
- 禁止只靠 Rule 文本自证正确：必须把验收标准映射到对应 scripts 并实际执行，留下可复现验证记录。
