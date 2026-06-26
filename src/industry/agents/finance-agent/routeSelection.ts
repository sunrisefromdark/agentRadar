import type { RouteSelectionInput, RouteSelectionResult } from "../policy-agent/groupProtocol.ts";
import { selectRoute } from "../policy-agent/groupProtocol.ts";
import { capitalFinanceSeed } from "./sourceCatalog.ts";

export function selectCapitalFinanceRoute(input: RouteSelectionInput): RouteSelectionResult {
  return selectRoute(capitalFinanceSeed, input);
}
