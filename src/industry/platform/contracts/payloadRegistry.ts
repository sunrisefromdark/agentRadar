import type { IndustrySchemaRegistry } from "./schemaRegistry.ts";
import { validatePayloadSchema } from "./schemaRegistry.ts";

type CompatibilityResult =
  | { ok: true; schemaId: string; version: string }
  | { ok: false; reasonCode: "schema_mismatch" | "unsupported_version"; message: string };

function major(version: string): string {
  return version.split(".", 1)[0] ?? "";
}

export function canConsumePayloadSchema(
  registry: IndustrySchemaRegistry,
  schemaId: string,
  producerVersion: string,
): CompatibilityResult {
  const payload = validatePayloadSchema(registry, schemaId);
  if (!payload.ok) return payload;

  const entry = registry.compatibility.entries.find((item) => item.schema_id === schemaId);
  if (!entry) {
    return {
      ok: false,
      reasonCode: "schema_mismatch",
      message: `Missing compatibility entry: ${schemaId}`,
    };
  }

  if (major(entry.current_version) !== major(producerVersion)) {
    return {
      ok: false,
      reasonCode: "unsupported_version",
      message: `Unsupported major version for ${schemaId}: ${producerVersion}`,
    };
  }

  return { ok: true, schemaId, version: producerVersion };
}
