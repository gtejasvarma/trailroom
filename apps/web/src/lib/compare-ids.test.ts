import { describe, expect, it } from "vitest";
import {
  compareHref,
  mostRecent,
  parseCompareIds,
  poseFor,
  shouldOpenCompare,
  toggleTray,
  tooManyCompareIds,
} from "./compare-ids";

describe("parseCompareIds", () => {
  it("splits, trims, de-duplicates and keeps order", () => {
    expect(parseCompareIds("a_1_x, b_2_y,a_1_x,,c")).toEqual([
      "a_1_x",
      "b_2_y",
      "c",
    ]);
  });
  it("is empty for nothing", () => {
    expect(parseCompareIds(null)).toEqual([]);
    expect(parseCompareIds("")).toEqual([]);
    expect(parseCompareIds(undefined)).toEqual([]);
  });
  it("drops anything that is not a plain id", () => {
    expect(parseCompareIds("../x,a/b,ok,,a b,-no,.hidden")).toEqual(["ok"]);
  });
  it("caps at four", () => {
    expect(parseCompareIds("a,b,c,d,e,f")).toEqual(["a", "b", "c", "d"]);
  });
  it("knows when more than four distinct ids were asked for", () => {
    expect(tooManyCompareIds("a,b,c,d")).toBe(false);
    expect(tooManyCompareIds("a,b,c,d,e")).toBe(true);
    expect(tooManyCompareIds("a,a,a,a,a")).toBe(false);
  });
  it("builds a linkable href that parses back", () => {
    const ids = ["u1_p1_coat", "u1_p1_blouse"];
    const href = compareHref(ids);
    expect(href).toBe("/compare?ids=u1_p1_coat,u1_p1_blouse");
    expect(
      parseCompareIds(new URL(href, "http://x").searchParams.get("ids")),
    ).toEqual(ids);
  });
});

describe("the tray", () => {
  it("adds, removes, and ignores a fifth", () => {
    let t: string[] = [];
    for (const id of ["a", "b", "c", "d", "e"]) t = toggleTray(t, id);
    expect(t).toEqual(["a", "b", "c", "d"]);
    expect(toggleTray(t, "b")).toEqual(["a", "c", "d"]);
  });
  it("Compare all takes the four most recent", () => {
    expect(mostRecent(["n1", "n2", "n3", "n4", "n5"])).toEqual([
      "n1",
      "n2",
      "n3",
      "n4",
    ]);
    expect(mostRecent(["n1"])).toEqual(["n1"]);
  });
});

describe("pose alignment", () => {
  const four = ["front", "three-quarter", "walking", "seated"];
  const three = ["front", "three-quarter", "seated"];
  it("every column shows the same pose", () => {
    for (const pose of four) {
      expect(poseFor(four, pose)).toBe(pose);
      expect(poseFor(three, pose)).toBe(pose === "walking" ? null : pose);
    }
  });
  it("a three-pose set never falls back to a different pose", () => {
    expect(poseFor(three, "walking")).toBeNull();
    expect(poseFor([], "front")).toBeNull();
  });
});

describe("the C key", () => {
  const key = (
    k: string,
    target: unknown = { tagName: "BODY" },
    extra = {},
  ) => ({
    key: k,
    target: target as EventTarget,
    ...extra,
  });
  it("opens Compare with two or more selected", () => {
    expect(shouldOpenCompare(key("c"), 2)).toBe(true);
    expect(shouldOpenCompare(key("C"), 4)).toBe(true);
  });
  it("needs two selected", () => {
    expect(shouldOpenCompare(key("c"), 0)).toBe(false);
    expect(shouldOpenCompare(key("c"), 1)).toBe(false);
  });
  it("ignores other keys and shortcuts", () => {
    expect(shouldOpenCompare(key("x"), 3)).toBe(false);
    expect(shouldOpenCompare(key("c", undefined, { metaKey: true }), 3)).toBe(
      false,
    );
    expect(shouldOpenCompare(key("c", undefined, { ctrlKey: true }), 3)).toBe(
      false,
    );
  });
  it("ignores text fields, whatever is selected", () => {
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) {
      expect(shouldOpenCompare(key("c", { tagName }), 3)).toBe(false);
    }
    expect(
      shouldOpenCompare(
        key("c", { tagName: "DIV", isContentEditable: true }),
        3,
      ),
    ).toBe(false);
  });
  it("ignores it while a dialog is open", () => {
    expect(shouldOpenCompare(key("c"), 3, true)).toBe(false);
  });
});
