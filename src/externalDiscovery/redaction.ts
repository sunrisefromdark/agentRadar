import crypto from "node:crypto";

export const REDACTION_POLICY_VERSION = "external-discovery-redaction.v1";

export interface RedactionCheckResult {
  ok: boolean;
  reason_codes: string[];
}

const forbiddenKeys = new Set([
  "content_text",
  "text",
  "raw_text",
  "full_text",
  "provider_display_name",
  "actor_display_name",
  "handle",
  "raw_handle",
  "profile_url",
  "platform_profile_url",
  "private_diagnostics",
  "provider_diagnostics",
]);

const secretPattern = /\b(cookie|session|password|oauth)\b/i;
const tokenSecretPattern =
  /\b(?:access|api|bearer|oauth|refresh)\s+token\b|\btoken\s+(?:credential|leak(?:ed)?|secret|value)\b|\btoken\s*[:=]/i;
const profileUrlPattern = /^https?:\/\/(?:www\.)?(?:twitter\.com|x\.com|reddit\.com|news\.ycombinator\.com)\/[^\s/]+/i;

export function stableSourceInputHash(input: string | Buffer): string {
  return crypto.createHash("sha256").update(input).digest("hex").toLowerCase();
}

export function containsForbiddenPublicArtifactText(value: unknown): boolean {
  return collectRedactionReasonCodes(value).length > 0;
}

export function assertPublicSafeAggregate(value: unknown): RedactionCheckResult {
  const reasonCodes = collectRedactionReasonCodes(value);
  if (!isRecord(value)) {
    reasonCodes.push("not_object");
  } else {
    if (value.public_safe !== true) reasonCodes.push("public_safe_not_true");
    if (value.contains_raw_text !== false) reasonCodes.push("contains_raw_text_not_false");
    if (value.contains_profile_urls !== false) reasonCodes.push("contains_profile_urls_not_false");
    if (typeof value.redaction_policy_version !== "string" || value.redaction_policy_version.length === 0) {
      reasonCodes.push("missing_redaction_policy_version");
    }
    if (typeof value.source_input_hash !== "string" || value.source_input_hash.length === 0) {
      reasonCodes.push("missing_source_input_hash");
    }
  }

  return {
    ok: reasonCodes.length === 0,
    reason_codes: Array.from(new Set(reasonCodes)).sort(),
  };
}

export function assertPublicSafeTrendWindow(value: unknown): RedactionCheckResult {
  const reasonCodes = collectRedactionReasonCodes(value);
  if (!isRecord(value)) {
    reasonCodes.push("not_object");
  } else {
    if (value.public_safe !== true) reasonCodes.push("public_safe_not_true");
    if (value.contains_raw_text !== false) reasonCodes.push("contains_raw_text_not_false");
    if (value.contains_profile_urls !== false) reasonCodes.push("contains_profile_urls_not_false");
    if (typeof value.redaction_policy_version !== "string" || value.redaction_policy_version.length === 0) {
      reasonCodes.push("missing_redaction_policy_version");
    }
    if (value.schema_version !== "external-discussion-trend-window.v1") {
      reasonCodes.push("invalid_trend_window_schema_version");
    }
  }

  return {
    ok: reasonCodes.length === 0,
    reason_codes: Array.from(new Set(reasonCodes)).sort(),
  };
}

function collectRedactionReasonCodes(value: unknown): string[] {
  const reasonCodes: string[] = [];
  visit(value, (currentValue, key) => {
    if (key && forbiddenKeys.has(key)) {
      reasonCodes.push(`forbidden_key:${key}`);
    }
    if (typeof currentValue === "string") {
      if (secretPattern.test(currentValue) || tokenSecretPattern.test(currentValue)) reasonCodes.push("forbidden_secret_text");
      if (profileUrlPattern.test(currentValue)) reasonCodes.push("forbidden_profile_url_text");
    }
  });
  return reasonCodes;
}

function visit(value: unknown, visitor: (value: unknown, key?: string) => void, key?: string): void {
  visitor(value, key);
  if (Array.isArray(value)) {
    for (const item of value) visit(item, visitor);
    return;
  }
  if (!isRecord(value)) return;
  for (const [childKey, childValue] of Object.entries(value)) {
    visit(childValue, visitor, childKey);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
