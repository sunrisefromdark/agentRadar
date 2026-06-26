import { buildProductAxisArtifacts, selectProductRoute, type ProductSourceInput, type ProductRouteSelectionInput } from "./groupProtocol.ts";
import { applyProductOwnerBoundary } from "./ownerBoundaryPolicy.ts";
import { productPlatformSeed } from "./productPlatformSourceCatalog.ts";

export interface BuildProductPlatformInput extends ProductRouteSelectionInput {
  runId: string;
  threadId: string;
  windowStart: string;
  windowEnd: string;
  now: string;
  sources: ProductSourceInput[];
}

export function buildProductPlatformArtifacts(input: BuildProductPlatformInput) {
  return buildProductAxisArtifacts({
    runId: input.runId,
    threadId: input.threadId,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    now: input.now,
    seed: productPlatformSeed,
    routeSelection: selectProductRoute(productPlatformSeed, input),
    sources: input.sources.map(applyProductOwnerBoundary),
  });
}
