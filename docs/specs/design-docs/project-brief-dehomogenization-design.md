# Project Brief Dehomogenization Design

## Status
- Date: 2026-05-18
- Status: Proposed
- Scope: `rules/template fallback` only

## Goal

Ensure each ranked project's `project_brief_cn` is generated from that project's own structured evidence instead of reusing family-level sentence templates. The brief should still produce a best-effort purpose judgment when evidence is weak, then explicitly note what information is missing.

## Non-Goals

- Do not add new validation rules for LLM-produced `project_brief_cn`.
- Do not change `why_today_cn`.
- Do not change project ranking, scoring, freshness, or enhancement merge semantics.
- Do not fetch extra external data for brief generation.

## Problem

The current fallback implementation in `src/action/projectBriefs.ts` uses family detection to select near-complete sentence patterns. Even when projects differ in description, tags, or evidence, items in the same family often end up with nearly identical introductions. This lowers credibility because the text reads like category labeling rather than project-specific explanation.

## Design

### 1. Keep classification as interpretation, not as output template

The existing family detection remains useful as a lightweight semantic hint, but it must no longer directly map to a fixed full-sentence brief. Family selection should only influence facet prioritization and wording choices at a local level.

### 2. Introduce project-specific facet extraction

Add a facet extraction stage inside `src/action/projectBriefs.ts` that derives a small semantic profile from the current project only.

Each profile should try to infer:

- `identity_label`: what kind of thing this project most likely is
- `primary_purpose`: the clearest concrete job it does
- `secondary_capability`: an additional capability if strongly supported
- `usage_surface`: where it operates, such as terminal, repo, workflow, retrieval, MCP, evaluation
- `target_object`: what it acts on, such as codebase, tools, documents, market signals, memory
- `missing_fields`: what key evidence is absent, such as description, concrete capability terms, or usage context

These facets must be derived only from:

- `project_name`
- `repo_full_name`
- `description`
- `tags`
- `paradigm`
- score/classification evidence already passed into the brief builder

### 3. Rank facets by distinctiveness

When multiple signals exist, prefer the 2-3 facets that best distinguish the project from generic category labels.

Priority order:

1. Concrete capability evidence from description/evidence snippets
2. Explicit operating surface or target object
3. Repo-name semantics when they add meaning
4. Paradigm fallback only when higher-signal evidence is weak

This prevents outputs such as “AI agent platform” when stronger cues like “terminal command execution”, “repository patch generation”, or “market research and strategy analysis” are available.

### 4. Compose briefs from facets, not family templates

Replace family-level whole-sentence templates with a composer that assembles a brief from the extracted facets.

Expected composition behavior:

- Sentence 1 states the best-effort identity and primary purpose.
- Sentence 2 optionally adds one secondary capability or operating context.
- If evidence is weak, append a short insufficiency note that names the missing information.

Target style:

- Plain Chinese
- Roughly current length envelope
- One project, one evidence-grounded explanation
- No generic category-only opening unless no stronger evidence exists

Example structure:

- “它更像一个面向代码仓库改动的 AI 编程助手，主要用来理解现有代码、生成补丁并配合测试回归。”
- “如果当前线索还不够完整，则补一句：当前项目信息不足，缺少明确的功能描述或使用场景。”

### 5. Redefine specificity validation around project evidence

Keep `validateProjectBriefSpecificity`, but shift its emphasis:

- Continue rejecting homogeneous or overly generic stock phrases
- Stop requiring family-level anchor wording as the main success condition
- Instead require the brief to reflect at least one project-derived facet
- Preserve current source-scope restrictions and noisy-description guards

Validation should accept two projects in the same family if they describe different project-specific capabilities, and it should also accept weak-evidence outputs when they include an explicit insufficiency note tied to missing fields.

Descriptions that arrive in Markdown-heavy or link-heavy GitHub formats should be sanitized before insufficiency checks. If the cleaned text still carries concrete capability or usage information, the fallback brief must not append a missing-description warning.

## Implementation Outline

Changes stay within the existing fallback path:

1. Refactor `buildProjectBrief` to call `extractProjectFacets`, `rankProjectFacets`, and `composeProjectBrief`.
2. Reduce family helpers so they provide labels or keyword priors, not complete sentences.
3. Add insufficiency detection that names missing evidence dimensions.
4. Update `validateProjectBriefSpecificity` to validate facet grounding instead of family-template anchoring.
5. Add tests covering same-family divergence, weak-signal fallback, and non-reuse behavior.

## Testing

Add or update unit tests in `src/__tests__/actionOutput.test.ts` for:

- two `coding-agent` style projects with different repo evidence producing materially different briefs
- two `multi-agent-runtime` style projects with different capability focus producing materially different briefs
- weak-signal project still producing a best-effort purpose judgment plus an explicit missing-information note
- noisy descriptions still not leaking raw source text into the brief
- generic stock phrases still rejected by validation

## Risks

- Overfitting to sparse keywords may create brittle phrasing
- Too much compositional freedom may reduce readability
- Missing-field notes may become repetitive if not normalized carefully

## Mitigations

- Keep the facet set small and deterministic
- Limit output to the top 2-3 strongest facets
- Use a constrained insufficiency vocabulary tied to actual missing dimensions
- Preserve existing tests for noisy descriptions and family differentiation while adding stronger same-family coverage

## Acceptance Criteria

- Same-family projects no longer default to the same sentence skeleton.
- Each fallback `project_brief_cn` can be traced back to that project's own description, tags, evidence, repo semantics, or explicit missing-field note.
- Weak-signal projects still produce a usable purpose judgment instead of collapsing to a generic category line.
- Markdown / link style GitHub summaries with concrete cleaned semantics are treated as sufficient description evidence.
- No changes are made to ranking, scoring, freshness, or LLM enhancement validation behavior.
