import { describe, expect, it } from "vitest";
import { outfitPieces, outfitTitle } from "./outfit";

describe("outfit helpers", () => {
  it("titles the outer layer first, whichever order the ids are in", () => {
    for (const ids of [
      ["coat", "slip"],
      ["slip", "coat"],
    ]) {
      expect(outfitTitle(outfitPieces(ids)!)).toBe(
        "wool car coat over the bias-cut slip dress",
      );
    }
  });
  it("needs two known pieces", () => {
    expect(outfitPieces(["coat"])).toBeNull();
    expect(outfitPieces(["coat", "nope"])).toBeNull();
  });
});
