import { buildDeveloperStudioArtifacts, type BuildDeveloperStudioInput } from "./developerStudioEventBuilder.ts";
import { buildProductPlatformArtifacts, type BuildProductPlatformInput } from "./productPlatformEventBuilder.ts";
import { buildProjectOssArtifacts, type BuildProjectOssInput } from "./projectOssEventBuilder.ts";

export interface BuildProductOssHandoffInput {
  productPlatform: BuildProductPlatformInput;
  developerStudio: BuildDeveloperStudioInput;
  projectOss: BuildProjectOssInput;
}

export function buildProductOssHandoff(input: BuildProductOssHandoffInput) {
  const productPlatform = buildProductPlatformArtifacts(input.productPlatform);
  const developerStudio = buildDeveloperStudioArtifacts(input.developerStudio);
  const projectOss = buildProjectOssArtifacts(input.projectOss);

  return {
    productPlatform,
    developerStudio,
    projectOss,
  };
}
