import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const ROOT = process.cwd();
const SKILL_PATH = path.join(ROOT, "docs", "specs", "agent-work", "CodeImplementation_Skill.md");
const DEFAULT_EXEC_PLAN_RELATIVE_PATH = "docs/specs/exec-plans/github-star-delta-trust-v0.1.exec-plan.md";
const DEFAULT_RECEIPT_PATH = path.join(ROOT, "docs", "specs", "agent-work", "code-implementation-preflight.json");

interface PreflightReceipt {
  skill_path: string;
  skill_sha256: string;
  exec_plan_path: string;
  exec_plan_sha256: string;
  generated_at: string;
  acknowledged: boolean;
}

function sha256(filepath: string): string {
  const text = fs.readFileSync(filepath, "utf-8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  return crypto.createHash("sha256").update(text).digest("hex").toLowerCase();
}

function relativeToRoot(filepath: string): string {
  return path.relative(ROOT, filepath).replace(/\\/g, "/");
}

function parseExecPlanPath(): string {
  const flagIndex = process.argv.indexOf("--exec-plan");
  const rawPath = flagIndex >= 0 ? process.argv[flagIndex + 1] : DEFAULT_EXEC_PLAN_RELATIVE_PATH;
  if (!rawPath || rawPath.startsWith("--")) {
    throw new Error("missing value for --exec-plan");
  }

  const resolvedPath = path.resolve(ROOT, rawPath);
  const relativePath = relativeToRoot(resolvedPath);
  if (relativePath.startsWith("../") || path.isAbsolute(relativePath)) {
    throw new Error(`exec-plan path must stay within repository root: ${rawPath}`);
  }
  if (!relativePath.startsWith("docs/specs/exec-plans/") || !relativePath.endsWith(".exec-plan.md")) {
    throw new Error(`exec-plan path must point to docs/specs/exec-plans/*.exec-plan.md: ${relativePath}`);
  }

  return resolvedPath;
}

function receiptPathFor(execPlanPath: string): string {
  const execPlanRelativePath = relativeToRoot(execPlanPath);
  if (execPlanRelativePath === DEFAULT_EXEC_PLAN_RELATIVE_PATH) {
    return DEFAULT_RECEIPT_PATH;
  }

  const receiptName = `code-implementation-preflight.${path.basename(execPlanRelativePath, ".exec-plan.md")}.json`;
  return path.join(ROOT, "docs", "specs", "agent-work", receiptName);
}

function loadReceipt(receiptPath: string): PreflightReceipt | null {
  if (!fs.existsSync(receiptPath)) return null;
  return JSON.parse(fs.readFileSync(receiptPath, "utf-8")) as PreflightReceipt;
}

function writeReceipt(execPlanPath: string, receiptPath: string): PreflightReceipt {
  const receipt: PreflightReceipt = {
    skill_path: relativeToRoot(SKILL_PATH),
    skill_sha256: sha256(SKILL_PATH),
    exec_plan_path: relativeToRoot(execPlanPath),
    exec_plan_sha256: sha256(execPlanPath),
    generated_at: new Date().toISOString(),
    acknowledged: true,
  };

  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf-8");
  return receipt;
}

function checkReceipt(execPlanPath: string, receiptPath: string): void {
  if (!fs.existsSync(SKILL_PATH)) {
    throw new Error(`missing skill file: ${SKILL_PATH}`);
  }
  if (!fs.existsSync(execPlanPath)) {
    throw new Error(`missing exec-plan file: ${execPlanPath}`);
  }

  const receipt = loadReceipt(receiptPath);
  if (!receipt) {
    throw new Error(`missing preflight receipt: ${receiptPath}`);
  }
  if (!receipt.acknowledged) {
    throw new Error("preflight receipt is not acknowledged");
  }
  if (receipt.skill_sha256.toLowerCase() !== sha256(SKILL_PATH)) {
    throw new Error("CodeImplementation_Skill.md changed without refreshing the preflight receipt");
  }
  const expectedExecPlanPath = relativeToRoot(execPlanPath);
  if (receipt.exec_plan_path !== expectedExecPlanPath) {
    throw new Error(`preflight receipt is for ${receipt.exec_plan_path}, expected ${expectedExecPlanPath}`);
  }
  if (receipt.exec_plan_sha256.toLowerCase() !== sha256(execPlanPath)) {
    throw new Error(`${expectedExecPlanPath} changed without refreshing the preflight receipt`);
  }
}

function main(): void {
  const writeMode = process.argv.includes("--write");
  const checkMode = process.argv.includes("--check") || !writeMode;
  const execPlanPath = parseExecPlanPath();
  const receiptPath = receiptPathFor(execPlanPath);

  if (writeMode) {
    const receipt = writeReceipt(execPlanPath, receiptPath);
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }

  if (checkMode) {
    checkReceipt(execPlanPath, receiptPath);
    console.log("[preflight] skill and exec-plan receipt verified");
  }
}

main();
