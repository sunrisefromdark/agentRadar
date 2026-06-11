# Agent 变更纪律

## 范围控制

- 每次只推进一个闭环或一个服务边界。
- 不把 Trendshift connector、score engine、weekly report 一次性混在同一轮实现。
- 不重排无关文件。

## Score 变更

- 新增或修改 score component 时必须更新权重说明、证据字段和测试。
- 任何数值公式都必须能从 `ScoreBreakdown` 解释。
- 不允许只调权重来掩盖分类错误。

## Source 变更

- 新 source 必须定义时间窗口、去重 key、失败语义和 raw snapshot 格式。
- 对 HTML source 必须保留 snapshot 测试，不把 DOM class 当稳定契约。

## Report 变更

- 新 report 必须说明使用哪些 score 和 evidence。
- weekly report 必须输出趋势抽象，不得只列项目。

