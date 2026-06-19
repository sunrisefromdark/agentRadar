import { selectAgentReachProviders } from "./providerRegistry.ts";
import type { AgentReachQueryEntry } from "./queryPack.ts";
import type {
  AgentReachProducerProvider,
  AgentReachProviderConfigMap,
  AgentReachProviderId,
  AgentReachQualityPolicy,
  AgentReachSearchJob,
  AgentReachSearchPlan,
} from "./types.ts";

const SEARCH_BACKED_PROVIDER_IDS = new Set<AgentReachProviderId>([
  "rss-blog",
  "official-web",
  "hacker-news",
]);

const RESERVED_PROVIDER_IDS = new Set<AgentReachProviderId>([
  "x_twitter",
  "reddit",
]);

export interface PlanAgentReachSearchJobsInput {
  providers: readonly AgentReachProducerProvider[];
  selected_provider_ids: readonly AgentReachProviderId[];
  query_pack: readonly AgentReachQueryEntry[];
  provider_configs: AgentReachProviderConfigMap;
  quality_policy: AgentReachQualityPolicy;
}

function slugTerm(term: string): string {
  const slug = term
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "query";
}

function limitedQueryPack(
  queryPack: readonly AgentReachQueryEntry[],
  providerId: AgentReachProviderId,
  providerConfigs: AgentReachProviderConfigMap,
): readonly AgentReachQueryEntry[] {
  const limit = providerConfigs[providerId]?.live?.query_limit;
  return limit === undefined ? queryPack : queryPack.slice(0, limit);
}

export function planAgentReachSearchJobs(
  input: PlanAgentReachSearchJobsInput,
): AgentReachSearchPlan {
  const selectedProviders = selectAgentReachProviders(
    input.providers,
    input.selected_provider_ids,
  );
  const jobs: AgentReachSearchJob[] = [];
  const seenJobIds = new Map<string, number>();

  for (const provider of selectedProviders) {
    if (!SEARCH_BACKED_PROVIDER_IDS.has(provider.provider_id)) continue;

    for (const query of limitedQueryPack(
      input.query_pack,
      provider.provider_id,
      input.provider_configs,
    )) {
      for (const term of query.terms) {
        const baseJobId = `${provider.provider_id}:${query.id}:${slugTerm(term)}`;
        const seen = seenJobIds.get(baseJobId) ?? 0;
        seenJobIds.set(baseJobId, seen + 1);
        jobs.push({
          job_id: seen === 0 ? baseJobId : `${baseJobId}-${seen + 1}`,
          provider_id: provider.provider_id,
          query_entry_id: query.id,
          term,
          direction_labels: [...query.direction_labels],
          tags: [...(query.tags ?? [])],
          max_items: input.quality_policy.max_items_per_query,
        });
      }
    }
  }

  const queryEntryIds = new Set(jobs.map((job) => job.query_entry_id));
  const providerJobCounts: Partial<Record<AgentReachProviderId, number>> = {};
  for (const job of jobs) {
    providerJobCounts[job.provider_id] =
      (providerJobCounts[job.provider_id] ?? 0) + 1;
  }

  return {
    jobs,
    summary: {
      job_count: jobs.length,
      provider_count: selectedProviders.filter((provider) =>
        SEARCH_BACKED_PROVIDER_IDS.has(provider.provider_id),
      ).length,
      query_entry_count: queryEntryIds.size,
      reserved_provider_count: selectedProviders.filter((provider) =>
        RESERVED_PROVIDER_IDS.has(provider.provider_id),
      ).length,
      max_items_per_query: input.quality_policy.max_items_per_query,
      provider_job_counts: providerJobCounts,
    },
  };
}
