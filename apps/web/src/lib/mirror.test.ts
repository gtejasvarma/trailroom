import { describe, expect, it } from "vitest";
import {
  ARRIVAL,
  arrivalEndMs,
  arrivalSteps,
  clampPose,
  decideAxis,
  movedTooFarToHold,
  poseFromDrag,
  rubberBand,
  tiltFor,
} from "./mirror";

describe("poseFromDrag", () => {
  it("moves one pose per step of drag, left being forward, following the finger", () => {
    expect(poseFromDrag(0, 0, 64, 4)).toBe(0);
    expect(poseFromDrag(0, -31, 64, 4)).toBe(0); // under half a step
    expect(poseFromDrag(0, -33, 64, 4)).toBe(1); // past half a step
    expect(poseFromDrag(0, -64, 64, 4)).toBe(1);
    expect(poseFromDrag(0, -200, 64, 4)).toBe(3);
    expect(poseFromDrag(2, 64, 64, 4)).toBe(1);
    expect(poseFromDrag(2, -64, 64, 4)).toBe(3);
  });
  it("never leaves the poses, however far the drag goes", () => {
    expect(poseFromDrag(0, 500, 64, 4)).toBe(0);
    expect(poseFromDrag(3, -500, 64, 4)).toBe(3);
    expect(poseFromDrag(1, -1000, 90, 2)).toBe(1);
  });
  it("uses the step it is given (90 on desktop)", () => {
    expect(poseFromDrag(0, -64, 90, 4)).toBe(1); // 0.71 of a step still rounds up
    expect(poseFromDrag(0, -44, 90, 4)).toBe(0);
    expect(poseFromDrag(0, -46, 90, 4)).toBe(1);
  });
  it("copes with one pose and with none", () => {
    expect(poseFromDrag(0, -300, 64, 1)).toBe(0);
    expect(poseFromDrag(0, 300, 64, 0)).toBe(0);
    expect(clampPose(5, 0)).toBe(0);
  });
});

describe("rubberBand", () => {
  it("is zero at rest, grows with the pull, and never reaches the limit", () => {
    expect(rubberBand(0, 6)).toBe(0);
    const a = rubberBand(20, 6);
    const b = rubberBand(100, 6);
    const c = rubberBand(100000, 6);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeLessThan(6);
    expect(c).toBeGreaterThan(5.9);
  });
  it("resists more the further it is pulled (diminishing returns)", () => {
    const first = rubberBand(50, 6) - rubberBand(0, 6);
    const second = rubberBand(100, 6) - rubberBand(50, 6);
    expect(second).toBeLessThan(first);
  });
  it("keeps the sign of the pull", () => {
    expect(rubberBand(-30, 6)).toBeCloseTo(-rubberBand(30, 6));
  });
});

describe("tiltFor", () => {
  const base = { step: 64, n: 4, max: 9, edgeMax: 6 };
  it("is flat when a pose is centred and while nothing is dragged", () => {
    expect(tiltFor({ ...base, base: 1, dx: 0 })).toBe(0);
    expect(tiltFor({ ...base, base: 1, dx: -64 })).toBeCloseTo(0);
  });
  it("leans toward the next pose by how far the drag has gone, from the live value", () => {
    const small = tiltFor({ ...base, base: 1, dx: -16 });
    const more = tiltFor({ ...base, base: 1, dx: -30 });
    expect(small).toBeGreaterThan(0);
    expect(more).toBeGreaterThan(small);
    // the other way round
    expect(tiltFor({ ...base, base: 1, dx: 16 })).toBeCloseTo(-small);
  });
  it("never passes half of max between two poses", () => {
    for (let dx = -64; dx <= 64; dx += 4) {
      const t = tiltFor({ ...base, base: 1, dx });
      expect(Math.abs(t)).toBeLessThanOrEqual(9 / 2 + 1e-9);
    }
  });
  it("leans against the first and last pose with a rubber band that stays under edgeMax", () => {
    const first = tiltFor({ ...base, base: 0, dx: 40 });
    expect(first).toBeLessThan(0);
    expect(Math.abs(first)).toBeLessThan(6);
    const last = tiltFor({ ...base, base: 3, dx: -40 });
    expect(last).toBeGreaterThan(0);
    expect(Math.abs(tiltFor({ ...base, base: 0, dx: 5000 }))).toBeLessThan(6);
    // dragging toward the pose that exists is not an edge
    expect(tiltFor({ ...base, base: 0, dx: -20 })).toBeGreaterThan(0);
  });
  it("with one pose every drag is an edge", () => {
    expect(Math.abs(tiltFor({ ...base, n: 1, base: 0, dx: 60 }))).toBeLessThan(
      6,
    );
    expect(tiltFor({ ...base, n: 1, base: 0, dx: 60 })).toBeLessThan(0);
  });
});

describe("telling a drag from a scroll and a press", () => {
  it("decides nothing until the pointer has moved 10px", () => {
    expect(decideAxis(0, 0)).toBe("pending");
    expect(decideAxis(10, 3)).toBe("pending");
    expect(decideAxis(-9, 9)).toBe("pending");
  });
  it("then horizontal when it went further across than down, else vertical", () => {
    expect(decideAxis(12, 3)).toBe("horizontal");
    expect(decideAxis(-14, 5)).toBe("horizontal");
    expect(decideAxis(3, 12)).toBe("vertical");
    expect(decideAxis(-4, -30)).toBe("vertical");
    expect(decideAxis(11, 11)).toBe("vertical"); // a tie goes to the page
  });
  it("cancels a hold beyond 8px of movement, in any direction", () => {
    expect(movedTooFarToHold(0, 0)).toBe(false);
    expect(movedTooFarToHold(5, 5)).toBe(false); // 7.07
    expect(movedTooFarToHold(8, 0)).toBe(false);
    expect(movedTooFarToHold(0, -9)).toBe(true);
    expect(movedTooFarToHold(7, 7)).toBe(true); // 9.9
  });
});

describe("the arrival's timeline", () => {
  it("turns through every passed pose in order, then back to the first", () => {
    const steps = arrivalSteps(4);
    expect(steps.map((s) => s.pose)).toEqual([1, 2, 3, 0]);
    for (let i = 1; i < steps.length; i++)
      expect(steps[i]!.atMs).toBeGreaterThan(steps[i - 1]!.atMs);
  });
  it("holds each pose about half a second, and starts only after the focus pull", () => {
    const steps = arrivalSteps(4);
    expect(steps[0]!.atMs).toBeGreaterThanOrEqual(ARRIVAL.focusMs);
    expect(steps[1]!.atMs - steps[0]!.atMs).toBe(ARRIVAL.poseMs);
    expect(ARRIVAL.poseMs).toBeGreaterThanOrEqual(500);
    expect(ARRIVAL.poseMs).toBeLessThanOrEqual(600);
  });
  it("uses only the poses that passed", () => {
    expect(arrivalSteps(3).map((s) => s.pose)).toEqual([1, 2, 0]);
    expect(arrivalSteps(2).map((s) => s.pose)).toEqual([1, 0]);
  });
  it("does not turn at all with one pose or none", () => {
    expect(arrivalSteps(1)).toEqual([]);
    expect(arrivalSteps(0)).toEqual([]);
    expect(arrivalEndMs(1)).toBe(ARRIVAL.focusMs + ARRIVAL.settleMs);
  });
  it("ends after the last step", () => {
    const steps = arrivalSteps(4);
    expect(arrivalEndMs(4)).toBeGreaterThan(steps[steps.length - 1]!.atMs);
  });
});
