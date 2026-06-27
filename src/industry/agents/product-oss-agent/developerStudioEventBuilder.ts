import { buildProductAxisArtifacts, selectProductRoute, type ProductRouteSelectionInput, type ProductSourceInput } from "./groupProtocol.ts";
import { developerStudioSeed } from "./developerStudioSourceCatalog.ts";

export interface BuildDeveloperStudioInput extends ProductRouteSelectionInput {
  runId: string;
  threadId: string;
  windowStart: string;
  windowEnd: string;
  now: string;
  sources: ProductSourceInput[];
}

export function buildDeveloperStudioArtifacts(input: BuildDeveloperStudioInput) {
  return buildProductAxisArtifacts({
    runId: input.runId,
    threadId: input.threadId,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    now: input.now,
    seed: developerStudioSeed,
    routeSelection: selectProductRoute(developerStudioSeed, input),
    sources: input.sources.map((source) => ({ ...source, directOwnerResponsibilityId: "developer-studio" })),
  });
}
