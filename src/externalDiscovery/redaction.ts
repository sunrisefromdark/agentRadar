import crypto from "node:crypto";

import { EXTERNAL_DIRECTION_LABELS } from "./types.ts";

export interface RedactionCheckResult {
  ok: boolean;
  errors: string[];
}

const FORBIDDEN_PUBLIC_KEYS = new Set([
  "content_text",
  "text",
  "profile_url",
  "profile_urls",
  "platform_profile_url",
  "handle",
  "handles",
  "private_diagnostics",
  "diagnostics",
]);

const SENSITIVE_TEXT_PATTERN = /\b(cookie|session|token|password|oauth)\b/i;
const HANDLE_TEXT_PATTERN = /(^|[^a-z0-9._%+-])@[a-z0-9_]{2,}\b/i;
const ALLOWED_DIRECTION_LABELS = new Set<string>(EXTERNAL_DIRECTION_LABELS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isForbiddenKey(key: string): boolean {
  return FORBIDDEN_PUBLIC_KEYS.has(key.toLowerCase());
}

function collectForbiddenPaths(
  value: unknown,
  currentPath: string,
  paths: string[],
  seen: WeakSet<object>,
): void {
  if (typeof value === "string") {
    if (SENSITIVE_TEXT_PATTERN.test(value) || HANDLE_TEXT_PATTERN.test(value)) {
      paths.push(currentPath);
    }
    return;
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) return;
    seen.add(value);
    value.forEach((item, index) => {
      collectForbiddenPaths(item, `${currentPath}[${index}]`, paths, seen);
    });
    return;
  }

  if (!isRecord(value)) return;
  if (seen.has(value)) return;
  seen.add(value);

  for (const [key, child] of Object.entries(value)) {
    const childPath = currentPath ? `${currentPath}.${key}` : key;
    if (isForbiddenKey(key)) {
      paths.push(childPath);
      continue;
    }
    collectForbiddenPaths(child, childPath, paths, seen);
  }
}

function collectInvalidDirectionLabelPaths(
  value: unknown,
  currentPath: string,
  paths: string[],
  seen: WeakSet<object>,
): void {
  if (Array.isArray(value)) {
    if (seen.has(value)) return;
    seen.add(value);
    value.forEach((item, index) => {
      collectInvalidDirectionLabelPaths(item, `${currentPath}[${index}]`, paths, seen);
    });
    return;
  }

  if (!isRecord(value)) return;
  if (seen.has(value)) return;
  seen.add(value);

  for (const [key, child] of Object.entries(value)) {
    const childPath = currentPath ? `${currentPath}.${key}` : key;

    if (key === "direction_label_counts") {
      if (!isRecord(child)) {
        paths.push(childPath);
        continue;
      }
      for (const label of Object.keys(child)) {
        if (!ALLOWED_DIRECTION_LABELS.has(label)) {
          paths.push(`${childPath}.${label}`);
        }
      }
      continue;
    }

    if (key === "direction_labels") {
      if (!Array.isArray(child)) {
        paths.push(childPath);
        continue;
      }
      child.forEach((label, index) => {
        if (typeof label !== "string" || !ALLOWED_DIRECTION_LABELS.has(label)) {
          paths.push(`${childPath}[${index}]`);
        }
      });
      continue;
    }

    collectInvalidDirectionLabelPaths(child, childPath, paths, seen);
  }
}

export function containsForbiddenPublicArtifactText(value: unknown): boolean {
  const paths: string[] = [];
  collectForbiddenPaths(value, "", paths, new WeakSet<object>());
  return paths.length > 0;
}

export function assertPublicSafeAggregate(value: unknown): RedactionCheckResult {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ["aggregate must be an object"] };
  }

  if (value.public_safe !== true) {
    errors.push("public_safe must be true");
  }
  if (value.contains_raw_text !== false) {
    errors.push("contains_raw_text must be false");
  }
  if (value.contains_profile_urls !== false) {
    errors.push("contains_profile_urls must be false");
  }
  if (
    typeof value.redaction_policy_version !== "string" ||
    value.redaction_policy_version.trim().length === 0
  ) {
    errors.push("redaction_policy_version is required");
  }
  if (typeof value.source_input_hash !== "string" || value.source_input_hash.trim().length === 0) {
    errors.push("source_input_hash is required");
  }

  const forbiddenPaths: string[] = [];
  collectForbiddenPaths(value, "", forbiddenPaths, new WeakSet<object>());
  if (forbiddenPaths.length > 0) {
    errors.push(`forbidden public aggregate field or text detected: ${forbiddenPaths.join(", ")}`);
  }

  const invalidDirectionLabelPaths: string[] = [];
  collectInvalidDirectionLabelPaths(value, "", invalidDirectionLabelPaths, new WeakSet<object>());
  if (invalidDirectionLabelPaths.length > 0) {
    errors.push(`invalid direction label detected: ${invalidDirectionLabelPaths.join(", ")}`);
  }

  return { ok: errors.length === 0, errors };
}

export function stableSourceInputHash(input: string | Buffer): string {
  return `sha256:${crypto.createHash("sha256").update(input).digest("hex").toLowerCase()}`;
}
