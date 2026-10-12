import { describe, expect, it } from "vitest";
import { dotWindow } from "./dots";

describe("dotWindow", () => {
  it("shows every dot up to five and none for a single frame's neighbours", () => {
    expect(dotWindow(0, 1)).toEqual([0]);
    expect(dotWindow(2, 4)).toEqual([0, 1, 2, 3]);
    expect(dotWindow(4, 5)).toEqual([0, 1, 2, 3, 4]);
  });
  it("slides a window of five over longer sets and stays inside them", () => {
    expect(dotWindow(0, 9)).toEqual([0, 1, 2, 3, 4]);
    expect(dotWindow(3, 9)).toEqual([1, 2, 3, 4, 5]);
    expect(dotWindow(8, 9)).toEqual([4, 5, 6, 7, 8]);
    expect(dotWindow(5, 6)).toEqual([1, 2, 3, 4, 5]);
  });
});
