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
    reasonCodes.push(...inspectPublicActorContract(value));
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

function inspectPublicActorContract(value: Record<string, unknown>): string[] {
  const reasonCodes: string[] = [];
  const evidenceSections = [value.project_evidence, value.direction_evidence];
  for (const section of evidenceSections) {
    if (!Array.isArray(section)) continue;
    for (const evidence of section) {
      if (!isRecord(evidence)) continue;
      reasonCodes.push(...inspectPublicActors(evidence.public_actors));
      reasonCodes.push(...inspectPublicActorAudit(evidence.public_actor_audit));
    }
  }
  return reasonCodes;
}

function inspectPublicActors(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return ["public_actors_not_array"];
  const reasonCodes: string[] = [];
  for (const actor of value) {
    if (!isRecord(actor)) {
      reasonCodes.push("public_actor_not_object");
      continue;
    }

    const publicActorId = actor.public_actor_id;
    const displayName = actor.display_name;
    if (typeof publicActorId !== "string" || publicActorId.length === 0) {
      reasonCodes.push("public_actor_id_missing");
    } else {
      if (/^https?:\/\//i.test(publicActorId)) reasonCodes.push("public_actor_id_url");
      if (/[?#\s\u0000-\u001F\u007F]/.test(publicActorId)) reasonCodes.push("public_actor_id_unsafe");
    }

    if (typeof displayName !== "string" || displayName.length === 0) {
      reasonCodes.push("public_actor_display_name_missing");
    } else {
      if (displayName.length > 80) reasonCodes.push("public_actor_display_name_too_long");
      if (/https?:\/\//i.test(displayName)) reasonCodes.push("public_actor_display_name_url");
      if (/[\u0000-\u001F\u007F]/.test(displayName)) reasonCodes.push("public_actor_display_name_control_char");
      if (secretPattern.test(displayName) || tokenSecretPattern.test(displayName)) reasonCodes.push("public_actor_display_name_secret");
    }

    if (!isActorType(actor.actor_type)) reasonCodes.push("public_actor_type_invalid");
    if (!isPublicActorRole(actor.actor_role)) reasonCodes.push("public_actor_role_invalid");
    if (!isPublicActorSourceKind(actor.source_kind)) reasonCodes.push("public_actor_source_kind_invalid");
    if (!isPublicActorSourceBasis(actor.source_basis)) reasonCodes.push("public_actor_source_basis_invalid");
    if (!isPublicActorTierBasis(actor.tier_basis)) reasonCodes.push("public_actor_tier_basis_invalid");
    if (actor.authority_tier !== undefined && !isPublicActorAuthorityTier(actor.authority_tier)) {
      reasonCodes.push("public_actor_authority_tier_invalid");
    }
    if (typeof actor.is_head_actor !== "boolean") reasonCodes.push("public_actor_is_head_actor_invalid");
    if (actor.is_head_actor === true && actor.tier_basis !== "registry_match") {
      reasonCodes.push("public_actor_head_without_registry_match");
    }
    if (actor.is_head_actor === true && actor.actor_role !== "registry_entity") {
      reasonCodes.push("public_actor_head_role_invalid");
    }
    if ((actor.actor_role === "official_publisher" || actor.actor_role === "project_owner") && actor.is_head_actor === true) {
      reasonCodes.push("public_actor_official_or_project_head_invalid");
    }
    if (typeof actor.event_count !== "number" || actor.event_count <= 0) reasonCodes.push("public_actor_event_count_invalid");
    if (!Array.isArray(actor.platforms) || actor.platforms.some((platform) => !isPlatform(platform))) {
      reasonCodes.push("public_actor_platforms_invalid");
    }
    if (typeof actor.first_seen_at !== "string" || actor.first_seen_at.length === 0) reasonCodes.push("public_actor_first_seen_missing");
    if (typeof actor.last_seen_at !== "string" || actor.last_seen_at.length === 0) reasonCodes.push("public_actor_last_seen_missing");
  }
  return reasonCodes;
}

function inspectPublicActorAudit(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return ["public_actor_audit_not_array"];
  const reasonCodes: string[] = [];
  for (const audit of value) {
    if (!isRecord(audit)) {
      reasonCodes.push("public_actor_audit_not_object");
      continue;
    }
    const extraKeys = Object.keys(audit).filter((key) => !["platform", "status", "reason", "event_count"].includes(key));
    if (extraKeys.length > 0) reasonCodes.push("public_actor_audit_extra_keys");
    if (!isPlatform(audit.platform)) reasonCodes.push("public_actor_audit_platform_invalid");
    if (!isIdentityStatus(audit.status)) reasonCodes.push("public_actor_audit_status_invalid");
    if (!isIdentityReason(audit.reason)) reasonCodes.push("public_actor_audit_reason_invalid");
    if (audit.status === "available" && audit.reason !== "actor_public_identity_available") {
      reasonCodes.push("public_actor_audit_available_reason_mismatch");
    }
    if (audit.status !== "available" && audit.reason === "actor_public_identity_available") {
      reasonCodes.push("public_actor_audit_non_available_reason_mismatch");
    }
    if (typeof audit.event_count !== "number" || audit.event_count <= 0) {
      reasonCodes.push("public_actor_audit_event_count_invalid");
    }
  }
  return reasonCodes;
}

function isPlatform(value: unknown): boolean {
  return value === "x_twitter" || value === "reddit" || value === "hacker_news" || value === "official_web" || value === "official_blog";
}

function isActorType(value: unknown): boolean {
  return value === "institution" || value === "team" || value === "person" || value === "community" || value === "unknown";
}

function isPublicActorRole(value: unknown): boolean {
  return value === "discussion_actor" || value === "community_source" || value === "official_publisher" || value === "project_owner" || value === "registry_entity";
}

function isPublicActorSourceKind(value: unknown): boolean {
  return value === "registry_entity" || value === "x_handle" || value === "reddit_community" || value === "reddit_user" || value === "hn_user" || value === "github_owner" || value === "official_domain" || value === "provider_actor";
}

function isPublicActorSourceBasis(value: unknown): boolean {
  return value === "registry_match" || value === "explicit_actor_field" || value === "source_url_path" || value === "official_source_url" || value === "target_official_url";
}

function isPublicActorTierBasis(value: unknown): boolean {
  return value === "registry_match" || value === "provider_hint" || value === "none";
}

function isPublicActorAuthorityTier(value: unknown): boolean {
  return value === "core" || value === "proven" || value === "watch" || value === "ordinary" || value === "unknown";
}

function isIdentityStatus(value: unknown): boolean {
  return value === "available" || value === "missing" || value === "invalid_reserved_path" || value === "redacted";
}

function isIdentityReason(value: unknown): boolean {
  return (
    value === "actor_public_identity_available" ||
    value === "actor_public_identity_missing" ||
    value === "x_reserved_or_indirect_url" ||
    value === "official_source_url_missing" ||
    value === "registry_entity_not_matched" ||
    value === "redacted_for_public_safety"
  );
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
