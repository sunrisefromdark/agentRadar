const EXTERNAL_RAW_INPUT_DIR = "data/raw/external-discovery";
const EXTERNAL_PUBLIC_DIR = "data/external-discovery";
const EXTERNAL_SANITIZED_FIXTURE_DIR = `${EXTERNAL_RAW_INPUT_DIR}/fixtures`;

export function externalRawInputPath(date: string): string {
  return `${EXTERNAL_RAW_INPUT_DIR}/${date}.agent-reach.json`;
}

export function externalAggregatePath(date: string): string {
  return `${EXTERNAL_PUBLIC_DIR}/${date}.aggregate.json`;
}

export function externalAggregateLatestPath(): string {
  return `${EXTERNAL_PUBLIC_DIR}/latest.aggregate.json`;
}

export function externalEntityRegistryPath(): string {
  return `${EXTERNAL_PUBLIC_DIR}/entity-registry.json`;
}

export function externalSanitizedFixtureDirPath(): string {
  return EXTERNAL_SANITIZED_FIXTURE_DIR;
}
