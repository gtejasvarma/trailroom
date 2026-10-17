// What this browser remembers about the mirror: which try-ons have had their arrival (once per
// try-on), and whether the person has yet learned to turn or hold (the first-time hint). Storage
// can be blocked: when it is, the arrival counts as seen (it must never loop on every visit) and
// the hint counts as learned (it must never nag).

/** The arrival's memory is the old reveal's, so try-ons already revealed are not played again. */
const SEEN_PREFIX = "trailroom.reveal.";
const LEARNED_KEY = "trailroom.mirror.learned";

export function arrivalSeen(jobId: string): boolean {
  try {
    return localStorage.getItem(SEEN_PREFIX + jobId) === "1";
  } catch {
    return true;
  }
}

export function markArrivalSeen(jobId: string): void {
  try {
    localStorage.setItem(SEEN_PREFIX + jobId, "1");
  } catch {
    // ignore
  }
}

export function gestureLearned(): boolean {
  try {
    return localStorage.getItem(LEARNED_KEY) === "1";
  } catch {
    return true;
  }
}

export function markGestureLearned(): void {
  try {
    localStorage.setItem(LEARNED_KEY, "1");
  } catch {
    // ignore
  }
}
