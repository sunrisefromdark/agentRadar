import { stableSourceInputHash } from "./redaction.ts";
import type { ExternalPlatform, ExternalSignalEvent } from "./types.ts";

type ExternalActor = ExternalSignalEvent["actor"];

const identityHashesByActor = new WeakMap<object, readonly string[]>();
const IDENTITY_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;

function normalizeHandle(value: string | undefined): string {
  return value?.trim().toLowerCase().replace(/^@/, "") ?? "";
}

function normalizeProfileUrl(value: string | undefined): string {
  return value?.trim().toLowerCase().replace(/\/+$/, "") ?? "";
}

export function buildExternalActorIdentityHashes(input: {
  platform: ExternalPlatform;
  handle?: string;
  profileUrl?: string;
}): string[] {
  const hashes: string[] = [];
  const handle = normalizeHandle(input.handle);
  const profileUrl = normalizeProfileUrl(input.profileUrl);
  if (handle) {
    hashes.push(stableSourceInputHash(`actor-handle:${input.platform}:${handle}`));
  }
  if (profileUrl) {
    hashes.push(stableSourceInputHash(`actor-profile-url:${profileUrl}`));
  }
  return [...new Set(hashes)];
}

export function parseExternalActorIdentityHashes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (item): item is string =>
          typeof item === "string" && IDENTITY_HASH_PATTERN.test(item),
      ),
    ),
  ];
}

export function attachExternalActorIdentityHashes(
  actor: ExternalActor,
  hashes: readonly string[],
): ExternalActor {
  if (hashes.length > 0) identityHashesByActor.set(actor, [...hashes]);
  return actor;
}

export function getExternalActorIdentityHashes(actor: ExternalActor): readonly string[] {
  return identityHashesByActor.get(actor) ?? [];
}
