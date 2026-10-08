// A small in-memory limiter for failed password attempts. It is per instance and resets on a
// restart, so it only slows guessing; Cloud Armor (rate limiting at the load balancer) is the
// real control. Pure and clock-injectable so it can be tested.

export interface AttemptLimiter {
  /** True when this client has used up its failed attempts in the window. */
  blocked(key: string): boolean;
  recordFailure(key: string): void;
}

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
  return {
    blocked: (key) => live(key).length >= max,
    recordFailure: (key) => {
      const kept = live(key);
      kept.push(now());
      failures.set(key, kept);
      // Bound memory: drop everything if a flood of distinct keys piles up.
      if (failures.size > 10_000) {
        failures.clear();
        failures.set(key, kept);
      }
    },
  };
}

/** The client IP is the first hop of x-forwarded-for; one shared bucket if there is none. */
export function clientKey(headers: Headers): string {
  const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first || "unknown";
}
