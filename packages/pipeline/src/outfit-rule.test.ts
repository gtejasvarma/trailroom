import { CATALOG, outfitCompatible, outfitPairsFor } from "@trailroom/catalog";
import { CATEGORIES, outfitPlan } from "@trailroom/render";
import { describe, expect, it } from "vitest";

describe("the catalogue's outfit rule", () => {
  it("agrees with outfitPlan on all 16 category pairs", () => {
    for (const a of CATEGORIES) {
      for (const b of CATEGORIES) {
        expect(outfitCompatible(a, b)).toBe(outfitPlan(a, b).ok);
      }
    }
    expect(outfitCompatible(null, "top")).toBe(false);
  });

  it("offers only valid, ready pairs, and never jewellery", () => {
    for (const item of CATALOG) {
      for (const p of outfitPairsFor(item.id)) {
        expect(p.tryOn).toBe("ready");
        expect(p.shopCategory).toBe("apparel");
        expect(p.category).not.toBeNull();
        expect(outfitPlan(item.category!, p.category!).ok).toBe(true);
        // Symmetric: if B is offered for A, A is offered for B.
        expect(outfitPairsFor(p.id).map((i) => i.id)).toContain(item.id);
      }
    }
  });

  it("gives each catalogue piece these pairs", () => {
    const table = Object.fromEntries(
      CATALOG.map((i) => [i.id, outfitPairsFor(i.id).map((p) => p.id)]),
    );
    expect(table).toEqual({
      jump: [],
      maxi: [],
      coord: [],
      vest: ["coat"],
      coat: ["vest", "slip", "blouse"],
      slip: ["coat"],
      suit: [],
      hoops: [],
      set: [],
      blouse: ["coat"],
      chain: [],
      jacket: [],
    });
  });
});
