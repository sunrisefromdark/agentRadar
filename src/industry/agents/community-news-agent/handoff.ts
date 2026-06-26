import { buildProductOssHandoff, type BuildProductOssHandoffInput } from "../product-oss-agent/handoff.ts";
import { buildCommunityDiscussionArtifacts, buildNewsNarrativeArtifacts, type BuildCommunityDiscussionInput, type BuildNewsNarrativeInput } from "./eventBuilder.ts";
import { collectProductEcosystemContributionRefs } from "./contributionLedger.ts";
import { collectProductEcosystemCoverageRefs } from "./coverageReport.ts";
import { buildDailyInputDraft, buildMergedCommunityDiscussionArtifacts } from "./groupProtocol.ts";

export interface BuildProductEcosystemHandoffInput extends BuildProductOssHandoffInput {
  runId: string;
  threadId: string;
  windowStart: string;
  windowEnd: string;
  now: string;
  cnCommunity: BuildCommunityDiscussionInput;
  globalCommunity: BuildCommunityDiscussionInput;
  newsPr: BuildNewsNarrativeInput;
}

export function buildProductEcosystemHandoff(input: BuildProductEcosystemHandoffInput) {
  const product = buildProductOssHandoff(input);
  const cnCommunity = buildCommunityDiscussionArtifacts(input.cnCommunity);
  const globalCommunity = buildCommunityDiscussionArtifacts(input.globalCommunity);
  const communityDiscussion = buildMergedCommunityDiscussionArtifacts({
    runId: input.runId,
    threadId: input.threadId,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    now: input.now,
    cn: cnCommunity,
    global: globalCommunity,
  });
  const newsPr = buildNewsNarrativeArtifacts(input.newsPr);

  const coverageRefs = collectProductEcosystemCoverageRefs({
    productVendorRelease: product.productPlatform.coverage.manifest.artifact_ref,
    developerStudio: product.developerStudio.coverage.manifest.artifact_ref,
    projectOpenSource: product.projectOss.coverage.manifest.artifact_ref,
    communityDiscussion: communityDiscussion.coverage.manifest.artifact_ref,
    newsPrNarrative: newsPr.coverage.manifest.artifact_ref,
  });
  const contributionRefs = collectProductEcosystemContributionRefs({
    productPlatform: product.productPlatform.contribution.manifest.artifact_ref,
    developerStudio: product.developerStudio.contribution.manifest.artifact_ref,
    projectOss: product.projectOss.contribution.manifest.artifact_ref,
    cnCommunity: cnCommunity.contribution.manifest.artifact_ref,
    globalCommunity: globalCommunity.contribution.manifest.artifact_ref,
    newsPr: newsPr.contribution.manifest.artifact_ref,
  });
  const normalizedEventBatchRefs = [
    product.productPlatform.accepted.manifest.artifact_ref,
    product.developerStudio.accepted.manifest.artifact_ref,
    product.projectOss.accepted.manifest.artifact_ref,
    cnCommunity.accepted.manifest.artifact_ref,
    globalCommunity.accepted.manifest.artifact_ref,
    newsPr.accepted.manifest.artifact_ref,
  ];
  const rejectedEventBatchRefs = [
    product.productPlatform.rejected.manifest.artifact_ref,
    product.developerStudio.rejected.manifest.artifact_ref,
    product.projectOss.rejected.manifest.artifact_ref,
    cnCommunity.rejected.manifest.artifact_ref,
    globalCommunity.rejected.manifest.artifact_ref,
    newsPr.rejected.manifest.artifact_ref,
  ];
  const sourceMessageIds = [
    product.productPlatform,
    product.developerStudio,
    product.projectOss,
    cnCommunity,
    globalCommunity,
    newsPr,
  ].flatMap((artifact) => [
    artifact.accepted.envelope.message_id,
    artifact.counter.envelope.message_id,
    artifact.diagnostic.envelope.message_id,
    artifact.rejected.envelope.message_id,
    artifact.coverage.envelope.message_id,
    artifact.contribution.envelope.message_id,
  ]);
  const dailyInput = buildDailyInputDraft({
    runId: input.runId,
    threadId: input.threadId,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    now: input.now,
    sourceMessageIds,
    normalizedEventBatchRefs,
    rejectedEventBatchRefs,
    coverageRefs,
    contributionRefs,
  });

  return {
    productPlatform: product.productPlatform,
    developerStudio: product.developerStudio,
    projectOss: product.projectOss,
    cnCommunity,
    globalCommunity,
    communityDiscussion,
    newsPr,
    dailyInput,
  };
}
