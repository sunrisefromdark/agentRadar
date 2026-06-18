import type { AgentReachProducerProvider } from "../types.ts";
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

function parseFeedItems(input: { url: string; body: string; observedAt: string }): unknown[] {
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
  return [...rssItems, ...atomItems];
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
