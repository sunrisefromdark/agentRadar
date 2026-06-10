import fs from "node:fs";
import path from "node:path";

interface LoadDotEnvOptions {
  override?: boolean;
}

interface LoadRuntimeEnvOptions {
  overrideProcessEnv?: boolean;
}

function parseEnvLine(line: string): [string, string] | undefined {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return undefined;

  const withoutExport = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
  const eqIndex = withoutExport.indexOf("=");
  if (eqIndex <= 0) return undefined;

  const key = withoutExport.slice(0, eqIndex).trim();
  if (!key) return undefined;

  let value = withoutExport.slice(eqIndex + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  value = value.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t").replace(/\\\\/g, "\\");
  return [key, value];
}

export function loadDotEnv(filePath = path.resolve(process.cwd(), ".env"), options: LoadDotEnvOptions = {}): boolean {
  if (!fs.existsSync(filePath)) return false;

  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    const [key, value] = parsed;
    if (options.override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return true;
}

export function loadRuntimeEnv(
  cwd = process.cwd(),
  options: LoadRuntimeEnvOptions = {},
): boolean {
  const originalKeys = new Set(Object.keys(process.env));
  const envFiles = [path.join(cwd, ".env"), path.join(cwd, ".env.local")];
  let loadedAny = false;

  for (const envFile of envFiles) {
    if (!fs.existsSync(envFile)) continue;
    loadedAny = true;
    const content = fs.readFileSync(envFile, "utf-8");
    for (const line of content.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (!parsed) continue;
      const [key, value] = parsed;
      if (!options.overrideProcessEnv && originalKeys.has(key)) continue;
      process.env[key] = value;
    }
  }

  return loadedAny;
}
