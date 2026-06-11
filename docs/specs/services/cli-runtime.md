# 服务 Spec：CLI Runtime

## 职责

CLI Runtime 负责统一仓库入口的命令语义、参数解析、配置加载、日志与重试策略，以及“哪些命令会写工件、哪些命令只做浏览或探针”。

它当前覆盖的不只是早期数据 CLI，还包括本地 workbench、auth 辅助命令和 agent-memory receipt 入口。

## 当前命令

| 命令 / 脚本入口 | 作用 |
| --- | --- |
| `run-daily` | 采集、归一化、分类、评分并生成 daily 相关工件 |
| `recover-daily` | 基于已缓存 raw 数据恢复 daily 工件 |
| `score` | 对指定日期或指定输入进行分类 + 评分 |
| `run-weekly` | 生成 weekly 工件 |
| `sync-weekly` | 在补齐 daily 窗口后重新同步 weekly 工件 |
| `verify-daily` | 校验 daily 工件完整性与健康度 |
| `capture-github-stars` | 记录 tracked repo star 快照 |
| `build-kb` | 刷新知识库工件 |
| `record-agent-task` | 通过 checked-in JSON receipt 记录开发任务 |
| `visual-console` | 在终端中渲染 workbench 视图 |
| `visual-console:web` | 启动本地只读优先 Web workbench |
| `visual-console:web:auth` | 启动启用内建认证的本地 Web workbench |
| `auth:doctor` | 检查 auth readiness 与数据库可达性 |
| `auth:setup-local` | 生成 / 校正 `.env.local` 并给出本地 auth 引导 |
| `auth:bootstrap-local-db` | 生成本地数据库 bootstrap 计划 |
| `auth:bootstrap-local-db:execute` | 执行本地数据库 bootstrap |
| `auth:bootstrap-local-db:shell` | 仅打印 Bash bootstrap 命令 |
| `auth:bootstrap-local-db:shell:execute` | 通过 Bash wrapper 执行 bootstrap |
| `auth:dev` | 在本地 auth 开发模式下启动 Web workbench |

## 运行契约

- 所有命令都必须经过统一配置加载与基础日志输出。
- 数据链路命令默认使用当前日期；显式 `--date YYYY-MM-DD` 时必须做日期校验。
- `run-daily`、`score`、`run-weekly`、`verify-daily`、`visual-console` 等命令共享统一参数解析，不得各自实现一套互相漂移的 flag 语义。
- `--config` 必须允许覆盖默认 `config.yaml`。
- `run-daily`、`score`、`run-weekly`、`verify-daily`、`build-kb` 必须支持 `--dry-run` 或等价低副作用验证路径。
- `run-weekly` 不得在缺少 canonical 7 日窗口时静默生成伪周报；需要补齐时应提示 `run-daily` 或 `sync-weekly --backfill-missing-days`。
- `recover-daily` 只能消费本地已缓存的 raw 工件，不得伪装成重新抓取。
- `record-agent-task` 必须要求显式 `--input <task-json-path>`，并把 receipt 写入 agent-memory canonical 入口。
- `visual-console:web` 与 `visual-console:web:auth` 属于 package script 暴露的 Web 入口，规范上同样受 CLI Runtime 约束。

## 视图与 Web 入口契约

- `visual-console` 支持 `overview`、`projects`、`weekly`、`run-health`、`observer`、`knowledge-base` / `kb` 视图语义。
- `visual-console:web` 默认是 fresh clone 友好的只读入口，不要求先完成 auth 配置。
- `visual-console:web:auth` 必须显式暴露 auth readiness、数据库连通性和账户入口状态。
- Web 入口和终端入口消费的是同一批 checked-in 工件，不能各自定义不同的 weekly / score 真相。

## 重试与失败语义

- 网络型 source 读取必须保留 retry 策略与失败日志。
- `run-daily` 自动化允许“产物保留但最终失败”的模式，以便 GitHub Actions 继续上传和提交可恢复工件。
- `verify-daily` 失败时不得把本轮运行伪装成成功。
- auth 探针失败时必须输出可操作原因，例如数据库未启动、凭据错误或 env 缺失。

## 文档同步规则

新增、删除或改名以下任一入口时，必须同步更新：

- 本文件
- `README.md`
- `docs/specs/system-spec.md`
- 相关 `exec-plan`
- 对应测试与脚本说明
