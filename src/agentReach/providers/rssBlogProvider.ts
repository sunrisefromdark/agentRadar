import type {
  AgentReachProducerProvider,
  AgentReachSearchJob,
} from "../types.ts";
import { runLiveProvider } from "./liveProvider.ts";
import { loadLocalJsonProvider, runLocalJsonProvider } from "./localJsonProvider.ts";

export interface LoadRssBlogProviderInput {
  inputPath: string;
}

export function loadRssBlogProvider(input: LoadRssBlogProviderInput) {
  return loadLocalJsonProvider({
    inputPath: input.inputPath,
    providerId: "rss-blog",
    defaultPlatform: "official_blog",
  });
}

function decodeXmlText(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function tagText(block: string, tag: string): string | undefined {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(block);
  return decodeXmlText(match?.[1]);
}

function atomLink(block: string): string | undefined {
  const match = /<link\b[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i.exec(block);
  return decodeXmlText(match?.[1]);
}

function toIsoDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

function blocks(input: string, tag: string): string[] {
  return [...input.matchAll(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, "gi"))].map(
    (match) => match[0],
  );
}

function termSlug(term: string): string {
  return term
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function jobForFeedItem(
  item: { title?: string; url?: string },
  jobs: readonly AgentReachSearchJob[],
): AgentReachSearchJob | undefined {
  const haystack = `${item.title ?? ""} ${item.url ?? ""}`.toLowerCase();
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

function withSearchJobHints(
  item: Record<string, unknown>,
  job: AgentReachSearchJob | undefined,
): Record<string, unknown> {
  if (!job) return item;
  return {
    ...item,
    direction_labels: job.direction_labels,
    tags: job.tags,
  };
}

function applyFeedJobFilter(
  items: Record<string, unknown>[],
  jobs: readonly AgentReachSearchJob[],
): Record<string, unknown>[] {
  if (jobs.length === 0) return items;
  const acceptedPerJob = new Map<string, number>();
  return items.flatMap((item) => {
    const job = jobForFeedItem(
      {
        title: typeof item.title === "string" ? item.title : undefined,
        url: typeof item.url === "string" ? item.url : undefined,
      },
      jobs,
    );
    if (!job) return [];
    const accepted = acceptedPerJob.get(job.job_id) ?? 0;
    if (accepted >= job.max_items) return [];
    acceptedPerJob.set(job.job_id, accepted + 1);
    return [withSearchJobHints(item, job)];
  });
}

function parseFeedItems(input: {
  url: string;
  body: string;
  observedAt: string;
  jobs: readonly AgentReachSearchJob[];
}): unknown[] {
  const rssItems = blocks(input.body, "item").map((item, index) => {
    const link = tagText(item, "link");
    return {
      raw_ref: `rss:${input.url}#${index + 1}`,
      raw_event_kind: "blog_post",
      derived_signal_kinds: ["discovery"],
      observed_at: input.observedAt,
      ...(toIsoDate(tagText(item, "pubDate") ?? tagText(item, "published")) ? {
        source_published_at: toIsoDate(tagText(item, "pubDate") ?? tagText(item, "published")),
      } : {}),
      ...(link ? { url: link } : {}),
      ...(tagText(item, "title") ? { title: tagText(item, "title") } : {}),
    };
  });
  const atomItems = blocks(input.body, "entry").map((entry, index) => {
    const link = atomLink(entry) ?? tagText(entry, "link");
    return {
      raw_ref: `atom:${input.url}#${index + 1}`,
      raw_event_kind: "blog_post",
      derived_signal_kinds: ["discovery"],
      observed_at: input.observedAt,
      ...(toIsoDate(tagText(entry, "updated") ?? tagText(entry, "published")) ? {
        source_published_at: toIsoDate(tagText(entry, "updated") ?? tagText(entry, "published")),
      } : {}),
      ...(link ? { url: link } : {}),
      ...(tagText(entry, "title") ? { title: tagText(entry, "title") } : {}),
    };
  });
  return applyFeedJobFilter([...rssItems, ...atomItems], input.jobs);
}

export const rssBlogProvider: AgentReachProducerProvider = {
  provider_id: "rss-blog",
  platforms: ["official_blog"],
  mode: "active",
  default_enabled: true,
  async run(context) {
    if (!context.provider_config.input_path) {
      return runLiveProvider({
        context,
        providerId: "rss-blog",
        defaultPlatform: "official_blog",
        parseResponse(input) {
          return parseFeedItems({
            url: input.url,
            body: input.body,
            observedAt: input.context.generated_at,
            jobs: input.context.search_jobs,
          });
        },
      });
    }
    return runLocalJsonProvider({
      context,
      providerId: "rss-blog",
      defaultPlatform: "official_blog",
    });
  },
};
