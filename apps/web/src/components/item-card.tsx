import Link from "next/link";
import type { CatalogItem } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { labelStyle, small } from "../lib/ui";
import { TryOnButton } from "./tryon-button";

/** Catalog card (Design.md §8): 3:4 image, label, name, price, one primary action. */
export function ItemCard({ item }: { item: CatalogItem }) {
  return (
    <article
      className="flex flex-col"
      data-testid="item-card"
      data-item={item.id}
    >
      <Link
        href={`/item/${item.id}`}
        aria-label={copy.item.viewLabel(item.name)}
        className="block overflow-hidden rounded-lg bg-canvas"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.image}
          alt={copy.item.imageAlt(item.name, item.label)}
          width={600}
          height={800}
          className="aspect-tryon w-full object-cover"
        />
      </Link>
      <p className={`mt-3 ${labelStyle}`}>{item.label}</p>
      <p className={`mt-1 truncate ${small}`}>{item.name}</p>
      <p className="mt-1 mb-3 text-[16px] leading-5 font-medium text-ink tabular-nums">
        {copy.item.price(item.priceUsd)}
      </p>
      <TryOnButton itemId={item.id} name={item.name} />
    </article>
  );
}
