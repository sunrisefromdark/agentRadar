# 执行计划：Open Code Review 接入 v0.1

## 文档状态

- 版本：`v0.1`
- 当前状态：`Draft`
- 负责人：`Codex`
- 风险等级：`Medium`
- 需求来源：
  - 用户请求：将 `alibaba/open-code-review` 接入当前项目作为代码审查机制，并判断适合的扫描与门禁环节。
  - 外部工具来源：`https://github.com/alibaba/open-code-review`
  - 当前 npm 包元信息：`@alibaba-group/open-code-review@1.7.1`，CLI bin 为 `ocr`。
  - OCR 官方 README / npm readme 中的命令、rule.json、环境变量和 CI 集成契约。
- 设计来源：
  - 本计划内的“设计冻结项”作为轻量设计冻结。
  - 当前没有独立已批准设计文档，因此本计划进入实现前必须先完成 ExecPlan Review；不得把本计划当作已批准实现指令。
- 说明：
  - 本计划只接入 AI 辅助 review 层，不替代 `typecheck`、`test`、人工 code review、现有 `docs/specs/agent-work/codeReviewSkill.md`。
  - 当前工作区可能已有未提交的 OCR 接入草稿；实现阶段只能逐项核对并保留与本计划一致的部分，不得把草稿视为已批准实现。

## 任务信息

| 字段 | 内容 |
| --- | --- |
| 任务名称 | Open Code Review 接入 v0.1 |
| 主要目标 | 在现有本地 hook、CI quality gate 和 code review skill 之上增加可控、可降级、可审计的 AI 代码审查层 |
| 主要影响范围 | `.opencodereview/`、`scripts/openCodeReview.ts`、`package.json`、`.githooks/pre-push`、`.github/workflows/open-code-review.yml`、`docs/specs/agent-work/`、`docs/specs/exec-plans/README.md`、`README.md`、`README.en.md` |
| 不应影响范围 | `src/**` 产品运行逻辑、`app/**` 前端产品逻辑、`data/**` 公开产物、主评分链路、日报/周报生成链路 |
| 交付物 | OCR 规则配置、本地包装脚本、可选本地 pre-push gate、默认关闭的 PR workflow、接入策略文档、验证记录 |

## 目标

在不拖慢日常编码循环、不暴露密钥、不扫描生成/原始数据、不替代现有确定性检查的前提下，把 Open Code Review 接成一个“完成一组改动后、push 或 PR 前”的增量审查层。

一句话产品/工程 framing：

> OCR 是变更完成后的第二双眼睛，不是每次保存代码时的硬闸门，也不是全仓历史代码的持续扫描器。

## 官方 OCR 契约核对

本计划必须服从 Open Code Review 官方契约，而不是按草稿猜测。

- CLI 包：`@alibaba-group/open-code-review@1.7.1`，bin 为 `ocr`。
- 截至 `2026-07-06`，`npm view @alibaba-group/open-code-review version name bin dist-tags --json` 显示 `latest` 为 `1.7.1`；进入实现或 CI 启用前必须重新跑该命令。如果 `latest` 已变化，必须停止并更新本计划，或明确记录“继续固定 1.7.1”的兼容性验证原因。
- 项目规则路径：`<repo>/.opencodereview/rule.json`。
- 规则文件的 `rule` 字段支持指向 `.md` 文件；相对路径从项目根目录解析。
- `ocr review` 是 diff 审查；未指定 `--from/--to/--commit` 时是 workspace mode，会审查 staged、unstaged 和 untracked changes 中未被排除的文件。
- PR CI 必须显式使用 `--from` / `--to`，不得依赖 workspace mode 推断 PR 范围。
- `ocr scan` 是全文件扫描。
- `ocr review --audience agent` 是 Agent 集成推荐命令。
- `ocr review --format json` 可用于 CI 机器可读输出。
- 官方环境变量包括：
  - `OCR_LLM_URL`
  - `OCR_LLM_TOKEN`
  - `OCR_LLM_AUTH_HEADER`
  - `OCR_LLM_EXTRA_HEADERS`
  - `OCR_LLM_MODEL`
  - `OCR_LLM_TIMEOUT`
  - `OCR_USE_ANTHROPIC`
- 官方 built-in provider 也可能读取 provider 原生命名环境变量，例如 `ANTHROPIC_API_KEY`、`OPENAI_API_KEY`；本仓库 CI 契约仍统一使用 `OCR_LLM_*` / `OCR_USE_ANTHROPIC`，provider 原生命名只允许作为个人本地配置路径，不写入 workflow 或团队文档的必需配置。
- 本计划不得引入 OCR 官方未识别的环境变量名作为运行时依赖，例如 `OCR_ANTHROPIC_API_KEY`。
- `include` 不是硬白名单：官方语义中，`include` 主要用于绕过内置默认排除规则；未匹配 `include` 的文件仍可能继续进入后续过滤判断。
- `exclude` 优先于 `include`。硬排除必须通过 rule.json `exclude` 和 wrapper / CI 的 `--exclude` 共同保证。
- `ocr rules check <file>` 和 `ocr review --preview` / `ocr scan --preview` 可用于不调用 LLM 的规则与范围验证。

## 设计冻结项

### 冻结项 1：默认审查对象

- 默认使用 `ocr review` 审查 Git diff。
- 默认不对全仓历史代码做持续扫描。
- `ocr scan` 只用于：
  - 首次接入后的基线审计。
  - 大重构前后的专项扫描。
  - 高风险共享模块的人工触发扫描。

### 冻结项 2：默认门禁位置

- 不接入 `pre-commit`。
- 本地默认快速反馈仍是：
  - `corepack pnpm typecheck`
  - `corepack pnpm test`
- OCR 放在两类位置：
  - 本地 `pre-push` 可选阻断，由环境变量显式开启。
  - PR workflow 默认关闭；启用后先非阻断产出 artifact，稳定后才能切为 blocking。

### 冻结项 3：审查规则来源

- OCR 项目规则必须复用并指向 `docs/specs/agent-work/codeReviewSkill.md`。
- 不另起一套相互冲突的 review 口径。
- OCR 输出只能作为 code review 输入之一，最终 review 仍必须遵守 `codeReviewSkill.md` 的证据规则和 ExecPlan alignment rule。

### 冻结项 4：审查与扫描边界

- 默认 diff review 不做硬白名单，只审查当前 Git diff 中未被排除的受支持文本文件。
- 默认 scan 使用硬 path：
  - `src,scripts,app`
- 文档、workflow、hook、README 的扫描或审查必须是显式传参或 PR diff 触发，不得通过误用 `include` 伪装成硬白名单。
- 默认 hard exclude：
  - `node_modules/**`
  - `dist/**`
  - `tmp/**`
  - `data/**`
  - `github-pages-site/**`
  - `github-profile/**`
  - `.git/**`
  - `.env`
  - `.env.*`
  - `pnpm-lock.yaml`
- 本仓库 OCR 默认服务“代码改动审查”，因此 `data/**` 作为生成/原始/公开数据产物整体排除；如需专项审查数据 schema、seed 或样例数据，必须通过一次性显式命令和 follow-up 计划说明范围。
- `.opencodereview/rule.json` 可以省略 `include`。如确需使用 `include`，必须在注释文档中说明它不是 allow-list，且不得作为限制审查范围的唯一机制。
- `scripts/openCodeReview.ts` 和 CI 命令必须显式传入同一组 hard exclude，确保实现不依赖 rule.json include 语义。
- 调用方额外传入 `--exclude` 时，只能与本仓库 hard exclude 合并；不得替换或移除 hard exclude。任何“覆盖默认排除”的能力都必须另开 follow-up，并默认禁止。
- 任何新增 scan path 或 hard exclude 变更必须在本计划或 follow-up plan 中说明原因。

### 冻结项 5：密钥与外部依赖

- 不把 OCR provider token 写入仓库文件。
- CI 只通过 GitHub Secrets / Variables 映射到 OCR 官方环境变量。
- GitHub Secrets / Variables 命名必须使用 OCR 官方环境变量名：
  - Secret：`OCR_LLM_TOKEN`
  - Variable 或 Secret：`OCR_LLM_URL`
  - Variable：`OCR_LLM_MODEL`
  - Variable：`OCR_USE_ANTHROPIC`
  - 可选 Variable / Secret：`OCR_LLM_AUTH_HEADER`、`OCR_LLM_EXTRA_HEADERS`、`OCR_LLM_TIMEOUT`
- CI 必须固定安装 `@alibaba-group/open-code-review@1.7.1`，除非另开 follow-up 更新版本并记录验证。
- 本地脚本在 OCR CLI 缺失时，非 required 模式必须可跳过；required 模式必须失败。
- fork PR 默认跳过 OCR review，因为 GitHub Secrets 对 fork PR 不可用；跳过时必须输出 notice，不能把缺少 secret 误报为代码失败。
- PR workflow 必须使用 `pull_request`，不得改用 `pull_request_target`，避免把 secrets 暴露给不可信 fork 上下文。
- workflow 的“非阻断”必须覆盖 provider 配置缺失、`ocr llm test` 失败和 `ocr review` 失败：`OCR_REVIEW_BLOCKING != 'true'` 时这些问题只能产生 notice/status artifact，不能让 job 失败；只有 `OCR_REVIEW_BLOCKING == 'true'` 才可失败。
- CI artifact 只上传 `review.json` 和 `status.json`；不得上传 OCR session JSONL、provider request/response 日志、viewer 数据或任何可能包含 prompt / secret / 私有代码上下文的调试包。artifact 必须设置短保留期，例如 `retention-days: 7`。

### 冻结项 6：现有草稿处理

- 当前未提交的 OCR 相关文件只作为待核对草稿。
- 实现阶段必须逐项检查草稿是否符合本计划。
- 若草稿与本计划冲突，以本计划为准，不能把草稿现状反向写成事实标准。

## 非目标

1. 不重构产品代码。
2. 不改变 `src/**`、`app/**` 的运行行为。
3. 不改现有评分、日报、周报、数据产物链路。
4. 不把 OCR 接成 pre-commit 默认阻断。
5. 不让 OCR 成为唯一 review 依据。
6. 不提交任何 LLM token、API key、`.env` 或 provider 私有配置。
7. 不默认上传 OCR 输出到公开发布产物；PR artifact 只作为 CI 工件保留。

## 当前状态

- 需求：`Approved by user request`
- 设计冻结：`Lightweight design capsule approved by user implementation request on 2026-07-06`
- ExecPlan review：`Second-pass review findings applied; implementation alignment self-review passed`
- 实施：`Implemented; local deterministic validation passed; real PR smoke pending provider configuration`
- Git 基线：`main synced to 10d567a; implementation branch codex/open-code-review-integration created`
- 验证：`Local validation passed; OCR CLI unavailable locally, rules check / real OCR preview skipped`

## 本轮 ExecPlan Review 发现

本轮按 `ExecPlan_ReviewSkill.md` 对计划做了一次自审，结论是：计划方向正确，但原稿存在多处会让实现跑偏的高/中风险缺口，已在本版本中补强。

| Severity | Finding | 改进 |
| --- | --- | --- |
| `HIGH` | 原计划把 OCR `include` 写成默认扫描边界，容易被实现者误解成 hard allow-list；官方语义中 `include` 不会排除未匹配文件。 | 新增“官方 OCR 契约核对”，把 hard boundary 改为 wrapper / CI `--exclude` 与 scan `--path`，并要求 preview / rules check 验证。 |
| `HIGH` | 原计划为 Anthropic CI 使用 `OCR_ANTHROPIC_API_KEY`，这不是 OCR 官方环境变量，CI 可能配置成功但 OCR 读不到。 | 统一改为 OCR 官方环境变量：`OCR_LLM_URL`、`OCR_LLM_TOKEN`、`OCR_LLM_MODEL`、`OCR_USE_ANTHROPIC`、可选 `OCR_LLM_AUTH_HEADER` 等。 |
| `MEDIUM` | 原计划没有定义 fork PR secret 不可用时的行为，启用 workflow 后可能误伤外部贡献者。 | Phase 4 明确 fork PR 默认 skip OCR 并输出 notice，不作为失败。 |
| `MEDIUM` | 原验证矩阵偏重 typecheck/test，缺少 OCR 自身无 LLM 的规则和范围验证。 | Phase 6 增加 `ocr rules check`、`ocr review --preview`、`ocr scan --preview`。 |
| `HIGH` | 原计划默认只排除 `data/raw/**`，但本仓库 `data/**` 下包含大量生成/公开数据产物；由于 `include` 不是 hard allow-list，diff review 仍可能误扫数据产物。 | 冻结项 4 改为默认 hard exclude `data/**`，并要求任何数据专项审查通过显式命令和 follow-up 计划说明范围。 |
| `HIGH` | 原计划声称 PR workflow 默认非阻断，但只把 `ocr review` step 设为 `continue-on-error`；provider 配置缺失或 `ocr llm test` 失败仍会让 job 失败。 | 冻结项 5 和 Phase 4 明确：非阻断模式下配置缺失、连通性失败、review 失败都只能产出 notice/status artifact；只有 `OCR_REVIEW_BLOCKING=true` 才失败。 |
| `MEDIUM` | 原计划同时要求 job-level `if` 跳过 fork PR 和输出 GitHub Actions notice，两者在单 job 结构中容易冲突。 | Phase 4 改为显式同仓 review job + fork notice job/step 结构，保证 fork skip 有可见 notice 且不会读取 secrets。 |
| `MEDIUM` | 原计划固定 `1.7.1`，但没有要求实现前再确认 npm latest，计划过期时可能继续按旧契约落地。 | 官方契约核对与 Phase 0 增加版本新鲜度检查；如 latest 变化必须更新计划或记录继续固定版本的验证依据。 |
| `HIGH` | Phase 2 允许调用方显式传入 `--exclude` 后替换 wrapper 默认 hard exclude，可能让 `.env*`、`data/**`、生成站点重新进入审查范围。 | 冻结项 4 和 Phase 2 改为“用户 exclude 只能追加/合并，不能覆盖 hard exclude”，并增加显式 merge 验证。 |
| `HIGH` | OCR 官方允许 `rule` 使用绝对路径读取项目外规则文件；原计划只要求指向 `codeReviewSkill.md`，没有禁止绝对路径、`..` 或 symlink 绕出仓库。 | Phase 1 增加 rule path containment 约束：规则引用必须是仓库内相对路径，禁止绝对路径、路径穿越和仓库外 symlink。 |
| `MEDIUM` | `ocr review` workspace mode 会包含 untracked changes；当前工作区存在未跟踪生成站点目录，若 hard exclude 或文档不严，首次运行容易产生噪音。 | 官方契约核对、Phase 5 和风险记录补充 workspace/untracked 语义；默认 hard exclude 继续覆盖生成站点和 `data/**`。 |
| `MEDIUM` | 在 Codex Desktop 的 PowerShell + WSL UNC 当前目录下运行 `corepack pnpm ...` 会触发 pnpm/UNC 路径问题，导致 preflight 失败但不是计划语义失败。 | Phase 0 和验证记录补充：执行阶段优先在 WSL repo path 下运行 pnpm 命令，或使用仓库脚本包装，避免 Windows UNC cwd。 |

## 阶段进度

| 阶段 | 状态 | 目标 | 完成标志 |
| --- | --- | --- | --- |
| Phase 0：上游门禁、main 基线与草稿核对 | `Completed` | 确认本计划获批，先同步 `main` 最新代码并从最新 `main` 建立实现基线，再清点当前未提交 OCR 草稿 | 用户已批准实施；分支 `codex/open-code-review-integration` 基于 `origin/main` / `10d567a`；草稿核对结果已记录 |
| Phase 1：OCR rule 与 scope 固化 | `Completed` | 落地 `.opencodereview/rule.json`，只依赖 hard exclude 做硬边界 | `rule.json` 可解析，移除 `include`，hard exclude 包含 `data/**`、`.git/**` 等范围 |
| Phase 2：本地包装脚本与 package scripts | `Completed` | 提供 `review / scan / required` 统一入口 | wrapper 支持 optional/required/review/scan/preview，调用方 exclude 只能追加合并，package scripts 已同步 |
| Phase 3：本地 pre-push 可选门禁 | `Completed` | 高风险改动可显式开启 OCR 阻断 | 默认 pre-push 仍只跑 typecheck/test；`AGENT_RADAR_OCR_PRE_PUSH=1` 才运行 required OCR |
| Phase 4：PR workflow 非阻断接入 | `Completed` | PR 可产出 OCR artifact/status artifact | workflow 默认关闭，fork notice 和同仓 review job 分离，official env、final gate、短 artifact retention 已落地 |
| Phase 5：文档与操作策略 | `Completed` | 说明 review/scan/blocking 使用边界 | README、README.en 和 agent-work 文档已同步使用策略 |
| Phase 6：验证、review 与账本收口 | `Completed` | 完成确定性验证和人工 review | typecheck/test/diff-check/preflight/解析与 wrapper smoke 通过；本机缺少 OCR CLI，真实 OCR preview / rules check 记录为 skipped |

## 实施阶段

### Phase 0：上游门禁、main 基线与草稿核对

1. 读取并确认以下前置材料：
   - `docs/specs/exec-plans/ExecPlan_ReviewSkill.md`
   - `docs/specs/agent-work/codeReviewSkill.md`
   - `.githooks/pre-push`
   - `.github/workflows/quality-gate.yml`
   - `package.json`
   - `README.md`
   - `README.en.md`
2. 执行 exec-plan review preflight：
   - `corepack pnpm exec-plan:review:preflight`
   - 在 Windows/Codex Desktop 环境中，如果当前目录是 `\\wsl.localhost\...` UNC path，必须改用 WSL repo path 执行，例如 `wsl -d Ubuntu-22.04 --cd /home/adduser/AgentProjection/agentRadar bash -lc 'corepack pnpm exec-plan:review:preflight'`，避免 pnpm 默认落到 `C:\Windows`。
3. 对本计划做 ExecPlan Review。
4. 重新核对 OCR 上游版本：
   - `npm view @alibaba-group/open-code-review version name bin dist-tags --json`
   - 如果 `dist-tags.latest` 不再是 `1.7.1`，不得继续按本计划实现；必须更新“官方 OCR 契约核对”、CI pin、验证矩阵和风险记录，或明确记录继续固定 `1.7.1` 的原因与兼容性验证。
5. 在实现任何 OCR 功能前，先处理 Git 基线：
   - 运行 `git status --short --branch`，记录当前分支、ahead/behind 状态和未提交文件。
   - 若工作区仍有未提交计划文档、OCR 草稿或用户改动，不得直接切分支或 pull；必须先通过明确的保留方式保护这些改动，例如提交到当前工作分支、只 stash 本任务相关文件，或等待用户确认。
   - 不得 stash、移动或覆盖与本任务无关的用户文件，例如现有未跟踪的 `github-pages-site/`、`github-profile/`。
6. 同步最新 `main`：
   - `git fetch origin main`
   - 如果本地已有 `main`：`git switch main`，然后 `git pull --ff-only origin main`。
   - 如果本地没有 `main`：`git switch --track origin/main`。
   - 如果 `main` 无法 fast-forward，停止并记录阻塞原因，不得用 merge commit 或 force reset 代替。
7. 从最新 `main` 建立实现分支：
   - 默认分支名：`codex/open-code-review-integration`。
   - 如果分支已存在，必须确认它是否已经基于最新 `main`；未确认前不得继续实现。
   - OCR 功能实现、文档同步和草稿 re-apply 都必须发生在这个基于最新 `main` 的分支上。
8. 清点当前未提交 OCR 草稿文件：
   - `.opencodereview/rule.json`
   - `scripts/openCodeReview.ts`
   - `.github/workflows/open-code-review.yml`
   - `docs/specs/agent-work/open-code-review.md`
   - `package.json`
   - `.githooks/pre-push`
   - `README.md`
   - `README.en.md`
9. 输出草稿核对结果：
   - `keep`：完全符合本计划，可保留。
   - `modify`：部分符合，需按本计划修改。
   - `remove`：不符合本计划，应删除或改为 follow-up。
10. 未完成 Phase 0 前不得继续实施 Phase 1-6。

验收：

- 本计划审查结果为 `APPROVE` 或 `APPROVE_WITH_NITS`。
- 用户明确接受本计划内的 lightweight design capsule；否则不得把计划中的设计冻结项当作已批准实现指令。
- 实现分支明确基于最新 `main`。
- 若审查为 `REQUEST_CHANGES`，先修改本计划。
- 若审查为 `BLOCK`，不得实施 OCR 接入。

### Phase 1：OCR rule 与 scope 固化

1. 新增或修正 `.opencodereview/rule.json`。
2. `exclude` 必须严格符合“设计冻结项 4”的 hard exclude。
3. `rules` 必须指向 `docs/specs/agent-work/codeReviewSkill.md`。
4. `merge_system_rule` 必须为 `true`，以保留 OCR 自身系统规则并追加本仓库 review 约束。
5. `rule` 文件路径必须是仓库内相对路径：
   - 禁止绝对路径。
   - 禁止 `..` 路径穿越。
   - 禁止通过 symlink 指向仓库外文件。
   - 默认唯一允许的 markdown rule 源是 `docs/specs/agent-work/codeReviewSkill.md`。
6. 不在 rule 文件中写入 provider token、模型名、URL 或任何私有配置。
7. 默认不得使用 `include` 来表达“只审查这些目录”。如果保留 `include`，必须同时：
   - 在 `docs/specs/agent-work/open-code-review.md` 说明 OCR 官方 `include` 不是硬白名单。
   - 在 wrapper 和 CI 中继续传入 hard exclude。
8. 增加规则预览验证入口：
   - `ocr rules check src/cli.ts`
   - `ocr rules check scripts/openCodeReview.ts`
   - `ocr rules check docs/specs/agent-work/codeReviewSkill.md`
   - 如果本地未安装 `ocr`，这些命令记录为 skipped，不作为实现阻塞。

验收：

- `.opencodereview/rule.json` 可被 `JSON.parse` 解析。
- rule 文件没有 `.env`、token、URL secret、private diagnostics。
- rule 文件中的 markdown rule 引用没有绝对路径、`..` 或仓库外 symlink。
- rule 文件没有把 `data/**`、`dist/**`、`tmp/**` 纳入默认审查或扫描。
- rule 文件没有把 `include` 当作限制审查范围的唯一机制。

### Phase 2：本地包装脚本与 package scripts

1. 新增或修正 `scripts/openCodeReview.ts`。
2. 包装脚本必须支持：
   - `review`
   - `scan`
   - `--preview`
   - `--required`
   - 透传 OCR 原生参数。
3. `review` 默认调用：
   - `ocr review --audience agent`
4. `review` 必须始终追加 hard exclude：
   - `node_modules/**,dist/**,tmp/**,data/**,github-pages-site/**,github-profile/**,.git/**,.env,.env.*,pnpm-lock.yaml`
   - 如果调用方显式传入 `--exclude`，wrapper 必须把调用方 exclude 与 hard exclude 合并；不得用调用方 exclude 替换 hard exclude。
   - 如果后续引入 `OCR_REVIEW_EXCLUDES` 或类似环境变量，它也只能追加额外排除，不能覆盖 hard exclude。
5. `scan` 默认限制为：
   - `src,scripts,app`
   - 排除 `node_modules/**,dist/**,tmp/**,data/**,github-pages-site/**,github-profile/**,.git/**,.env,.env.*,pnpm-lock.yaml`
   - 设置明确 token budget，避免误扫全仓。
   - 如果调用方显式传入 `--exclude`，也必须与 hard exclude 合并。
6. `--preview` 行为：
   - `review --preview` 必须透传为 `ocr review --preview`。
   - `scan --preview` 必须透传为 `ocr scan --preview`。
   - preview 不调用 LLM，用于验证范围。
7. OCR CLI 缺失行为：
   - optional 模式：输出清晰提示并退出 `0`。
   - required 模式：输出清晰提示并退出非零。
8. `package.json` 增加：
   - `code-review:ocr`
   - `code-review:ocr:required`
   - `code-review:ocr:scan`
9. 不把 `@alibaba-group/open-code-review` 加为生产 dependency；本地由开发者全局安装或通过自定义 `OCR_BIN` 指定。

验收：

- `corepack pnpm code-review:ocr` 在未安装 `ocr` 时不阻断。
- `corepack pnpm code-review:ocr:required` 在未安装 `ocr` 时失败。
- `corepack pnpm code-review:ocr -- --preview` 在安装 OCR CLI 的环境中只预览范围，不调用 LLM。
- `corepack pnpm code-review:ocr -- --exclude src/generated/** --preview` 仍然保留 `data/**`、`.env*`、生成站点和 lockfile 等 hard exclude。
- `corepack pnpm typecheck` 通过。

### Phase 3：本地 pre-push 可选门禁

1. 修改 `.githooks/pre-push`。
2. 默认行为保持：
   - 先运行 `corepack pnpm typecheck`
   - 再运行 `corepack pnpm test`
3. 只有当 `AGENT_RADAR_OCR_PRE_PUSH=1` 时，才运行：
   - `corepack pnpm code-review:ocr:required`
4. 不修改 `.githooks/pre-commit` 来运行 OCR。
5. 不让 OCR failure 在默认 push 路径中阻断开发者。

验收：

- 未设置 `AGENT_RADAR_OCR_PRE_PUSH` 时，pre-push 不调用 OCR。
- 设置 `AGENT_RADAR_OCR_PRE_PUSH=1` 且未安装 OCR CLI 时，pre-push 在 OCR 步骤失败。
- `pre-commit` 无 OCR 调用。

### Phase 4：PR workflow 非阻断接入

1. 新增 `.github/workflows/open-code-review.yml`。
2. 触发时机：
   - `pull_request` 的 `opened`
   - `synchronize`
   - `reopened`
   - `ready_for_review`
3. workflow 默认关闭：
   - 所有 OCR 相关 job 必须受 `vars.OCR_REVIEW_ENABLED == 'true'` 约束。
   - 不启用时不得安装 OCR、不得读取 OCR secrets、不得上传空 artifact。
4. 触发安全：
   - workflow 必须使用 `pull_request`。
   - 不得使用 `pull_request_target`。
   - 权限保持最小化，默认只需要 `contents: read`。
5. fork PR 策略：
   - 推荐结构为两个 job：
     - `ocr-fork-notice`：当 `vars.OCR_REVIEW_ENABLED == 'true' && github.event.pull_request.head.repo.full_name != github.repository` 时运行，只输出 GitHub Actions notice 并成功退出。
     - `ocr-review`：当 `vars.OCR_REVIEW_ENABLED == 'true' && github.event.pull_request.head.repo.full_name == github.repository` 时运行，才安装 OCR、读取 secrets / variables、执行 review。
   - 如果实现为单 job，也必须对读取 secrets、安装 OCR、调用 OCR 的每个 step 加同仓 PR 条件；不能用 job-level skip 造成 fork PR 没有 notice。
   - fork PR 跳过 OCR 不得导致 workflow 失败。
6. 默认非阻断：
   - `OCR_REVIEW_BLOCKING` 未设置或不等于 `true` 时，provider 配置缺失、`ocr llm test` 失败、`ocr review` 失败都必须转为 notice/status artifact，job 退出 `0`。
   - 只有 `vars.OCR_REVIEW_BLOCKING == 'true'` 时，provider 配置缺失、`ocr llm test` 失败或 `ocr review` 失败才允许让 job 非零退出。
   - 不得只依赖单个 review step 的 `continue-on-error` 来表达非阻断；必须有明确的 final gate step 依据 `OCR_REVIEW_BLOCKING` 判定失败或成功。
7. Provider 配置必须只使用 OCR 官方环境变量：
   - `OCR_LLM_URL`
   - `OCR_LLM_TOKEN`
   - `OCR_LLM_MODEL`
   - `OCR_USE_ANTHROPIC`
   - 可选：`OCR_LLM_AUTH_HEADER`、`OCR_LLM_EXTRA_HEADERS`、`OCR_LLM_TIMEOUT`
   - 任何 secret 都不得写入日志。
   - 不得使用 `OCR_ANTHROPIC_API_KEY` 作为 OCR 运行时变量。
   - 不得照抄与当前 OCR env reference 冲突的旧示例变量名；如官方未来新增 alias，必须先通过 `npm view`/源码核对并更新本计划。
   - `OCR_LLM_TOKEN` 必须来自 GitHub Secret。
   - `OCR_LLM_URL` 可来自 Variable 或 Secret；实现必须选择一种清晰映射，不得同时要求两处都配置。
   - `OCR_LLM_MODEL` 和 `OCR_USE_ANTHROPIC` 默认来自 GitHub Variables；如改用 Secret，必须在文档中同步说明。
8. 安装：
   - `npm install -g @alibaba-group/open-code-review@1.7.1`
   - 安装后运行 `ocr version` 或等价命令记录实际版本；如不是 `1.7.1`，按 blocking 规则处理。
9. 连通性：
   - 在 review 前运行 `ocr llm test`。
   - 失败时按第 6 条 blocking / non-blocking 规则处理。
10. 审查范围：
   - `--from github.event.pull_request.base.sha`
   - `--to github.event.pull_request.head.sha`
   - `--audience agent`
   - `--format json`
   - 与 Phase 2 相同的 hard exclude。
   - CI 中调用方不得传入能覆盖 hard exclude 的 `--exclude`；如要额外排除，只能追加合并。
11. artifact：
   - 写入 `artifacts/open-code-review/review.json`
   - 写入 `artifacts/open-code-review/status.json` 记录 `skipped`、`config_failed`、`llm_test_failed`、`review_failed` 或 `review_passed`
   - 上传 artifact 名称 `open-code-review`
   - artifact retention 必须显式设置短保留期，例如 `retention-days: 7`。
   - `review.json` 只能包含 OCR `--format json` stdout；配置错误、skip 原因和 wrapper 日志只能进入 `status.json` 或 stderr，不得混入 `review.json`。
   - 不得上传 OCR session JSONL、viewer 数据或 provider request/response 调试文件。
12. 为保持 JSON artifact 干净，不得通过会向 stdout 注入 package-manager banner 的命令包裹 OCR JSON 输出。
13. CI 首选直接调用全局安装的 `ocr`，避免仅为 wrapper 安装项目依赖和触发 package-manager banner。
14. 如果通过本地包装脚本运行，包装脚本的日志必须写到 stderr，stdout 只能保留 OCR JSON。

验收：

- workflow YAML 可解析。
- `OCR_REVIEW_ENABLED` 未设置时 workflow 不运行 OCR job。
- fork PR 有 notice、跳过 OCR 且不失败。
- provider 配置缺失时信息明确且不泄露 secret；非 blocking 模式不失败，blocking 模式失败。
- `ocr llm test` 失败时信息明确；非 blocking 模式不失败，blocking 模式失败。
- workflow 不引用 `OCR_ANTHROPIC_API_KEY`。
- `review.json` 只包含 OCR JSON 输出，不包含 `pnpm` script banner、wrapper 日志或错误说明；状态说明进入 `status.json`。
- workflow 设置 artifact retention，且不上传 OCR session/provider 调试日志。

### Phase 5：文档与操作策略

1. 新增或修正 `docs/specs/agent-work/open-code-review.md`。
2. 文档必须说明：
   - 默认使用 `review`，不是 `scan`。
   - `scan` 只用于基线/重构/高风险专项。
   - 不放在 `pre-commit`。
   - 本地 pre-push OCR 默认关闭。
   - PR workflow 默认关闭，先非阻断。
   - 如何配置 OCR 官方 Secrets / Variables。
   - `ocr review` 的 workspace mode 会包含 staged、unstaged 和 untracked changes；PR CI 使用 `--from` / `--to` 固定审查范围。
   - OCR 官方 `include` 不是硬白名单；本仓库硬边界来自 hard exclude 和 scan `--path`。
   - 调用方额外 `--exclude` 只能追加，不能移除 hard exclude。
   - 默认 hard exclude 包含 `data/**`，OCR 默认只服务代码改动审查；数据专项审查必须显式触发。
   - fork PR 默认跳过 OCR。
   - PR workflow 默认非阻断；配置缺失、LLM 连通性失败和 review 失败在非 blocking 模式下都只产出 notice/status artifact。
   - Anthropic 或其他 provider 也必须映射到 OCR 官方环境变量，不使用 `OCR_ANTHROPIC_API_KEY`。
3. 更新 `README.md` 和 `README.en.md` 的常用命令区域。
4. 更新 `docs/specs/exec-plans/README.md` 索引，加入本计划。
5. 不在 README 中承诺 OCR 会自动修复代码。

验收：

- README 中的命令与 `package.json` scripts 一致。
- agent-work 文档与本计划的冻结项一致。
- exec-plan index 状态为 `Draft` 或 `Proposed`，不得写成 `Done`。

### Phase 6：验证、review 与账本收口

1. 运行静态验证：
   - `corepack pnpm typecheck`
   - `corepack pnpm test`
   - `git diff --check`
2. 运行 OCR 包装脚本验证：
   - `corepack pnpm code-review:ocr`
   - `corepack pnpm code-review:ocr:required`
   - `corepack pnpm code-review:ocr -- --preview`
   - `corepack pnpm code-review:ocr:scan -- --preview`
3. 在未安装 OCR CLI 的环境中，记录：
   - `OCR_BIN=__missing_ocr__ corepack pnpm code-review:ocr` 应退出 `0`。
   - `OCR_BIN=__missing_ocr__ corepack pnpm code-review:ocr:required` 应退出非零。
4. 解析配置：
   - `.opencodereview/rule.json` 可 JSON parse。
   - rule markdown 引用必须解析为仓库内路径，不得包含绝对路径、`..` 或仓库外 symlink。
   - `.github/workflows/open-code-review.yml` 可 YAML parse。
   - workflow 不包含 `pull_request_target`。
   - workflow 不包含 `OCR_ANTHROPIC_API_KEY`。
   - workflow 包含 `OCR_REVIEW_ENABLED`、`OCR_REVIEW_BLOCKING`、fork notice 逻辑和 final gate 逻辑。
   - workflow artifact 使用短 retention，且不上传 OCR session/provider 调试文件。
5. 重新核对 OCR 版本：
   - `npm view @alibaba-group/open-code-review version name bin dist-tags --json`
   - 如果本地安装了 OCR CLI，再运行 `ocr version` 或等价命令确认实际版本。
6. 如果 OCR CLI 可用，运行规则和范围预览：
   - `ocr rules check src/cli.ts`
   - `ocr rules check scripts/openCodeReview.ts`
   - `ocr review --preview --audience agent --exclude <hard-exclude-csv>`
   - `ocr review --preview --audience agent --exclude <extra-exclude>` 通过 wrapper 运行时仍合并 hard exclude。
   - `ocr scan --preview --path src,scripts,app --exclude <hard-exclude-csv>`
   - preview 输出不得包含 `data/**`、`dist/**`、`tmp/**`、生成站点、`.env*` 或 `pnpm-lock.yaml`。
7. 执行 code review preflight：
   - `corepack pnpm code-review:preflight`
8. 按 `docs/specs/agent-work/codeReviewSkill.md` 对实现 diff 做代码审查。
9. 更新本计划：
   - 阶段进度。
   - 已落地内容。
   - 验证记录。
   - 残余风险。
   - 结论记录。

验收：

- 所有确定性检查通过，或明确记录阻塞原因。
- 代码审查结论不是 `REQUEST_CHANGES` 或 `BLOCK`。
- OCR 接入不修改产品运行逻辑。

## 验收标准

1. OCR 默认审查 diff，不默认全仓扫描。
2. `ocr scan` 有明确使用场景和扫描边界。
3. OCR 不接入默认 `pre-commit`。
4. 默认 `pre-push` 仍只强制 `typecheck` 和 `test`。
5. 本地 OCR pre-push gate 只能由 `AGENT_RADAR_OCR_PRE_PUSH=1` 开启。
6. PR workflow 默认由 `OCR_REVIEW_ENABLED=true` 开启。
7. PR OCR 默认非阻断；provider 配置缺失、LLM 连通性失败和 review 失败都只有在 `OCR_REVIEW_BLOCKING=true` 时才阻断。
8. OCR provider 配置只来自 secrets / variables，不进入仓库文件。
9. OCR rule 复用 `docs/specs/agent-work/codeReviewSkill.md`。
10. 默认 hard exclude 排除 `.env*`、`data/**`、`dist/**`、`tmp/**`、生成站点、`.git/**`、`pnpm-lock.yaml` 和 `node_modules/**`。
11. CI 固定安装 `@alibaba-group/open-code-review@1.7.1`。
12. README、agent-work 文档和 package scripts 互相一致。
13. 实现 diff 可被 code review skill 映射回本 ExecPlan。
14. `corepack pnpm typecheck` 与 `corepack pnpm test` 通过。
15. 计划和实现不得把 OCR `include` 当作硬白名单。
16. CI workflow 不引用 `OCR_ANTHROPIC_API_KEY`。
17. fork PR 默认跳过 OCR 且不失败。
18. 在 OCR CLI 可用的环境中，preview / rules check 能证明规则和范围符合预期。
19. PR workflow 不使用 `pull_request_target`。
20. `review.json` 保持 OCR JSON stdout 纯净；skip / failed / notice 状态写入 `status.json`。
21. 调用方自定义 `--exclude` 只能追加，不能绕过 `.env*`、`data/**`、生成站点、lockfile 等 hard exclude。
22. `.opencodereview/rule.json` 的 markdown rule 引用必须保持在仓库内，不能通过绝对路径、`..` 或 symlink 读取仓库外规则。
23. 文档明确 `ocr review` workspace mode 会包含 untracked changes，PR CI 通过 `--from` / `--to` 固定范围。
24. PR artifact 设置短保留期，且不上传 OCR session/provider 调试日志。

## 验证矩阵

| 文件或机制 | 验证内容 | 验证方式 | 通过标准 |
| --- | --- | --- | --- |
| `.opencodereview/rule.json` | hard exclude、规则路径、官方 include 语义、rule path containment | JSON parse + 人工 diff review + rule path parse + `ocr rules check` | 指向 `codeReviewSkill.md`，默认排除 `data/**` 等生成/敏感范围，不把 `include` 当 hard allow-list，不引用仓库外 rule |
| `scripts/openCodeReview.ts` | optional / required / review / scan / preview / exclude merge 行为 | `corepack pnpm code-review:ocr`、`OCR_BIN=__missing_ocr__ corepack pnpm code-review:ocr`、`OCR_BIN=__missing_ocr__ corepack pnpm code-review:ocr:required`、preview 命令、显式 extra `--exclude` merge smoke、`corepack pnpm typecheck` | CLI 缺失时 optional 跳过、required 失败；review/scan 都合并 hard exclude；调用方 exclude 不能覆盖 hard exclude；preview 不调用 LLM；类型检查通过 |
| `package.json` | scripts 入口 | `corepack pnpm run` 或人工 diff review | scripts 与 README 命令一致 |
| `.githooks/pre-push` | 默认不跑 OCR，可显式开启 | 人工 diff review；必要时临时环境变量 smoke | 默认路径只跑 typecheck/test；env 开启后跑 required |
| `.github/workflows/open-code-review.yml` | 默认关闭、非阻断、official OCR env、fork PR notice、artifact 纯净度、artifact retention | YAML parse + 人工 diff review + forbidden-string scan | gated by `OCR_REVIEW_ENABLED`，blocking final gate by `OCR_REVIEW_BLOCKING`，fork PR 有 notice 且不读 secrets，不引用 `OCR_ANTHROPIC_API_KEY`，不使用 `pull_request_target`，不上传 session/provider 调试日志 |
| README / agent-work 文档 | 使用策略一致 | 人工 diff review | 不把 scan 或 blocking 描述成默认路径，说明 workspace/untracked 语义、include 非 allow-list、`data/**` 默认排除、fork PR skip、非 blocking 失败语义 |
| OCR preview | 规则和范围不调用 LLM 验证 | `ocr review --preview`、`ocr scan --preview`、`ocr rules check` | hard exclude 生效，preview 不包含 `data/**` / `.env*` / lockfile / build output，规则命中 `codeReviewSkill.md` |
| 全仓 | 不影响产品逻辑 | `corepack pnpm typecheck`、`corepack pnpm test` | 全部通过 |
| 实现 diff | ExecPlan alignment | `corepack pnpm code-review:preflight` + code review | 无未映射到本计划的实现行为 |

## 风险与回滚策略

### 风险 1：AI review 误报导致开发节奏变慢

- 预防：
  - 不接入 pre-commit。
  - pre-push 默认关闭 OCR。
  - PR workflow 先非阻断。
- 回滚：
  - 关闭 `OCR_REVIEW_ENABLED`。
  - 保留本地手动命令，不影响 `typecheck` / `test`。

### 风险 2：全仓扫描成本过高或噪音过大

- 预防：
  - 默认走 `ocr review`。
  - `ocr scan` 限制默认 path 和 token budget。
  - 默认 hard exclude 覆盖 `data/**`、构建产物、临时目录、生成站点、`.env*` 和 lockfile。
- 回滚：
  - 移除或隐藏 `code-review:ocr:scan` 文档入口，保留 review。

### 风险 3：密钥泄漏

- 预防：
  - 不在仓库写 provider token。
  - workflow 只读 GitHub Secrets / Variables。
  - 默认 exclude `.env*`。
  - fork PR 默认跳过 OCR，避免向不可信上下文暴露 secrets。
- 回滚：
  - 立即关闭 `OCR_REVIEW_ENABLED`。
  - 轮换相关 provider token。
  - 检查 artifact 和 logs。

### 风险 4：OCR 版本漂移

- 预防：
  - CI 固定安装 `@alibaba-group/open-code-review@1.7.1`。
  - Phase 0 和 Phase 6 都重新运行 `npm view @alibaba-group/open-code-review version name bin dist-tags --json`。
  - CI 安装后记录 `ocr version` 或等价版本输出。
  - 版本升级必须单独记录。
- 回滚：
  - 固定回上一版本。
  - 保留 workflow 关闭开关。

### 风险 5：实现草稿绕过计划

- 预防：
  - Phase 0 必须清点草稿并输出 keep/modify/remove。
  - code review 必须检查每个 diff 是否映射到本计划。
- 回滚：
  - 对不符合计划的 OCR 草稿文件逐项回退或改为 follow-up。

### 风险 6：实现基线不是最新 main

- 预防：
  - Phase 0 必须先 `git fetch origin main` 并通过 fast-forward 同步 `main`。
  - 功能实现必须发生在基于最新 `main` 的 `codex/open-code-review-integration` 分支上。
  - 当前 `develop-branch` 上的草稿不能直接视为最终实现基线。
- 回滚：
  - 停止实现。
  - 重新同步 `main`。
  - 只把符合本计划的改动重新应用到最新 `main` 派生分支。

### 风险 7：误解 OCR include 语义导致扫描边界失效

- 预防：
  - 本计划明确 `include` 不是 hard allow-list。
  - hard boundary 必须来自 wrapper / CI 的 `--exclude` 和 scan `--path`。
  - Phase 6 使用 `ocr review --preview`、`ocr scan --preview` 和 `ocr rules check` 做无 LLM 验证。
- 回滚：
  - 移除 rule.json 中的 `include`。
  - 保留 hard exclude 和 scan path。
  - 重新运行 preview 验证。

### 风险 8：CI 使用 OCR 未识别的环境变量

- 预防：
  - workflow 只映射 OCR 官方环境变量。
  - 不使用 `OCR_ANTHROPIC_API_KEY`。
  - `ocr llm test` 在 review 前执行。
  - 非 blocking 模式下配置缺失和 `ocr llm test` 失败只产出 notice/status artifact，不使 job 失败。
- 回滚：
  - 关闭 `OCR_REVIEW_ENABLED`。
  - 修正 GitHub Secrets / Variables 命名。
  - 重新运行 CI smoke。

### 风险 9：fork PR 因 secret 不可用失败

- 预防：
  - fork PR 默认 skip OCR。
  - skip 输出 notice，不作为失败。
- 回滚：
  - 临时关闭 `OCR_REVIEW_ENABLED`。
  - 只在 trusted branch / internal PR 上启用 OCR。

### 风险 10：PR workflow 名义非阻断但实际阻断

- 预防：
  - 不只依赖单个 step 的 `continue-on-error`。
  - 配置检查、`ocr llm test`、review 三类失败都写入 `status.json`。
  - final gate 只在 `OCR_REVIEW_BLOCKING=true` 时非零退出。
- 回滚：
  - 关闭 `OCR_REVIEW_ENABLED`。
  - 将 workflow 恢复为手动本地命令，保留 `.opencodereview/rule.json` 和 wrapper。

### 风险 11：调用方 exclude 覆盖硬排除

- 预防：
  - wrapper 和 CI 只能把额外 exclude 与 hard exclude 合并。
  - Phase 6 增加显式 extra `--exclude` preview smoke。
- 回滚：
  - 临时禁用 wrapper 的自定义 `--exclude` 透传。
  - 保留 rule.json hard exclude 并重新运行 preview。

### 风险 12：规则文件读取仓库外内容或 artifact 泄露调试上下文

- 预防：
  - rule markdown 引用必须解析在仓库内，禁止绝对路径、`..` 和仓库外 symlink。
  - CI artifact 只上传 `review.json` / `status.json`，设置短 retention，不上传 OCR session JSONL 或 provider 调试日志。
- 回滚：
  - 关闭 `OCR_REVIEW_ENABLED`。
  - 删除有问题的 artifact，轮换可能暴露的 provider token。
  - 修正 rule path 后重新跑 preview / rules check。

### 风险 13：Windows UNC 执行环境导致门禁误失败

- 预防：
  - Codex Desktop / Windows 环境中优先通过 WSL repo path 执行 `corepack pnpm ...`。
  - 验证记录必须区分“环境路径失败”和“计划/实现失败”。
- 回滚：
  - 切换到 WSL shell 重新执行相同命令。
  - 必要时使用仓库内脚本包装 pnpm 入口。

## 边界与归属

### 允许修改

- `.opencodereview/rule.json`
- `scripts/openCodeReview.ts`
- `package.json`
- `.githooks/pre-push`
- `.github/workflows/open-code-review.yml`
- `docs/specs/agent-work/open-code-review.md`
- `docs/specs/exec-plans/open-code-review-integration-v0.1.exec-plan.md`
- `docs/specs/exec-plans/README.md`
- `README.md`
- `README.en.md`

### 禁止修改

- `src/**` 产品逻辑。
- `app/**` 产品 UI 逻辑。
- `data/**` 公开数据产物。
- `.env`、`.env.local`、`.env.example` 中加入真实 provider token。
- 现有 `quality-gate.yml` 的 typecheck/test 语义。
- `.githooks/pre-commit` 增加 OCR 阻断。

## 已落地内容

### Phase 0：草稿核对结果

| 文件 | 处理 | 结果 |
| --- | --- | --- |
| `.opencodereview/rule.json` | `modify` | 移除误导性 `include`，将 `data/raw/**` 扩大为 `data/**`，补入 `.git/**`，保留 `codeReviewSkill.md` rule |
| `scripts/openCodeReview.ts` | `modify` | 新增 hard exclude 合并、pnpm `--` 分隔符清理、review/scan 默认边界、optional/required 缺 CLI 行为 |
| `.github/workflows/open-code-review.yml` | `modify` | 从单 job 草稿改为 fork notice + 同仓 review，官方 env、固定版本、final gate、status/review artifact 和 retention 均已落地 |
| `docs/specs/agent-work/open-code-review.md` | `modify` | 重写为执行策略文档，说明 workspace mode、include 语义、hard exclude、fork skip、非阻断和官方 env |
| `package.json` | `keep` | OCR scripts 已存在且符合计划，未新增 OCR production dependency |
| `.githooks/pre-push` | `keep` | 已符合默认 typecheck/test，且仅在 `AGENT_RADAR_OCR_PRE_PUSH=1` 时运行 required OCR |
| `README.md` | `modify` | 常用命令加入 OCR review/required/scan 与默认排除边界 |
| `README.en.md` | `modify` | 同步英文常用命令与默认排除边界 |
| `docs/specs/exec-plans/README.md` | `keep` | 索引已有本计划且状态保持 `Draft`，未写成 `Done` |

### Phase 1-6：实现摘要

- `.opencodereview/rule.json` 固化 hard exclude 和 `codeReviewSkill.md` rule。
- `scripts/openCodeReview.ts` 统一本地 OCR 入口，确保 extra `--exclude` 只能追加，不能覆盖 `.env*`、`data/**`、生成站点、lockfile 等 hard exclude。
- `.github/workflows/open-code-review.yml` 默认由 `OCR_REVIEW_ENABLED=true` 开启，fork PR 只输出 notice，同仓 PR 才读取 secrets 并运行 OCR。
- PR workflow 在非 blocking 模式下把 provider 配置缺失、`ocr llm test` 失败和 review 失败写入 `status.json` 并成功退出；只有 `OCR_REVIEW_BLOCKING=true` 时 final gate 失败。
- PR artifact 只包含 `review.json` / `status.json`，并设置 `retention-days: 7`。
- README、README.en 和 agent-work 文档与 package scripts 保持一致。

## 验证记录

| 日期 | 命令 | 结果 | 备注 |
| --- | --- | --- | --- |
| 2026-07-06 | `npm view @alibaba-group/open-code-review version name bin --json` | `Pass` | 当前版本 `1.7.1`，bin 为 `ocr` |
| 2026-07-06 | `npm view @alibaba-group/open-code-review readme --json` | `Pass` | 已核对官方 `rule.json`、`include/exclude`、`ocr review/scan`、CI env 与 preview/rules check 契约 |
| 2026-07-06 | `npm view @alibaba-group/open-code-review version name bin dist-tags --json` | `Pass` | 当前 `latest` 仍为 `1.7.1`，bin 为 `ocr` |
| 2026-07-06 | `npm view @alibaba-group/open-code-review readme \| rg ...` | `Pass` | 再次核对 workspace review、`--from/--to`、`--format json`、`--preview`、`rules check`、`include/exclude`、官方 env reference |
| 2026-07-06 | `git fetch origin main && git switch main && git pull --ff-only origin main` | `Pass` | `main` fast-forward 到 `10d567a` |
| 2026-07-06 | `git switch -c codex/open-code-review-integration && git stash apply 'stash@{0}'` | `Pass` | 已从最新 `main` 建立功能分支并应用 OCR/ExecPlan 草稿；未产生冲突 |
| 2026-07-06 | conflict marker scan | `Pass` | 未发现 `<<<<<<<`、`=======`、`>>>>>>>` 冲突标记 |
| 2026-07-06 | `git diff --check -- <OCR/ExecPlan paths>` | `Pass` | 无 whitespace error |
| 2026-07-06 | `corepack pnpm exec-plan:review:preflight` | `Pass` | exec-plan review skill and receipt verified |
| 2026-07-06 | PowerShell UNC cwd 下 `corepack pnpm exec-plan:review:preflight` | `Env Issue` | pnpm 在 `\\wsl.localhost\...` cwd 下回退到 `C:\Windows` 并失败；改用 WSL repo path 后通过 |
| 2026-07-06 | `wsl -d Ubuntu-22.04 --cd /home/adduser/AgentProjection/agentRadar bash -lc 'corepack pnpm exec-plan:review:preflight'` | `Pass` | exec-plan review skill and receipt verified |
| 2026-07-06 | `Select-String ... '\s+$'` | `Pass` | 本计划文档未发现尾随空白 |
| 2026-07-06 | second-pass ExecPlan audit | `Pass` | 已补强 exclude merge、rule path containment、workspace/untracked 语义、artifact retention/privacy、Windows UNC 执行说明 |
| 2026-07-06 | ExecPlan self-review | `Pass` | 已补强 include 语义、official env、`data/**` hard exclude、fork PR notice、非 blocking final gate、preview/rules check 验证 |
| 2026-07-06 | `wsl -d Ubuntu-22.04 --cd /home/adduser/AgentProjection/agentRadar bash -lc 'corepack pnpm code-implementation:preflight'` | `Pass` | implementation skill and exec-plan receipt verified |
| 2026-07-06 | `wsl -d Ubuntu-22.04 --cd /home/adduser/AgentProjection/agentRadar bash -lc 'git fetch origin main && ... && git merge-base --is-ancestor origin/main HEAD'` | `Pass` | 当前分支 `codex/open-code-review-integration`，HEAD 与 `origin/main` 均为 `10d567a` |
| 2026-07-06 | `node -e "JSON.parse(... .opencodereview/rule.json ...)"` | `Pass` | OCR rule JSON 可解析 |
| 2026-07-06 | rule path containment Node check | `Pass` | `docs/specs/agent-work/codeReviewSkill.md` 解析在仓库内，无绝对路径、`..` 或仓库外 symlink |
| 2026-07-06 | YAML parse via `js-yaml` | `Pass` | `.github/workflows/open-code-review.yml` 可解析 |
| 2026-07-06 | workflow forbidden-string scan | `Pass` | workflow 不包含 `pull_request_target`、`OCR_ANTHROPIC_API_KEY`、session/provider 调试上传关键词 |
| 2026-07-06 | `OCR_BIN=__missing_ocr__ corepack pnpm code-review:ocr` | `Pass` | 缺 CLI 时 optional review 清晰提示并退出 `0` |
| 2026-07-06 | `OCR_BIN=__missing_ocr__ corepack pnpm code-review:ocr:required` | `Pass` | 缺 CLI 时 required review 退出 `1`，符合预期 |
| 2026-07-06 | `OCR_BIN=__missing_ocr__ corepack pnpm code-review:ocr -- --preview` | `Pass` | 本机缺 CLI，optional preview 清晰提示并跳过 |
| 2026-07-06 | `OCR_BIN=__missing_ocr__ corepack pnpm code-review:ocr:scan -- --preview` | `Pass` | 本机缺 CLI，optional scan preview 清晰提示并跳过 |
| 2026-07-06 | `OCR_BIN=echo corepack pnpm code-review:ocr -- --exclude src/generated/** --preview` | `Pass` | 输出参数包含 hard exclude 和额外 exclude，且不再透传 pnpm `--` 分隔符 |
| 2026-07-06 | `OCR_BIN=echo corepack pnpm code-review:ocr:scan -- --exclude src/generated/** --preview` | `Pass` | scan 输出参数包含 `--path src,scripts,app`、token budget、hard exclude 和额外 exclude |
| 2026-07-06 | `corepack pnpm code-review:ocr` | `Pass` | 本机缺 OCR CLI，optional review 按设计跳过 |
| 2026-07-06 | `corepack pnpm code-review:ocr:required` | `Expected Fail` | 本机缺 OCR CLI，required review 退出 `1`，符合计划 |
| 2026-07-06 | `command -v ocr || echo ocr-missing` | `Skipped` | 本机未安装 OCR CLI；`ocr rules check`、真实 `ocr review --preview`、真实 `ocr scan --preview` 未运行 |
| 2026-07-06 | `corepack pnpm typecheck` | `Pass` | TypeScript 类型检查通过 |
| 2026-07-06 | `corepack pnpm test` | `Pass` | 88 个测试文件、438 个测试通过 |
| 2026-07-06 | `git diff --check` | `Pass` | 无 whitespace error |
| 2026-07-06 | `corepack pnpm code-review:preflight` | `Pass` | code review skill and receipt verified |
| 2026-07-06 | implementation self-review against `codeReviewSkill.md` | `APPROVE` | 未发现 blocking 或 high-confidence issue；实现 diff 均映射到本 ExecPlan |

## 当前残余风险

1. 本机未安装 OCR CLI，因此 `ocr rules check`、真实 `ocr review --preview` 和真实 `ocr scan --preview` 只能记录为 skipped；wrapper 行为已用 missing CLI 和 `OCR_BIN=echo` smoke 覆盖。
2. workflow 已本地 YAML/字符串验证，但仍需要在配置 `OCR_REVIEW_ENABLED=true`、`OCR_LLM_URL`、`OCR_LLM_TOKEN`、`OCR_LLM_MODEL` 后跑一次真实同仓 PR smoke，确认 `review.json` / `status.json` 和 provider env 映射符合预期。
3. 当前工作区仍有未跟踪 `github-pages-site/`、`github-profile/`；默认 hard exclude 已覆盖它们，但真实 OCR CLI 可用后仍应用 preview 复核。
4. Windows PowerShell + WSL UNC cwd 会让 pnpm preflight 出现环境路径失败；正式验证应继续在 WSL repo path 下运行。

## 结论记录

当前结论：`Implemented; local validation passed`。
OCR 接入已按本计划落地为默认 diff review、可选本地 pre-push gate 和默认关闭的 PR workflow。确定性验证、wrapper smoke、配置解析和实现自审均通过；真实 OCR preview / rules check 和同仓 PR smoke 需在安装 OCR CLI 与配置 provider 后执行。

## 下一阶段入口

下一步在需要启用 OCR PR review 时配置 GitHub Variables / Secrets：

```text
OCR_REVIEW_ENABLED=true
OCR_LLM_URL=<provider-url>
OCR_LLM_TOKEN=<secret-token>
OCR_LLM_MODEL=<model>
```

启用后先保持 `OCR_REVIEW_BLOCKING` 未设置或不等于 `true`，用同仓 PR 跑一次非阻断 smoke；确认 artifact 与信号质量稳定后，再考虑设置 `OCR_REVIEW_BLOCKING=true`。

本地如安装 OCR CLI，可补跑：

```bash
ocr rules check src/cli.ts
ocr rules check scripts/openCodeReview.ts
corepack pnpm code-review:ocr -- --preview
corepack pnpm code-review:ocr:scan -- --preview
```
