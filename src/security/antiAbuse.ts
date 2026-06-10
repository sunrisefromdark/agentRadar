export type AccessMode = "public" | "local-only" | "disabled";

export interface RateLimitRule {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

export interface AbuseBlockRule {
  threshold: number;
  windowMs: number;
  banMs: number;
}

type BucketState = {
  count: number;
  resetAt: number;
};

export class InMemoryRateLimiter {
  private readonly buckets = new Map<string, BucketState>();
  private readonly now: () => number;

  constructor(now: () => number = () => Date.now()) {
    this.now = now;
  }

  take(key: string, rule: RateLimitRule): RateLimitDecision {
    const now = this.now();
    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      const resetAt = now + Math.max(1, rule.windowMs);
      this.buckets.set(key, { count: 1, resetAt });
      this.trimExpired(now);
      return {
        allowed: true,
        remaining: Math.max(0, rule.maxRequests - 1),
        resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      };
    }

    existing.count += 1;
    const allowed = existing.count <= rule.maxRequests;
    return {
      allowed,
      remaining: Math.max(0, rule.maxRequests - existing.count),
      resetAt: existing.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  private trimExpired(now: number): void {
    if (this.buckets.size < 512) return;
    for (const [key, value] of this.buckets.entries()) {
      if (value.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}

type ViolationWindow = {
  count: number;
  resetAt: number;
};

export class InMemoryAbuseBlocker {
  private readonly blockedUntil = new Map<string, number>();
  private readonly violationWindows = new Map<string, ViolationWindow>();
  private readonly now: () => number;

  constructor(now: () => number = () => Date.now()) {
    this.now = now;
  }

  isBlocked(key: string): { blocked: boolean; retryAfterSeconds: number } {
    const now = this.now();
    const expiresAt = this.blockedUntil.get(key);
    if (!expiresAt || expiresAt <= now) {
      if (expiresAt) this.blockedUntil.delete(key);
      return { blocked: false, retryAfterSeconds: 0 };
    }
    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((expiresAt - now) / 1000)),
    };
  }

  recordViolation(key: string, rule: AbuseBlockRule): { blocked: boolean; retryAfterSeconds: number } {
    const current = this.isBlocked(key);
    if (current.blocked) return current;

    const now = this.now();
    const existing = this.violationWindows.get(key);
    if (!existing || existing.resetAt <= now) {
      this.violationWindows.set(key, {
        count: 1,
        resetAt: now + Math.max(1, rule.windowMs),
      });
      this.trimExpired(now);
      return { blocked: false, retryAfterSeconds: 0 };
    }

    existing.count += 1;
    if (existing.count < rule.threshold) {
      return { blocked: false, retryAfterSeconds: 0 };
    }

    const blockedUntil = now + Math.max(1, rule.banMs);
    this.blockedUntil.set(key, blockedUntil);
    this.violationWindows.delete(key);
    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((blockedUntil - now) / 1000)),
    };
  }

  private trimExpired(now: number): void {
    if (this.violationWindows.size >= 512) {
      for (const [key, value] of this.violationWindows.entries()) {
        if (value.resetAt <= now) {
          this.violationWindows.delete(key);
        }
      }
    }
    if (this.blockedUntil.size >= 512) {
      for (const [key, value] of this.blockedUntil.entries()) {
        if (value <= now) {
          this.blockedUntil.delete(key);
        }
      }
    }
  }
}

export function normalizeIp(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^::ffff:/i, "").toLowerCase();
}

export function isLoopbackIp(value: string | null | undefined): boolean {
  const normalized = normalizeIp(value);
  return normalized === "127.0.0.1" || normalized === "::1" || normalized === "[::1]" || normalized === "localhost";
}

function parseIpv4Octets(value: string): number[] | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => Number.parseInt(part, 10));
  return octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255) ? octets : null;
}

function isPrivateIpv6(value: string): boolean {
  return value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:");
}

function isPrivateIpv4Octets(octets: number[]): boolean {
  const [first, second] = octets;
  if (first === 10) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  return first === 169 && second === 254;
}

export function isPrivateNetworkIp(value: string | null | undefined): boolean {
  const normalized = normalizeIp(value);
  if (!normalized) return false;
  if (isLoopbackIp(normalized)) return true;
  if (isPrivateIpv6(normalized)) return true;
  const octets = parseIpv4Octets(normalized);
  if (!octets) return false;
  return isPrivateIpv4Octets(octets);
}

export function isTrustedProxyPeerIp(value: string | null | undefined, allowPrivateNetwork: boolean): boolean {
  if (isLoopbackIp(value)) return true;
  return allowPrivateNetwork && isPrivateNetworkIp(value);
}

export function accessModeAllows(mode: AccessMode, clientIp: string | null | undefined): boolean {
  if (mode === "public") return true;
  if (mode === "disabled") return false;
  return isLoopbackIp(clientIp);
}
