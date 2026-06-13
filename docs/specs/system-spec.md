# 系统级 Spec

## 文档状态

- 版本：`v0.2`
- 适用范围：`agent-trend-radar` 当前主分支代码
- 目标读者：实现 Agent、验证 Agent、人工维护者

## 系统目标

`agent-trend-radar` 的目标是从公开 AI Agent / Agent Infra / Tooling 生态中提取“值得继续判断和跟踪”的趋势信号，并把这些信号转成可解释、可回看、可浏览的产物与工作台。

系统当前同时承担两类职责：

1. 数据与判断链路：采集、归一化、评分、分类、日报/周报/知识工件输出
2. 消费与运营链路：本地 Web workbench、认证入口、用户偏好与关注仓库持久化、自动化调度

## 系统边界

### 范围内

- 默认以 `github-http` 模式读取上游 `agents-radar` 已提交工件
- 通过 `GitHub` direct-read path 读取 `manifest.json` 与 `digests/YYYY-MM-DD/*.md`
- 兼容 `repo-sync` / `local-refresh` 作为显式恢复或兼容模式
- 采集 Trendshift、GitHub star 快照和 ecosystem observer 补充信号
- 归一化为稳定的项目视图与 `RawSignal` / `NormalizedProject` / score 工件
- 基于规则优先的评分与可选 LLM 分类
- 输出 daily、weekly、run-summary、verify-daily、knowledge-base、observer 工件
- 提供终端视图、SSR Web workbench、认证启用版 Web workbench
- 在启用认证时提供账户、偏好和关注仓库持久化
- 提供 daily / weekly GitHub Actions、systemd timer 与本地 auth/bootstrap 辅助命令

### 范围外

- 替代 `agents-radar` 上游生产 digest 的完整采集系统
- 将 LLM 作为黑箱最终排序器
- 无约束地直接从前端重算 score、weekly trend 或 observer ranking
- 面向公网的多租户 SaaS 运维平台
- 强制要求 fresh clone 必须先搭建数据库或认证后才能浏览已提交工件

## 运行面

| 运行面 | 入口 | 作用 | 当前状态 |
| --- | --- | --- | --- |
| daily loop | `run-daily` | 采集信号、归一化、分类、评分、输出 daily / run-summary / verify / observer | 活跃 |
| daily recovery | `recover-daily` | 基于已缓存 raw 数据重建 daily 工件 | 活跃 |
| weekly loop | `run-weekly` | 读取 canonical 7 日窗口并输出 weekly 工件 | 活跃 |
| weekly sync | `sync-weekly` | 在缺口修复后补齐 weekly 工件 | 活跃 |
| verification | `verify-daily` | 校验 daily 输出完整性与健康度 | 活跃 |
| enrichment | `capture-github-stars` | 写入 tracked repo star 快照 | 活跃 |
| knowledge refresh | `build-kb` | 刷新知识库工件 | 活跃 |
| receipt ingress | `record-agent-task` | 把开发任务写入 agent-memory canonical receipt | 活跃 |
| terminal view | `visual-console` | 终端中浏览 overview / projects / weekly / run-health / observer / kb | 活跃 |
| web view | `visual-console:web` | 启动只读优先的本地 Web workbench | 活跃 |
| auth-enabled web | `visual-console:web:auth` | 启动带内建认证的本地 Web workbench | 活跃 |
| local auth ops | `auth:doctor` / `auth:setup-local` / `auth:bootstrap-local-db*` | 本地认证与数据库探针 / 引导 | 活跃 |
| automation | GitHub Actions / `automation:daily` / `automation:weekly` | 定时产出与提交公共工件 | 活跃 |

## 核心稳定契约

- 默认 public source 是 `github-http`。
- `github-http` 对应 GitHub direct-read path，而不是“必须邻居 checkout 才能运行”。
- 当前 daily GitHub Actions 会额外准备 producer workspace 做兼容 / 恢复级校验，但不会把默认 source 悄悄切换成 `repo-sync`。
- `data/raw/`、`data/normalized/`、`data/scores/`、`data/classifications/`、`data/reports/`、`data/kb/`、`data/observer/` 是主工件目录。
- `run-daily` / `run-weekly` / `score` / `verify-daily` / `build-kb` 保持可脚本验证，并支持 dry-run 或等价低副作用验证路径。
- 认证默认不是 fresh clone 的前置条件；`visual-console:web` 应允许在未启用 auth 的情况下浏览已提交工件。
- 启用认证后，Web 服务可消费数据库、偏好与账户绑定能力，但这不改变核心数据产物契约。

## 失败语义

| 类型 | 含义 | 处理原则 |
| --- | --- | --- |
| upstream digest unavailable | 无法通过默认 public path 读取上游 | daily 链路失败或进入显式恢复路径 |
| partial source outage | Trendshift / GitHub 补充信号缺失 | 允许降级，但必须保留状态与证据 |
| stale daily window | weekly 缺少 canonical 7 日窗口 | `run-weekly` 不得静默拼装假窗口 |
| verify failure | daily 工件不完整或质量门禁未通过 | 必须输出 verify 结果并让自动化显式失败 |
| auth readiness blocked | 数据库或认证配置不可用 | `visual-console:web:auth` 失败，默认只读 web 仍可存在 |
| dry-run | 用户要求低副作用演练 | 不得写入持久化主工件 |

## 验收口径

- 当用户运行 `run-daily` 时，系统必须能落出完整 daily 工件集，或清晰给出失败原因。
- 当用户运行 `run-weekly` 时，系统必须基于完整窗口生成 weekly 工件，而不是拿残缺数据硬拼趋势。
- 当用户运行 `visual-console:web` 时，系统必须能浏览当前仓库已提交工件，不要求本地先完成 auth setup。
- 当用户运行 `visual-console:web:auth` 时，系统必须把认证 readiness、数据库连通性和账户入口显式暴露出来，而不是静默降级。
