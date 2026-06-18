import { containsForbiddenPublicArtifactText } from "../externalDiscovery/redaction.ts";

export function isPublicSafeAgentReachValue(value: unknown): boolean {
  return !containsForbiddenPublicArtifactText(value);
}

