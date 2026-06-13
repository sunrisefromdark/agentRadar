import type { DirectionPressureState } from "../types.ts";
import type { ObserverIncubatingDirection } from "../types.ts";

export interface GapFeedbackEvent {
  direction_key: string;
  event_type:
    | "explicit_not_found"
    | "search_zero_result"
    | "skip_repeated_head"
    | "click_quick_exit"
    | "return_visit_without_satisfaction"
    | "favorite"
    | "subscribe"
    | "matched";
  timestamp: string;
}

export function aggregateGapPressure(input: {
  date: string;
  feedbackEvents: GapFeedbackEvent[];
  previousDirectionStates?: Record<string, { pressure_state: DirectionPressureState; counts: Record<string, number> }>;
}): {
  direction_states: Record<string, { pressure_state: DirectionPressureState; counts: Record<string, number> }>;
} {
  const direction_states: Record<string, { pressure_state: DirectionPressureState; counts: Record<string, number> }> = Object.fromEntries(
    Object.entries(input.previousDirectionStates ?? {}).map(([directionKey, state]) => [
      directionKey,
      { counts: { ...state.counts }, pressure_state: state.pressure_state },
    ]),
  );

  for (const event of input.feedbackEvents) {
    const counts = direction_states[event.direction_key]?.counts ?? {};
    counts[event.event_type] = (counts[event.event_type] ?? 0) + 1;
    direction_states[event.direction_key] = {
      counts,
      pressure_state: derivePressureState(counts),
    };
  }

  return { direction_states };
}

export function applyObserverPromotions(
  directionStates: Record<string, { pressure_state: DirectionPressureState; counts: Record<string, number> }>,
  incubatingDirections: ObserverIncubatingDirection[] | undefined,
): Record<string, { pressure_state: DirectionPressureState; counts: Record<string, number> }> {
  const nextStates = { ...directionStates };
  for (const direction of incubatingDirections ?? []) {
    if (!direction.promotion_candidate) continue;
    for (const relatedDirectionKey of direction.related_catalog_direction_keys) {
      const current = nextStates[relatedDirectionKey] ?? { pressure_state: "normal" as const, counts: {} };
      nextStates[relatedDirectionKey] = {
        counts: current.counts,
        pressure_state: "promoted",
      };
    }
  }
  return nextStates;
}

function derivePressureState(counts: Record<string, number>): DirectionPressureState {
  if ((counts.matched ?? 0) >= 2) return "relieved";
  if ((counts.explicit_not_found ?? 0) >= 1) return "pressurized";
  if ((counts.search_zero_result ?? 0) >= 2) return "pressurized";
  if ((counts.skip_repeated_head ?? 0) >= 3 && (counts.favorite ?? 0) + (counts.subscribe ?? 0) === 0) return "pressurized";
  if ((counts.click_quick_exit ?? 0) >= 3 && (counts.favorite ?? 0) + (counts.subscribe ?? 0) === 0) return "pressurized";
  if ((counts.return_visit_without_satisfaction ?? 0) >= 2) return "pressurized";
  return "normal";
}
