import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

export interface FileMetrics {
  path: string;
  totalLines: number;
  codeLines: number;
  hasChineseComment: boolean;
  chineseCommentBlocks: number;
  functionCount: number;
  maxFunctionComplexity: number;
  maxFunctionLength: number;
}

export interface FunctionMetrics {
  filePath: string;
  name: string;
  startLine: number;
  endLine: number;
  length: number;
  complexity: number;
  reasonableLengthCategory?: string;
}

export interface DebtBudgetEntry {
  filePath: string;
  name: string;
  maxComplexity: number;
  maxLength: number;
  rationale: string;
}

export interface ReasonableLengthEntry {
  filePath: string;
  name: string;
  maxLength: number;
  category: string;
  rationale: string;
}

export interface QualityGateConfig {
  thresholds: {
    maxFunctionComplexity: number;
    maxFunctionLength: number;
  };
  hotspotFilesRequiringChineseComments: string[];
  allowedDebt: {
    functions: DebtBudgetEntry[];
  };
  reasonableLength?: {
    allowedCategories: string[];
    defaultMaxLength?: number;
    functions: ReasonableLengthEntry[];
  };
}

export interface AuditReport {
  generatedAt: string;
  scannedFiles: number;
  productionFiles: number;
  thresholds: {
    maxFunctionComplexity: number;
    maxFunctionLength: number;
  };
  summary: {
    filesMissingChineseComments: number;
    filesOverComplexity: number;
    filesOverLength: number;
    functionsOverComplexity: number;
    functionsOverLength: number;
  };
  violations: {
    functionsOverComplexity: FunctionMetrics[];
    functionsOverLength: FunctionMetrics[];
    filesMissingChineseComments: FileMetrics[];
  };
  hotspots: {
    functionsByComplexity: FunctionMetrics[];
    functionsByLength: FunctionMetrics[];
    filesByLines: FileMetrics[];
    filesMissingChineseComments: FileMetrics[];
  };
  recommendedTargets: string[];
}

export interface GateFailure {
  kind: "complexity" | "length" | "chinese_comment";
  message: string;
}

export interface GateResult {
  passed: boolean;
  failures: GateFailure[];
  protectedDebtEntries: number;
  reasonableLengthEntries: number;
}

const DIRECTIVE_PATTERN = /@quality-gate\s+allow-long-function(?:\s+([a-z0-9-]+))?/i;
const BRANCHING_SYNTAX_KINDS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ConditionalExpression,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.CatchClause,
  ts.SyntaxKind.CaseClause,
]);
const LOGICAL_OPERATOR_KINDS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
]);

export function walkFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

export function toRepoPath(filePath: string, rootDir: string): string {
  return path.relative(rootDir, filePath).replace(/\\/g, "/");
}

function getLineNumber(sourceFile: ts.SourceFile, position: number): number {
  return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}

function countCodeLines(text: string): number {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("//"))
    .length;
}

function extractCommentBlocks(text: string): string[] {
  return text.match(/\/\/.*|\/\*[\s\S]*?\*\//g) ?? [];
}

function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

function isFunctionLike(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node) ||
    ts.isConstructorDeclaration(node)
  );
}

function resolveFunctionName(node: ts.FunctionLikeDeclaration, sourceFile: ts.SourceFile): string {
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
    return node.name?.getText(sourceFile) ?? "<anonymous>";
  }
  if (ts.isConstructorDeclaration(node)) return "constructor";
  if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && ts.isVariableDeclaration(node.parent)) {
    return node.parent.name.getText(sourceFile);
  }
  return "<anonymous>";
}

function complexityIncrement(node: ts.Node): number {
  if (BRANCHING_SYNTAX_KINDS.has(node.kind)) return 1;
  if (!ts.isBinaryExpression(node)) return 0;
  return LOGICAL_OPERATOR_KINDS.has(node.operatorToken.kind) ? 1 : 0;
}

function computeFunctionComplexity(node: ts.FunctionLikeDeclaration): number {
  let complexity = 1;

  function visit(current: ts.Node): void {
    if (current !== node && isFunctionLike(current)) return;
    complexity += complexityIncrement(current);
    current.forEachChild(visit);
  }

  if (node.body) visit(node.body);
  return complexity;
}

function extractReasonableLengthCategory(node: ts.FunctionLikeDeclaration, sourceText: string): string | undefined {
  const commentRanges = ts.getLeadingCommentRanges(sourceText, node.getFullStart()) ?? [];
  for (const range of commentRanges) {
    const commentText = sourceText.slice(range.pos, range.end);
    const match = DIRECTIVE_PATTERN.exec(commentText);
    if (match) return match[1]?.trim() || "general";
  }
  return undefined;
}

export function collectMetrics(filePath: string, rootDir: string = process.cwd()): { file: FileMetrics; functions: FunctionMetrics[] } {
  const text = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true);
  const repoPath = toRepoPath(filePath, rootDir);
  const commentBlocks = extractCommentBlocks(text);
  const chineseCommentBlocks = commentBlocks.filter(hasChinese);
  const functions: FunctionMetrics[] = [];

  function visit(node: ts.Node): void {
    if (isFunctionLike(node)) {
      const startLine = getLineNumber(sourceFile, node.getStart(sourceFile));
      const endLine = getLineNumber(sourceFile, node.getEnd());
      functions.push({
        filePath: repoPath,
        name: resolveFunctionName(node, sourceFile),
        startLine,
        endLine,
        length: endLine - startLine + 1,
        complexity: computeFunctionComplexity(node),
        reasonableLengthCategory: extractReasonableLengthCategory(node, text),
      });
    }
    node.forEachChild(visit);
  }

  visit(sourceFile);

  return {
    file: {
      path: repoPath,
      totalLines: text.split(/\r?\n/).length,
      codeLines: countCodeLines(text),
      hasChineseComment: chineseCommentBlocks.length > 0,
      chineseCommentBlocks: chineseCommentBlocks.length,
      functionCount: functions.length,
      maxFunctionComplexity: functions.reduce((max, item) => Math.max(max, item.complexity), 0),
      maxFunctionLength: functions.reduce((max, item) => Math.max(max, item.length), 0),
    },
    functions,
  };
}

export function normalizeQualityGateConfig(config: QualityGateConfig): QualityGateConfig {
  return {
    ...config,
    allowedDebt: {
      ...config.allowedDebt,
      functions: config.allowedDebt.functions ?? [],
    },
    reasonableLength: {
      allowedCategories: config.reasonableLength?.allowedCategories ?? [],
      defaultMaxLength: config.reasonableLength?.defaultMaxLength ?? 120,
      functions: config.reasonableLength?.functions ?? [],
    },
  };
}

export function buildReport(files: FileMetrics[], functions: FunctionMetrics[], rawConfig: QualityGateConfig): AuditReport {
  const config = normalizeQualityGateConfig(rawConfig);
  const productionFiles = files.filter((file) => !file.path.includes("/__tests__/"));
  const productionFunctions = functions.filter((item) => !item.filePath.includes("/__tests__/"));
  const filesMissingChineseComments = productionFiles.filter(
    (file) => config.hotspotFilesRequiringChineseComments.includes(file.path) && !file.hasChineseComment,
  );
  const filesOverComplexity = productionFiles.filter(
    (file) => file.maxFunctionComplexity > config.thresholds.maxFunctionComplexity,
  );
  const filesOverLength = productionFiles.filter((file) => file.maxFunctionLength > config.thresholds.maxFunctionLength);
  const functionsOverComplexity = productionFunctions.filter(
    (item) => item.complexity > config.thresholds.maxFunctionComplexity,
  );
  const functionsOverLength = productionFunctions.filter((item) => item.length > config.thresholds.maxFunctionLength);

  const complexityHotspots = [...productionFunctions]
    .sort((a, b) => b.complexity - a.complexity || b.length - a.length)
    .slice(0, 15);
  const lengthHotspots = [...productionFunctions]
    .sort((a, b) => b.length - a.length || b.complexity - a.complexity)
    .slice(0, 15);
  const lineHotspots = [...productionFiles].sort((a, b) => b.totalLines - a.totalLines).slice(0, 15);

  const recommendedTargets = [
    ...new Set(
      [
        ...complexityHotspots.slice(0, 5).map((item) => item.filePath),
        ...lengthHotspots.slice(0, 5).map((item) => item.filePath),
        ...filesMissingChineseComments.map((item) => item.path),
      ],
    ),
  ].slice(0, 8);

  return {
    generatedAt: new Date().toISOString(),
    scannedFiles: files.length,
    productionFiles: productionFiles.length,
    thresholds: {
      maxFunctionComplexity: config.thresholds.maxFunctionComplexity,
      maxFunctionLength: config.thresholds.maxFunctionLength,
    },
    summary: {
      filesMissingChineseComments: filesMissingChineseComments.length,
      filesOverComplexity: filesOverComplexity.length,
      filesOverLength: filesOverLength.length,
      functionsOverComplexity: functionsOverComplexity.length,
      functionsOverLength: functionsOverLength.length,
    },
    violations: {
      functionsOverComplexity,
      functionsOverLength,
      filesMissingChineseComments,
    },
    hotspots: {
      functionsByComplexity: complexityHotspots,
      functionsByLength: lengthHotspots,
      filesByLines: lineHotspots,
      filesMissingChineseComments,
    },
    recommendedTargets,
  };
}

export function renderMarkdown(report: AuditReport): string {
  const lines: string[] = [
    "# 代码质量基线审计",
    "",
    `> 生成时间 ${report.generatedAt}`,
    "",
    "## 审计范围",
    "",
    `- 扫描文件数: ${report.scannedFiles}`,
    `- 生产代码文件数: ${report.productionFiles}`,
    `- 函数复杂度阈值: ${report.thresholds.maxFunctionComplexity}`,
    `- 函数长度阈值: ${report.thresholds.maxFunctionLength}`,
    "",
    "## 摘要",
    "",
    `- 缺少中文注释的热点文件: ${report.summary.filesMissingChineseComments}`,
    `- 超过复杂度阈值的文件: ${report.summary.filesOverComplexity}`,
    `- 超过函数长度阈值的文件: ${report.summary.filesOverLength}`,
    `- 超过复杂度阈值的函数: ${report.summary.functionsOverComplexity}`,
    `- 超过长度阈值的函数: ${report.summary.functionsOverLength}`,
    "",
    "## 复杂度热点函数",
    "",
    ...report.hotspots.functionsByComplexity.map(
      (item) =>
        `- ${item.filePath}:${item.startLine} | ${item.name} | complexity=${item.complexity} | length=${item.length}`,
    ),
    "",
    "## 长函数热点",
    "",
    ...report.hotspots.functionsByLength.map(
      (item) =>
        `- ${item.filePath}:${item.startLine} | ${item.name} | length=${item.length} | complexity=${item.complexity}`,
    ),
    "",
    "## 大文件热点",
    "",
    ...report.hotspots.filesByLines.map(
      (item) =>
        `- ${item.path} | total_lines=${item.totalLines} | code_lines=${item.codeLines} | max_complexity=${item.maxFunctionComplexity} | max_length=${item.maxFunctionLength}`,
    ),
    "",
    "## 缺少中文注释的热点文件",
    "",
    ...(report.hotspots.filesMissingChineseComments.length > 0
      ? report.hotspots.filesMissingChineseComments.map(
          (item) =>
            `- ${item.path} | chinese_comment_blocks=${item.chineseCommentBlocks} | max_complexity=${item.maxFunctionComplexity}`,
        )
      : ["- 当前热点文件都已包含中文注释"]),
    "",
    "## 建议优先治理目标",
    "",
    ...report.recommendedTargets.map((item) => `- ${item}`),
    "",
  ];

  return lines.join("\n");
}

export function functionKey(item: { filePath: string; name: string }): string {
  return `${item.filePath}::${item.name}`;
}

function sortDebtEntries(entries: DebtBudgetEntry[]): DebtBudgetEntry[] {
  return [...entries].sort(
    (left, right) => left.filePath.localeCompare(right.filePath) || left.name.localeCompare(right.name),
  );
}

function isFunctionExplicitlyReasonableLong(item: FunctionMetrics, config: QualityGateConfig): boolean {
  const allowance = config.reasonableLength?.functions.find(
    (entry) => entry.filePath === item.filePath && entry.name === item.name,
  );
  if (!allowance) return false;
  if (!config.reasonableLength?.allowedCategories.includes(allowance.category)) return false;
  if (item.length > allowance.maxLength) return false;
  return item.complexity <= config.thresholds.maxFunctionComplexity;
}

function hasExplicitReasonableLengthAllowance(item: FunctionMetrics, config: QualityGateConfig): boolean {
  return Boolean(
    config.reasonableLength?.functions.find((entry) => entry.filePath === item.filePath && entry.name === item.name),
  );
}

function isFunctionTaggedReasonableLong(item: FunctionMetrics, config: QualityGateConfig): boolean {
  const category = item.reasonableLengthCategory;
  if (!category) return false;
  if (!config.reasonableLength?.allowedCategories.includes(category)) return false;
  if (item.length > (config.reasonableLength?.defaultMaxLength ?? config.thresholds.maxFunctionLength)) return false;
  return item.complexity <= config.thresholds.maxFunctionComplexity;
}

function hasReasonableLengthIntent(item: FunctionMetrics, config: QualityGateConfig): boolean {
  return hasExplicitReasonableLengthAllowance(item, config) || Boolean(item.reasonableLengthCategory);
}

function isAllowedReasonableLongFunction(item: FunctionMetrics, rawConfig: QualityGateConfig): boolean {
  const config = normalizeQualityGateConfig(rawConfig);
  return isFunctionExplicitlyReasonableLong(item, config) || isFunctionTaggedReasonableLong(item, config);
}

export function buildDebtBudget(report: AuditReport, rawConfig: QualityGateConfig, reportDate: string): DebtBudgetEntry[] {
  const config = normalizeQualityGateConfig(rawConfig);
  const debtByFunction = new Map<string, DebtBudgetEntry>();
  const rationale = `历史债务基线快照（${reportDate}），仅允许保持现状，禁止继续恶化。`;

  for (const item of [...report.violations.functionsOverComplexity, ...report.violations.functionsOverLength]) {
    if (isAllowedReasonableLongFunction(item, config)) continue;
    const key = functionKey(item);
    const current = debtByFunction.get(key);
    debtByFunction.set(key, {
      filePath: item.filePath,
      name: item.name,
      maxComplexity: Math.max(current?.maxComplexity ?? 0, item.complexity),
      maxLength: Math.max(current?.maxLength ?? 0, item.length),
      rationale,
    });
  }

  return sortDebtEntries([...debtByFunction.values()]);
}

export function syncGateConfig(report: AuditReport, rawConfig: QualityGateConfig, reportDate: string): QualityGateConfig {
  const config = normalizeQualityGateConfig(rawConfig);
  return {
    ...config,
    allowedDebt: {
      ...config.allowedDebt,
      functions: buildDebtBudget(report, config, reportDate),
    },
  };
}

export function buildGateResult(report: AuditReport, rawConfig: QualityGateConfig): GateResult {
  const config = normalizeQualityGateConfig(rawConfig);
  const budgetByFunction = new Map(
    config.allowedDebt.functions.map((item) => [functionKey(item), item] as const),
  );
  const failures: GateFailure[] = [];

  for (const item of report.violations.functionsOverComplexity) {
    const budget = budgetByFunction.get(functionKey(item));
    if (!budget) {
      failures.push({
        kind: "complexity",
        message: `新增复杂度超阈值函数: ${item.filePath}:${item.startLine} ${item.name} complexity=${item.complexity}`,
      });
      continue;
    }
    if (item.complexity > budget.maxComplexity) {
      failures.push({
        kind: "complexity",
        message:
          `复杂度回归: ${item.filePath}:${item.startLine} ${item.name} ` +
          `complexity=${item.complexity} > budget=${budget.maxComplexity}`,
      });
    }
  }

  for (const item of report.violations.functionsOverLength) {
    if (hasReasonableLengthIntent(item, config) && item.complexity > config.thresholds.maxFunctionComplexity) continue;
    if (isAllowedReasonableLongFunction(item, config)) continue;
    const budget = budgetByFunction.get(functionKey(item));
    if (!budget) {
      failures.push({
        kind: "length",
        message: `新增长函数: ${item.filePath}:${item.startLine} ${item.name} length=${item.length}`,
      });
      continue;
    }
    if (item.length > budget.maxLength) {
      failures.push({
        kind: "length",
        message:
          `函数长度回归: ${item.filePath}:${item.startLine} ${item.name} ` +
          `length=${item.length} > budget=${budget.maxLength}`,
      });
    }
  }

  for (const file of report.violations.filesMissingChineseComments) {
    failures.push({
      kind: "chinese_comment",
      message: `热点文件缺少中文注释: ${file.path}`,
    });
  }

  return {
    passed: failures.length === 0,
    failures,
    protectedDebtEntries: config.allowedDebt.functions.length,
    reasonableLengthEntries: config.reasonableLength?.functions.length ?? 0,
  };
}

export function renderGateResult(gateResult: GateResult): string {
  const lines = [
    "## 门禁结果",
    "",
    "- mode: quality-gate",
    `- protected_debt_entries: ${gateResult.protectedDebtEntries}`,
    `- reasonable_length_entries: ${gateResult.reasonableLengthEntries}`,
    `- passed: ${gateResult.passed ? "yes" : "no"}`,
    "",
  ];

  if (gateResult.failures.length === 0) {
    lines.push("- 当前没有新增质量回归，历史技术债和合理长函数例外都已被显式约束。", "");
    return lines.join("\n");
  }

  lines.push("### 失败项", "", ...gateResult.failures.map((item) => `- [${item.kind}] ${item.message}`), "");
  return lines.join("\n");
}
