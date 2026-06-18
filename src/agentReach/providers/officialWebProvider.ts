import type { AgentReachProducerProvider } from "../types.ts";
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

export const officialWebProvider: AgentReachProducerProvider = {
  provider_id: "official-web",
  platforms: ["official_web"],
  mode: "active",
  default_enabled: true,
  async run(context) {
    return runLocalJsonProvider({
      context,
      providerId: "official-web",
      defaultPlatform: "official_web",
    });
  },
};
