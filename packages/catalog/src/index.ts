import { ITEMS, type CatalogItem } from "./items";

export * from "./items";
export * from "./copy-rules";

/** Items below this readiness are refused up front (the honest-failure path). */
export const READINESS_THRESHOLD = 70;

export const CATALOG: readonly CatalogItem[] = ITEMS;

export const DEMO_CATALOG_NOTICE =
  "Labels and prices in this catalogue are invented demo data.";

export function getItem(id: string): CatalogItem | undefined {
  return CATALOG.find((i) => i.id === id);
}

export function isRenderReady(item: CatalogItem): boolean {
  return item.readiness >= READINESS_THRESHOLD;
}

/**
 * Three other render-ready items: same category first, then the rest, each group ordered by
 * readiness (desc) then id. Deterministic.
 */
export function closestThree(itemId: string): CatalogItem[] {
  const self = getItem(itemId);
  const others = CATALOG.filter((i) => i.id !== itemId && isRenderReady(i));
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
