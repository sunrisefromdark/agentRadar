import type { RouteSelectionInput, RouteSelectionResult } from "./groupProtocol.ts";
import { selectRoute } from "./groupProtocol.ts";
import { policyThinktankSeed } from "./thinktankSourceCatalog.ts";

export function selectPolicyThinktankRoute(input: RouteSelectionInput): RouteSelectionResult {
  return selectRoute(policyThinktankSeed, input);
}
