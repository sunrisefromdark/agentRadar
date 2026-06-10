const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateOnly(value: string): boolean {
  if (!DATE_ONLY_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

export function assertValidDateOnly(value: string, label = "date"): string {
  if (!isValidDateOnly(value)) {
    throw new Error(`${label} must match YYYY-MM-DD, received "${value}"`);
  }
  return value;
}

export function assertValidDateOnlyOrLatest(value: string, label = "date"): string {
  if (value === "latest") return value;
  return assertValidDateOnly(value, label);
}
