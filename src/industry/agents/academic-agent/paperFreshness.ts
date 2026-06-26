import { daysBetween, type FreshnessAnchorKind, type FreshnessAssessment } from "./types.ts";

const freshnessProfiles: Record<
  FreshnessAnchorKind,
  { profile_id: string; fresh_days: number; usable_days: number }
> = {
  first_release: { profile_id: "academic.paper.first_release", fresh_days: 30, usable_days: 90 },
  major_revision: { profile_id: "academic.paper.major_revision", fresh_days: 45, usable_days: 120 },
  accepted_or_proceedings: {
    profile_id: "academic.paper.accepted_or_proceedings",
    fresh_days: 90,
    usable_days: 240,
  },
  benchmark_or_dataset_update: {
    profile_id: "academic.paper.benchmark_or_dataset_update",
    fresh_days: 60,
    usable_days: 180,
  },
  code_or_replication_release: {
    profile_id: "academic.paper.code_or_replication_release",
    fresh_days: 90,
    usable_days: 365,
  },
  unknown: { profile_id: "academic.paper.unknown", fresh_days: 0, usable_days: 0 },
};

export function assessPaperFreshness(
  anchorKind: FreshnessAnchorKind,
  publishedAt: string | undefined,
  observedAt: string,
): FreshnessAssessment {
  const profile = freshnessProfiles[anchorKind];
  if (!publishedAt) {
    return {
      profile_id: profile.profile_id,
      state: "stale",
      age_days: null,
    };
  }
  const ageDays = daysBetween(publishedAt, observedAt);
  if (ageDays <= profile.fresh_days) {
    return { profile_id: profile.profile_id, state: "fresh", age_days: ageDays };
  }
  if (ageDays <= profile.usable_days) {
    return { profile_id: profile.profile_id, state: "stale_but_usable", age_days: ageDays };
  }
  return { profile_id: profile.profile_id, state: "stale", age_days: ageDays };
}
