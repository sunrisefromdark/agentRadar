# System Spec

## 运行面

| 模块 | 说明 | 关键路径 |
| --- | --- | --- |
| 信号采集 | 采集公开趋势源并归一化 | `src/signal/`, `src/normalize.ts` |
| 评分与过滤 | 对候选项目进行评分和筛选 | `src/filter/`, `src/action/` |
| 结果产出 | 生成日报、周报与知识库 | `src/action/`, `data/reports/`, `data/kb/` |
