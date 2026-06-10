import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  PRIVATE_SYNC_CONFIG_FILE,
  buildPrivateSyncPushArgs,
  loadPrivateSyncConfig,
  resolvePrivateSyncTarget,
} from "../privateSync.ts";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("private sync config", () => {
  it("loads local-only private sync config from ignored file", () => {
    const dir = makeTempDir();
    fs.writeFileSync(
      path.join(dir, PRIVATE_SYNC_CONFIG_FILE),
      JSON.stringify(
        {
          remote: "private-prod",
          branch: "release",
          allowDirty: true,
        },
        null,
        2,
      ),
      "utf-8",
    );

    expect(loadPrivateSyncConfig(dir)).toEqual({
      remote: "private-prod",
      branch: "release",
      allowDirty: true,
    });
  });

  it("falls back to safe defaults when local config is absent", () => {
    const dir = makeTempDir();

    expect(resolvePrivateSyncTarget({ cwd: dir })).toEqual({
      remote: "private",
      branch: "sync/oss-public",
      allowDirty: false,
      source: "defaults",
    });
  });

  it("lets CLI overrides win over local config", () => {
    const dir = makeTempDir();
    fs.writeFileSync(
      path.join(dir, PRIVATE_SYNC_CONFIG_FILE),
      JSON.stringify(
        {
          remote: "private-prod",
          branch: "release",
          allowDirty: false,
        },
        null,
        2,
      ),
      "utf-8",
    );

    expect(
      resolvePrivateSyncTarget({
        cwd: dir,
        remoteOverride: "private-staging",
        branchOverride: "staging",
        allowDirtyOverride: true,
      }),
    ).toEqual({
      remote: "private-staging",
      branch: "staging",
      allowDirty: true,
      source: "config+overrides",
    });
  });

  it("builds git push args with dry-run support", () => {
    expect(buildPrivateSyncPushArgs({ remote: "private", branch: "main", dryRun: true })).toEqual([
      "push",
      "--dry-run",
      "private",
      "HEAD:main",
    ]);
  });
});

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "private-sync-"));
  tempDirs.push(dir);
  return dir;
}
