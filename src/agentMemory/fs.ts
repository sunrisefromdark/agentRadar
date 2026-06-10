import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function sha256Text(value: string): string {
  return crypto.createHash("sha256").update(value.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n")).digest("hex").toLowerCase();
}

export function sha256File(rootDir: string, relativePath: string): string {
  return sha256Text(fs.readFileSync(path.join(rootDir, relativePath), "utf-8"));
}

export function readJsonFile<T>(rootDir: string, relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf-8")) as T;
}

export function writeJsonAtomic(rootDir: string, relativePath: string, value: unknown): void {
  writeTextAtomic(rootDir, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function writeJsonExclusive(rootDir: string, relativePath: string, value: unknown): void {
  writeTextExclusive(rootDir, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function writeTextAtomic(rootDir: string, relativePath: string, value: string): void {
  const targetPath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tempPath = path.join(path.dirname(targetPath), `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tempPath, value, "utf-8");
  fs.renameSync(tempPath, targetPath);
}

export function writeTextExclusive(rootDir: string, relativePath: string, value: string): void {
  const targetPath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const fileHandle = fs.openSync(targetPath, "wx");
  try {
    fs.writeFileSync(fileHandle, value, "utf-8");
  } finally {
    fs.closeSync(fileHandle);
  }
}

export function listFiles(rootDir: string, relativeDir: string, extensions: string[] = []): string[] {
  const fullDir = path.join(rootDir, relativeDir);
  if (!fs.existsSync(fullDir)) return [];

  const collected: string[] = [];
  const queue = [fullDir];

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) continue;

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }

      const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, "/");
      if (extensions.length === 0 || extensions.some((extension) => relativePath.endsWith(extension))) {
        collected.push(relativePath);
      }
    }
  }

  return collected.sort((left, right) => left.localeCompare(right));
}
