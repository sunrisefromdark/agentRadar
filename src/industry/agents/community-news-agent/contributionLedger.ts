export function collectProductEcosystemContributionRefs(refs: {
  productPlatform: string;
  developerStudio: string;
  projectOss: string;
  cnCommunity: string;
  globalCommunity: string;
  newsPr: string;
}): string[] {
  return [
    refs.productPlatform,
    refs.developerStudio,
    refs.projectOss,
    refs.cnCommunity,
    refs.globalCommunity,
    refs.newsPr,
  ];
}
