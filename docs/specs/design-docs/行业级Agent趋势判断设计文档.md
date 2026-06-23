# 设计文档：行业级 Agent 趋势判断

## 文档状态

- 版本：`v0.1`
- 状态：`Draft for Review`
- 对应需求：[行业级Agent趋势判断需求分析.md](../product-specs/行业级Agent趋势判断需求分析.md#L1)
- 需求状态：`Frozen for Design`
- 设计审查标准：[DesignDocument_ReviewSkill.md](DesignDocument_ReviewSkill.md#L1)
- 文档形态：本文为设计文档包入口；冻结正文拆分到 `行业级Agent趋势判断设计/` 子目录。

## 阅读顺序

| 顺序 | 子文档 | 内容 |
| --- | --- | --- |
| 00 | [总览与设计边界](行业级Agent趋势判断设计/00-总览与设计边界.md) | 文档状态、一句话设计、Thesis、范围、与现有系统关系 |
| 01 | [产品表面与生产治理](行业级Agent趋势判断设计/01-产品表面与生产治理.md) | Weekly 产品表面、用户工作流、SLO / 成本默认数值地板、eval、人工复核、治理面 |
| 02 | [证据轴与相关性门控](行业级Agent趋势判断设计/02-证据轴与相关性门控.md) | 冻结十轴证据、Agent relevance gate、相关性 profile |
| 03 | [数据模型契约](行业级Agent趋势判断设计/03-数据模型契约.md) | IndustrySignalEvent、Registry、Tool、Claim、Audit、Ledger、per-axis subscore rubric 等 schema 与字段语义 |
| 04 | [评分裁决与证据归一](行业级Agent趋势判断设计/04-评分裁决与证据归一.md) | per-axis scoring profile、趋势等级裁决、证据归一、合并、反证 severity |
| 05 | [多Agent协作与中间件](行业级Agent趋势判断设计/05-多Agent协作与中间件.md) | 9 个实际 Agent、15 个职责项、payload schema registry、artifact manifest、三段式 DAG、中间件采用策略 |
| 06 | [工具保障与 Seed Registry](行业级Agent趋势判断设计/06-工具保障与SeedRegistry.md) | 工具四级保障链路、工具 seed、冻结 Seed Registry 基线 |
| 07 | [运行输出与安全](行业级Agent趋势判断设计/07-运行输出与安全.md) | 日级/周级运行口径、Weekly 输出契约、失败降级、安全边界、产物目录 |
| 08 | [验证追溯与完成定义](行业级Agent趋势判断设计/08-验证追溯与完成定义.md) | 同步规格、测试矩阵、需求追溯、防偷懒约束、完成定义、设计结论 |
| 09 | [术语与审计词汇表](行业级Agent趋势判断设计/09-术语与审计词汇表.md) | judgment primitives、协作协议、治理面、eval/replay 等专用名词统一口径 |

## 拆分原则

- 专用名词统一以 [术语与审计词汇表](行业级Agent趋势判断设计/09-术语与审计词汇表.md) 为准；子文档中的局部解释只补充上下文。

- 原路径保留为入口，避免需求文档、评审文档或后续 ExecPlan 的链接失效。
- 子文档是冻结正文的来源；实现阶段应引用具体子文档和章节，而不是只引用本入口。
- 拆分只改变文档组织，不改变任何设计语义、目标态完成定义、评分规则、Agent 分工或治理要求。
- 若后续修改设计，必须同步更新对应子文档；本入口只维护导航和状态。
