import { describe, expect, it } from "vitest";
import { MAX_ATTEMPTS, nextStepForPose, routeSet } from "./policy";

const P = ["front", "three-quarter", "walking", "seated"] as const;
const mk = (bits: string) =>
  Object.fromEntries(
    P.map((p, i) => [p, bits[i] === "1" ? "passed" : "failed"]),
  );

// bits: front, three-quarter, walking, seated; 1 = passed. Expected values written by hand.
const TABLE: [string, string, string[]][] = [
  ["1111", "complete", ["front", "three-quarter", "walking", "seated"]],
  ["0111", "complete_partial", ["three-quarter", "walking", "seated"]],
  ["1011", "complete_partial", ["front", "walking", "seated"]],
  ["1101", "complete_partial", ["front", "three-quarter", "seated"]],
  ["1110", "complete_partial", ["front", "three-quarter", "walking"]],
  ["0011", "failed", []],
  ["0101", "failed", []],
  ["0110", "failed", []],
  ["1001", "failed", []],
  ["1010", "failed", []],
  ["1100", "failed", []],
  ["0001", "failed", []],
  ["0010", "failed", []],
  ["0100", "failed", []],
  ["1000", "failed", []],
  ["0000", "failed", []],
];

describe("routeSet, four poses", () => {
  it("covers all sixteen combinations", () => {
    expect(new Set(TABLE.map((r) => r[0])).size).toBe(16);
  });
  it.each(TABLE)("%s -> %s", (bits, status, published) => {
    expect(routeSet(mk(bits))).toEqual({ status, published });
  });
});

describe("routeSet, N poses", () => {
  const set = (...s: string[]) =>
    Object.fromEntries(s.map((v, i) => [`p${i}`, v]));
  it("N=1: pass completes, fail fails", () => {
    expect(routeSet(set("passed"))).toEqual({
      status: "complete",
      published: ["p0"],
    });
    expect(routeSet(set("failed"))).toEqual({
      status: "failed",
      published: [],
    });
  });
  it("N=2: one miss is not a set", () => {
    expect(routeSet(set("passed", "passed")).status).toBe("complete");
    expect(routeSet(set("passed", "failed")).status).toBe("failed");
    expect(routeSet(set("failed", "failed")).status).toBe("failed");
  });
  it("N=3: one miss is partial, two are not", () => {
    expect(routeSet(set("passed", "passed", "passed")).status).toBe("complete");
    expect(routeSet(set("passed", "failed", "passed"))).toEqual({
      status: "complete_partial",
      published: ["p0", "p2"],
    });
    expect(routeSet(set("passed", "failed", "failed")).status).toBe("failed");
  });
  it("pending counts as not passed; empty set fails", () => {
    expect(routeSet(set("passed", "pending", "passed")).status).toBe(
      "complete_partial",
    );
    expect(routeSet({}).status).toBe("failed");
  });
});

describe("nextStepForPose", () => {
  it("MAX_ATTEMPTS is 2", () => expect(MAX_ATTEMPTS).toBe(2));
  it.each([
    [1, "pass", "publish"],
    [1, "fail", "retry"],
    [2, "pass", "publish"],
    [2, "fail", "fail_pose"],
  ] as const)("attempt %i %s -> %s", (attempt, verdict, next) => {
    expect(nextStepForPose({ attempt, verdict })).toBe(next);
  });
});
