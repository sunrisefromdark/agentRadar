# Visual Console 测试使用手册

这份手册用于当前 `Visual Console` 可视化界面的测试与验证，覆盖：

- `src/__tests__/visualConsole.test.ts`
- `src/__tests__/cliWorkflow.test.ts`
- `src/visualConsole/*`
- `src/cli.ts` 中 `visual-console` 入口

## 1. 测试目标

当前 Visual Console 测试主要验证 4 类能力：

1. 只读边界是否稳定
   - 控制台只能消费既有 artifact
   - 不允许引入 `filter / signal / normalize` 业务重算链路
2. 状态模型是否一致
   - `failed -> not-judgeable -> stale -> degraded -> empty -> ready`
   - `latest`、历史日期、缺失 artifact 的行为一致
3. 视图结构是否符合约定
   - `Overview`
   - `Projects`
   - `Weekly`
   - `Run Health`
   - `Knowledge Base`
4. CLI 与跨视图钻取是否可用
   - `visual-console --view overview/projects/weekly/run-health/kb`
   - `weekly -> project`
   - `project -> kb`

## 2. 前置环境

在仓库根目录执行：

```bash
cd /home/adduser/AgentProjection/agent-trend-radar
pnpm install
```

如果你的环境平时通过 `corepack` 使用 `pnpm`，保持原有方式即可。

## 3. 推荐执行方式

### 方式 A：一键脚本

这是最推荐的方式，默认执行稳定自动化检查：

```bash
bash scripts/runVisualConsoleTests.sh
```

或者：

```bash
corepack pnpm test:visual-console
```

默认会执行：

1. `testing-skill:preflight`
2. `vitest run visualConsole`
3. `vitest run cliWorkflow visualConsole`
4. `typecheck`

### 方式 B：逐条执行

如果你想单独定位问题，可以按顺序执行：

```bash
corepack pnpm testing-skill:preflight
corepack pnpm test -- visualConsole
corepack pnpm test -- cliWorkflow visualConsole
corepack pnpm typecheck
```

## 4. 可选 CLI 冒烟

如果你本地已经有真实 artifact，可以在一键脚本后追加真实 CLI 冒烟：

```bash
bash scripts/runVisualConsoleTests.sh --smoke-date 2026-05-01
```

这会额外执行：

```bash
corepack pnpm visual-console -- --view overview --date 2026-05-01
corepack pnpm visual-console -- --view projects --date 2026-05-01
corepack pnpm visual-console -- --view run-health --date 2026-05-01
corepack pnpm visual-console -- --view weekly --anchor-date 2026-05-01
corepack pnpm visual-console -- --view kb --date 2026-05-01 --project openai/codex
```

注意：

- `--smoke-date` 依赖 `data/reports/`、`data/kb/` 等本地 artifact 已存在
- 如果没有对应日期数据，脚本会直接失败，提示你先准备 artifact

## 5. 通过标准

一轮 Visual Console 测试通过，至少应满足：

- `visualConsole.test.ts` 全绿
- `cliWorkflow.test.ts` 中与 Visual Console 相关用例全绿
- `tsc --noEmit` 通过
- 如果执行了 `--smoke-date`，所有 CLI 视图命令都能正常输出

## 6. 失败排查

### `visualConsole` 测试失败

优先检查：

- `src/visualConsole/render.ts`
- `src/visualConsole/build.ts`
- `src/visualConsole/context.ts`
- `src/visualConsole/readLayer.ts`

这类失败通常意味着：

- 状态优先级变了
- Weekly / KB 结构字段变了
- 跨视图上下文丢了
- 只读边界被破坏了

### `cliWorkflow` 测试失败

优先检查：

- `src/cli.ts`
- `src/visualConsole/index.ts`
- 测试中构造的 fixture 是否仍匹配当前渲染格式

这类失败通常意味着：

- CLI 参数行为变了
- `kb` / `knowledge-base` 别名失效
- `weekly -> project -> kb` 的上下文继承断了

### `typecheck` 失败

优先检查：

- Weekly support project 结构
- 新增 view alias 的联合类型
- 测试里手工构造的 fixture 是否缺字段

## 7. 日常建议

- 改 `src/visualConsole/*` 后，至少跑一遍一键脚本
- 改 `src/cli.ts` 的 `visual-console` 参数处理后，务必跑 `cliWorkflow visualConsole`
- 改 Weekly / KB 渲染格式后，最好加一次 `--smoke-date`

## 8. 当前一键入口

- 脚本：`scripts/runVisualConsoleTests.sh`
- 包脚本：`corepack pnpm test:visual-console`
