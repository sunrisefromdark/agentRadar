type ConsumerFixtureResult =
  | { ok: true; status: "current_consumer_ready" }
  | { ok: false; reasonCode: "schema_mismatch" | "dispatch_context_missing"; message: string };

type ConsumerRecord = Record<string, unknown>;

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isRecord(value: unknown): value is ConsumerRecord {
  return typeof value === "object" && value !== null;
}

function hasStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(hasText);
}

export function validateExecutionContext(event: object): ConsumerFixtureResult {
  const record = event as ConsumerRecord;
  if (!hasText(record.responsibility_id) || !isRecord(record.execution_context)) {
    return { ok: false, reasonCode: "schema_mismatch", message: "event requires responsibility_id and execution_context." };
  }

  if (record.execution_context.primary_responsibility_id !== record.responsibility_id) {
    return {
      ok: false,
      reasonCode: "schema_mismatch",
      message: "execution_context.primary_responsibility_id must match responsibility_id.",
    };
  }

  if (!hasText(record.execution_context.operational_executor_id)) {
    return {
      ok: false,
      reasonCode: "schema_mismatch",
      message: "execution_context.operational_executor_id is required.",
    };
  }

  if (
    record.execution_context.takeover_mode &&
    record.execution_context.takeover_mode !== "none" &&
    !hasText(record.execution_context.takeover_audit_ref)
  ) {
    return {
      ok: false,
      reasonCode: "schema_mismatch",
      message: "takeover execution requires takeover_audit_ref.",
    };
  }

  return { ok: true, status: "current_consumer_ready" };
}

export function validateSameRunConsumerRefs(message: object): ConsumerFixtureResult {
  const record = message as ConsumerRecord;
  if (!hasText(record.dispatch_context_ref) || !hasText(record.scheduling_key)) {
    return {
      ok: false,
      reasonCode: "dispatch_context_missing",
      message: "same-run message requires dispatch_context_ref and scheduling_key.",
    };
  }

  if (!hasText(record.claim_partition_id) && !hasText(record.candidate_group_id)) {
    return {
      ok: false,
      reasonCode: "dispatch_context_missing",
      message: "same-run message requires claim_partition_id or candidate_group_id.",
    };
  }

  if (!hasText(record.claim_admission_assessment_ref)) {
    return {
      ok: false,
      reasonCode: "dispatch_context_missing",
      message: "same-run message requires claim_admission_assessment_ref.",
    };
  }

  if (!hasStringArray(record.capacity_reservation_refs)) {
    return {
      ok: false,
      reasonCode: "dispatch_context_missing",
      message: "same-run message requires capacity_reservation_refs.",
    };
  }

  return { ok: true, status: "current_consumer_ready" };
}
