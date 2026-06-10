# Private Sync Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe `sync-private` maintenance entrypoint that keeps private repository details out of the OSS tree.

**Architecture:** Add a small `src/privateSync.ts` module for local-only config parsing and git push argument planning, wire a `sync-private` command into `src/cli.ts`, and document ignored local config files in the README and `.gitignore`.

**Tech Stack:** TypeScript, Vitest, Node child_process, pnpm

---

### Task 1: Private Sync Planning Tests

**Files:**
- Create: `src/__tests__/privateSync.test.ts`
- Create: `src/privateSync.ts`

- [ ] Add failing tests for local config loading, default remote/branch resolution, and dry-run git arg planning.
- [ ] Run the targeted Vitest file and verify the failures point at missing private sync helpers.
- [ ] Implement the minimal private sync planning helpers to satisfy the tests.
- [ ] Re-run the targeted Vitest file until it passes.

### Task 2: CLI Entrypoint

**Files:**
- Modify: `package.json`
- Modify: `src/cli.ts`
- Modify: `src/privateSync.ts`

- [ ] Add a `sync-private` script and CLI command mapping.
- [ ] Support local config plus explicit override flags for remote/branch and a guarded dirty-worktree policy.
- [ ] Execute `git push <remote> HEAD:<branch>` with `--dry-run` support after validating the target remote exists.
- [ ] Re-run the targeted tests and any relevant CLI-adjacent checks.

### Task 3: Ignore Rules And Docs

**Files:**
- Modify: `.gitignore`
- Create: `.sync-private.local.example.json`
- Modify: `README.md`
- Modify: `README.en.md`

- [ ] Ignore local-only private sync config files.
- [ ] Add a tracked example config that contains no secrets.
- [ ] Document the recommended dual-remote workflow and the rule that the actual private remote URL must stay in local git config.
- [ ] Verify the docs match the implemented command names and safety behavior.
