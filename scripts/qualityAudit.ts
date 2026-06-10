import fs from "node:fs";
import path from "node:path";
import {
  buildGateResult,
  buildReport,
  collectMetrics,
  normalizeQualityGateConfig,
  renderGateResult,
  renderMarkdown,
  syncGateConfig,
  walkFiles,
  type QualityGateConfig,
} from "../src/qualityGate.ts";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");
const REPORT_DIR = path.join(ROOT, "docs", "specs", "quality-audits");
const GATE_CONFIG_PATH = path.join(REPORT_DIR, "quality-gate.json");

function loadGateConfig(): QualityGateConfig {
  const text = fs.readFileSync(GATE_CONFIG_PATH, "utf-8");
  return normalizeQualityGateConfig(JSON.parse(text) as QualityGateConfig);
}

function writeGateConfig(config: QualityGateConfig): void {
  fs.writeFileSync(GATE_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
}

function writeReport(report: ReturnType<typeof buildReport>, markdown: string, reportDate: string): void {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(REPORT_DIR, `code-quality-baseline-${reportDate}.json`),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf-8",
  );
  fs.writeFileSync(path.join(REPORT_DIR, `code-quality-baseline-${reportDate}.md`), `${markdown}\n`, "utf-8");
}

function parseArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function main(): void {
  let config = loadGateConfig();
  const files = walkFiles(SRC_DIR);
  const metrics = files.map((filePath) => collectMetrics(filePath, ROOT));
  const report = buildReport(
    metrics.map((item) => item.file),
    metrics.flatMap((item) => item.functions),
    config,
  );
  const markdown = renderMarkdown(report);
  const reportDate = parseArg("--date") ?? new Date().toISOString().slice(0, 10);

  if (hasFlag("--write")) {
    writeReport(report, markdown, reportDate);
  }

  if (hasFlag("--sync-gate")) {
    config = syncGateConfig(report, config, reportDate);
    writeGateConfig(config);
  }

  const gateMode = hasFlag("--gate");
  const strictCheckMode = hasFlag("--check");
  const gateResult = gateMode ? buildGateResult(report, config) : undefined;
  const output = gateResult ? `${markdown}\n${renderGateResult(gateResult)}` : markdown;

  if (hasFlag("--json")) {
    console.log(
      JSON.stringify(
        gateMode
          ? {
              report,
              gateResult,
            }
          : report,
        null,
        2,
      ),
    );
  } else {
    console.log(output);
  }

  if (strictCheckMode) {
    const failed =
      report.summary.functionsOverComplexity > 0 ||
      report.summary.functionsOverLength > 0 ||
      report.summary.filesMissingChineseComments > 0;
    if (failed) process.exitCode = 1;
  }

  if (gateMode && gateResult && !gateResult.passed) {
    process.exitCode = 1;
  }
}

main();
