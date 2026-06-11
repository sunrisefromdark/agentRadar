# Visual Console Content And Detail Remediation Review Addendum

## Context

- Base plan: `docs/specs/exec-plans/visual-console-content-and-detail-remediation-v0.1.exec-plan.md`
- Review date: `2026-05-05`
- Purpose: explain why the approved implementation still left user-visible problems unresolved, then record the supplemental execution needed to close those gaps.

## Review Findings

1. `src/action/projectBriefs.ts` no longer keys off topic templates first, but it still returns one fixed sentence per family. That means the implementation is still family-template-first rather than project-evidence-first, so same-family projects keep collapsing into similar intros.
2. `src/action/weeklyEnhancement.ts` still had fallback paths that built briefs without scored evidence. Daily and weekly therefore did not consume the same evidence boundary, which explains why weekly copy could remain more generic.
3. `app/styles.css` and `app/server.ts` restored detail visibility, focus, and keyboard paging, but they did not restore a sticky desktop reading surface or preserve detail-local scroll state across local swaps. The tests proved the DOM changed, but they did not cover the real "click in the middle of a long list and keep wheel-reading detail" flow.
4. KB readability was not partially fixed and then broken again; it was explicitly out of scope in the original plan. The current parser still drops paragraph boundaries, and the current renderer still flattens section bodies into single paragraphs, so the user complaint remains expected.

## Supplemental Execution

### R1a: Project Brief De-Homogenization

- Build `project_brief_cn` from family selection plus project-level evidence phrases instead of family-only fixed copy.
- Feed scored classification evidence into daily and weekly fallback generation so both paths use the same evidence boundary.
- Add a `project brief specificity` validation step that rejects outputs ignoring strong purpose evidence.

### R2a: Detail Surface Interaction Recovery

- Restore desktop `.detail-column` as a sticky, independently scrollable reading surface.
- Preserve `detail-column.scrollTop` across local detail replacements instead of resetting whenever the detail key changes.
- Route desktop wheel interaction to the active detail surface until the detail surface reaches its own scroll boundary.

### R3a: KB Reader-Only Remediation

- Keep KB schema and CLI contracts frozen.
- Re-open only the parser/renderer layer so markdown paragraph and list structure are preserved.
- Rebuild KB detail into a summary-first layout:
  - `What This Is`
  - `Why It Matters Now`
  - `Risks and Next Steps`
  - `Machine Notes`
  - `Human Notes`
  - `Linked Context`
- Explicitly label cards without meaningful human notes as lightweight KB cards.

## Acceptance

- `ruvnet/ruflo`, `TauricResearch/TradingAgents`, and `openclaw/openclaw` no longer read like one template with different repo names.
- Opening detail from the middle of a long list keeps detail visible and independently scrollable on desktop.
- KB detail shows conclusions first, preserves raw structure in machine/human notes, and honestly marks thin cards as lightweight.
