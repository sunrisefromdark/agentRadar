import type { AgentReachProducerProvider } from "../types.ts";
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

export const rssBlogProvider: AgentReachProducerProvider = {
  provider_id: "rss-blog",
  platforms: ["official_blog"],
  mode: "active",
  default_enabled: true,
  async run(context) {
    return runLocalJsonProvider({
      context,
      providerId: "rss-blog",
      defaultPlatform: "official_blog",
    });
  },
};
