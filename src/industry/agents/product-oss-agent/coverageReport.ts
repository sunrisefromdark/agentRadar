import type { ProductAxisArtifacts } from "./groupProtocol.ts";

export function collectProductCoverageRefs(artifacts: ProductAxisArtifacts[]): string[] {
  return artifacts.map((artifact) => artifact.coverage.manifest.artifact_ref);
}
