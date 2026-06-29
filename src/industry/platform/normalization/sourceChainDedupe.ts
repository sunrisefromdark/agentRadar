type RecordLike = Record<string, unknown>;

export type PlatformGroupId = "policy_finance" | "academic" | "product_ecosystem";

export type SourceChainEvent = {
  group: PlatformGroupId;
  eventId: string;
  dedupeKey: string;
  responsibilityId: string;
  ownerAgentId: string;
  polarity: string;
};

export type SourceChainDedupeBatch = {
  schema_version: "source-chain-dedupe-batch.v1";
  status: "deduped" | "blocked";
  input_group_count: number;
  input_event_count: number;
  deduped_event_count: number;
  duplicate_event_count: number;
  deduped_events: SourceChainEvent[];
  duplicate_events: Array<{
    event_id: string;
    duplicate_of_event_id: string;
    dedupe_key: string;
  }>;
};

export function buildSourceChainDedupeBatch(input: {
  bundles: Array<{ group: PlatformGroupId; bundle: unknown }>;
}): SourceChainDedupeBatch {
  const events = input.bundles.flatMap(({ group, bundle }) => eventsFromBundle(group, bundle));
  const byKey = new Map<string, SourceChainEvent>();
  const duplicates: SourceChainDedupeBatch["duplicate_events"] = [];

  for (const event of events) {
    const existing = byKey.get(event.dedupeKey);
    if (existing) {
      duplicates.push({
        event_id: event.eventId,
        duplicate_of_event_id: existing.eventId,
        dedupe_key: event.dedupeKey,
      });
    } else {
      byKey.set(event.dedupeKey, event);
    }
  }

  return {
    schema_version: "source-chain-dedupe-batch.v1",
    status: "deduped",
    input_group_count: input.bundles.length,
    input_event_count: events.length,
    deduped_event_count: byKey.size,
    duplicate_event_count: duplicates.length,
    deduped_events: [...byKey.values()],
    duplicate_events: duplicates,
  };
}

function eventsFromBundle(group: PlatformGroupId, bundle: unknown): SourceChainEvent[] {
  const bundleRecord = record(bundle);
  const payloads: unknown[] = Array.isArray(bundleRecord.payloads) ? bundleRecord.payloads : [];
  return payloads
    .map(record)
    .filter((payload) => payload.payload_schema === "industry-signal-event-batch.v1")
    .flatMap((payload) => eventsFromPayload(group, payload));
}

function eventsFromPayload(group: PlatformGroupId, payload: RecordLike): SourceChainEvent[] {
  const events: unknown[] = Array.isArray(payload.events) ? payload.events : [];
  return events.map(record).map((event) => {
    const eventId = text(event.event_id);
    return {
      group,
      eventId,
      dedupeKey: dedupeKey(event),
      responsibilityId: text(event.responsibility_id) || text(payload.responsibility_id),
      ownerAgentId: text(record(event.execution_context).default_owner_agent_id) || ownerFromGroup(group),
      polarity: text(event.source_polarity_cue) || text(payload.bucket) || "supporting",
    };
  }).filter((event) => event.eventId.length > 0);
}

function dedupeKey(event: RecordLike): string {
  const source = record(event.source);
  return [
    text(source.source_url),
    text(source.source_id),
    text(event.responsibility_id),
    text(event.source_polarity_cue),
  ].filter(Boolean).join("|") || text(event.event_id);
}

function ownerFromGroup(group: PlatformGroupId): string {
  if (group === "policy_finance") return "policy-agent";
  if (group === "academic") return "academic-agent";
  return "product-oss-agent";
}

function record(value: unknown): RecordLike {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RecordLike) : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
