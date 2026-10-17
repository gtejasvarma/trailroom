// The mirror's arithmetic, kept apart from React so it can be table-tested: which pose a drag
// lands on, how far the picture tilts while it is dragged, the rubber band at the ends, how a
// press is told apart from a drag, and the arrival's timeline. Pure: no DOM, no timers.

/** Pixels of horizontal drag per pose. */
export const DRAG_STEP_PHONE = 64;
export const DRAG_STEP_DESKTOP = 90;
/** A still press longer than this swaps in the label's photograph. */
export const HOLD_MS = 280;
/** Movement beyond this many pixels cancels a hold: it is a drag. */
export const HOLD_SLOP = 8;
/** Movement beyond this many pixels decides horizontal (ours) or vertical (the page's). */
export const AXIS_SLOP = 10;
/** The most the picture tilts toward the next pose, in degrees, phone and desktop. */
export const TILT_PHONE = 9;
export const TILT_DESKTOP = 8;
/** The most it leans against the first or last pose, in degrees. */
export const EDGE_TILT_PHONE = 6;
export const EDGE_TILT_DESKTOP = 5;
/** The easing everything settles with (a critically damped spring, as a bezier). */
export const SETTLE_EASE = "cubic-bezier(0.23, 1, 0.32, 1)";

export const clampPose = (i: number, n: number): number =>
  Math.max(0, Math.min(Math.max(n - 1, 0), i));

/**
 * The pose a drag lands on. Dragging left (negative dx) moves forward through the poses, the way
 * a hand turns a figure toward its left. Follows the finger: the pose changes when the drag
 * passes half a step.
 */
export function poseFromDrag(
  base: number,
  dx: number,
  step: number,
  n: number,
): number {
  return clampPose(base + Math.round(-dx / step), n);
}

/** Soft resistance: grows with the pull but never passes `limit`. */
export function rubberBand(pull: number, limit: number): number {
  const d = Math.abs(pull);
  return Math.sign(pull) * limit * (1 - 1 / ((d * 0.55) / limit + 1));
}

/**
 * The tilt (degrees of rotateY) while dragging, from the live value. Inside the poses: toward
 * the next pose by the fraction of a step already travelled, so it is zero when a pose is centred
 * and at most `max / 2` when halfway to the next. Past the first or last pose: a lean against the
 * end that grows with a rubber band and never passes `edgeMax`. Dragging right tilts negative,
 * dragging left positive, both inside and at the ends.
 */
export function tiltFor(args: {
  base: number;
  dx: number;
  step: number;
  n: number;
  max: number;
  edgeMax: number;
}): number {
  const { base, dx, step, n, max, edgeMax } = args;
  // Where the drag has taken the picture, in poses (0 is the first).
  const at = base - dx / step;
  if (at < 0) return -rubberBand(-at * step, edgeMax);
  if (at > n - 1) return rubberBand((at - (n - 1)) * step, edgeMax);
  return (at - Math.round(at)) * max;
}

export type Gesture = "pending" | "horizontal" | "vertical";

/**
 * After the pointer has moved, what is it? Undecided until it has moved AXIS_SLOP pixels, then
 * horizontal when it has gone further across than down, else vertical (the page scrolls).
 */
export function decideAxis(dx: number, dy: number): Gesture {
  if (Math.max(Math.abs(dx), Math.abs(dy)) <= AXIS_SLOP) return "pending";
  return Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
}

/** Has the pointer moved far enough to count as a drag rather than a press? */
export const movedTooFarToHold = (dx: number, dy: number): boolean =>
  Math.hypot(dx, dy) > HOLD_SLOP;

/** Steps between poses on the arrival, and how long each is held, in ms. */
export const ARRIVAL = {
  /** The picture comes into focus. */
  focusMs: 1300,
  /** The pause before she starts to turn. */
  beforeTurnMs: 300,
  /** Each passed pose is shown this long. */
  poseMs: 550,
  /** The pause on the last pose before returning to the first. */
  returnMs: 600,
  /** After the return, until the mirror is settled. */
  settleMs: 400,
  /** The cross-fade under reduced motion. */
  reducedMs: 300,
} as const;

/**
 * The arrival's timeline for `n` passed poses: the pose to show and how long after the picture is
 * in focus. Poses 1..n-1 in turn, then back to 0. One pose (or none) gives no turn at all.
 */
export function arrivalSteps(n: number): { atMs: number; pose: number }[] {
  if (n < 2) return [];
  const steps: { atMs: number; pose: number }[] = [];
  let at = ARRIVAL.focusMs + ARRIVAL.beforeTurnMs;
  for (let i = 1; i < n; i++) {
    steps.push({ atMs: at, pose: i });
    at += ARRIVAL.poseMs;
  }
  steps.push({ atMs: at + ARRIVAL.returnMs - ARRIVAL.poseMs, pose: 0 });
  return steps;
}

/** When the arrival is over (the mirror is settled), ms after it starts. */
export function arrivalEndMs(n: number): number {
  const steps = arrivalSteps(n);
  const last = steps[steps.length - 1];
  return (last ? last.atMs : ARRIVAL.focusMs) + ARRIVAL.settleMs;
}
