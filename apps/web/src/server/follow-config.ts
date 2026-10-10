// The two switches of the follow loop. Both default to doing nothing.
//   ARRIVALS_BUFFER = off | on     (absent = off) may the "arrives on you" buffer render unasked?
//   EMAIL_TRANSPORT = none | log   (absent = none) how email leaves; see email/transport.ts
type Env = Record<string, string | undefined>;

export function arrivalsBufferOn(env: Env = process.env): boolean {
  const v = (env.ARRIVALS_BUFFER ?? "off").trim().toLowerCase();
  if (v === "off" || v === "") return false;
  if (v === "on") return true;
  throw new Error(
    `ARRIVALS_BUFFER "${env.ARRIVALS_BUFFER}" must be "off" or "on"`,
  );
}

/** The ceilings and counts of the buffer, in one place. */
export const ARRIVALS_WINDOW_DAYS = 30;
/** Most buffer renders one housekeeping call may start, whatever the ceilings leave. */
export const ARRIVALS_MAX_PER_RUN = 20;
