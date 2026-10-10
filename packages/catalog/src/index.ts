import { ITEMS, type CatalogItem, type ShopCategory } from "./items";
import { allItems } from "./published";

export * from "./items";
export * from "./published";
export * from "./labels";
export * from "./copy-rules";
export * from "./unsafe-text";

/** Items below this readiness are refused up front (the honest-failure path). */
export const READINESS_THRESHOLD = 70;

/** The twelve static pieces. Use `catalog()` for everything shown, which adds published pieces. */
export const CATALOG: readonly CatalogItem[] = ITEMS;

/** Static plus published pieces. */
export const catalog = (): readonly CatalogItem[] => allItems();

export const DEMO_CATALOG_NOTICE =
  "Labels and prices in this catalogue are invented demo data.";

export function getItem(id: string): CatalogItem | undefined {
  return allItems().find((i) => i.id === id);
}

/** Whether we render this piece: apparel we can show honestly, above the readiness bar. */
export function isRenderReady(item: CatalogItem): boolean {
  return item.tryOn === "ready" && item.readiness >= READINESS_THRESHOLD;
}

/** The URL a catalogue photo is served from. */
export const catalogUrl = (file: string): string => `/catalog/${file}`;

export function itemsByLabel(slug: string): CatalogItem[] {
  return allItems().filter((i) => i.labelSlug === slug);
}

/** "Start with these": render-ready pieces that have four label photographs. */
export function startWithThese(): CatalogItem[] {
  return CATALOG.filter((i) => isRenderReady(i) && i.photos.length === 4);
}

/** The first photograph of a label's first piece: the label's avatar. */
export function labelAvatar(slug: string): string | undefined {
  return itemsByLabel(slug)[0]?.photos[0]?.file;
}

/**
 * Three other render-ready apparel pieces: same prompt category first, then the rest, each group
 * ordered by readiness (desc) then id. Deterministic.
 */
export function closestThree(itemId: string): CatalogItem[] {
  const self = getItem(itemId);
  const others = allItems().filter(
    (i) => i.id !== itemId && isRenderReady(i) && i.shopCategory === "apparel",
  );
  const rank = (i: CatalogItem) =>
    self && i.category === self.category ? 0 : 1;
  return others
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        b.readiness - a.readiness ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 3);
}

/**
 * The Discover proof slider: two photographs of the same framing. The model shot is not a
 * catalogue piece; the on-person side is the car coat's label photograph.
 */
export const PROOF_MODEL_FILE = "p6218357.jpg";
export const PROOF_ON_PERSON_FILE = "p19299199.jpg";

/** The Discover category tiles: a photograph and crop for each shop category. */
export const SHOP_CATEGORIES: readonly {
  id: ShopCategory;
  file: string;
  focus: string;
}[] = [
  { id: "apparel", file: "p19299199.jpg", focus: "50% 30%" },
  { id: "jewellery", file: "p14411703.jpg", focus: "50% 25%" },
  { id: "accessories", file: "p14411703.jpg", focus: "50% 45%" },
];

/**
 * Whether two prompt categories can be worn together as one outfit: outerwear over a top, bottom
 * or dress, or a top with a bottom. The same rule as `outfitPlan` in @trailroom/render (a test in
 * @trailroom/pipeline checks all sixteen pairs agree); kept here so the client never imports the
 * render package.
 */
export function outfitCompatible(
  a: CatalogItem["category"],
  b: CatalogItem["category"],
): boolean {
  if (!a || !b || a === b) return false;
  if (a === "outerwear" || b === "outerwear") return true;
  if (a === "dress" || b === "dress") return false;
  return true; // top + bottom
}

/** Two piece ids in canonical (sorted) order, so A+B and B+A name one outfit. */
export function canonicalOutfitIds(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

/** Whether these two catalogue pieces make a valid outfit: both ready apparel, a valid pair. */
export function isOutfitPair(a: string, b: string): boolean {
  const x = getItem(a);
  const y = getItem(b);
  return (
    !!x &&
    !!y &&
    x.id !== y.id &&
    isRenderReady(x) &&
    isRenderReady(y) &&
    x.shopCategory === "apparel" &&
    y.shopCategory === "apparel" &&
    outfitCompatible(x.category, y.category)
  );
}

/**
 * The pieces "Build the outfit" offers for this one: those named in either piece's `pairsWith`
 * (the label's own suggestion, taken both ways) that make a valid outfit with it and are ready to
 * render. Jewellery and pieces we cannot render never appear. Empty means no control is shown.
 */
export function outfitPairsFor(itemId: string): CatalogItem[] {
  const self = getItem(itemId);
  if (!self) return [];
  return allItems().filter(
    (o) =>
      o.id !== itemId &&
      (self.pairsWith.includes(o.id) || o.pairsWith.includes(itemId)) &&
      isOutfitPair(itemId, o.id),
  );
}
