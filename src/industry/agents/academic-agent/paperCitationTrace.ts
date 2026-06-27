import type { CitationTrace, PaperSeed } from "./types.ts";

export function buildPaperCitationTrace(seed: PaperSeed): CitationTrace {
  const refs: string[] = [];
  if (seed.canonical_refs?.doi) refs.push(`doi:${seed.canonical_refs.doi}`);
  if (seed.canonical_refs?.arxiv_id) refs.push(`arxiv:${seed.canonical_refs.arxiv_id}`);
  if (seed.canonical_refs?.openreview_id) refs.push(`openreview:${seed.canonical_refs.openreview_id}`);
  if (seed.canonical_refs?.proceedings_url) refs.push(seed.canonical_refs.proceedings_url);
  if (seed.canonical_refs?.code_url) refs.push(seed.canonical_refs.code_url);

  return {
    status: refs.length > 0 ? "complete" : "missing",
    canonical_ref: refs[0],
    citation_refs: refs,
  };
}
