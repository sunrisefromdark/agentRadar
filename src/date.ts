/**
 * Date and timing utilities used across the pipeline.
 */

const CST_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Convert a Date to a CST (UTC+8) date string like "2026-03-11". */
export function toCstDateStr(date: Date): string {
  return new Date(date.getTime() + CST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Format a Date as a local date string like "2026-03-11". */
export function toLocalDateStr(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Format a Date as a compact UTC string like "2026-03-11 00:00". */
export function toUtcStr(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

/** Format a Date as an ISO-8601 string in the user's local timezone. */
export function toLocalIsoString(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffsetMinutes = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absoluteOffsetMinutes / 60)).padStart(2, "0");
  const offsetRemainderMinutes = String(absoluteOffsetMinutes % 60).padStart(2, "0");

  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetRemainderMinutes}`;
}

/** Promise-based delay. */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
