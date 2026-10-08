import type { CatalogItem } from "@trailroom/catalog";
import { PieceTile } from "./piece-tile";
import { TryOnButton } from "./tryon-button";

/** A piece with its Try it on action: the closest-three alternatives on the failure screen. */
export function ItemCard({ item }: { item: CatalogItem }) {
  return (
    <article
      className="flex flex-col gap-3"
      data-testid="item-card"
      data-item={item.id}
    >
      <PieceTile item={item} />
      <TryOnButton itemId={item.id} name={item.name} size="md" />
    </article>
  );
}
