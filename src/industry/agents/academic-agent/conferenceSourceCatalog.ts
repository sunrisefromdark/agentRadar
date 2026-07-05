export const conferenceSourceCatalog = {
  accepted_list: {
    display_name: "Official Accepted List",
    source_type: "conference",
    authority_tier: "core",
    primary_source_distance: "primary",
    tool_ids: ["conference-official", "venue-resolver"],
  },
  proceedings: {
    display_name: "Conference Proceedings",
    source_type: "conference",
    authority_tier: "core",
    primary_source_distance: "primary",
    tool_ids: ["conference-official", "venue-resolver"],
  },
  workshop: {
    display_name: "Official Workshop",
    source_type: "conference",
    authority_tier: "proven",
    primary_source_distance: "primary",
    tool_ids: ["conference-official", "venue-resolver"],
  },
  challenge: {
    display_name: "Official Challenge or Leaderboard",
    source_type: "conference",
    authority_tier: "proven",
    primary_source_distance: "primary",
    tool_ids: ["leaderboard-tracker", "venue-resolver"],
  },
  schedule: {
    display_name: "Official Schedule",
    source_type: "conference",
    authority_tier: "proven",
    primary_source_distance: "primary",
    tool_ids: ["conference-official", "venue-resolver"],
  },
} as const;

export type ConferenceSourceKey = keyof typeof conferenceSourceCatalog;

export function getConferenceSource(sourceKey: string) {
  return conferenceSourceCatalog[
    (sourceKey in conferenceSourceCatalog ? sourceKey : "accepted_list") as ConferenceSourceKey
  ];
}
