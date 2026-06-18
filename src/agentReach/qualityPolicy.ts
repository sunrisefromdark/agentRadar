import type {
  AgentReachQualityPolicy,
  AgentReachQualityPolicyInput,
} from "./types.ts";

export const AGENT_REACH_DEFAULT_QUALITY_POLICY: AgentReachQualityPolicy = {
  lookback_days: 180,
  max_items_per_query: 20,
  max_items_per_provider: 50,
  max_items_total: 100,
};

const POLICY_RANGES = {
  lookback_days: [1, 3650],
  max_items_per_query: [1, 100],
  max_items_per_provider: [1, 500],
  max_items_total: [1, 1000],
} as const;

function boundedInteger(
  key: keyof AgentReachQualityPolicy,
  value: number,
): number {
  const [minimum, maximum] = POLICY_RANGES[key];
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `quality.${key} must be an integer between ${minimum} and ${maximum}`,
    );
  }
  return value;
}

export function resolveAgentReachQualityPolicy(
  input: AgentReachQualityPolicyInput = {},
): AgentReachQualityPolicy {
  const policy: AgentReachQualityPolicy = {
    lookback_days: boundedInteger(
      "lookback_days",
      input.lookback_days ?? AGENT_REACH_DEFAULT_QUALITY_POLICY.lookback_days,
    ),
    max_items_per_query: boundedInteger(
      "max_items_per_query",
      input.max_items_per_query ??
        AGENT_REACH_DEFAULT_QUALITY_POLICY.max_items_per_query,
    ),
    max_items_per_provider: boundedInteger(
      "max_items_per_provider",
      input.max_items_per_provider ??
        AGENT_REACH_DEFAULT_QUALITY_POLICY.max_items_per_provider,
    ),
    max_items_total: boundedInteger(
      "max_items_total",
      input.max_items_total ?? AGENT_REACH_DEFAULT_QUALITY_POLICY.max_items_total,
    ),
  };

  if (policy.max_items_per_query > policy.max_items_per_provider) {
    throw new Error(
      "quality.max_items_per_query must not exceed max_items_per_provider",
    );
  }
  if (policy.max_items_per_provider > policy.max_items_total) {
    throw new Error(
      "quality.max_items_per_provider must not exceed max_items_total",
    );
  }
  return policy;
}
