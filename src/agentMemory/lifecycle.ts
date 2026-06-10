import { writeJsonExclusive } from "./fs.ts";
import type { LearnedSkillMetadata, SkillLifecycleEventReceipt, SkillReuseReceipt } from "./types.ts";

export interface BuildLifecycleEventInput {
  eventId: string;
  skillId: string;
  now: string;
  eventType: SkillLifecycleEventReceipt["event_type"];
  trigger: SkillLifecycleEventReceipt["trigger"];
  reason: string;
  evidenceRefs: string[];
  relatedSkillIds?: string[];
  fromTrustTier?: SkillLifecycleEventReceipt["from_trust_tier"];
  toTrustTier?: SkillLifecycleEventReceipt["to_trust_tier"];
  fromLifecycleStatus?: SkillLifecycleEventReceipt["from_lifecycle_status"];
  toLifecycleStatus?: SkillLifecycleEventReceipt["to_lifecycle_status"];
  manualConfirmationRef?: string;
}

export interface SkillExpirationResult {
  updated_skill: LearnedSkillMetadata;
  event: SkillLifecycleEventReceipt;
}

export function buildLifecycleEvent(input: BuildLifecycleEventInput): SkillLifecycleEventReceipt {
  return {
    event_id: input.eventId,
    skill_id: input.skillId,
    event_type: input.eventType,
    trigger: input.trigger,
    created_at: input.now,
    ...(input.fromTrustTier ? { from_trust_tier: input.fromTrustTier } : {}),
    ...(input.toTrustTier ? { to_trust_tier: input.toTrustTier } : {}),
    ...(input.fromLifecycleStatus ? { from_lifecycle_status: input.fromLifecycleStatus } : {}),
    ...(input.toLifecycleStatus ? { to_lifecycle_status: input.toLifecycleStatus } : {}),
    reason: input.reason,
    evidence_refs: [...input.evidenceRefs].sort((left, right) => left.localeCompare(right)),
    related_skill_ids: [...(input.relatedSkillIds ?? [])].sort((left, right) => left.localeCompare(right)),
    ...(input.manualConfirmationRef ? { manual_confirmation_ref: input.manualConfirmationRef } : {}),
  };
}

export function applyLifecycleEventToSkill(skill: LearnedSkillMetadata, event: SkillLifecycleEventReceipt): LearnedSkillMetadata {
  const next = {
    ...skill,
    last_lifecycle_event_id: event.event_id,
  };
  const handler = lifecycleHandlers[event.event_type];
  return handler ? handler(next, event) : next;
}

export function recordSuccessfulReuseOnSkill(
  skill: LearnedSkillMetadata,
  input: {
    taskCreatedAt: string;
    reuseReceipt: SkillReuseReceipt;
  },
): LearnedSkillMetadata {
  const isSuccessfulReuse =
    input.reuseReceipt.execution_result === "success" &&
    input.reuseReceipt.verification_result === "passed" &&
    input.reuseReceipt.fallback_used === false;

  if (!isSuccessfulReuse) {
    if (
      input.reuseReceipt.execution_result === "failed" ||
      input.reuseReceipt.execution_result === "partial" ||
      input.reuseReceipt.verification_result === "failed"
    ) {
      return {
        ...skill,
        failed_reuse_count: skill.failed_reuse_count + 1,
      };
    }
    return { ...skill };
  }

  return {
    ...skill,
    trust_tier: skill.trust_tier === "learned_candidate" ? "learned_stable" : skill.trust_tier,
    lifecycle_status: "stable",
    drift_status: "trusted",
    successful_reuse_count: skill.successful_reuse_count + 1,
    last_used_at: input.taskCreatedAt,
    last_verified_at: input.taskCreatedAt,
  };
}

export function expireSkillIfNeeded(skill: LearnedSkillMetadata, now: string): SkillExpirationResult | null {
  if (skill.lifecycle_status === "retired" || !skill.last_verified_at) return null;
  const ageMs = Date.parse(now) - Date.parse(skill.last_verified_at);
  const fortyFiveDaysMs = 45 * 24 * 60 * 60 * 1000;
  if (ageMs < fortyFiveDaysMs) return null;

  const event = buildLifecycleEvent({
    eventId: incrementEventId(skill.last_lifecycle_event_id),
    skillId: skill.skill_id,
    now,
    eventType: "expired",
    trigger: "inactivity-expiration",
    reason: "last_verified_at older than 45 days",
    evidenceRefs: [],
    fromTrustTier: skill.trust_tier,
    toTrustTier: skill.trust_tier,
    fromLifecycleStatus: skill.lifecycle_status,
    toLifecycleStatus: "expired",
  });

  return {
    updated_skill: applyLifecycleEventToSkill(skill, event),
    event,
  };
}

export function writeLifecycleEvent(rootDir: string, event: SkillLifecycleEventReceipt): void {
  writeJsonExclusive(rootDir, `data/agent-memory/lifecycle/${event.created_at.slice(0, 10)}/${event.event_id}.json`, event);
}

function incrementEventId(lastEventId: string): string {
  const match = lastEventId.match(/^(.*\.evt-)(\d+)$/);
  if (!match) return `${lastEventId}.next`;
  return `${match[1]}${String(Number.parseInt(match[2] ?? "0", 10) + 1).padStart(4, "0")}`;
}

function applyCandidateCreated(skill: LearnedSkillMetadata, event: SkillLifecycleEventReceipt): LearnedSkillMetadata {
  return {
    ...skill,
    trust_tier: event.to_trust_tier === "learned_stable" ? "learned_stable" : "learned_candidate",
    lifecycle_status: event.to_lifecycle_status ?? "candidate",
    drift_status: "trusted",
    last_verified_at: event.created_at,
  };
}

function applyPromoted(skill: LearnedSkillMetadata, event: SkillLifecycleEventReceipt): LearnedSkillMetadata {
  return {
    ...skill,
    trust_tier: event.to_trust_tier === "learned_candidate" ? "learned_candidate" : "learned_stable",
    lifecycle_status: event.to_lifecycle_status ?? "stable",
    promoted_at: event.created_at,
    promotion_source: event.trigger === "manual-confirmation" ? "manual-confirmation" : "successful-reuse",
    promotion_evidence_refs: event.evidence_refs,
    drift_status: "trusted",
    last_verified_at: event.created_at,
  };
}

function applyManualConfirmation(skill: LearnedSkillMetadata, event: SkillLifecycleEventReceipt): LearnedSkillMetadata {
  return {
    ...skill,
    trust_tier: "learned_stable",
    lifecycle_status: "stable",
    promoted_at: event.created_at,
    manual_confirmation_ref: event.manual_confirmation_ref,
    promotion_source: "manual-confirmation",
    promotion_evidence_refs: event.evidence_refs,
    drift_status: "trusted",
    last_verified_at: event.created_at,
  };
}

function applyConflictRecorded(skill: LearnedSkillMetadata, event: SkillLifecycleEventReceipt): LearnedSkillMetadata {
  return {
    ...skill,
    lifecycle_status: skill.lifecycle_status === "stable" ? "paused" : skill.lifecycle_status,
    drift_status: "degraded",
    conflict_with_skill_ids: Array.from(new Set([...skill.conflict_with_skill_ids, ...event.related_skill_ids])).sort((left, right) =>
      left.localeCompare(right),
    ),
  };
}

function applyRevalidated(skill: LearnedSkillMetadata, event: SkillLifecycleEventReceipt): LearnedSkillMetadata {
  if (event.to_lifecycle_status === "stable") {
    return {
      ...skill,
      lifecycle_status: "stable",
      drift_status: "trusted",
      last_verified_at: event.created_at,
    };
  }
  if (skill.lifecycle_status !== "stable") {
    return {
      ...skill,
      drift_status: "pending_recheck",
    };
  }
  return {
    ...skill,
    drift_status: "trusted",
    last_verified_at: event.created_at,
  };
}

const lifecycleHandlers: Partial<Record<SkillLifecycleEventReceipt["event_type"], (skill: LearnedSkillMetadata, event: SkillLifecycleEventReceipt) => LearnedSkillMetadata>> = {
  "candidate-created": applyCandidateCreated,
  promoted: applyPromoted,
  "manually-confirmed": applyManualConfirmation,
  demoted: (skill, event) => ({
    ...skill,
    trust_tier: "learned_candidate",
    lifecycle_status: "candidate",
    demotion_reason: event.reason,
    drift_status: "degraded",
  }),
  paused: (skill) => ({ ...skill, lifecycle_status: "paused", drift_status: "degraded" }),
  expired: (skill) => ({ ...skill, lifecycle_status: "expired", drift_status: "pending_recheck" }),
  retired: (skill, event) => ({ ...skill, lifecycle_status: "retired", retirement_reason: event.reason, drift_status: "degraded" }),
  superseded: (skill, event) => ({ ...skill, lifecycle_status: "retired", retirement_reason: event.reason, drift_status: "degraded" }),
  "conflict-recorded": applyConflictRecorded,
  revalidated: applyRevalidated,
};
