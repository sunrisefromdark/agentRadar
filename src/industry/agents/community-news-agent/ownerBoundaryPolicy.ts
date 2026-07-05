import type { CommunityNewsResponsibilityId, CommunitySourceInput } from "./groupProtocol.ts";

export interface CommunityOwnerBoundaryResult {
  directOwnerResponsibilityId: CommunityNewsResponsibilityId;
  bucket: CommunitySourceInput["bucket"];
  rejectedReason?: string;
  relationRefs: string[];
}

export function classifyCommunityNewsBoundary(source: CommunitySourceInput, fallbackCommunityOwner: Extract<CommunityNewsResponsibilityId, "cn-community" | "global-community">): CommunityOwnerBoundaryResult {
  if (source.sourceType === "seo_content" || source.sourceType === "aggregator") {
    return {
      directOwnerResponsibilityId: fallbackCommunityOwner,
      bucket: "rejected",
      rejectedReason: source.rejectedReason ?? "community_noise_or_seo_content",
      relationRefs: source.relationRefs ?? [],
    };
  }

  if ((source.sourceType === "media_report" || source.sourceType === "press_release") && source.retellsSourceId) {
    return {
      directOwnerResponsibilityId: source.directOwnerResponsibilityId ?? fallbackCommunityOwner,
      bucket: source.bucket === "accepted" ? "diagnostic" : source.bucket,
      rejectedReason: source.rejectedReason ?? "news_retell_kept_as_context_not_direct_owner",
      relationRefs: [...(source.relationRefs ?? []), `relation://retells/${source.retellsSourceId}`],
    };
  }

  if (source.sourceType === "media_report" || source.sourceType === "press_release") {
    return {
      directOwnerResponsibilityId: "news-pr",
      bucket: source.bucket,
      relationRefs: source.relationRefs ?? [],
    };
  }

  return {
    directOwnerResponsibilityId: fallbackCommunityOwner,
    bucket: source.bucket,
    relationRefs: source.relationRefs ?? [],
  };
}

export function applyCommunityNewsBoundary(
  source: CommunitySourceInput,
  fallbackCommunityOwner: Extract<CommunityNewsResponsibilityId, "cn-community" | "global-community">,
): CommunitySourceInput {
  const boundary = classifyCommunityNewsBoundary(source, fallbackCommunityOwner);
  return {
    ...source,
    bucket: boundary.bucket,
    directOwnerResponsibilityId: boundary.directOwnerResponsibilityId,
    rejectedReason: boundary.rejectedReason ?? source.rejectedReason,
    relationRefs: boundary.relationRefs,
  };
}
