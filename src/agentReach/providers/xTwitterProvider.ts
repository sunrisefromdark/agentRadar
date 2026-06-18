import type { ExternalPlatform } from "../../externalDiscovery/types.ts";
import type { AgentReachProducerProvider } from "../types.ts";

export interface ReservedAgentReachProvider extends AgentReachProducerProvider {
  provider_id: "x_twitter" | "reddit";
  platform: ExternalPlatform;
  mode: "manual_import_only";
  default_enabled: false;
}

export const xTwitterProvider: ReservedAgentReachProvider = {
  provider_id: "x_twitter",
  platform: "x_twitter",
  platforms: ["x_twitter"],
  mode: "manual_import_only",
  default_enabled: false,
  async run() {
    return {
      provider_id: "x_twitter",
      status: "manual_import_only",
      items: [],
      coverage: {
        x_twitter: {
          status: "manual_import_only",
          reason: "reserved_provider_not_configured",
        },
      },
      warnings: [],
      rejected_items: [],
    };
  },
};
