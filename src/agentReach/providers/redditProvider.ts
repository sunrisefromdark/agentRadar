import type { ReservedAgentReachProvider } from "./xTwitterProvider.ts";

export const redditProvider: ReservedAgentReachProvider = {
  provider_id: "reddit",
  platform: "reddit",
  platforms: ["reddit"],
  mode: "manual_import_only",
  default_enabled: false,
  async run() {
    return {
      provider_id: "reddit",
      status: "manual_import_only",
      items: [],
      coverage: {
        reddit: {
          status: "manual_import_only",
          reason: "reserved_provider_not_configured",
        },
      },
      warnings: [],
      rejected_items: [],
    };
  },
};
