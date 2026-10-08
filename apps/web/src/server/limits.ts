// Per-user daily limits on try-on starts (UTC day). A failed set still counts; a reused pose set
// and any refusal do not. PRD §10.2 Tier A: signed-in users get 5 a day.
/** One try-on plus one retry. */
export const GUEST_DAILY_STARTS = 2;
export const SIGNED_IN_DAILY_STARTS = 5;

export const dailyStartLimit = (isGuest: boolean) =>
  isGuest ? GUEST_DAILY_STARTS : SIGNED_IN_DAILY_STARTS;

/** A queued/rendering job untouched for this long is treated as dead. */
export const STALE_JOB_MS = 20 * 60 * 1000;
