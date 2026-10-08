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

/**
 * Set-level routing over N poses (N = number of keys):
 *  - all N passed                    -> complete
 *  - exactly N-1 passed and N >= 3   -> complete_partial (for the four-pose set: one failed)
 *  - anything else                   -> failed (published renders must then be withdrawn)
 * For N < 3 a single miss would leave one or zero images, which is not a set, so it fails.
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
  if (n >= 3 && passed === n - 1) {
    return { status: "complete_partial", published };
  }
  return { status: "failed", published: [] };
}
