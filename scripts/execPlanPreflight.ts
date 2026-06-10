import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const ROOT = process.cwd();
const SKILL_PATH = path.join(ROOT, "docs", "specs", "agent-work", "CodeImplementation_Skill.md");
const EXEC_PLAN_PATH = path.join(ROOT, "docs", "specs", "exec-plans", "github-star-delta-trust-v0.1.exec-plan.md");
const RECEIPT_PATH = path.join(ROOT, "docs", "specs", "agent-work", "code-implementation-preflight.json");

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

function loadReceipt(): PreflightReceipt | null {
  if (!fs.existsSync(RECEIPT_PATH)) return null;
  return JSON.parse(fs.readFileSync(RECEIPT_PATH, "utf-8")) as PreflightReceipt;
}

function writeReceipt(): PreflightReceipt {
  const receipt: PreflightReceipt = {
    skill_path: path.relative(ROOT, SKILL_PATH).replace(/\\/g, "/"),
    skill_sha256: sha256(SKILL_PATH),
    exec_plan_path: path.relative(ROOT, EXEC_PLAN_PATH).replace(/\\/g, "/"),
    exec_plan_sha256: sha256(EXEC_PLAN_PATH),
    generated_at: new Date().toISOString(),
    acknowledged: true,
  };

  fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
  fs.writeFileSync(RECEIPT_PATH, `${JSON.stringify(receipt, null, 2)}\n`, "utf-8");
  return receipt;
}

function checkReceipt(): void {
  if (!fs.existsSync(SKILL_PATH)) {
    throw new Error(`missing skill file: ${SKILL_PATH}`);
  }
  if (!fs.existsSync(EXEC_PLAN_PATH)) {
    throw new Error(`missing exec-plan file: ${EXEC_PLAN_PATH}`);
  }

  const receipt = loadReceipt();
  if (!receipt) {
    throw new Error(`missing preflight receipt: ${RECEIPT_PATH}`);
  }
  if (!receipt.acknowledged) {
    throw new Error("preflight receipt is not acknowledged");
  }
  if (receipt.skill_sha256.toLowerCase() !== sha256(SKILL_PATH)) {
    throw new Error("CodeImplementation_Skill.md changed without refreshing the preflight receipt");
  }
  if (receipt.exec_plan_sha256.toLowerCase() !== sha256(EXEC_PLAN_PATH)) {
    throw new Error("github-star-delta-trust exec-plan changed without refreshing the preflight receipt");
  }
}

function main(): void {
  const writeMode = process.argv.includes("--write");
  const checkMode = process.argv.includes("--check") || !writeMode;

  if (writeMode) {
    const receipt = writeReceipt();
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }

  if (checkMode) {
    checkReceipt();
    console.log("[preflight] skill and exec-plan receipt verified");
  }
}

main();
