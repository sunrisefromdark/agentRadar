import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadDotEnv, loadRuntimeEnv } from "../env.ts";

const originalEnvValue = process.env.AGENT_TREND_RADAR_ENV_TEST;
const originalEnvOther = process.env.AGENT_TREND_RADAR_ENV_OTHER;
const originalEnvThird = process.env.AGENT_TREND_RADAR_ENV_THIRD;
const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-radar-env-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  if (originalEnvValue === undefined) {
    delete process.env.AGENT_TREND_RADAR_ENV_TEST;
  } else {
    process.env.AGENT_TREND_RADAR_ENV_TEST = originalEnvValue;
  }

  if (originalEnvOther === undefined) {
    delete process.env.AGENT_TREND_RADAR_ENV_OTHER;
  } else {
    process.env.AGENT_TREND_RADAR_ENV_OTHER = originalEnvOther;
  }

  if (originalEnvThird === undefined) {
    delete process.env.AGENT_TREND_RADAR_ENV_THIRD;
  } else {
    process.env.AGENT_TREND_RADAR_ENV_THIRD = originalEnvThird;
  }

  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("loadDotEnv", () => {
  it("loads .env values without overwriting existing process env by default", () => {
    const workspace = makeTempDir();
    const envPath = path.join(workspace, ".env");
    process.env.AGENT_TREND_RADAR_ENV_TEST = "already-set";

    fs.writeFileSync(
      envPath,
      [
        "# comment",
        "AGENT_TREND_RADAR_ENV_TEST=from-file",
        'AGENT_TREND_RADAR_ENV_OTHER="quoted value"',
        "export AGENT_TREND_RADAR_ENV_THIRD=third-value",
      ].join("\n"),
      "utf-8",
    );

    const loaded = loadDotEnv(envPath);

    expect(loaded).toBe(true);
    expect(process.env.AGENT_TREND_RADAR_ENV_TEST).toBe("already-set");
    expect(process.env.AGENT_TREND_RADAR_ENV_OTHER).toBe("quoted value");
    expect(process.env.AGENT_TREND_RADAR_ENV_THIRD).toBe("third-value");
  });

  it("can overwrite existing process env when override is enabled", () => {
    const workspace = makeTempDir();
    const envPath = path.join(workspace, ".env");
    process.env.AGENT_TREND_RADAR_ENV_TEST = "already-set";

    fs.writeFileSync(envPath, "AGENT_TREND_RADAR_ENV_TEST=from-file\n", "utf-8");

    const loaded = loadDotEnv(envPath, { override: true });

    expect(loaded).toBe(true);
    expect(process.env.AGENT_TREND_RADAR_ENV_TEST).toBe("from-file");
  });
});

describe("loadRuntimeEnv", () => {
  it("loads .env.local after .env while preserving existing process env by default", () => {
    const workspace = makeTempDir();
    process.env.AGENT_TREND_RADAR_ENV_TEST = "already-set";

    fs.writeFileSync(
      path.join(workspace, ".env"),
      ["AGENT_TREND_RADAR_ENV_TEST=from-env", "AGENT_TREND_RADAR_ENV_OTHER=from-env"].join("\n"),
      "utf-8",
    );
    fs.writeFileSync(
      path.join(workspace, ".env.local"),
      ["AGENT_TREND_RADAR_ENV_OTHER=from-env-local", "AGENT_TREND_RADAR_ENV_THIRD=third-local"].join("\n"),
      "utf-8",
    );

    const loaded = loadRuntimeEnv(workspace);

    expect(loaded).toBe(true);
    expect(process.env.AGENT_TREND_RADAR_ENV_TEST).toBe("already-set");
    expect(process.env.AGENT_TREND_RADAR_ENV_OTHER).toBe("from-env-local");
    expect(process.env.AGENT_TREND_RADAR_ENV_THIRD).toBe("third-local");
  });

  it("can let runtime env files override existing process env when requested", () => {
    const workspace = makeTempDir();
    process.env.AGENT_TREND_RADAR_ENV_TEST = "already-set";

    fs.writeFileSync(path.join(workspace, ".env.local"), "AGENT_TREND_RADAR_ENV_TEST=from-env-local\n", "utf-8");

    const loaded = loadRuntimeEnv(workspace, { overrideProcessEnv: true });

    expect(loaded).toBe(true);
    expect(process.env.AGENT_TREND_RADAR_ENV_TEST).toBe("from-env-local");
  });
});
