# 可观测性契约

## 观测信号

| 信号 | 用途 |
| --- | --- |
| source fetch count | 判断上游是否可用 |
| normalized project count | 判断 parser 是否漂移 |
| score distribution | 判断评分是否异常偏移 |
| high-score count | 判断阈值是否过松或过严 |
| dry-run planned writes | 判断落盘路径 |
| missing evidence warnings | 判断 explainability 缺口 |

## 产物信号

- `data/raw/*`
- `data/normalized/*`
- `data/scores/*`
- `data/reports/*`
- `data/kb/*`

## 失败判据

- high-score 项目没有 evidence，视为 P0。
- rules-only 模式失败，视为 P0。
- dry-run 写入持久文件，视为 P0。
- weekly 只列项目不抽象趋势，视为 P1。

