import type { ProductOssResponsibilityId, ProductSourceInput } from "./groupProtocol.ts";

export interface ProductOwnerBoundaryResult {
  directOwnerResponsibilityId: ProductOssResponsibilityId;
  bucket: ProductSourceInput["bucket"];
  rejectedReason?: string;
  crossResponsibilityAttestationRefs: string[];
}

export function classifyProductOwnerBoundary(source: ProductSourceInput): ProductOwnerBoundaryResult {
  if (source.sourceType === "repo_release" || source.sourceType === "package_version" || source.sourceType === "model_card" || source.sourceType === "dependency_adoption") {
    return {
      directOwnerResponsibilityId: "project-oss",
      bucket: source.bucket,
      crossResponsibilityAttestationRefs: source.crossResponsibilityAttestationRefs ?? [],
    };
  }

  if (source.sourceType === "vendor_blog" && source.topicKey?.includes("repo")) {
    return {
      directOwnerResponsibilityId: "project-oss",
      bucket: source.bucket === "accepted" ? "diagnostic" : source.bucket,
      rejectedReason: source.rejectedReason ?? "vendor_blog_repo_update_requires_project_oss_owner",
      crossResponsibilityAttestationRefs: [...(source.crossResponsibilityAttestationRefs ?? []), "attestation://product-oss/vendor-blog-repo-boundary"],
    };
  }

  if (source.sourceType === "developer_docs" || source.sourceType === "sdk_release" || source.sourceType === "console_update") {
    return {
      directOwnerResponsibilityId: "developer-studio",
      bucket: source.bucket,
      crossResponsibilityAttestationRefs: source.crossResponsibilityAttestationRefs ?? [],
    };
  }

  return {
    directOwnerResponsibilityId: "product-platform",
    bucket: source.bucket,
    crossResponsibilityAttestationRefs: source.crossResponsibilityAttestationRefs ?? [],
  };
}

export function applyProductOwnerBoundary(source: ProductSourceInput): ProductSourceInput {
  const boundary = classifyProductOwnerBoundary(source);
  return {
    ...source,
    bucket: boundary.bucket,
    directOwnerResponsibilityId: boundary.directOwnerResponsibilityId,
    rejectedReason: boundary.rejectedReason ?? source.rejectedReason,
    crossResponsibilityAttestationRefs: boundary.crossResponsibilityAttestationRefs,
  };
}
