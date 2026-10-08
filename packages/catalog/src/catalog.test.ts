import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CATALOG,
  DEMO_CATALOG_NOTICE,
  READINESS_THRESHOLD,
  closestThree,
  findFitLanguage,
  LABELS,
  PROOF_MODEL_FILE,
  PROOF_ON_PERSON_FILE,
  getItem,
  getLabel,
  isRenderReady,
  startWithThese,
} from "./index";
import {
  catalogContentType,
  catalogFileFor,
  catalogFiles,
  isCatalogFile,
} from "./server";

const assetsDir = resolve(__dirname, "../assets/prototype");

describe("catalogue", () => {
  it("has exactly the twelve prototype ids", () => {
    expect(CATALOG.map((i) => i.id).sort()).toEqual(
      [
        "jump",
        "maxi",
        "coord",
        "vest",
        "coat",
        "slip",
        "suit",
        "hoops",
        "set",
        "blouse",
        "chain",
        "jacket",
      ].sort(),
    );
  });

  it("every item has photos that exist, a render image, a prompt description and readiness", () => {
    for (const i of CATALOG) {
      expect(i.photos.length).toBeGreaterThanOrEqual(1);
      expect(i.photos.length).toBeLessThanOrEqual(4);
      for (const p of i.photos) {
        expect(existsSync(resolve(assetsDir, p.file)), p.file).toBe(true);
        expect(p.label).toBeTruthy();
        expect(p.focus).toMatch(/^\d+% \d+%$/);
        expect(isCatalogFile(p.file)).toBe(true);
      }
      expect(i.photos.map((p) => p.file)).toContain(i.renderImage);
      expect(i.renderImage).toBe(i.photos[0]!.file);
      expect(i.promptDescription.length).toBeGreaterThan(5);
      expect(i.readiness).toBeGreaterThanOrEqual(0);
      expect(i.readiness).toBeLessThanOrEqual(100);
      expect(i.readinessReasons.length).toBeGreaterThan(0);
      expect(i.description).toBeTruthy();
      expect(i.stock.line).toBeTruthy();
      if (i.tryOn === "ready") expect(i.category).not.toBeNull();
    }
  });

  it("labels and pairings resolve", () => {
    const ids = new Set(CATALOG.map((i) => i.id));
    expect(LABELS).toHaveLength(5);
    for (const i of CATALOG) {
      expect(getLabel(i.labelSlug)?.name).toBe(i.label);
      for (const p of i.pairsWith)
        expect(ids.has(p), `${i.id}->${p}`).toBe(true);
    }
  });

  it("try-on state follows the product rules", () => {
    for (const i of CATALOG) {
      if (i.shopCategory === "apparel" && i.id !== "jacket") {
        expect(i.tryOn, i.id).toBe("ready");
        expect(isRenderReady(i), i.id).toBe(true);
      }
      if (i.shopCategory !== "apparel") {
        expect(i.tryOn).toBe("not_yet");
        expect(isRenderReady(i)).toBe(false);
      }
    }
    const jacket = getItem("jacket")!;
    expect(jacket.tryOn).toBe("cannot");
    expect(jacket.readiness).toBeLessThan(READINESS_THRESHOLD);
    expect(jacket.readinessReasons.join(" ")).toContain("folded over an arm");
    expect(
      CATALOG.filter((i) => !isRenderReady(i))
        .map((i) => i.id)
        .sort(),
    ).toEqual(["chain", "hoops", "jacket"]);
  });

  it("full-body pieces map to the dress prompt category", () => {
    for (const id of ["jump", "coord", "suit", "set", "slip", "maxi"])
      expect(getItem(id)!.category, id).toBe("dress");
    expect(getItem("coat")!.category).toBe("outerwear");
    expect(getItem("blouse")!.category).toBe("top");
  });

  it("closestThree returns three distinct render-ready apparel items, never itself", () => {
    for (const i of CATALOG) {
      const three = closestThree(i.id);
      expect(three).toHaveLength(3);
      expect(new Set(three.map((t) => t.id)).size).toBe(3);
      expect(three.every(isRenderReady)).toBe(true);
      expect(three.every((t) => t.shopCategory === "apparel")).toBe(true);
      expect(three.map((t) => t.id)).not.toContain(i.id);
      expect(closestThree(i.id)).toEqual(three);
    }
  });

  it("start with these: the render-ready pieces with four label photos", () => {
    expect(
      startWithThese()
        .map((i) => i.id)
        .sort(),
    ).toEqual(["blouse", "coord", "jump", "maxi", "vest"]);
  });

  it("only catalogue photo names are servable", () => {
    expect(catalogFiles()).toHaveLength(28);
    expect(isCatalogFile("../items.ts")).toBe(false);
    expect(isCatalogFile("commons-parka.jpg")).toBe(false);
    expect(isCatalogFile("p12144990.jpg")).toBe(false);
    expect(isCatalogFile(PROOF_MODEL_FILE)).toBe(true);
    expect(isCatalogFile(PROOF_ON_PERSON_FILE)).toBe(true);
    expect(catalogFileFor("blouse")).toBe("wrap-top-front.webp");
    expect(catalogFileFor("nope")).toBeUndefined();
    expect(getItem("nope")).toBeUndefined();
    expect(catalogContentType("a.webp")).toBe("image/webp");
    expect(catalogContentType("a.jpg")).toBe("image/jpeg");
  });

  it("catalogue copy has no fit or size language and no talk of a model's body", () => {
    const texts = [
      DEMO_CATALOG_NOTICE,
      ...CATALOG.flatMap((i) => [
        i.name,
        i.label,
        i.description,
        i.promptDescription,
        i.stock.line,
        i.shelf,
        ...i.readinessReasons,
      ]),
    ];
    for (const t of texts) expect(findFitLanguage(t), t).toBeNull();
    for (const i of CATALOG)
      for (const t of [i.description, i.name]) {
        expect(t, i.id).not.toMatch(
          /model|mid-calf|collarbone|runs long|the length/i,
        );
      }
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
