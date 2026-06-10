import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildGateResult, buildReport, collectMetrics, type QualityGateConfig } from "../qualityGate.ts";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("quality gate reasonable long-function exceptions", () => {
  it("allows comment-tagged prompt builders to exceed the default length threshold", () => {
    const filePath = writeTempSource(
      "promptBuilder.ts",
      `
      /**
       * @quality-gate allow-long-function prompt-builder
       */
      export function buildPrompt(): string {
      ${manyLines("const line = 'prompt';", 92)}
        return "done";
      }
      `,
    );

    const metrics = collectMetrics(filePath, process.cwd());
    const config = makeConfig();
    const report = buildReport([metrics.file], metrics.functions, config);
    const gateResult = buildGateResult(report, config);

    expect(report.summary.functionsOverLength).toBe(1);
    expect(gateResult.passed).toBe(true);
    expect(gateResult.failures).toEqual([]);
  });

  it("allows explicitly allowlisted report composers up to their configured length budget", () => {
    const filePath = writeTempSource(
      "reportComposer.ts",
      `
      export function composeReport(): string {
      ${manyLines("const section = 'report';", 96)}
        return "done";
      }
      `,
    );

    const metrics = collectMetrics(filePath, process.cwd());
    const config = makeConfig({
      reasonableLength: {
        allowedCategories: ["prompt-builder", "report-composer", "schema-serializer"],
        functions: [
          {
            filePath: metrics.file.path,
            name: "composeReport",
            maxLength: 120,
            category: "report-composer",
            rationale: "Structured report composition is intentionally linear and verbose.",
          },
        ],
      },
    });
    const report = buildReport([metrics.file], metrics.functions, config);
    const gateResult = buildGateResult(report, config);

    expect(report.summary.functionsOverLength).toBe(1);
    expect(gateResult.passed).toBe(true);
    expect(gateResult.failures).toEqual([]);
  });

  it("does not suppress complexity failures for tagged long functions", () => {
    const filePath = writeTempSource(
      "complexPrompt.ts",
      `
      /**
       * @quality-gate allow-long-function prompt-builder
       */
      export function buildPrompt(): string {
      ${manyLines("const line = 'prompt';", 84)}
      ${manyIfs(13)}
        return "done";
      }
      `,
    );

    const metrics = collectMetrics(filePath, process.cwd());
    const config = makeConfig();
    const report = buildReport([metrics.file], metrics.functions, config);
    const gateResult = buildGateResult(report, config);

    expect(report.summary.functionsOverLength).toBe(1);
    expect(report.summary.functionsOverComplexity).toBe(1);
    expect(gateResult.passed).toBe(false);
    expect(gateResult.failures).toHaveLength(1);
    expect(gateResult.failures[0]?.kind).toBe("complexity");
  });
});

function makeConfig(overrides: Partial<QualityGateConfig> = {}): QualityGateConfig {
  return {
    thresholds: {
      maxFunctionComplexity: 12,
      maxFunctionLength: 80,
    },
    hotspotFilesRequiringChineseComments: [],
    allowedDebt: {
      functions: [],
    },
    reasonableLength: {
      allowedCategories: ["prompt-builder", "report-composer", "schema-serializer"],
      functions: [],
    },
    ...overrides,
  };
}

function writeTempSource(filename: string, source: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quality-gate-"));
  tempDirs.push(dir);
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, normalizeIndent(source), "utf-8");
  return filePath;
}

function normalizeIndent(source: string): string {
  const lines = source.replace(/^\n/, "").split("\n");
  const indents = lines.filter((line) => line.trim().length > 0).map((line) => line.match(/^ */)?.[0].length ?? 0);
  const minIndent = Math.min(...indents, 0);
  return lines.map((line) => line.slice(minIndent)).join("\n");
}

function manyLines(line: string, count: number): string {
  return Array.from({ length: count }, () => `  ${line}`).join("\n");
}

function manyIfs(count: number): string {
  return Array.from({ length: count }, (_, index) => `  if (flag${index} ?? false) return "${index}";`).join("\n");
}
