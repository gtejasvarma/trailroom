// The public unsubscribe path: no password, no account, the token is the proof. It is built so it
// cannot be used to learn anything: every token, real or made up, gets the same answer, status and
// body, and the only effect is that a real token's owner stops getting email. Attempts are
// rate-limited per client.
import { isEmailTokenShape, unsubscribeByToken } from "@trailroom/db";
import { clientKey, createAttemptLimiter } from "../lib/gate-limit";

/** Per client, in memory and per instance (Cloud Armor is the real limit): 20 tries in 10 minutes. */
const limiter = createAttemptLimiter(20, 10 * 60 * 1000);

/** Headers on every unsubscribe response, as on the ask page: never indexed, cached or referred. */
export const PUBLIC_UNSUB_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
} as const;

/** True when this client is over the limit; counts the attempt otherwise. */
export function unsubscribeLimited(headers: Headers): boolean {
  const key = clientKey(headers);
  if (limiter.blocked(key)) return true;
  limiter.record(key);
  return false;
}

export async function unsubscribe(token: string): Promise<void> {
  if (!isEmailTokenShape(token)) return;
  await unsubscribeByToken(token);
}
