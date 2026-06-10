import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const distRoot = path.join(repoRoot, "dist");

const sourceRoots = [
  {
    root: path.join(repoRoot, "src"),
    include: (relativePath) => relativePath.endsWith(".ts") && !relativePath.includes(`${path.sep}__tests__${path.sep}`),
  },
  {
    root: path.join(repoRoot, "app"),
    include: (relativePath) => relativePath.endsWith(".ts") || relativePath.endsWith(".tsx"),
  },
  {
    root: path.join(repoRoot, "scripts"),
    include: (relativePath) => relativePath === "llmProviderSmoke.ts",
  },
];

function removeDistRoot() {
  fs.rmSync(distRoot, { recursive: true, force: true });
}

function walkFiles(rootDir, include) {
  const results = [];
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

      const relativePath = path.relative(rootDir, fullPath);
      if (include(relativePath)) {
        results.push(fullPath);
      }
    }
  }

  return results.sort((left, right) => left.localeCompare(right));
}

function rewriteImportSpecifiers(source) {
  return source
    .replace(/((?:import|export)\s[^"'`]*?\sfrom\s*["'])([^"']+)\.(ts|tsx)(["'])/g, "$1$2.js$4")
    .replace(/(import\s*\(\s*["'])([^"']+)\.(ts|tsx)(["']\s*\))/g, "$1$2.js$4");
}

function compileFile(sourcePath) {
  const relativePath = path.relative(repoRoot, sourcePath);
  const outputPath = path.join(distRoot, relativePath.replace(/\.(ts|tsx)$/u, ".js"));
  const source = fs.readFileSync(sourcePath, "utf-8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      allowImportingTsExtensions: true,
      esModuleInterop: true,
    },
    fileName: sourcePath,
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, rewriteImportSpecifiers(transpiled.outputText), "utf-8");
}

function copyAsset(relativePath) {
  const sourcePath = path.join(repoRoot, relativePath);
  const outputPath = path.join(distRoot, relativePath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.copyFileSync(sourcePath, outputPath);
}

function buildProductionBundle() {
  removeDistRoot();

  for (const sourceRoot of sourceRoots) {
    for (const sourcePath of walkFiles(sourceRoot.root, sourceRoot.include)) {
      compileFile(sourcePath);
    }
  }

}

if (process.argv.includes("--clean")) {
  removeDistRoot();
} else {
  buildProductionBundle();
}
