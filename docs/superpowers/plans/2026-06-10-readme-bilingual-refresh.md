# README Bilingual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make GitHub show a Chinese-first README by default, keep an English switch path, and add small visual elements that improve scanability.

**Architecture:** Replace the root `README.md` with the primary Chinese document, add a dedicated `README.en.md` for the English version, and share a lightweight SVG hero asset across both entry documents. Keep `README.zh-CN.md` as a compatibility page that links readers back to the new primary Chinese entry.

**Tech Stack:** Markdown, SVG, GitHub README rendering

---

### Task 1: Restructure the README entry points

**Files:**
- Modify: `README.md`
- Create: `README.en.md`
- Modify: `README.zh-CN.md`

- [ ] **Step 1: Draft the new Chinese-first README structure**

Write the root document with these sections in order:

```md
# AgentRadar

<language switch + badges + hero image>

## 这是什么
## 为什么值得关注
## 你能得到什么
## 工作流一眼看懂
## 适合谁使用
## 快速开始
## 常用命令
## 数据与边界
## 致谢与贡献
```

- [ ] **Step 2: Draft the English companion README**

Write a parallel English document with the same navigation intent:

```md
# AgentRadar

English · [中文](./README.md)

## What this is
## Why it matters
## What you get
## Workflow at a glance
## Who it is for
## Quick start
## Common commands
## Data boundary
## Contributing
```

- [ ] **Step 3: Keep the legacy Chinese filename working**

Replace `README.zh-CN.md` with a compatibility document:

```md
# AgentRadar 中文文档

主文档已切换到仓库首页：

- [打开中文版 README](./README.md)
- [Open English README](./README.en.md)
```

### Task 2: Add lightweight visual assets

**Files:**
- Create: `docs/assets/readme-radar-banner.svg`
- Modify: `README.md`
- Modify: `README.en.md`

- [ ] **Step 1: Create a lightweight SVG banner**

Build a small GitHub-safe SVG with a radar motif and three labeled chips:

```svg
<svg viewBox="0 0 960 240" xmlns="http://www.w3.org/2000/svg">
  <rect width="960" height="240" rx="24" fill="#f8fafc" />
  <circle cx="170" cy="120" r="72" fill="none" stroke="#94a3b8" />
  <circle cx="170" cy="120" r="48" fill="none" stroke="#cbd5e1" />
  <circle cx="170" cy="120" r="24" fill="#0f172a" />
  <path d="M170 120 L238 92" stroke="#0ea5e9" stroke-width="6" />
  <text x="300" y="92">Collect signals</text>
  <text x="300" y="132">Score momentum</text>
  <text x="300" y="172">Ship reusable artifacts</text>
</svg>
```

- [ ] **Step 2: Reference the banner from both README entry points**

Insert:

```md
![AgentRadar overview](./docs/assets/readme-radar-banner.svg)
```

### Task 3: Verify rendering-oriented content

**Files:**
- Verify: `README.md`
- Verify: `README.en.md`
- Verify: `README.zh-CN.md`
- Verify: `docs/assets/readme-radar-banner.svg`

- [ ] **Step 1: Run a diff-focused review**

Run: `git diff -- README.md README.en.md README.zh-CN.md docs/assets/readme-radar-banner.svg`
Expected: only the README restructure and new SVG asset appear

- [ ] **Step 2: Run a text search for language links and image path**

Run: `rg -n "README\.en\.md|README\.md|readme-radar-banner\.svg" README.md README.en.md README.zh-CN.md`
Expected: both language switches resolve and the banner path appears in the primary entry documents

- [ ] **Step 3: Check repository status**

Run: `git status --short`
Expected: only the intended documentation files show as changed for this task, alongside any unrelated pre-existing workspace changes
