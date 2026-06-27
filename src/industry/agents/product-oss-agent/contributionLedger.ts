import type { ProductAxisArtifacts } from "./groupProtocol.ts";

export function collectProductContributionRefs(artifacts: ProductAxisArtifacts[]): string[] {
  return artifacts.map((artifact) => artifact.contribution.manifest.artifact_ref);
}
