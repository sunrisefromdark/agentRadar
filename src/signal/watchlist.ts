import type { RawSignal } from "../types.ts";
import { extractGitHubRepoFullName } from "./githubMetrics.ts";

function ownerFromRepoUrl(repoUrl: string): string {
  const repoFullName = extractGitHubRepoFullName(repoUrl);
  return repoFullName.split("/")[0] ?? "";
}

export function annotateWatchlistSignals(signals: RawSignal[], watchlistOrgs: string[]): RawSignal[] {
  const watchlist = new Map(watchlistOrgs.map((org) => [org.toLowerCase(), org]));

  return signals.map((signal) => {
    const owner = ownerFromRepoUrl(signal.repo_url);
    const matchedOrg = watchlist.get(owner.toLowerCase());
    if (!matchedOrg) return signal;

    return {
      ...signal,
      tags: [...new Set([...signal.tags, "watchlist-hit", `watchlist:${matchedOrg}`])],
    };
  });
}
