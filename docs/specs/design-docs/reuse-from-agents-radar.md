# 设计文档：从 agents-radar-system 复用什么

## 结论

agent-trend-radar 应优先复用 agents-radar-system 的工程经验和少量通用工具，不应直接复制日报生成主链路。

## 可以直接搬运

这些模块语义足够通用，适合直接复制后按新项目路径微调。

| 模块 | 搬运理由 | 注意事项 |
| --- | --- | --- |
| `src/date.ts` | 日期格式、sleep、CST/UTC helper 通用 | 保留无业务耦合函数；不需要日报标题语义 |
| `src/providers/` | LLM Provider 抽象、OpenAI/Anthropic/OpenRouter/GitHub Copilot 接口可复用 | 本项目默认 rules-only，Provider 只服务 semantic classification，不能参与最终打分 |
| `src/report.ts` 的 `callLlm` 重试思路 | 429 retry、并发限制、token budget 经验通用 | 不建议整文件复制 `saveFile/footer`，storage 语义不同 |
| `src/config.ts` 的 YAML loader 模式 | `config.yaml` 加载、默认回退、类型转换思路通用 | 新项目配置结构完全不同，需要重写 schema |
| `src/__tests__/providers.test.ts` 思路 | Provider 工厂、空响应、秘钥不泄漏测试通用 | 测试名称和默认 provider 需适配 |
| `docs/specs/agent-work/agent-pitfalls.md` 通用经验 | WSL/pnpm/UTF-8/Spec 同步/测试纪律可复用 | 已按本项目语义合并 |

## 可以改造复用

这些模块的底层模式有价值，但业务语义不同，不能直接拷贝后使用。

| 模块 | 可复用部分 | 必须改造 |
| --- | --- | --- |
| `src/generate-manifest.ts` | 枚举日期目录、生成索引、XML 安全经验 | 本项目 data/reports 不等于 public RSS，第一阶段不需要 RSS |
| `src/report-builders.ts` | Markdown report assembly 模式 | 本项目报告以 ScoreBreakdown evidence 为中心，不能复用日报章节 |
| `src/rollup.ts` | 读取最近 7 天报告、截断输入、生成周报思路 | weekly report 必须聚合 scores，而不是 LLM 摘要拼接 |
| `src/trending.ts` | GitHub trending HTML + search API 采集思路 | 本项目上游是 Trendshift，不直接重建 agents-radar trending 抓取 |
| `src/github.ts` | GitHub API 类型和 Issue/PR/release fetch helper | 本项目第一阶段不创建 Issue；只可抽 GitHub repo metrics helper |
| `src/web.ts` | state file、sitemap 增量、metadata-only 边界经验 | 本项目暂无官网 sitemap source |
| `src/notify.ts` / `src/feishu.ts` | report 链接和 highlights 通知模板经验 | 本项目第一阶段不做通知 |

## 不建议搬运

| 模块 | 原因 |
| --- | --- |
| `src/index.ts` | agents-radar 的主链路是 digest producer，本项目是 scoring decision engine，职责不同 |
| `src/prompts.ts` | 针对 AI CLI/Agent 日报，不适合 scoring evidence |
| `src/prompts-data.ts` | 针对多源日报和 rollup，不适合本项目的 Action 输出 |
| `src/report-savers.ts` | 绑定 GitHub Issue 发布和日报类型，不符合本项目本地 data/ 落盘优先 |
| `mcp/` | 本项目第一阶段不做 MCP，过早搬运会扩大边界 |
| `.github/workflows/*` | 当前项目还没有实现代码和测试，暂不接 CI/Actions |
| `index.html` / `feed.xml` | Web/RSS 发布不是第一阶段目标 |

## 推荐搬运顺序

1. 先搬 `date.ts` 的通用 helper。
2. 再搬 Provider 抽象，但默认关闭 LLM。
3. 再按新配置结构重写 config loader。
4. 最后才考虑 GitHub metrics helper 或 report builder pattern。

## 验收标准

- 搬运模块必须有对应新项目 Spec。
- 搬运模块必须通过新项目测试，而不是沿用旧项目测试结论。
- 搬运后不得引入 agents-radar 的报告类型、Issue 发布、RSS、MCP 等非目标边界。
