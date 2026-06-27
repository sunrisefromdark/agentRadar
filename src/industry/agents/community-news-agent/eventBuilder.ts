import {
  buildCommunityAxisArtifacts,
  selectCommunityRoute,
  type CommunityRouteSelectionInput,
  type CommunitySourceInput,
} from "./groupProtocol.ts";
import { communityDiscussionSeed } from "./communitySourceCatalog.ts";
import { newsNarrativeSeed } from "./newsNarrativeSourceCatalog.ts";
import { applyCommunityNewsBoundary } from "./ownerBoundaryPolicy.ts";

export interface BuildCommunityDiscussionInput extends CommunityRouteSelectionInput {
  runId: string;
  threadId: string;
  windowStart: string;
  windowEnd: string;
  now: string;
  responsibilityId: "cn-community" | "global-community";
  sources: CommunitySourceInput[];
}

export interface BuildNewsNarrativeInput extends CommunityRouteSelectionInput {
  runId: string;
  threadId: string;
  windowStart: string;
  windowEnd: string;
  now: string;
  sources: CommunitySourceInput[];
}

export function buildCommunityDiscussionArtifacts(input: BuildCommunityDiscussionInput) {
  const seed = communityDiscussionSeed(input.responsibilityId);
  return buildCommunityAxisArtifacts({
    runId: input.runId,
    threadId: input.threadId,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    now: input.now,
    seed,
    routeSelection: selectCommunityRoute(seed, input),
    sources: input.sources.map((source) => applyCommunityNewsBoundary(source, input.responsibilityId)),
  });
}

export function buildNewsNarrativeArtifacts(input: BuildNewsNarrativeInput) {
  return buildCommunityAxisArtifacts({
    runId: input.runId,
    threadId: input.threadId,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    now: input.now,
    seed: newsNarrativeSeed,
    routeSelection: selectCommunityRoute(newsNarrativeSeed, input),
    sources: input.sources.map((source) => {
      if (source.retellsSourceId) {
        return applyCommunityNewsBoundary(source, source.language === "zh" ? "cn-community" : "global-community");
      }
      return { ...source, directOwnerResponsibilityId: "news-pr" as const };
    }),
  });
}
