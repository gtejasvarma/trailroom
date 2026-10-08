import { ITEMS, type CatalogItem, type ShopCategory } from "./items";

export * from "./items";
export * from "./labels";
export * from "./copy-rules";

/** Items below this readiness are refused up front (the honest-failure path). */
export const READINESS_THRESHOLD = 70;

export const CATALOG: readonly CatalogItem[] = ITEMS;

export const DEMO_CATALOG_NOTICE =
  "Labels and prices in this catalogue are invented demo data.";

export function getItem(id: string): CatalogItem | undefined {
  return CATALOG.find((i) => i.id === id);
}

/** Whether we render this piece: apparel we can show honestly, above the readiness bar. */
export function isRenderReady(item: CatalogItem): boolean {
  return item.tryOn === "ready" && item.readiness >= READINESS_THRESHOLD;
}

/** The URL a catalogue photo is served from. */
export const catalogUrl = (file: string): string => `/catalog/${file}`;

export function itemsByLabel(slug: string): CatalogItem[] {
  return CATALOG.filter((i) => i.labelSlug === slug);
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
  const others = CATALOG.filter(
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
