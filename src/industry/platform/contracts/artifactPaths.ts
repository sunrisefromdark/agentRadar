type ArtifactVisibility = "internal" | "consumer" | "public";

type ArtifactRefInput = {
  visibility: ArtifactVisibility;
  date: string;
  schemaId: string;
  artifactId: string;
};

export function buildIndustryArtifactRef(input: ArtifactRefInput): { artifactRef: string; storagePath: string } {
  const base = `${input.visibility}/${input.date}/${input.schemaId}/${input.artifactId}`;

  return {
    artifactRef: `industry://${base}`,
    storagePath: `data/industry/${base}.json`,
  };
}
