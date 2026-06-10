import fs from "node:fs";
import path from "node:path";
import type { DocumentApprovalResolution } from "./types.ts";

export function resolveDocumentApprovalState(rootDir: string, relativePath: string): DocumentApprovalResolution {
  const normalizedPath = relativePath.replace(/\\/g, "/");
  const fullPath = path.join(rootDir, normalizedPath);
  if (!fs.existsSync(fullPath)) {
    return {
      path: normalizedPath,
      state: "missing_evidence",
      evidence_ref: normalizedPath,
      detail: "document-missing",
    };
  }

  if (/^docs\/specs\/product-specs\/.+\.md$/.test(normalizedPath)) {
    return resolveRequirementApproval(rootDir, normalizedPath);
  }

  if (/^docs\/specs\/design-docs\/.+\.md$/.test(normalizedPath)) {
    return resolveDesignApproval(rootDir, normalizedPath);
  }

  if (/^docs\/specs\/exec-plans\/.+\.exec-plan\.md$/.test(normalizedPath)) {
    return {
      path: normalizedPath,
      state: "missing_evidence",
      evidence_ref: normalizedPath,
      detail: "exec-plan-has-no-independent-approval",
    };
  }

  return {
    path: normalizedPath,
    state: "missing_evidence",
    evidence_ref: normalizedPath,
    detail: "unsupported-document-type",
  };
}

export function listApprovedSpecPaths(rootDir: string): string[] {
  const approved: string[] = [];

  for (const relativePath of listMarkdownFiles(rootDir, "docs/specs/product-specs")) {
    if (resolveDocumentApprovalState(rootDir, relativePath).state === "passed") approved.push(relativePath);
  }

  for (const relativePath of listMarkdownFiles(rootDir, "docs/specs/design-docs")) {
    if (resolveDocumentApprovalState(rootDir, relativePath).state === "passed") approved.push(relativePath);
  }

  return approved.sort((left, right) => left.localeCompare(right));
}

function resolveRequirementApproval(rootDir: string, relativePath: string): DocumentApprovalResolution {
  const content = fs.readFileSync(path.join(rootDir, relativePath), "utf-8");
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const headerIndex = lines.findIndex((line) => /^## 10\. Requirement Freeze Status(?:（.*）)?$/.test(line.trim()));
  if (headerIndex < 0) {
    return {
      path: relativePath,
      state: "missing_evidence",
      evidence_ref: relativePath,
      detail: "missing-requirement-freeze-status",
    };
  }

  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const current = lines[index]?.trim() ?? "";
    if (!current) continue;
    if (/^##\s+/.test(current)) {
      return {
        path: relativePath,
        state: "failed",
        evidence_ref: relativePath,
        detail: "requirement-freeze-status-not-ready",
      };
    }
    const normalized = current.replace(/`/g, "");
    return {
      path: relativePath,
      state: normalized === "READY" ? "passed" : "failed",
      evidence_ref: relativePath,
      detail: normalized === "READY" ? "requirement-ready" : "requirement-freeze-status-not-ready",
    };
  }

  return {
    path: relativePath,
    state: "failed",
    evidence_ref: relativePath,
    detail: "requirement-freeze-status-not-ready",
  };
}

function resolveDesignApproval(rootDir: string, relativePath: string): DocumentApprovalResolution {
  const content = fs.readFileSync(path.join(rootDir, relativePath), "utf-8");
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const headerIndex = lines.findIndex((line) => /^## 10\. Design Approval Status(?:（.*）)?$/.test(line.trim()));
  if (headerIndex < 0) {
    return {
      path: relativePath,
      state: "missing_evidence",
      evidence_ref: relativePath,
      detail: "missing-design-approval-status",
    };
  }

  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const current = lines[index]?.trim() ?? "";
    if (!current) continue;
    if (/^##\s+/.test(current)) {
      return {
        path: relativePath,
        state: "failed",
        evidence_ref: relativePath,
        detail: "design-approval-status-not-approved",
      };
    }
    const normalized = current.replace(/`/g, "");
    return {
      path: relativePath,
      state: normalized === "APPROVED" ? "passed" : "failed",
      evidence_ref: relativePath,
      detail: normalized === "APPROVED" ? "design-approved" : "design-approval-status-not-approved",
    };
  }

  return {
    path: relativePath,
    state: "failed",
    evidence_ref: relativePath,
    detail: "design-approval-status-not-approved",
  };
}

function listMarkdownFiles(rootDir: string, relativeDir: string): string[] {
  const fullDir = path.join(rootDir, relativeDir);
  if (!fs.existsSync(fullDir)) return [];
  return fs
    .readdirSync(fullDir)
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) => path.join(relativeDir, entry).replace(/\\/g, "/"));
}
