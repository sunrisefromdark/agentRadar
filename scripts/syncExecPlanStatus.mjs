import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SKILL_PATH = path.join(ROOT, "docs", "specs", "agent-work", "CodeImplementation_Skill.md");

const POLICY_FINANCE_PLAN = {
  execPlanRelativePath: "docs/specs/exec-plans/周趋势判断执行计划/行业级Agent趋势判断-政策金融组-v0.1.exec-plan.md",
  watchPrefixes: [
    "src/industry/agents/finance-agent/",
    "src/industry/agents/policy-agent/",
    "src/__tests__/industry/agents/finance-agent/",
    "src/__tests__/industry/agents/policy-agent/",
    "src/__tests__/industry/platform/",
    "src/industry/platform/normalization/",
    "fixtures/industry/agents/finance-agent/",
    "fixtures/industry/agents/policy-agent/",
    "docs/specs/exec-plans/周趋势判断执行计划/行业级Agent趋势判断-政策金融组-v0.1.exec-plan.md",
  ],
};

const PLAN_CONFIGS = [POLICY_FINANCE_PLAN];

function repoRelative(filepath) {
  return path.relative(ROOT, filepath).replace(/\\/g, "/");
}

function stagedFiles() {
  const output = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return output.length === 0 ? [] : output.split("\0").filter(Boolean);
}

function sha256(filepath) {
  const text = fs.readFileSync(filepath, "utf-8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  return crypto.createHash("sha256").update(text).digest("hex").toLowerCase();
}

function receiptPathFor(execPlanRelativePath) {
  const base = path.basename(execPlanRelativePath, ".exec-plan.md");
  return path.join(ROOT, "docs", "specs", "agent-work", `code-implementation-preflight.${base}.json`);
}

function buildReceipt(execPlanRelativePath) {
  const execPlanPath = path.join(ROOT, execPlanRelativePath);
  return {
    skill_path: repoRelative(SKILL_PATH),
    skill_sha256: sha256(SKILL_PATH),
    exec_plan_path: execPlanRelativePath,
    exec_plan_sha256: sha256(execPlanPath),
    generated_at: new Date().toISOString(),
    acknowledged: true,
  };
}

function writeReceipt(execPlanRelativePath) {
  const receiptPath = receiptPathFor(execPlanRelativePath);
  const nextReceipt = buildReceipt(execPlanRelativePath);
  const currentReceipt = fs.existsSync(receiptPath)
    ? JSON.parse(fs.readFileSync(receiptPath, "utf-8"))
    : null;
  if (
    currentReceipt &&
    currentReceipt.skill_path === nextReceipt.skill_path &&
    currentReceipt.skill_sha256 === nextReceipt.skill_sha256 &&
    currentReceipt.exec_plan_path === nextReceipt.exec_plan_path &&
    currentReceipt.exec_plan_sha256 === nextReceipt.exec_plan_sha256 &&
    currentReceipt.acknowledged === nextReceipt.acknowledged
  ) {
    return { path: repoRelative(receiptPath), changed: false };
  }

  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(receiptPath, `${JSON.stringify(nextReceipt, null, 2)}\n`, "utf-8");
  return { path: repoRelative(receiptPath), changed: true };
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function replaceHeadingStatus(content, phaseToken, status, title) {
  const pattern = new RegExp(`### ${phaseToken}（[^）]*）[：:]${title}`, "g");
  if (pattern.test(content)) {
    return content.replace(pattern, `### ${phaseToken}（${status}）：${title}`);
  }
  const barePattern = new RegExp(`### ${phaseToken}[：:]${title}`, "g");
  return content.replace(barePattern, `### ${phaseToken}（${status}）：${title}`);
}

function syncPolicyFinanceExecPlan(content) {
  const phase1Done = [
    "src/industry/agents/finance-agent/sourceCatalog.ts",
    "src/industry/agents/finance-agent/routeSelection.ts",
    "src/industry/agents/policy-agent/regulatorySourceCatalog.ts",
    "src/industry/agents/policy-agent/regulatoryRouteSelection.ts",
    "src/industry/agents/policy-agent/thinktankSourceCatalog.ts",
    "src/industry/agents/policy-agent/thinktankRouteSelection.ts",
  ].every(exists);
  const phase2Done = [
    "src/industry/agents/finance-agent/eventBuilder.ts",
    "src/industry/agents/finance-agent/handoff.ts",
    "src/industry/agents/policy-agent/eventBuilder.ts",
    "src/industry/agents/policy-agent/handoff.ts",
  ].every(exists);
  const phase3ProducerDone = [
    "fixtures/industry/agents/policy-agent/compatibility/same-run-current-consumer.json",
    "fixtures/industry/agents/policy-agent/compatibility/same-run-missing-stable-claim-key-negative.json",
    "src/industry/agents/policy-agent/shared-runtime-note.md",
  ].every(exists);
  const phase3RuntimeDryRunDone = exists("src/industry/platform/normalization/financePolicyDryRun.ts");
  const phase4Done = [
    "src/industry/agents/finance-agent/coverageReport.ts",
    "src/industry/agents/finance-agent/contributionLedger.ts",
    "src/industry/agents/policy-agent/coverageReport.ts",
    "src/industry/agents/policy-agent/contributionLedger.ts",
  ].every(exists);
  const phase4ADone = exists("fixtures/industry/agents/policy-agent/replay/phase1-current-bundle.json");
  const phase4BDone = [
    "fixtures/industry/agents/finance-agent/owner-boundary/news-retell-does-not-own.json",
    "fixtures/industry/agents/policy-agent/owner-boundary/news-cannot-replace-regulator.json",
    "fixtures/industry/agents/finance-agent/anti-upgrade/capital-heat-without-cross-confirmation.json",
    "fixtures/industry/agents/policy-agent/anti-upgrade/thinktank-opinion-not-regulatory-decision.json",
  ].every(exists);
  const phase5Done = [
    "fixtures/industry/agents/policy-agent/replay/phase1-delivery-manifest.json",
    "fixtures/industry/agents/policy-agent/replay/phase1-next-platform-actions.json",
    "fixtures/industry/agents/policy-agent/replay/phase1-delivery-checksums.json",
    "src/industry/agents/policy-agent/handoff-note.md",
    "src/industry/agents/policy-agent/index.ts",
    "src/industry/agents/finance-agent/index.ts",
  ].every(exists);

  let next = content;
  next = replaceHeadingStatus(next, "Phase 1", phase1Done ? "已完成" : "进行中", "source class 与 route 基线");
  next = replaceHeadingStatus(next, "Phase 2", phase2Done ? "已完成" : "进行中", "event 生产");
  next = replaceHeadingStatus(
    next,
    "Phase 3",
    phase3RuntimeDryRunDone
      ? "本组已完成 producer 侧，待 4 号完成 runtime 侧"
      : phase3ProducerDone
        ? "本组已完成 producer 侧，待 4 号接通 dry-run"
        : "进行中",
    "activation / stop / budget 接线",
  );
  next = replaceHeadingStatus(next, "Phase 4", phase4Done ? "已完成" : "进行中", "tool coverage 与 contribution");
  next = replaceHeadingStatus(next, "Phase 4A", phase4ADone ? "已完成" : "进行中", "daily handoff 冻结");
  next = replaceHeadingStatus(next, "Phase 4B", phase4BDone ? "已完成" : "进行中", "owner / attestation 负例 fixture");
  next = replaceHeadingStatus(
    next,
    "Phase 5",
    phase5Done ? "已完成正式 handoff 交付，待 4 号继续平台 runtime 接线" : "进行中",
    "领域测试与 handoff 冻结",
  );
  return next;
}

function syncPlan(execPlanRelativePath) {
  const execPlanPath = path.join(ROOT, execPlanRelativePath);
  const original = fs.readFileSync(execPlanPath, "utf-8");
  const synced = execPlanRelativePath === POLICY_FINANCE_PLAN.execPlanRelativePath
    ? syncPolicyFinanceExecPlan(original)
    : original;
  if (synced === original) {
    return false;
  }
  fs.writeFileSync(execPlanPath, synced, "utf-8");
  return true;
}

function affectedPlans(files) {
  if (files.length === 0) return [];
  return PLAN_CONFIGS.filter((plan) => files.some((file) => plan.watchPrefixes.some((prefix) => file.startsWith(prefix))));
}

function stageFiles(pathsToStage) {
  if (pathsToStage.length === 0) return;
  execFileSync("git", ["update-index", "--again", "--", ...pathsToStage], { cwd: ROOT, stdio: "ignore" });
}

function main() {
  const files = stagedFiles();
  const plans = affectedPlans(files);
  if (plans.length === 0) return;

  const toStage = new Set();
  for (const plan of plans) {
    const changed = syncPlan(plan.execPlanRelativePath);
    const receipt = writeReceipt(plan.execPlanRelativePath);
    toStage.add(plan.execPlanRelativePath);
    if (receipt.changed) {
      toStage.add(receipt.path);
    }
    if (changed) {
      console.log(`[exec-plan-sync] updated ${plan.execPlanRelativePath}`);
    }
    if (receipt.changed) {
      console.log(`[exec-plan-sync] refreshed ${receipt.path}`);
    }
  }
  stageFiles([...toStage]);
}

main();
