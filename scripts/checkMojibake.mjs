import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const distRoot = path.join(repoRoot, "dist");

const FILE_EXTENSIONS = new Set([".js", ".mjs", ".json", ".md", ".css", ".html"]);
const GARBLED_PATTERNS = [
  /瑁佸喅鏉ユ簮/g,
  /鏁版嵁/g,
  /涓嶅悎/g,
];
const SAFE_REPLACEMENT_CHAR_CONTEXTS = [
  "match(/[�]/g)",
  "match(/�/g)",
  "[�]",
];

function walkFiles(rootDir) {
  const files = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !fs.existsSync(current)) continue;

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (FILE_EXTENSIONS.has(ext)) files.push(fullPath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function inspectFile(filePath) {
  const text = fs.readFileSync(filePath, "utf-8");
  const hits = [];
  for (const pattern of GARBLED_PATTERNS) {
    if (pattern.test(text)) hits.push(pattern.source);
  }
  if (text.includes("�")) {
    const normalized = SAFE_REPLACEMENT_CHAR_CONTEXTS.reduce((current, marker) => current.split(marker).join(""), text);
    if (normalized.includes("�")) hits.push("replacement-char");
  }
  return hits;
}

function main() {
  if (!fs.existsSync(distRoot)) {
    console.error("[check-mojibake] error: dist/ not found, run build first");
    process.exit(1);
  }

  const files = walkFiles(distRoot);
  const findings = [];

  for (const filePath of files) {
    const hits = inspectFile(filePath);
    if (hits.length > 0) {
      findings.push({ filePath, hits });
    }
  }

  if (findings.length > 0) {
    console.error("[check-mojibake] failed");
    for (const finding of findings) {
      console.error(`- ${path.relative(repoRoot, finding.filePath)}: ${finding.hits.join(", ")}`);
    }
    process.exit(1);
  }

  console.log(`[check-mojibake] ok: scanned ${files.length} file(s) under dist/`);
}

main();
