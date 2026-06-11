# 产品规格：agent-trend-radar

## 用户画像

### AI 系统工程师

- 想知道哪些 Agent/Infra/Tools 项目不只是热门，而是真的代表架构趋势。
- 需要可解释证据，而不是黑箱排行。

### 投研 / 技术决策者

- 关注异常增长、持续出现、多源验证和范式变化。
- 需要 daily signal 和 weekly abstraction。

### Agent 开发团队

- 关注 memory、skill、自进化、runtime、MCP、sandbox、autonomy 等能力是否形成新方向。

## 产品目标

- 从 GitHub / Trendshift 的当日新鲜来源中发现项目级信号，并把 agents-radar 作为补充上下文来源。
- 计算可解释的 `ScoreBreakdown`。
- 生成项目 knowledge card。
- 生成 daily report：今日新项目、高分项目、异常增长项目。
- 生成 weekly report：共同点、方向强化、新范式。

## 场景矩阵

| 场景 | 用户意图 | 成功标准 | 失败标准 |
| --- | --- | --- | --- |
| 今日扫描 | 找出当天值得关注的新项目 | daily report 以当次实时发现层产出新项目、高分项目、异常增长 | 主要依赖旧 digest / snapshot 充当当天主榜单 |
| 评分解释 | 理解为什么项目高分 | 每个组件有 evidence | 只有总分无解释 |
| rules-only | 无 LLM 环境仍能运行 | 完成分类和评分 | 没有 LLM 就失败 |
| 多源验证 | 判断项目是否持续出现 | discussion_score 显示来源和出现次数 | 单源项目被误判成长期趋势 |
| 周趋势抽象 | 识别新范式 | 输出类似 `agent runtime + persistent memory + self-improving` | 只列项目清单 |
| KB 构建 | 跟踪项目历史 | card 记录历史 score 和 evidence，且不覆盖人工区 | 每天覆盖旧信息或抹掉人工判断 |

## 验收场景

### 场景：高分项目解释

WHEN daily report 中项目 score 超过阈值，THEN report MUST 展示它的关键 evidence，包括增长、engagement、架构范式和多源讨论。

### 场景：异常增长

WHEN 项目 star_delta 超过阈值但 engagement 很低，THEN report MUST 标记 fake-star 风险或低 engagement 风险。

### 场景：周报范式

WHEN 最近 7 天多个高分项目共享 memory、runtime、self-improving 能力，THEN weekly report MUST 抽象出组合趋势，而不是只输出单项目。

### 场景：KB 人工沉淀保护

WHEN 用户在项目卡片的 `## 人工判断` 或 `## Review Notes` 中补充了内容，THEN 后续 `build-kb` MUST 保留该区域原文，只更新机器区。

### 场景：跨天持续出现

WHEN 同一 repo 在多天数据中持续出现，THEN 系统 MUST 在评分与周报中识别它属于 `emerging` 或 `persistent`，而不是把每天都当成孤立新项目。

## 验证矩阵

| 文件位置 | 验证内容 | 验证方式 | 对应 Spec |
| --- | --- | --- | --- |
| `src/filter/scoreEngine.ts` | 高分项目是否有 evidence | 单元测试 | 本文件「评分解释」 |
| `src/action/dailyReport.ts` | daily report 是否覆盖三类项目 | 快照测试 | 本文件「今日扫描」 |
| `src/action/weeklyReport.ts` | weekly 是否输出趋势抽象 | 快照测试 | 本文件「周趋势抽象」 |
| `src/action/knowledgeCard.ts` | KB card 是否记录历史、建议且保留人工区 | 单元测试 + 重入测试 | 本文件「KB 构建」「KB 人工沉淀保护」 |
