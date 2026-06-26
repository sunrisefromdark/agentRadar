import type { RouteSelectionInput, RouteSelectionResult } from "./groupProtocol.ts";
import { selectRoute } from "./groupProtocol.ts";
import { policyRegulatorySeed } from "./regulatorySourceCatalog.ts";

export function selectPolicyRegulatoryRoute(input: RouteSelectionInput): RouteSelectionResult {
  return selectRoute(policyRegulatorySeed, input);
}
