# 设计文档：架构边界

## 决策：独立趋势决策系统

agents-radar 是 digest producer；agent-trend-radar 是 trend decision engine。前者生产信息，后者做项目级归一化、评分、解释和行动建议。

## 决策：rules-first scoring

评分默认由规则和结构化数据完成，LLM 只做 semantic classification。这样可以保持可解释、可测试、可离线运行。

## 决策：Trendshift connector 可插拔

Trendshift 当前以公开站点为明确上游，未来可能接入本地项目或 API。connector 先抽象成 `http/snapshot/local`，避免把 HTML 结构写死成核心契约。

## 决策：data/ 文件系统优先

第一版使用文件系统 JSONL/Markdown，降低实现复杂度，并方便审查每一步产物。

