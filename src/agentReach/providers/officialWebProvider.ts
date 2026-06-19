import { normalizeAgentReachProviderItems } from "../normalizer.ts";
import { AgentReachProviderError, toSafeAgentReachProviderError } from "../providerErrors.ts";
import type {
  AgentReachProducerProvider,
  AgentReachProviderContext,
  AgentReachProviderResult,
  AgentReachSearchJob,
} from "../types.ts";
import { liveProviderNotConfigured } from "./liveProvider.ts";
import { loadLocalJsonProvider, runLocalJsonProvider } from "./localJsonProvider.ts";

export interface LoadOfficialWebProviderInput {
  inputPath: string;
}

export function loadOfficialWebProvider(input: LoadOfficialWebProviderInput) {
  return loadLocalJsonProvider({
    inputPath: input.inputPath,
    providerId: "official-web",
    defaultPlatform: "official_web",
  });
}

function decodeHtml(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlTitle(body: string): string | undefined {
  return decodeHtml(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(body)?.[1]);
}

function attr(tag: string, name: string): string | undefined {
  const match = new RegExp(`${name}=["']([^"']+)["']`, "i").exec(tag);
  return decodeHtml(match?.[1]);
}

function canonicalUrl(body: string): string | undefined {
  const linkTags = [...body.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0]);
  const canonical = linkTags.find((tag) => attr(tag, "rel")?.toLowerCase() === "canonical");
  return canonical ? attr(canonical, "href") : undefined;
}

function metaDescription(body: string): string | undefined {
  const metaTags = [...body.matchAll(/<meta\b[^>]*>/gi)].map((match) => match[0]);
  const description = metaTags.find(
    (tag) => attr(tag, "name")?.toLowerCase() === "description",
  );
  return description ? attr(description, "content") : undefined;
}

function parseOfficialPage(input: {
  url: string;
  body: string;
  observedAt: string;
  job?: AgentReachSearchJob;
}): unknown[] {
  const url = canonicalUrl(input.body) ?? input.url;
  const title = htmlTitle(input.body);
  const description = metaDescription(input.body);
  return [
    {
      raw_ref: `official-web:${url}`,
      raw_event_kind: "official_release",
      derived_signal_kinds: ["discovery"],
      observed_at: input.observedAt,
      url,
      ...(title ? { title } : {}),
      target: {
        url,
        ...(description ? { topic_hint: description } : {}),
      },
      ...(input.job
        ? {
            direction_labels: input.job.direction_labels,
            tags: input.job.tags,
          }
        : {}),
    },
  ];
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function isSitemap(input: { url: string; contentType?: string; body: string }): boolean {
  return (
    input.url.toLowerCase().endsWith(".xml") ||
    input.contentType?.toLowerCase().includes("xml") === true ||
    /<urlset\b/i.test(input.body)
  );
}

function sitemapLocs(body: string): string[] {
  return [...body.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)]
    .map((match) => decodeHtml(match[1]))
    .filter((value): value is string => value !== undefined);
}

function safeUrl(value: string): URL | undefined {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function termSlug(term: string): string {
  return term
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function jobForUrl(
  url: string,
  jobs: readonly AgentReachSearchJob[],
): AgentReachSearchJob | undefined {
  const haystack = url.toLowerCase();
  return jobs.find((job) => {
    const slug = termSlug(job.term);
    if (slug && haystack.includes(slug)) return true;
    return job.term
      .toLowerCase()
      .split(/\s+/)
      .filter((part) => part.length > 2)
      .every((part) => haystack.includes(part));
  });
}

function sameHostname(candidate: string, base: string): boolean {
  const candidateUrl = safeUrl(candidate);
  const baseUrl = safeUrl(base);
  return (
    candidateUrl !== undefined &&
    baseUrl !== undefined &&
    candidateUrl.hostname === baseUrl.hostname
  );
}

async function fetchOfficialUrl(
  context: AgentReachProviderContext,
  url: string,
): Promise<{ body: string; contentType?: string }> {
  const liveConfig = context.provider_config.live;
  const response = await context.transport.request({
    provider_id: "official-web",
    url,
    method: "GET",
    headers: {},
    timeout_ms: positiveInteger(liveConfig?.timeout_ms, 5000),
    max_response_bytes: positiveInteger(liveConfig?.max_response_bytes, 512_000),
  });
  return {
    body: response.body,
    contentType: response.headers["content-type"],
  };
}

async function runOfficialWebLiveProvider(
  context: AgentReachProviderContext,
): Promise<AgentReachProviderResult> {
  const liveConfig = context.provider_config.live;
  if (liveConfig?.enabled !== true) {
    return liveProviderNotConfigured({
      providerId: "official-web",
      defaultPlatform: "official_web",
    });
  }
  const urls = liveConfig.urls ?? [];
  if (urls.length === 0) {
    throw new AgentReachProviderError({
      providerId: "official-web",
      code: "configuration_invalid",
      retryable: false,
      safeMessage: "official-web live urls are required",
    });
  }

  const rawItems: unknown[] = [];
  const warnings: string[] = [];
  const seenPageUrls = new Set<string>();
  let failedFetchCount = 0;
  const maxPages = Math.max(
    1,
    Math.min(
      context.quality_policy.max_items_per_provider,
      context.search_jobs.length || context.quality_policy.max_items_per_query,
    ),
  );

  async function fetchAndParsePage(url: string, job?: AgentReachSearchJob): Promise<void> {
    if (seenPageUrls.has(url) || seenPageUrls.size >= maxPages) return;
    seenPageUrls.add(url);
    try {
      const response = await fetchOfficialUrl(context, url);
      rawItems.push(
        ...parseOfficialPage({
          url,
          body: response.body,
          observedAt: context.generated_at,
          job,
        }),
      );
    } catch (error) {
      failedFetchCount += 1;
      warnings.push(
        `live_fetch_failed:${toSafeAgentReachProviderError(error, "official-web").code}`,
      );
    }
  }

  for (const url of urls) {
    let seedResponse: { body: string; contentType?: string };
    try {
      seedResponse = await fetchOfficialUrl(context, url);
    } catch (error) {
      failedFetchCount += 1;
      warnings.push(
        `live_fetch_failed:${toSafeAgentReachProviderError(error, "official-web").code}`,
      );
      continue;
    }

    if (!isSitemap({ url, contentType: seedResponse.contentType, body: seedResponse.body })) {
      if (!seenPageUrls.has(url) && seenPageUrls.size < maxPages) {
        seenPageUrls.add(url);
        rawItems.push(
          ...parseOfficialPage({
            url,
            body: seedResponse.body,
            observedAt: context.generated_at,
            job: jobForUrl(url, context.search_jobs),
          }),
        );
      }
      continue;
    }

    for (const loc of sitemapLocs(seedResponse.body)) {
      if (!sameHostname(loc, url)) continue;
      const job = jobForUrl(loc, context.search_jobs);
      if (context.search_jobs.length > 0 && !job) continue;
      await fetchAndParsePage(loc, job);
    }
  }

  if (rawItems.length === 0 && failedFetchCount > 0) {
    return {
      provider_id: "official-web",
      status: "unavailable",
      items: [],
      coverage: {
        official_web: {
          status: "unavailable",
          reason: "provider_transport_unavailable",
          warnings,
        },
      },
      warnings,
      rejected_items: [],
    };
  }

  const result = normalizeAgentReachProviderItems({
    providerId: "official-web",
    rawItems,
    defaultPlatform: "official_web",
  });

  if (failedFetchCount === 0) return result;
  return {
    ...result,
    status: result.status === "failed" ? "failed" : "partial",
    coverage: {
      ...result.coverage,
      official_web: {
        status: result.coverage.official_web?.status === "failed" ? "failed" : "partial",
        reason: "provider_transport_partial",
        warnings,
      },
    },
    warnings: [...result.warnings, ...warnings],
  };
}

export const officialWebProvider: AgentReachProducerProvider = {
  provider_id: "official-web",
  platforms: ["official_web"],
  mode: "active",
  default_enabled: true,
  async run(context) {
    if (!context.provider_config.input_path) {
      return runOfficialWebLiveProvider(context);
    }
    return runLocalJsonProvider({
      context,
      providerId: "official-web",
      defaultPlatform: "official_web",
    });
  },
};
