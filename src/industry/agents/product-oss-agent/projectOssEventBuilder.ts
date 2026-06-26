import { buildProductAxisArtifacts, selectProductRoute, type ProductRouteSelectionInput, type ProductSourceInput } from "./groupProtocol.ts";
import { applyProductOwnerBoundary } from "./ownerBoundaryPolicy.ts";
import { projectOssSeed } from "./projectOssSourceCatalog.ts";

export interface BuildProjectOssInput extends ProductRouteSelectionInput {
  runId: string;
  threadId: string;
  windowStart: string;
  windowEnd: string;
  now: string;
  sources: ProductSourceInput[];
}

export function buildProjectOssArtifacts(input: BuildProjectOssInput) {
  return buildProductAxisArtifacts({
    runId: input.runId,
    threadId: input.threadId,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    now: input.now,
    seed: projectOssSeed,
    routeSelection: selectProductRoute(projectOssSeed, input),
    sources: input.sources.map(applyProductOwnerBoundary),
  });
}
