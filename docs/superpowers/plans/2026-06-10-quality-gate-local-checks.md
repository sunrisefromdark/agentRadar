# Quality Gate Local Checks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal public test suite and fix git hook installation so local checks catch the same quality-gate failure before push.

**Architecture:** Add focused `vitest` coverage for the current public modules that are stable and low-risk to expose: `env`, `config`, and `qualityGate`. Keep tests self-contained with temp files and no private-repo references. Update hook setup to keep `core.hooksPath` configured and mark tracked hook files executable on POSIX systems.

**Tech Stack:** TypeScript, Vitest, Node.js fs/path/os, git hook setup via `execFileSync`

---

### Task 1: Add env loading regression tests

**Files:**
- Create: `src/__tests__/env.test.ts`
- Test: `src/env.ts`

- [ ] **Step 1: Write the failing test**

```ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadDotEnv, loadRuntimeEnv } from "../env.ts";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash -lc "corepack pnpm vitest run src/__tests__/env.test.ts"`
Expected: FAIL because `src/__tests__/env.test.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

No production change expected. Create tests that verify `.env`, `.env.local`, quoting, and override behavior against the existing implementation.

- [ ] **Step 4: Run test to verify it passes**

Run: `bash -lc "corepack pnpm vitest run src/__tests__/env.test.ts"`
Expected: PASS

### Task 2: Add config loading regression tests

**Files:**
- Create: `src/__tests__/config.test.ts`
- Test: `src/config.ts`

- [ ] **Step 1: Write the failing test**

```ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../config.ts";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash -lc "corepack pnpm vitest run src/__tests__/config.test.ts"`
Expected: FAIL because `src/__tests__/config.test.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

No production change expected. Create tests that verify current public behavior: semantic-classification provider validation, env-driven provider inference, user interest profile validation, and default ecosystem config.

- [ ] **Step 4: Run test to verify it passes**

Run: `bash -lc "corepack pnpm vitest run src/__tests__/config.test.ts"`
Expected: PASS

### Task 3: Add quality gate regression tests

**Files:**
- Create: `src/__tests__/qualityGate.test.ts`
- Test: `src/qualityGate.ts`

- [ ] **Step 1: Write the failing test**

```ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildGateResult, buildReport, collectMetrics, type QualityGateConfig } from "../qualityGate.ts";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash -lc "corepack pnpm vitest run src/__tests__/qualityGate.test.ts"`
Expected: FAIL because `src/__tests__/qualityGate.test.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

No production change expected. Create tests that verify comment-tagged long-function allowances, explicit reasonable-length allowlist handling, and that complexity violations still fail.

- [ ] **Step 4: Run test to verify it passes**

Run: `bash -lc "corepack pnpm vitest run src/__tests__/qualityGate.test.ts"`
Expected: PASS

### Task 4: Fix git hook installation on POSIX filesystems

**Files:**
- Modify: `scripts/setupGitHooks.mjs`
- Test: `.githooks/pre-push`

- [ ] **Step 1: Write the failing test**

Use an integration-style verification command instead of a unit test:

Run: `bash -lc "test -x .githooks/pre-push"`
Expected: FAIL in the current checkout because the hook lacks execute permission.

- [ ] **Step 2: Run check to verify it fails**

Run: `bash -lc "test -x .githooks/pre-push"`
Expected: non-zero exit status

- [ ] **Step 3: Write minimal implementation**

Update `scripts/setupGitHooks.mjs` to:
- keep the existing `core.hooksPath` setup
- detect tracked files under `.githooks`
- `chmod 755` them on non-Windows platforms
- swallow permission/setup errors so install remains non-blocking

- [ ] **Step 4: Run check to verify it passes**

Run: `bash -lc "node scripts/setupGitHooks.mjs && test -x .githooks/pre-push"`
Expected: zero exit status

### Task 5: Verify repo-level quality gate behavior

**Files:**
- Test: `package.json`
- Test: `.githooks/pre-push`
- Test: `src/__tests__/config.test.ts`
- Test: `src/__tests__/env.test.ts`
- Test: `src/__tests__/qualityGate.test.ts`

- [ ] **Step 1: Run targeted tests**

Run: `bash -lc "corepack pnpm vitest run src/__tests__/env.test.ts src/__tests__/config.test.ts src/__tests__/qualityGate.test.ts"`
Expected: PASS

- [ ] **Step 2: Run full test suite**

Run: `bash -lc "corepack pnpm test"`
Expected: PASS

- [ ] **Step 3: Run typecheck**

Run: `bash -lc "corepack pnpm typecheck"`
Expected: PASS

- [ ] **Step 4: Run the local hook command path**

Run: `bash -lc ".githooks/pre-push"`
Expected: PASS after running typecheck and tests
