import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type SchemaEntry = {
  schema_id: string;
  schema_kind: string;
  required_fields?: string[];
};

type CompatibilityEntry = {
  schema_id: string;
  current_version: string;
};

type RegistryFile = {
  schema_version: string;
};

type ReasonCodeEntry = {
  code: string;
};

type StateTransitionEntry = {
  state_family: string;
  local_state: string;
};

export type IndustrySchemaRegistry = {
  canonical: {
    bundle_id: string;
    entries: SchemaEntry[];
  };
  compatibility: RegistryFile & {
    entries: CompatibilityEntry[];
  };
  reasonCodes: RegistryFile & {
    codes: ReasonCodeEntry[];
  };
  stateTransitions: RegistryFile & {
    entries: StateTransitionEntry[];
  };
};

type PayloadValidation =
  | { ok: true; schemaId: string }
  | { ok: false; reasonCode: "schema_mismatch"; message: string };

const registryDir = path.resolve(fileURLToPath(new URL("../../../../", import.meta.url)), "schemas", "industry");

function readJson<T>(fileName: string): T {
  return JSON.parse(fs.readFileSync(path.join(registryDir, fileName), "utf-8")) as T;
}

export function loadIndustrySchemaRegistry(): IndustrySchemaRegistry {
  return {
    canonical: readJson("canonical-schema.bundle.json"),
    compatibility: readJson("compatibility-matrix.json"),
    reasonCodes: readJson("reason-code-registry.json"),
    stateTransitions: readJson("state-transition-registry.json"),
  };
}

export function getPayloadSchemaIds(registry: IndustrySchemaRegistry): string[] {
  return registry.canonical.entries.filter((entry) => entry.schema_kind === "payload").map((entry) => entry.schema_id);
}

export function validatePayloadSchema(registry: IndustrySchemaRegistry, schemaId: string): PayloadValidation {
  if (getPayloadSchemaIds(registry).includes(schemaId)) {
    return { ok: true, schemaId };
  }

  return {
    ok: false,
    reasonCode: "schema_mismatch",
    message: `Unsupported payload_schema: ${schemaId}`,
  };
}
