import { describe, expect, it } from "vitest";
import {
  photoPath,
  renderPath,
  renderPrefix,
  stagingPath,
  stagingPrefix,
} from "./paths";

describe("path builders", () => {
  it("produce the documented paths", () => {
    expect(photoPath("u1", "abc123")).toBe("photos/u1/abc123.jpg");
    expect(stagingPath("j1", "front", 2)).toBe("staging/j1/front-2.png");
    expect(stagingPath("j1", "front", 1, "jpg")).toBe("staging/j1/front-1.jpg");
    expect(stagingPrefix("j1")).toBe("staging/j1/");
    expect(renderPath("u1", "u1_1_blouse", "front")).toBe(
      "renders/u1/u1_1_blouse/front.jpg",
    );
    expect(renderPrefix("u1")).toBe("renders/u1/");
  });

  it.each([
    "",
    "a/b",
    "..",
    "../x",
    "a..b",
    ".",
    "/abs",
    "a\\b",
    "a b",
    "a\0b",
  ])("rejects segment %j", (bad) => {
    expect(() => photoPath(bad, "p1")).toThrow();
    expect(() => stagingPath(bad, "front", 1)).toThrow();
    expect(() => stagingPath("j", bad, 1)).toThrow();
    expect(() => renderPath("u", bad, "front")).toThrow();
    expect(() => renderPath("u", "ps", bad)).toThrow();
    expect(() => renderPath(bad, "ps", "front")).toThrow();
  });

  it("rejects bad attempts", () => {
    expect(() => stagingPath("j", "front", -1)).toThrow();
    expect(() => stagingPath("j", "front", 1.5)).toThrow();
  });
});
