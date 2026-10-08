import Link from "next/link";
import { catalogUrl, type CatalogItem } from "@trailroom/catalog";
import { copy } from "../lib/copy";

/** A compact piece: its first label photograph, name and price. Used in rails and grids. */
export function PieceTile({ item }: { item: CatalogItem }) {
  const photo = item.photos[0]!;
  return (
    <Link
      href={`/item/${item.id}`}
      data-testid="piece-tile"
      data-item={item.id}
      className="block text-left"
    >
      <span className="block aspect-[3/4] overflow-hidden rounded-md bg-canvas md:aspect-[4/5]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={catalogUrl(photo.file)}
          alt={copy.item.imageAlt(item.name, item.label, photo.label)}
          loading="lazy"
          className="size-full object-cover"
          style={{ objectPosition: photo.focus }}
        />
      </span>
      <span className="mt-2 block truncate text-[14px] leading-[19px] text-ink-800">
        {item.name}
      </span>
      <span className="block text-[14px] leading-[19px] text-ink tabular-nums">
        {copy.item.price(item.priceUsd)}
      </span>
    </Link>
  );
}
