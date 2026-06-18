import {
  EXTERNAL_DIRECTION_LABELS,
  EXTERNAL_PLATFORMS,
  EXTERNAL_RAW_EVENT_KINDS,
  EXTERNAL_SIGNAL_KINDS,
  type ExternalDirectionLabel,
  type ExternalPlatform,
  type ExternalRawEventKind,
  type ExternalSignalKind,
} from "../externalDiscovery/types.ts";
import { isPublicSafeAgentReachValue } from "./sanitizer.ts";
import type {
  AgentReachProviderId,
  AgentReachProviderItem,
  AgentReachProviderResult,
  AgentReachRejectedProviderItem,
} from "./types.ts";

export interface NormalizeAgentReachProviderItemsInput {
  providerId: AgentReachProviderId;
  rawItems: unknown[];
  defaultPlatform?: ExternalPlatform;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isExternalPlatform(value: unknown): value is ExternalPlatform {
  return typeof value === "string" && EXTERNAL_PLATFORMS.includes(value as ExternalPlatform);
}

function isRawEventKind(value: unknown): value is ExternalRawEventKind {
  return (
    typeof value === "string" &&
    EXTERNAL_RAW_EVENT_KINDS.includes(value as ExternalRawEventKind)
  );
}

function signalKinds(value: unknown): ExternalSignalKind[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const kinds = value.filter((kind): kind is ExternalSignalKind => {
    return typeof kind === "string" && EXTERNAL_SIGNAL_KINDS.includes(kind as ExternalSignalKind);
  });
  return kinds.length > 0 ? [...new Set(kinds)] : undefined;
}

function directionLabels(value: unknown): {
  labels?: ExternalDirectionLabel[];
  warnings: string[];
} {
  if (!Array.isArray(value)) return { warnings: [] };
  const labels: ExternalDirectionLabel[] = [];
  const warnings: string[] = [];
  for (const label of value) {
    if (
      typeof label === "string" &&
      EXTERNAL_DIRECTION_LABELS.includes(label as ExternalDirectionLabel)
    ) {
      if (!labels.includes(label as ExternalDirectionLabel)) {
        labels.push(label as ExternalDirectionLabel);
      }
      continue;
    }
    if (typeof label === "string") warnings.push(`dropped_direction_label:${label}`);
  }
  return { labels, warnings };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function recordStringNumber(value: unknown): Record<string, number> | undefined {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value).filter((entry): entry is [string, number] => {
    return typeof entry[1] === "number" && Number.isFinite(entry[1]);
  });
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function makeRejectedItem(
  raw: Record<string, unknown>,
  reasonCode: string,
  reasonDetail: string,
): AgentReachRejectedProviderItem {
  return {
    ...(optionalString(raw.raw_ref) ? { raw_ref: optionalString(raw.raw_ref) } : {}),
    reason_code: reasonCode,
    reason_detail: reasonDetail,
  };
}

function normalizeItem(
  raw: Record<string, unknown>,
): AgentReachProviderItem | AgentReachRejectedProviderItem {
  if (!isExternalPlatform(raw.platform)) {
    return makeRejectedItem(raw, "unsupported_platform", "platform must be a V1 external platform");
  }

  if (!isPublicSafeAgentReachValue(raw)) {
    return makeRejectedItem(raw, "public_unsafe_item", "item contains forbidden public fields or text");
  }

  const rawRef = optionalString(raw.raw_ref);
  const url = optionalString(raw.url);
  if (!rawRef && !url) {
    return makeRejectedItem(raw, "missing_trace_ref", "item must contain url or raw_ref");
  }

  const observedAt = optionalString(raw.observed_at);
  if (!observedAt) {
    return makeRejectedItem(raw, "missing_observed_at", "item must contain observed_at");
  }

  const rawEventKind = isRawEventKind(raw.raw_event_kind) ? raw.raw_event_kind : undefined;
  const derivedSignalKinds = signalKinds(raw.derived_signal_kinds);
  const target = isRecord(raw.target) ? raw.target : undefined;
  const actor = isRecord(raw.actor) ? raw.actor : undefined;
  const canonicalDirectionLabels = Array.isArray(raw.direction_labels)
    ? raw.direction_labels.filter(
        (label): label is ExternalDirectionLabel =>
          typeof label === "string" &&
          EXTERNAL_DIRECTION_LABELS.includes(label as ExternalDirectionLabel),
      )
    : undefined;
  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((tag): tag is string => typeof tag === "string")
    : undefined;

  return {
    ...(rawRef ? { raw_ref: rawRef } : {}),
    platform: raw.platform,
    ...(rawEventKind ? { raw_event_kind: rawEventKind } : {}),
    ...(derivedSignalKinds ? { derived_signal_kinds: derivedSignalKinds } : {}),
    observed_at: observedAt,
    ...(optionalString(raw.source_published_at)
      ? { source_published_at: optionalString(raw.source_published_at) }
      : {}),
    ...(url ? { url } : {}),
    ...(optionalString(raw.title) ? { title: optionalString(raw.title) } : {}),
    ...(actor
      ? {
          actor: {
            ...(optionalString(actor.display_name)
              ? { display_name: optionalString(actor.display_name) }
              : {}),
            ...(optionalString(actor.type_hint) ? { type_hint: optionalString(actor.type_hint) } : {}),
            ...(optionalString(actor.tier_hint) ? { tier_hint: optionalString(actor.tier_hint) } : {}),
          },
        }
      : {}),
    ...(target
      ? {
          target: {
            ...(optionalString(target.name) ? { name: optionalString(target.name) } : {}),
            ...(optionalString(target.url) ? { url: optionalString(target.url) } : {}),
            ...(optionalString(target.repo_url) ? { repo_url: optionalString(target.repo_url) } : {}),
            ...(optionalString(target.paper_url) ? { paper_url: optionalString(target.paper_url) } : {}),
            ...(optionalString(target.topic_hint) ? { topic_hint: optionalString(target.topic_hint) } : {}),
          },
        }
      : {}),
    ...(recordStringNumber(raw.metrics) ? { metrics: recordStringNumber(raw.metrics) } : {}),
    ...(canonicalDirectionLabels ? { direction_labels: canonicalDirectionLabels } : {}),
    ...(tags ? { tags } : {}),
  };
}

function isRejected(
  item: AgentReachProviderItem | AgentReachRejectedProviderItem,
): item is AgentReachRejectedProviderItem {
  return "reason_code" in item;
}

export function normalizeAgentReachProviderItems(
  input: NormalizeAgentReachProviderItemsInput,
): AgentReachProviderResult {
  const items: AgentReachProviderItem[] = [];
  const rejectedItems: AgentReachRejectedProviderItem[] = [];
  const rejectedPlatforms: ExternalPlatform[] = [];
  const warnings: string[] = [];

  for (const rawItem of input.rawItems) {
    if (!isRecord(rawItem)) {
      rejectedItems.push({
        reason_code: "invalid_item",
        reason_detail: "item must be an object",
      });
      if (input.defaultPlatform) rejectedPlatforms.push(input.defaultPlatform);
      continue;
    }

    if (
      input.defaultPlatform &&
      rawItem.platform !== undefined &&
      rawItem.platform !== input.defaultPlatform
    ) {
      rejectedItems.push(
        makeRejectedItem(
          rawItem,
          "provider_platform_mismatch",
          `platform must be ${input.defaultPlatform} for ${input.providerId}`,
        ),
      );
      rejectedPlatforms.push(input.defaultPlatform);
      continue;
    }

    const rawWithPlatform =
      rawItem.platform === undefined && input.defaultPlatform
        ? { ...rawItem, platform: input.defaultPlatform }
        : rawItem;
    const normalizedLabels = directionLabels(rawWithPlatform.direction_labels);
    warnings.push(...normalizedLabels.warnings);
    const normalized = normalizeItem({
      ...rawWithPlatform,
      ...(normalizedLabels.labels ? { direction_labels: normalizedLabels.labels } : {}),
    });
    if (isRejected(normalized)) {
      rejectedItems.push(normalized);
      if (isExternalPlatform(rawWithPlatform.platform)) {
        rejectedPlatforms.push(rawWithPlatform.platform);
      }
    } else {
      items.push(normalized);
    }
  }

  const coverage: AgentReachProviderResult["coverage"] = {};
  if (input.defaultPlatform && rejectedPlatforms.length === 0) {
    coverage[input.defaultPlatform] = { status: "ok" };
  }
  for (const item of items) {
    coverage[item.platform] = { status: "ok" };
  }
  for (const platform of rejectedPlatforms) {
    coverage[platform] = coverage[platform]
      ? { status: "partial", reason: "provider_items_rejected" }
      : { status: "failed", reason: "provider_items_rejected" };
  }

  const status =
    rejectedItems.length === 0
      ? "ok"
      : items.length > 0
        ? "partial"
        : "failed";

  return {
    provider_id: input.providerId,
    status,
    items,
    coverage,
    warnings,
    rejected_items: rejectedItems,
  };
}
