import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CATALOG,
  DEMO_CATALOG_NOTICE,
  READINESS_THRESHOLD,
  closestThree,
  findFitLanguage,
  getItem,
  isRenderReady,
} from "./index";
import { catalogFileFor, catalogFiles, isCatalogFile } from "./server";

const assetsDir = resolve(__dirname, "../assets");

describe("catalogue", () => {
  it("has exactly the five approved ids", () => {
    expect(CATALOG.map((i) => i.id).sort()).toEqual(
      [
        "g-shell-jacket",
        "g-parka",
        "g-leather-coat",
        "g-denim-jacket",
        "g-elbow-sweater",
      ].sort(),
    );
  });

  it("every item has licence, credit author, source URL and readiness", () => {
    for (const i of CATALOG) {
      expect(i.credit.licence).toBeTruthy();
      expect(i.credit.author).toBeTruthy();
      expect(i.credit.sourceUrl).toMatch(/^https:\/\//);
      expect(i.readiness).toBeGreaterThanOrEqual(0);
      expect(i.readiness).toBeLessThanOrEqual(100);
      expect(i.readinessReasons.length).toBeGreaterThan(0);
      expect(i.description).toBeTruthy();
    }
  });

  it("no licence or source matches NC, SA or VITON", () => {
    for (const i of CATALOG) {
      expect(i.credit.licence).not.toMatch(/\b(NC|SA)\b|VITON/i);
      expect(i.credit.sourceUrl).not.toMatch(/VITON/i);
      expect(i.image).not.toMatch(/viton/i);
    }
  });

  it("exactly one item is below the readiness threshold", () => {
    const low = CATALOG.filter((i) => !isRenderReady(i));
    expect(low.map((i) => i.id)).toEqual(["g-leather-coat"]);
    expect(low[0].readiness).toBeLessThan(READINESS_THRESHOLD);
  });

  it("closestThree returns three distinct render-ready items, never itself", () => {
    for (const i of CATALOG) {
      const three = closestThree(i.id);
      expect(three).toHaveLength(3);
      expect(new Set(three.map((t) => t.id)).size).toBe(3);
      expect(three.every(isRenderReady)).toBe(true);
      expect(three.map((t) => t.id)).not.toContain(i.id);
      expect(closestThree(i.id)).toEqual(three);
    }
    expect(closestThree("g-parka")[0].category).toBe("outerwear");
  });

  it("every item's image file exists in packages/catalog/assets", () => {
    for (const i of CATALOG) {
      expect(i.image).toBe(`/catalog/${basename(i.image)}`);
      expect(existsSync(resolve(assetsDir, basename(i.image)))).toBe(true);
      expect(catalogFileFor(i.id)).toBe(basename(i.image));
      expect(isCatalogFile(basename(i.image))).toBe(true);
    }
    expect(catalogFiles()).toHaveLength(5);
    expect(isCatalogFile("../items.ts")).toBe(false);
    expect(catalogFileFor("nope")).toBeUndefined();
    expect(getItem("nope")).toBeUndefined();
  });

  it("catalogue copy has no fit or size language", () => {
    const texts = [
      DEMO_CATALOG_NOTICE,
      ...CATALOG.flatMap((i) => [
        i.name,
        i.label,
        i.description,
        ...i.readinessReasons,
      ]),
    ];
    for (const t of texts) expect(findFitLanguage(t), t).toBeNull();
  });

  it("does not trip on garment descriptors", () => {
    for (const ok of ["Cropped denim jacket", "hooded technical shell jacket"])
      expect(findFitLanguage(ok), ok).toBeNull();
  });

  it("the banned-phrase regex catches the obvious cases", () => {
    for (const bad of [
      "runs small",
      "true to size",
      "hits mid-calf on you",
      "so flattering",
      "slimming cut",
      "check the hem",
      "a snug cut",
      "loose and baggy",
      "roomy pockets",
      "relaxed fit",
      "true to size",
      "runs large",
      "cinched waist",
      "flowy skirt",
      "curvy",
      "figure-hugging",
      "tailored fit",
    ]) {
      expect(findFitLanguage(bad), bad).not.toBeNull();
    }
  });
});
