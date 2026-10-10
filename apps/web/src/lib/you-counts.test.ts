import { describe, expect, it } from "vitest";
import { WEEK_MS, youCounts } from "./you-counts";

const now = new Date("2026-10-09T12:00:00Z");
const ago = (ms: number) => ({
  createdAt: new Date(now.getTime() - ms).toISOString(),
});

describe("youCounts", () => {
  it("is all zero for a new account", () => {
    expect(youCounts([], 0, now)).toEqual({
      tryOnsKept: 0,
      thisWeek: 0,
      lists: 0,
    });
  });
  it("counts every kept try-on, and those from the last seven days", () => {
    const t = [
      ago(1000),
      ago(WEEK_MS - 1000),
      ago(WEEK_MS + 1000),
      ago(30 * 86400000),
    ];
    expect(youCounts(t, 3, now)).toEqual({
      tryOnsKept: 4,
      thisWeek: 2,
      lists: 3,
    });
  });
});
