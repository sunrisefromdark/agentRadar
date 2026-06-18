import type { AgentReachProducerProvider } from "../types.ts";
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

export const hackerNewsProvider: AgentReachProducerProvider = {
  provider_id: "hacker-news",
  platforms: ["hacker_news"],
  mode: "active",
  default_enabled: true,
  async run(context) {
    return runLocalJsonProvider({
      context,
      providerId: "hacker-news",
      defaultPlatform: "hacker_news",
    });
  },
};
