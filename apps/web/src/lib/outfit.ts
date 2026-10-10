// Pure helpers for an outfit's two pieces. No React, so they can be table-tested.
import { getItem, type CatalogItem } from "@trailroom/catalog";
import { copy } from "./copy";

/** The two catalogue pieces of an outfit job, or null if either is unknown. */
export function outfitPieces(
  itemIds: readonly string[],
): [CatalogItem, CatalogItem] | null {
  if (itemIds.length !== 2) return null;
  const a = getItem(itemIds[0]!);
  const b = getItem(itemIds[1]!);
  return a && b ? [a, b] : null;
}

/** "wool car coat over the bias-cut slip dress": the outer layer first when there is one. */
export function outfitTitle(pieces: readonly [CatalogItem, CatalogItem]) {
  const [a, b] = pieces;
  if (b.category === "outerwear" && a.category !== "outerwear") {
    return copy.outfit.title(b.name, a.name);
  }
  if (a.category === "outerwear") return copy.outfit.title(a.name, b.name);
  return copy.outfit.titleWith(a.name, b.name);
}
