# 代码质量审计

这里存放代码质量基线审计产物和门禁预算配置。

## 用法

生成并写入基线报告：

```bash
corepack pnpm quality:audit -- --date 2026-04-26
```

只做客观检查并返回退出码：

```bash
corepack pnpm quality:check
```

按“历史债务预算 + 新增回归禁止”模式执行门禁：

```bash
corepack pnpm quality:gate
```

用于 CI 的组合入口：

```bash
corepack pnpm quality:ci
```

同步当前历史债务到门禁预算，并写入一份新的基线报告：

```bash
corepack pnpm quality:gate:sync -- --date 2026-05-11
```

安装依赖后会自动把仓库级 `.githooks/pre-push` 注册为本地 `pre-push` 钩子，推送前先跑同一套 `quality:ci`。

## 当前口径

当前脚本会客观统计：

- 文件总行数与代码行数
- 函数数量
- 最大函数长度
- 最大函数复杂度
- 热点文件是否包含中文注释

## 门禁策略

`quality:audit` 用于生成基线报告。  
`quality:check` 是严格模式，会对当前所有超阈值函数直接失败，适合看“全仓离理想状态还有多远”。  
`quality:gate` 是实际门禁模式，会读取 [quality-gate.json](quality-gate.json)：

- 允许已登记的历史技术债继续存在
- 禁止新增复杂度超阈值函数
- 禁止已登记债务继续恶化
- 禁止热点文件丢失中文注释
- 允许满足规则的“合理长函数”通过长度门禁，而不是一刀切要求拆分

## 合理长函数例外

适用于以下类型，但前提是函数职责单一、主体为线性拼装/映射、且复杂度仍不超过通用阈值：

- `prompt-builder`
- `report-composer`
- `schema-serializer`
- `data-mapper`

### 方式 1：代码注释标签

对于“略长但合理”的函数，直接在函数前添加注释标签：

```ts
/**
 * @quality-gate allow-long-function prompt-builder
 */
function buildPrompt() {
  // ...
}
```

这类标签例外会受到 `reasonableLength.defaultMaxLength` 约束。默认值是 `120` 行。

### 方式 2：显式白名单配置

对于确实需要更长的函数，可以在 `quality-gate.json` 的 `reasonableLength.functions` 中显式登记：

```json
{
  "filePath": "src/action/weeklyEnhancement.ts",
  "name": "buildWeeklyEnhancementPrompt",
  "maxLength": 170,
  "category": "prompt-builder",
  "rationale": "Prompt skeleton is intentionally linear and easier to review in one place."
}
```

显式白名单适合：

- 超过默认 `120` 行但依然合理的函数
- 需要团队审阅并长期保留的例外
- 希望把“这是有意识保留，不是临时欠债”记录到配置中的场景

## 推荐约定

- 日常开发前先运行 `corepack pnpm quality:ci`
- 保持本地 `pre-push` 钩子开启，不要跳过推送前质量校验
- 只有在团队明确接受一批现存历史债务时，才运行 `corepack pnpm quality:gate:sync`
- 如果函数只是“线性但偏长”，优先使用合理长函数例外，而不是机械拆分
- 如果函数同时又长又复杂，仍应拆分；合理长函数例外不会豁免复杂度问题
- 一旦完成局部重构，应同步收紧 `quality-gate.json`，让预算随债务下降而收缩
