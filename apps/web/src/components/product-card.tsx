"use client";
import Link from "next/link";
import { catalogUrl, type CatalogItem } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { Button } from "./ui/button";
import { HeartIcon } from "./ui/icons";
import { PhotoFrames } from "./ui/photo-frames";
import { TryOnButton } from "./tryon-button";
import { useToast } from "./ui/toast";

/**
 * The Discover card: brand row, swipeable label photographs, name, price, stock line, and the
 * actions. `onYou` is the later state, once a render exists: the frames become the four poses
 * and Buy and Add to a list join the row.
 */
export function ProductCard({
  item,
  onYou = false,
}: {
  item: CatalogItem;
  onYou?: boolean;
}) {
  const say = useToast();
  const price = copy.item.price(item.priceUsd);
  const soon = () => say(copy.toasts.soon);

  return (
    <article
      className="rise flex flex-col"
      data-testid="item-card"
      data-item={item.id}
    >
      <PhotoFrames
        name={item.name}
        state={onYou ? "onYou" : "label"}
        href={`/item/${item.id}`}
        frames={item.photos.map((p) => ({
          src: catalogUrl(p.file),
          alt: copy.item.imageAlt(item.name, item.label, p.label),
          focus: p.focus,
        }))}
        rounded="md:rounded-md"
      />
      <div className="px-4 pt-3 md:px-0">
        <p
          data-testid="card-label"
          className="mb-0.5 text-[12px] leading-4 text-ink-600"
        >
          {item.label}
        </p>
        <div className="flex items-baseline gap-2">
          <Link
            href={`/item/${item.id}`}
            aria-label={copy.item.viewLabel(item.name)}
            className="flex-1 text-[15px] leading-5 text-ink"
          >
            {item.name}
          </Link>
          <span className="flex-none text-[15px] leading-5 font-medium text-ink tabular-nums">
            {price}
          </span>
        </div>
        <p
          data-testid="stock"
          className={`mt-0.5 text-[13px] leading-[18px] ${
            item.stock.low ? "text-danger" : "text-ink-600"
          }`}
        >
          {item.stock.line}
        </p>
        <div className="mt-3 flex items-center gap-2">
          {onYou ? (
            <Button size="md" onClick={soon} className="flex-1">
              {copy.card.buy(price)}
            </Button>
          ) : (
            <TryOnButton
              itemId={item.id}
              name={item.name}
              size="md"
              className="flex-1"
            />
          )}
          <Button
            variant="outline"
            size="md"
            onClick={soon}
            aria-label={copy.card.addToList}
            className="size-11 flex-none !px-0"
          >
            <HeartIcon />
          </Button>
        </div>
      </div>
    </article>
  );
}
