import { describe, expect, it } from "vitest";
import { leader, shareLabel, shares, totalVotes } from "./votes";

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

describe("shares", () => {
  it("is all zero with no votes", () => {
    expect(shares([0, 0])).toEqual([0, 0]);
    expect(shares([])).toEqual([]);
  });
  it("splits plain cases", () => {
    expect(shares([1, 0])).toEqual([100, 0]);
    expect(shares([1, 1])).toEqual([50, 50]);
    expect(shares([14, 9])).toEqual([61, 39]);
  });
  it("always adds to 100, even where plain rounding would not", () => {
    expect(shares([1, 1, 1])).toEqual([34, 33, 33]);
    expect(shares([1, 1, 1]).reduce((a, b) => a + b)).toBe(100);
    expect(shares([2, 1, 1, 1])).toEqual([40, 20, 20, 20]);
    for (let a = 0; a < 12; a++)
      for (let b = 0; b < 12; b++)
        for (let c = 0; c < 6; c++) {
          const s = shares([a, b, c]);
          expect(sum(s)).toBe(a + b + c === 0 ? 0 : 100);
          s.forEach((v, i) => expect(v).toBeGreaterThanOrEqual(0 * i));
        }
  });
  it("breaks ties toward the earlier piece", () => {
    expect(shares([1, 2])).toEqual([33, 67]);
    expect(shares([2, 1])).toEqual([67, 33]);
    expect(shares([1, 1, 1, 0])).toEqual([34, 33, 33, 0]);
  });
});

describe("labels and the leader", () => {
  it("shows a dash for a piece with no votes, and a percentage otherwise", () => {
    expect(shareLabel(0, 0)).toBe("—");
    expect(shareLabel(3, 75)).toBe("75%");
  });
  it("names a strict leader only", () => {
    expect(leader(["a", "b"], {})).toBeNull();
    expect(leader(["a", "b"], { a: 0, b: 0 })).toBeNull();
    expect(leader(["a", "b"], { a: 1, b: 0 })).toBe("a");
    expect(leader(["a", "b"], { a: 1, b: 2 })).toBe("b");
    expect(leader(["a", "b"], { a: 2, b: 2 })).toBeNull();
    expect(leader(["a", "b", "c"], { a: 1, b: 3, c: 3 })).toBeNull();
    expect(leader(["a", "b", "c"], { a: 3, b: 2, c: 2 })).toBe("a");
  });
  it("totals only the pieces in the ask", () => {
    expect(totalVotes(["a", "b"], { a: 2, b: 1, z: 9 })).toBe(3);
    expect(totalVotes(["a"], {})).toBe(0);
  });
});
