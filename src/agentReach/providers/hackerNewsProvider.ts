import type { AgentReachProducerProvider } from "../types.ts";
import { AgentReachProviderError } from "../providerErrors.ts";
import { runLiveProvider } from "./liveProvider.ts";
import { loadLocalJsonProvider, runLocalJsonProvider } from "./localJsonProvider.ts";

export interface LoadHackerNewsProviderInput {
  inputPath: string;
}

export function loadHackerNewsProvider(input: LoadHackerNewsProviderInput) {
  return loadLocalJsonProvider({
    inputPath: input.inputPath,
    providerId: "hacker-news",
    defaultPlatform: "hacker_news",
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toIsoDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

function hackerNewsItemUrl(hit: Record<string, unknown>, objectId: string): string {
  return (
    optionalString(hit.url) ??
    optionalString(hit.story_url) ??
    `https://news.ycombinator.com/item?id=${objectId}`
  );
}

function parseHackerNewsHits(
  body: string,
  observedAt: string,
  maxHits: number,
): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch (error) {
    throw new AgentReachProviderError({
      providerId: "hacker-news",
      code: "input_invalid",
      retryable: false,
      safeMessage: "hacker-news response JSON is invalid",
      cause: error,
    });
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.hits)) {
    throw new AgentReachProviderError({
      providerId: "hacker-news",
      code: "input_invalid",
      retryable: false,
      safeMessage: "hacker-news response must contain hits[]",
    });
  }

  return parsed.hits.filter(isRecord).flatMap((hit) => {
    const objectId = optionalString(hit.objectID);
    if (!objectId) return [];
    const points = optionalNumber(hit.points);
    const comments = optionalNumber(hit.num_comments);
    return [
      {
        raw_ref: `hn:${objectId}`,
        raw_event_kind: "discussion",
        derived_signal_kinds: ["discovery"],
        observed_at: observedAt,
        ...(toIsoDate(optionalString(hit.created_at)) ? {
          source_published_at: toIsoDate(optionalString(hit.created_at)),
        } : {}),
        url: hackerNewsItemUrl(hit, objectId),
        ...(optionalString(hit.title) ?? optionalString(hit.story_title)
          ? { title: optionalString(hit.title) ?? optionalString(hit.story_title) }
          : {}),
        ...(optionalString(hit.author)
          ? { actor: { display_name: optionalString(hit.author) } }
          : {}),
        ...(points !== undefined || comments !== undefined
          ? {
              metrics: {
                ...(points !== undefined ? { points } : {}),
                ...(comments !== undefined ? { comments } : {}),
              },
            }
          : {}),
      },
    ];
  }).slice(0, maxHits);
}

function hackerNewsSearchUrls(
  baseUrl: string,
  terms: string[],
  hitsPerPage: number,
): string[] {
  return terms.map((term) => {
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}query=${encodeURIComponent(term)}&tags=story&hitsPerPage=${hitsPerPage}`;
  });
}

export const hackerNewsProvider: AgentReachProducerProvider = {
  provider_id: "hacker-news",
  platforms: ["hacker_news"],
  mode: "active",
  default_enabled: true,
  async run(context) {
    if (!context.provider_config.input_path && context.provider_config.live?.enabled === true) {
      const baseUrl = context.provider_config.live.urls?.[0];
      if (!baseUrl) {
        throw new AgentReachProviderError({
          providerId: "hacker-news",
          code: "configuration_invalid",
          retryable: false,
          safeMessage: "hacker-news live search url is required",
        });
      }
      const queryLimit = context.provider_config.live.query_limit ?? 3;
      const terms = context.query_pack.flatMap((entry) => entry.terms).slice(0, queryLimit);
      const maxHitsPerQuery = context.quality_policy.max_items_per_query;
      return runLiveProvider({
        context: {
          ...context,
          provider_config: {
            ...context.provider_config,
            live: {
              ...context.provider_config.live,
              urls: hackerNewsSearchUrls(baseUrl, terms, maxHitsPerQuery),
            },
          },
        },
        providerId: "hacker-news",
        defaultPlatform: "hacker_news",
        parseResponse(input) {
          return parseHackerNewsHits(
            input.body,
            input.context.generated_at,
            maxHitsPerQuery,
          );
        },
      });
    }
    return runLocalJsonProvider({
      context,
      providerId: "hacker-news",
      defaultPlatform: "hacker_news",
    });
  },
};
