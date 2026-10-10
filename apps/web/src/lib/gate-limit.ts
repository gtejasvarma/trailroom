// A small in-memory limiter for failed password attempts. It is per instance and resets on a
// restart, so it only slows guessing; Cloud Armor (rate limiting at the load balancer) is the
// real control. Pure and clock-injectable so it can be tested.

export interface AttemptLimiter {
  /** True when this client has used up its attempts in the window. */
  blocked(key: string): boolean;
  /** Counts one attempt against the key (the gate counts only its failures). */
  record(key: string): void;
  /** The gate's name for the same thing. */
  recordFailure(key: string): void;
}

const MAX_KEYS = 10_000;

export function createAttemptLimiter(
  max = 10,
  windowMs = 10 * 60 * 1000,
  now: () => number = Date.now,
): AttemptLimiter {
  const failures = new Map<string, number[]>();
  const live = (key: string) => {
    const cutoff = now() - windowMs;
    const kept = (failures.get(key) ?? []).filter((t) => t > cutoff);
    if (kept.length > 0) failures.set(key, kept);
    else failures.delete(key);
    return kept;
  };
  const record = (key: string) => {
    const kept = live(key);
    kept.push(now());
    // Delete first so a re-recorded key moves to the back of the insertion order.
    failures.delete(key);
    failures.set(key, kept);
    // Bound memory by evicting the oldest keys, so a flood of distinct keys cannot reset
    // anyone else's counter.
    while (failures.size > MAX_KEYS) {
      const oldest = failures.keys().next().value;
      if (oldest === undefined) break;
      failures.delete(oldest);
    }
  };
  return {
    blocked: (key) => live(key).length >= max,
    record,
    recordFailure: record,
  };
}

/**
 * The client IP, counted from the RIGHT of x-forwarded-for: the proxies in front of us append
 * the address they saw, so only the entries nearest the end are ours; everything to their left
 * is whatever the client claimed. `hops` is how many trusted proxies there are (1 = the
 * rightmost entry). A shorter list falls back to its leftmost entry; no header is one shared key.
 */
export function clientKeyFrom(headers: Headers, hops: number): string {
  const parts = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return "unknown";
  const n = Number.isInteger(hops) && hops >= 1 ? hops : 1;
  return parts[Math.max(0, parts.length - n)]!;
}

export function trustedProxyHops(env: Record<string, string | undefined>) {
  const n = Number(env.TRUSTED_PROXY_HOPS);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export function clientKey(headers: Headers): string {
  return clientKeyFrom(headers, trustedProxyHops(process.env));
}
