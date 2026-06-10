function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "");
}

function normalizeJsonishText(text: string): string {
  return stripThinkTags(text)
    .replace(/^\uFEFF/, "")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\r\n/g, "\n")
    .trim();
}

function stripJsonComments(text: string): string {
  return text
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^\s*#(?![{\[]).*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

function stripPlaceholderEllipsis(text: string): string {
  return text
    .replace(/,\s*(?:\.\.\.|…)\s*(?=[}\]])/g, "")
    .replace(/^\s*(?:\.\.\.|…)\s*,?\s*$/gm, "")
    .replace(/,\s*(?:\.\.\.|…)\s*(?=(?:\r?\n))/g, "");
}

function sanitizeJsonishCandidate(text: string): string {
  return stripTrailingCommas(stripPlaceholderEllipsis(stripJsonComments(text))).trim();
}

function extractFencedJson(text: string): string | undefined {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced?.[1]?.trim() || undefined;
}

function stripTrailingCommas(text: string): string {
  return text.replace(/,\s*([}\]])/g, "$1");
}

function completeLikelyTruncatedJson(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return undefined;

  const closers: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      closers.push("}");
      continue;
    }
    if (char === "[") {
      closers.push("]");
      continue;
    }

    if (char === "}" || char === "]") {
      const expected = closers.pop();
      if (expected !== char) return undefined;
    }
  }

  const suffix = `${inString && !escaped ? '"' : ""}${closers.reverse().join("")}`;
  if (!suffix) return undefined;
  return sanitizeJsonishCandidate(`${trimmed}${suffix}`);
}

function maybeParseNestedJson<T>(value: unknown, depth = 0): T | undefined {
  if (depth >= 2 || typeof value !== "string") return value as T | undefined;
  const nested = tryParseCandidates<T>([value], depth + 1);
  return nested ?? (value as T);
}

function tryParseCandidates<T>(candidates: string[], depth = 0): T | undefined {
  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    try {
      return maybeParseNestedJson<T>(JSON.parse(trimmed), depth);
    } catch {}
    try {
      return maybeParseNestedJson<T>(JSON.parse(sanitizeJsonishCandidate(trimmed)), depth);
    } catch {}
  }
  return undefined;
}

function extractBalancedJsonValues(text: string): string[] {
  const results: string[] = [];
  const stack: string[] = [];
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      if (stack.length === 0) start = i;
      stack.push(char === "{" ? "}" : "]");
      continue;
    }

    if (stack.length === 0) continue;
    const expectedClose = stack[stack.length - 1];
    if (char !== expectedClose) continue;
    stack.pop();
    if (stack.length === 0 && start >= 0) {
      results.push(text.slice(start, i + 1));
      start = -1;
    }
  }

  return results;
}

export function parseJsonObjectFromText<T>(text: string): T {
  const normalized = normalizeJsonishText(text);
  const fenced = extractFencedJson(normalized);
  const sanitizedNormalized = sanitizeJsonishCandidate(normalized);
  const sanitizedFenced = fenced ? sanitizeJsonishCandidate(fenced) : "";
  const repairedNormalized = completeLikelyTruncatedJson(sanitizedNormalized);
  const repairedFenced = sanitizedFenced ? completeLikelyTruncatedJson(sanitizedFenced) : undefined;
  const balanced = extractBalancedJsonValues(sanitizedFenced || sanitizedNormalized).map(sanitizeJsonishCandidate);
  const parsed = tryParseCandidates<T>(
    [repairedFenced ?? "", sanitizedFenced, fenced ?? "", repairedNormalized ?? "", sanitizedNormalized, normalized, ...balanced].filter(Boolean),
  );

  if (parsed !== undefined) return parsed;

  const jsonText = balanced[0] ?? repairedFenced ?? sanitizedFenced ?? repairedNormalized ?? sanitizedNormalized;
  return maybeParseNestedJson<T>(JSON.parse(jsonText)) as T;
}
