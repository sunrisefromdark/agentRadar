export function collectProductEcosystemCoverageRefs(refs: {
  productVendorRelease: string;
  developerStudio: string;
  projectOpenSource: string;
  communityDiscussion: string;
  newsPrNarrative: string;
}): string[] {
  return [
    refs.productVendorRelease,
    refs.developerStudio,
    refs.projectOpenSource,
    refs.communityDiscussion,
    refs.newsPrNarrative,
  ];
}
