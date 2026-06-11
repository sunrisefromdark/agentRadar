# 架构约束

## P0：必须满足

- 评分必须可解释，每个非零组件必须有 evidence。
- LLM 不得直接决定最终分数。
- rules-only 模式必须可运行。
- Trendshift 不可用时不得编造 engagement 指标。
- agents-radar Markdown 解析失败时不得生成虚假项目。
- dry-run 不得写入 `data/` 持久文件。
- 新 score component 必须同步 Spec、测试和 config。
- 新 source 必须定义失败语义和 raw snapshot 格式。

## P1：应该满足

- Trendshift HTML connector 应有 snapshot 测试。
- agents-radar Markdown parser 应只依赖稳定 Markdown 结构。
- weekly report 应验证趋势短语输出。
- KB 更新应保留历史，不覆盖证据。

## P2：建议满足

- score 权重和 total 计算做结构测试。
- source connector 统一 retry / logging。
- Open Question 定期清理。

