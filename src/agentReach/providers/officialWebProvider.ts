import type { AgentReachProducerProvider } from "../types.ts";
import { runLiveProvider } from "./liveProvider.ts";
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

function parseOfficialPage(input: { url: string; body: string; observedAt: string }): unknown[] {
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
    },
  ];
}

export const officialWebProvider: AgentReachProducerProvider = {
  provider_id: "official-web",
  platforms: ["official_web"],
  mode: "active",
  default_enabled: true,
  async run(context) {
    if (!context.provider_config.input_path) {
      return runLiveProvider({
        context,
        providerId: "official-web",
        defaultPlatform: "official_web",
        parseResponse(input) {
          return parseOfficialPage({
            url: input.url,
            body: input.body,
            observedAt: input.context.generated_at,
          });
        },
      });
    }
    return runLocalJsonProvider({
      context,
      providerId: "official-web",
      defaultPlatform: "official_web",
    });
  },
};
