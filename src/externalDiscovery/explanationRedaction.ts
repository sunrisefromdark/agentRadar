import { containsForbiddenPublicArtifactText, type RedactionCheckResult } from "./redaction.ts";
import type { CandidateExplanationInput, ExternalCandidateExplanationArtifact } from "./explanations.ts";

const markdownLinkPattern = /\[[^\]]+\]\([^)]+\)/;
const rawHandlePattern = /(^|\s)@[\w.-]{2,}/;
const urlPattern = /https?:\/\//i;
const profileUrlPattern = /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com|reddit\.com|news\.ycombinator\.com)\/[^\s/]+/i;
const unsupportedFunctionPattern = /自动部署|自动生成完整应用|自动完成端到端|一键生成|自主修复|无需人工/i;
const overclaimPattern = /高置信推荐|确定爆发|已经形成趋势|趋势已成|必然成为|可以替代主链路/i;
const mainConclusionPattern = /主榜结论/i;
const mainConclusionNegationPattern = /不能作为主榜结论|不作为主榜结论|不得作为主榜结论|不是主榜结论/i;
const directionOnlySemanticsPattern = /方向线索|尚未绑定明确项目|尚未绑定明确 GitHub 项目|进入方向观察|作为方向观察/;

export function assertPublicSafeCandidateExplanationInputs(inputs: CandidateExplanationInput[]): RedactionCheckResult {
  const reasonCodes: string[] = [];

  if (!Array.isArray(inputs)) reasonCodes.push("input_not_array");
  if (containsForbiddenPublicArtifactText(inputs)) reasonCodes.push("sensitive_text_detected");

  for (const input of inputs) {
    for (const text of [
      input.display_name,
      input.target_display_name,
      input.existing_project_brief_cn,
      input.repo_description,
      ...input.public_evidence_titles,
      ...input.public_source_titles,
      ...input.evidence_reason_facts,
      ...input.named_registry_actor_names,
    ]) {
      if (!text) continue;
      reasonCodes.push(...textReasonCodes(text, { allowGithubUrl: false }));
    }

    for (const title of [...input.public_evidence_titles, ...input.public_source_titles]) {
      if (title.length > 160) reasonCodes.push("long_public_title_detected");
    }

    for (const url of [input.target_url, input.repo_url]) {
      if (!url) continue;
      if (profileUrlPattern.test(url)) reasonCodes.push("profile_url_detected");
      if (markdownLinkPattern.test(url)) reasonCodes.push("markdown_link_detected");
    }
  }

  return result(reasonCodes);
}

export function assertPublicSafeCandidateExplanations(artifact: ExternalCandidateExplanationArtifact): RedactionCheckResult {
  const reasonCodes: string[] = [];

  if (!isRecord(artifact)) {
    reasonCodes.push("artifact_not_object");
    return result(reasonCodes);
  }
  if (artifact.public_safe !== true) reasonCodes.push("public_safe_not_true");
  if (artifact.contains_raw_text !== false) reasonCodes.push("contains_raw_text_not_false");
  if (artifact.contains_profile_urls !== false) reasonCodes.push("contains_profile_urls_not_false");
  if (containsForbiddenPublicArtifactText(artifact)) reasonCodes.push("sensitive_text_detected");

  const seenEnhancedSummaries = new Set<string>();
  for (const explanation of artifact.explanations ?? []) {
    for (const text of [explanation.what_it_is_cn, explanation.why_watch_cn, ...explanation.caveats]) {
      reasonCodes.push(...textReasonCodes(text, { allowGithubUrl: false }));
      if (unsupportedFunctionPattern.test(text)) reasonCodes.push("unsupported_function_claim");
      if (overclaimPattern.test(text) || (mainConclusionPattern.test(text) && !mainConclusionNegationPattern.test(text))) {
        reasonCodes.push("overclaim_detected");
      }
    }

    if (
      (explanation.explanation_scope === "direction_signal" || explanation.candidate_kind === "direction") &&
      !/(方向|线索|尚未绑定明确项目|尚未绑定明确 GitHub 项目)/.test(`${explanation.what_it_is_cn}${explanation.why_watch_cn}`)
    ) {
      reasonCodes.push("direction_semantics_missing");
    }
    if (
      explanation.explanation_scope !== "direction_signal" &&
      explanation.candidate_kind !== "direction" &&
      directionOnlySemanticsPattern.test(`${explanation.what_it_is_cn}${explanation.why_watch_cn}`)
    ) {
      reasonCodes.push("project_semantics_conflict");
    }

    if (explanation.summary_source !== "rules_fallback") {
      const summaryKey = normalizeSummary(`${explanation.what_it_is_cn}${explanation.why_watch_cn}`);
      if (seenEnhancedSummaries.has(summaryKey)) {
        reasonCodes.push("duplicate_summary_detected");
      }
      seenEnhancedSummaries.add(summaryKey);
    }
  }

  return result(reasonCodes);
}

function textReasonCodes(text: string, options: { allowGithubUrl: boolean }): string[] {
  const reasonCodes: string[] = [];
  if (!options.allowGithubUrl && urlPattern.test(text)) reasonCodes.push("url_detected");
  if (profileUrlPattern.test(text)) reasonCodes.push("profile_url_detected");
  if (rawHandlePattern.test(text)) reasonCodes.push("raw_handle_detected");
  if (markdownLinkPattern.test(text)) reasonCodes.push("markdown_link_detected");
  if (/\b(cookie|session|oauth|bearer|token|api[_ -]?key|password)\b/i.test(text)) reasonCodes.push("sensitive_text_detected");
  if (text.length > 600) reasonCodes.push("long_raw_text_detected");
  return reasonCodes;
}

function normalizeSummary(value: string): string {
  return value.replace(/\s+/g, "").replace(/[，。、“”"'；：:,.!?！？()（）\-\s]/g, "").toLowerCase();
}

function result(reasonCodes: string[]): RedactionCheckResult {
  return {
    ok: reasonCodes.length === 0,
    reason_codes: [...new Set(reasonCodes)].sort(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
