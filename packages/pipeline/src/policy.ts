// Pure routing policy. No I/O, no runtime imports beyond types, so a client may import it.
import type { NextStep, SetStatus, Verdict } from "./types";

/** One render plus one retry. The retry spends money, so this is a hard cap, not a default. */
export const MAX_ATTEMPTS = 2;

/** After QA: publish a pass; retry a first failure; give up on a second one. */
export function nextStepForPose(input: {
  attempt: number;
  verdict: Verdict;
}): NextStep {
  if (input.verdict === "pass") return "publish";
  return input.attempt < MAX_ATTEMPTS ? "retry" : "fail_pose";
}

/** A set needs this many passed poses (or all of them, when it has fewer poses than this). */
export const MIN_POSES_PASSED = 2;

/**
 * Set-level routing over N poses (N = number of keys), one rule: the set fails when fewer than
 * min(MIN_POSES_PASSED, N) poses passed.
 *  - all N passed                       -> complete
 *  - fewer than N but at least min(2, N) -> complete_partial (for the four-pose set: 2 or 3 passed)
 *  - fewer than min(2, N) passed        -> failed (published renders must then be withdrawn)
 * So a four-pose try-on survives two failed poses (the owner's rule: 1 or 2 failing images
 * still show the others, 3 or more show the failure screen), while a single-pose job (an outfit
 * or an arrival) needs its one pose, and a two-pose set needs both.
 * Any status other than "passed" (failed, still pending) counts as not passed.
 * `published` lists the poses that stay published, in input order: the passed ones for a
 * complete or partial set, and none for a failed set (its passed poses are withdrawn).
 */
export function routeSet(poseStatuses: Record<string, string>): {
  status: SetStatus;
  published: string[];
} {
  const entries = Object.entries(poseStatuses);
  const n = entries.length;
  const published = entries.filter(([, s]) => s === "passed").map(([p]) => p);
  const passed = published.length;
  if (n > 0 && passed === n) return { status: "complete", published };
  if (n > 0 && passed >= Math.min(MIN_POSES_PASSED, n)) {
    return { status: "complete_partial", published };
  }
  return { status: "failed", published: [] };
}

/**
 * Why a failed set failed. `attemptOutcomes` holds, per pose, the recorded render outcome of
 * every attempt. When every attempt of every pose died on the provider's side (`model_error`),
 * the model never judged anything: that is our fault (`internal`), not a quality failure. Any
 * other mix (the model answered and the checks rejected it, or some answered) is `render_failed`.
 * A pose with no recorded attempt counts as not provider-failed. A capacity branch never
 * reaches finalize (it ends the job as `capacity` first), so it needs no case here.
 */
export function failureCodeForFailedSet(
  attemptOutcomes: (string | undefined)[][],
): "internal" | "render_failed" {
  const allProvider =
    attemptOutcomes.length > 0 &&
    attemptOutcomes.every(
      (outcomes) =>
        outcomes.length > 0 && outcomes.every((o) => o === "model_error"),
    );
  return allProvider ? "internal" : "render_failed";
}
