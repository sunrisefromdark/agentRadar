# 服务 Spec：Action Output

## 文档状态

- 版本：`v0.2`
- 目标：把评分结果转换成可读、可复盘、可行动的输出。
- 当前实现状态：daily report、weekly report、knowledge card 已落地；输出质量仍依赖上游 enrichment 和范式分类准确度。

## 责任范围

Action 层负责把 `ScoredProject` 转换为用户可以消费的决策材料。它不重新计算分数，但必须展示分数证据。

## 输入

- `ScoredProject[]`
- `ScoreBreakdown`
- report date
- generated timestamp

## 输出

| 输出 | 位置 | 当前状态 |
| --- | --- | --- |
| daily report JSON | `data/reports/YYYY-MM-DD.daily.json` | 已落地 |
| daily report Markdown | `data/reports/YYYY-MM-DD.daily.md` | 已落地 |
| weekly report Markdown | `data/reports/YYYY-MM-DD.weekly.md` | 已落地 |
| KB cards Markdown | `data/kb/*.md` | 已落地 |
| KB latest JSON | `data/kb/latest.json` | 已落地 |

## Knowledge Card 契约

每个项目 card MUST 包含：

- 项目简介。
- star 增长。
- 为什么重要。
- 属于哪个范式。
- 风险。
- 下一步建议。
- ScoreBreakdown 摘要或可追溯 evidence。

### KB 更新契约

`build-kb` MUST 采用增量更新，而不是无脑覆盖整个文件。

- 机器可更新区域：frontmatter、metrics、signals、score、risks、next steps。
- 人工保留区域：`## 人工判断`、`## Review Notes` 或等价的受保护 section。
- 机器在后续更新同一张 card 时 MUST 保留人工区域原文，不得覆盖、删除或重排其内容。
- 如果缺少受保护 section，机器 MAY 按模板补出空 section，但后续仍必须保留该 section。
- 同一 repo 的 card 更新 MUST 视为重入场景，不能因为再次执行 `build-kb` 而丢失既有人工沉淀。

## Daily Report 契约

Daily report MUST 包含：

- 今日新项目。
- 高分项目。
- 异常增长项目。
- 今日趋势短语。
- 每个重点项目的 evidence 摘要。

## Weekly Report 契约

Weekly report MUST 回答：

- 最近爆的东西有什么共同点？
- 是否强化某个方向？
- 是否出现新范式？

输出必须抽象为趋势，例如 `agent runtime + persistent memory + self-improving`，不能只列 repo。

## 失败模式

| 失败 | 语义 | 预期处理 |
| --- | --- | --- |
| scored input 为空 | 没有可报告项目 | 输出空报告并说明无信号 |
| evidence 缺失 | 分数不可复盘 | 结构测试失败或报告降级标注 |
| 范式过粗 | 分类规则不足 | 进入 scoring / classification 后续计划 |
| 写盘失败 | data 目录不可写 | CLI 返回失败，不静默吞错 |
| KB 重入覆盖人工区 | 机器更新破坏人工沉淀 | 测试失败并阻止以 overwrite 方式发布 |

## 关键场景

### 场景：异常增长

当项目 `star_delta_daily` 超过阈值时，daily report MUST 把它放入 Anomaly Growth，并展示 engagement evidence。

### 场景：周趋势

当多个项目共享相同 paradigm 时，weekly report SHOULD 输出方向强化判断，而不是只输出项目表格。

### 场景：KB 构建

当 latest scores 存在时，`build-kb` MUST 为每个项目生成独立 card 和 `latest.json`。

### 场景：KB 重入更新

当同一项目的 KB card 已存在，且用户在 `## 人工判断` 或 `## Review Notes` 中写入了内容时，THEN 后续 `build-kb` MUST 只更新机器区，保留人工区原文。

## 验证矩阵

| 文件位置 | 验证内容 | 验证方式 | 对应 Spec |
| --- | --- | --- | --- |
| `src/action/dailyReport.ts` | 新项目、高分、异常增长、evidence 输出 | 单元测试 + dry-run | 本文件「Daily Report 契约」 |
| `src/action/weeklyReport.ts` | 三个周报问题是否被回答 | 单元测试 + 报告审查 | 本文件「Weekly Report 契约」 |
| `src/action/knowledgeCard.ts` | card 字段是否完整、机器区/人工区是否隔离 | 单元测试 | 本文件「Knowledge Card 契约」「KB 更新契约」 |
| `data/reports/*.md` | 人类可读报告是否生成 | 冒烟检查 | 本文件「输出」 |
| `data/kb/*.md` | KB card 是否生成且重入更新不覆盖人工区 | 冒烟检查 + 重入测试 | 本文件「KB 构建」「KB 重入更新」 |
