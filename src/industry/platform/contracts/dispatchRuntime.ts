type RuntimeRecord = Record<string, unknown>;

export type DispatchRuntimeInput = {
  message: RuntimeRecord;
  dispatchContext?: RuntimeRecord;
  reservations?: RuntimeRecord[];
  budgetArbitration?: RuntimeRecord;
  requiresCapacityReservation?: boolean;
  requiresSameRunReview?: boolean;
  reviewAvailability?: RuntimeRecord;
};

type DispatchRuntimeResult =
  | { ok: true; status: "accepted_for_dispatch" }
  | {
      ok: false;
      reasonCode: "dispatch_context_missing" | "reservation_missing" | "budget_exceeded";
      message: string;
    };

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function hasStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(hasText);
}

export function validateDispatchRuntimeGate(input: DispatchRuntimeInput): DispatchRuntimeResult {
  const dispatchRef = input.message.dispatch_context_ref;
  const schedulingKey = input.message.scheduling_key;

  if (!hasText(dispatchRef) || !hasText(schedulingKey) || !input.dispatchContext) {
    return {
      ok: false,
      reasonCode: "dispatch_context_missing",
      message: "same-run action requires dispatch_context_ref, scheduling_key, and dispatch context.",
    };
  }

  if (input.dispatchContext.scheduling_key !== schedulingKey) {
    return {
      ok: false,
      reasonCode: "dispatch_context_missing",
      message: "dispatch context scheduling_key does not match message scheduling_key.",
    };
  }

  if (input.budgetArbitration?.decision === "rejected") {
    return { ok: false, reasonCode: "budget_exceeded", message: "budget arbitration rejected this action." };
  }

  if (!hasText(input.message.claim_admission_assessment_ref)) {
    return {
      ok: false,
      reasonCode: "dispatch_context_missing",
      message: "same-run action requires claim_admission_assessment_ref.",
    };
  }

  if (!hasText(input.message.claim_partition_id) && !hasText(input.message.candidate_group_id)) {
    return {
      ok: false,
      reasonCode: "dispatch_context_missing",
      message: "same-run action requires claim_partition_id or candidate_group_id.",
    };
  }

  if (input.requiresSameRunReview && input.reviewAvailability?.review_execution_mode === "async_only") {
    return {
      ok: false,
      reasonCode: "reservation_missing",
      message: "async_only review availability cannot satisfy same-run review.",
    };
  }

  if (!input.requiresCapacityReservation) {
    return { ok: true, status: "accepted_for_dispatch" };
  }

  if (!hasStringArray(input.message.capacity_reservation_refs)) {
    return {
      ok: false,
      reasonCode: "reservation_missing",
      message: "high-cost action requires capacity_reservation_refs.",
    };
  }

  if (!input.reservations?.some((reservation) => reservation.reservation_state === "granted")) {
    return {
      ok: false,
      reasonCode: "reservation_missing",
      message: "high-cost action requires at least one granted reservation.",
    };
  }

  return { ok: true, status: "accepted_for_dispatch" };
}
