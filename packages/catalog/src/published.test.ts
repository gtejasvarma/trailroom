import { afterEach, describe, expect, it } from "vitest";
import {
  catalog,
  checkPublishedPiece,
  getItem,
  itemsByLabel,
  registerPublishedItems,
  setPublishedItems,
  startWithThese,
  CATALOG,
} from "./index";

const valid = () => ({
  id: "linen-shirt",
  name: "Washed linen shirt",
  label: "LOAM STUDIO",
  labelSlug: "loam-studio",
  priceUsd: 140,
  shopCategory: "apparel",
  shelf: "New in",
  stock: { line: "In stock", low: false },
  pairsWith: [],
  photos: [{ file: "linen-shirt-1.jpg", label: "Front", focus: "50% 26%" }],
  description: "Washed linen with a camp collar and a straight cut.",
  category: "top",
  promptDescription: "washed linen camp-collar shirt",
  readiness: 85,
  readinessReasons: ["Clear label photographs with the whole garment visible."],
  tryOn: "ready",
});

afterEach(() => setPublishedItems([]));

describe("checkPublishedPiece", () => {
  it("accepts a well-formed piece and fills in the render image", () => {
    const r = checkPublishedPiece(valid());
    expect(r.problems).toEqual([]);
    expect(r.item?.renderImage).toBe("linen-shirt-1.jpg");
  });

  it.each([
    ["the coat hits mid-calf on you", "description"],
    ["runs small", "description"],
    ["True to size", "name"],
    ["Flattering cut", "name"],
  ])("refuses fit or size language (%s in %s)", (text, field) => {
    const r = checkPublishedPiece({ ...valid(), [field]: text });
    expect(r.item).toBeNull();
    expect(r.problems.join(" ")).toMatch(/fit or size language/);
  });

  it("refuses fit language hidden in the stock line, shelf and photo labels", () => {
    expect(
      checkPublishedPiece({
        ...valid(),
        stock: { line: "Sizes S to XL", low: false },
      }).item,
    ).toBeNull();
    expect(
      checkPublishedPiece({ ...valid(), shelf: "Fits you" }).item,
    ).toBeNull();
    expect(
      checkPublishedPiece({
        ...valid(),
        photos: [{ file: "a.jpg", label: "Runs small", focus: "50% 50%" }],
      }).item,
    ).toBeNull();
  });

  it("refuses a bad id, an unknown label, a mismatched label name, a bad price and a bad photo", () => {
    for (const bad of [
      { id: "../etc" },
      { id: "coat" }, // a static piece
      { labelSlug: "nobody" },
      { label: "OTHER" },
      { priceUsd: 0 },
      { priceUsd: 10.123 },
      { photos: [] },
      { photos: [{ file: "x.gif", label: "Front", focus: "50% 26%" }] },
      { photos: [{ file: "x.jpg", label: "Front", focus: "top" }] },
      { category: "hat" },
    ]) {
      expect(
        checkPublishedPiece({ ...valid(), ...bad }).item,
        JSON.stringify(bad),
      ).toBeNull();
    }
    expect(checkPublishedPiece("nope").item).toBeNull();
  });
});

describe("the merged catalogue", () => {
  it("shows published pieces behind the existing accessors, and static ones always win", () => {
    const piece = checkPublishedPiece(valid()).item!;
    expect(getItem("linen-shirt")).toBeUndefined();
    setPublishedItems([piece, { ...piece, id: "coat", name: "Imposter" }]);
    expect(getItem("linen-shirt")?.name).toBe("Washed linen shirt");
    expect(getItem("coat")?.name).not.toBe("Imposter");
    expect(
      itemsByLabel("loam-studio").some((i) => i.id === "linen-shirt"),
    ).toBe(true);
    expect(catalog()).toHaveLength(CATALOG.length + 1);
    // "Start with these" stays the static, four-photo pieces.
    expect(startWithThese().every((i) => CATALOG.includes(i))).toBe(true);
  });

  it("register adds without dropping what is there", () => {
    const a = checkPublishedPiece(valid()).item!;
    const b = { ...a, id: "linen-shirt-2" };
    registerPublishedItems([a]);
    registerPublishedItems([b]);
    expect(catalog().map((i) => i.id)).toEqual(
      expect.arrayContaining(["linen-shirt", "linen-shirt-2"]),
    );
  });
});
