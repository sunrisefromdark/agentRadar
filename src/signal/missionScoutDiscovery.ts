import { PROJECT_SEARCH_CONSTANTS, type DirectionCatalogEntry } from "./directionCatalog.ts";
import type { DirectionCoverageOutcome, DirectionCoverageSearchDepth, DirectionCoverageStatus, DirectionGapLedgerEntry, DirectionNextAction, RawSignal } from "../types.ts";

export interface MissionScoutSearchResult {
  status: "ok" | "failed";
  raw_hits: number;
  normalized_hits: number;
  quality_passed_hits: number;
  lane_hits: Record<string, number>;
  repo_candidates: Array<{ repo_full_name: string; repo_url: string }>;
  raw_signals?: RawSignal[];
  query_count: number;
  search_exhausted?: boolean;
  error?: string;
}

export interface MissionScoutDiscoveryResult {
  coverage_atlas: DirectionCoverageStatus[];
  gap_ledger: DirectionGapLedgerEntry[];
  raw_signals: RawSignal[];
}

const OUTCOME_EXPLANATIONS_CN: Record<DirectionCoverageOutcome, string> = {
  matched: "今天这个方向有真结果，可以进入正式命中区。",
  weak_signal: "今天看到了苗头，但还不够格推荐。",
  noise_only: "搜过了，但大多不是你要的那类结果。",
  zero_candidate: "认真搜过之后，暂时没有找到候选。",
  search_failed: "搜索本身失败了，本次方向发现降级。",
  disabled: "mission 搜索当前被禁用，本次方向发现降级。",
};

export async function runMissionScoutDiscovery(input: {
  catalog: DirectionCatalogEntry[];
  githubSearchEnabled: boolean;
  search: (args: { direction: DirectionCatalogEntry }) => Promise<MissionScoutSearchResult>;
}): Promise<MissionScoutDiscoveryResult> {
  const coverage_atlas: DirectionCoverageStatus[] = [];
  const gap_ledger: DirectionGapLedgerEntry[] = [];
  const raw_signals: RawSignal[] = [];

  for (const direction of input.catalog) {
    if (!input.githubSearchEnabled) {
      const disabled = buildCoverage(direction, "disabled", {
        raw_hits: 0,
        boundary_passed_hits: 0,
        normalized_hits: 0,
        quality_passed_hits: 0,
        exposed_hits: 0,
      }, ["mission_search_disabled"], "needs_human_seed_refinement");
      coverage_atlas.push(disabled);
      gap_ledger.push(toGapEntry(disabled));
      continue;
    }

    let result: MissionScoutSearchResult;
    try {
      result = await input.search({ direction });
    } catch (error) {
      result = {
        status: "failed",
        raw_hits: 0,
        normalized_hits: 0,
        quality_passed_hits: 0,
        lane_hits: {},
        repo_candidates: [],
        query_count: direction.query_packs.reduce((sum, pack) => sum + pack.templates.length, 0),
        error: String(error),
      };
    }
    raw_signals.push(...(result.raw_signals ?? []));
    const counts = {
      raw_hits: result.raw_hits,
      boundary_passed_hits: result.normalized_hits,
      normalized_hits: result.normalized_hits,
      quality_passed_hits: result.quality_passed_hits,
      exposed_hits: result.repo_candidates.length,
    };

    if (result.status === "failed") {
      const failed = buildCoverage(direction, "search_failed", counts, ["search_failed"], "needs_human_seed_refinement");
      coverage_atlas.push(failed);
      gap_ledger.push(toGapEntry(failed));
      continue;
    }

    const matched = counts.raw_hits >= PROJECT_SEARCH_CONSTANTS.directionRawHitsMin
      && counts.normalized_hits >= PROJECT_SEARCH_CONSTANTS.directionNormalizedHitsMin
      && counts.quality_passed_hits >= PROJECT_SEARCH_CONSTANTS.directionQualityPassedHitsMin;
    const hasRawOnlyNoise = counts.raw_hits > 0 && counts.normalized_hits === 0 && counts.quality_passed_hits === 0;
    const weakSignal = counts.normalized_hits > 0 || counts.quality_passed_hits > 0;
    const outcome = matched ? "matched" : hasRawOnlyNoise ? "noise_only" : weakSignal ? "weak_signal" : "zero_candidate";
    const nextAction: DirectionNextAction = matched
      ? "keep_watching"
      : hasRawOnlyNoise
        ? "needs_human_seed_refinement"
        : weakSignal
          ? "upgrade_to_deep"
          : "wait_for_more_signal";
    const reasonCodes = matched
      ? ["quantity_target_met"]
      : hasRawOnlyNoise
        ? ["boundary_noise_only"]
        : weakSignal
          ? ["quantity_target_unmet"]
          : ["search_zero_result"];
    const status = buildCoverage(
      direction,
      outcome,
      counts,
      result.search_exhausted && !matched ? [...reasonCodes, "search_exhausted"] : reasonCodes,
      nextAction,
      result.search_exhausted && !matched,
    );
    coverage_atlas.push(status);
    if (outcome !== "matched") gap_ledger.push(toGapEntry(status));
  }

  return { coverage_atlas, gap_ledger, raw_signals };
}

function buildCoverage(
  direction: DirectionCatalogEntry,
  outcome: DirectionCoverageStatus["outcome"],
  counts: DirectionCoverageStatus["candidate_counts"],
  reasonCodes: string[],
  nextAction: DirectionNextAction,
  searchExhausted = false,
): DirectionCoverageStatus {
  return {
    direction_key: direction.direction_key,
    family_key: direction.family_key,
    display_name_cn: direction.display_name_cn,
    boundary_mode: direction.boundary_mode,
    search_depth: toCoverageSearchDepth(direction.search_depth),
    query_pack_count: direction.query_packs.length,
    query_template_count: direction.query_packs.reduce((sum, pack) => sum + pack.templates.length, 0),
    lane_types: direction.lane_types,
    pressure_state: "normal",
    outcome,
    reason_codes: reasonCodes,
    explanation_cn: outcome === "matched" ? `「${direction.display_name_cn}」今天已达到覆盖下限。` : OUTCOME_EXPLANATIONS_CN[outcome] ?? direction.zero_result_explanation_cn,
    next_action: nextAction,
    candidate_counts: counts,
    quantity_target_met: outcome === "matched",
    search_exhausted: searchExhausted,
  };
}

function toGapEntry(status: DirectionCoverageStatus): DirectionGapLedgerEntry {
  return { ...status };
}

function toCoverageSearchDepth(searchDepth: DirectionCatalogEntry["search_depth"]): DirectionCoverageSearchDepth {
  return searchDepth === "scout-daily" ? "scout" : "deep";
}
