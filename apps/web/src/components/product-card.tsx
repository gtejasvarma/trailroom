"use client";
import Link from "next/link";
import { catalogUrl, type CatalogItem } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { paths } from "../lib/flow";
import { useRenderImages } from "../lib/use-render-image";
import { Button } from "./ui/button";
import { FavouriteHeart } from "./favourite-heart";
import { PhotoFrames } from "./ui/photo-frames";
import { TryOnButton } from "./tryon-button";
import { useMe } from "./me-provider";
import { useBuy } from "./use-buy";

/**
 * The Discover card: the swipeable label photographs (or, once the person has tried the piece
 * on, their poses, with the "On you" chip and the AI caption under them), the heart on the image,
 * two quiet text lines and one action. The image opens the piece, or the result when it is on
 * the person. A guest only ever sees the label's photographs here.
 */
export function ProductCard({
  item,
  first = false,
}: {
  item: CatalogItem;
  /** The first card in the feed: its picture is not lazy. */
  first?: boolean;
}) {
  const buy = useBuy();
  const { isGuest, tryOns } = useMe();
  const mine = isGuest ? undefined : tryOns.find((t) => t.itemId === item.id);
  const urls = useRenderImages(mine?.poseSetId ?? null, mine?.poses ?? []);
  const onYou = Boolean(mine);
  const price = copy.item.price(item.priceUsd);

  const frames = mine
    ? mine.poses.map((p, i) => ({
        src: urls[i] ?? "",
        alt: copy.result.thumbAlt(item.name, copy.poses[p] ?? p),
        focus: "50% 30%",
      }))
    : item.photos.map((p) => ({
        src: catalogUrl(p.file),
        alt: copy.item.imageAlt(item.name, item.label, p.label),
        focus: p.focus,
      }));

  return (
    <article
      className="flex flex-col"
      data-testid="item-card"
      data-item={item.id}
      data-on-you={onYou ? "true" : undefined}
      data-first={first ? "true" : undefined}
    >
      <PhotoFrames
        name={item.name}
        state={onYou ? "onYou" : "label"}
        href={mine ? paths.tryOn(mine.jobId) : `/item/${item.id}`}
        frames={frames}
        aspect="aspect-[4/5] md:aspect-[3/4]"
        rounded="md:rounded-md"
        action={<FavouriteHeart itemId={item.id} className="top-3 right-3" />}
      />
      {onYou ? (
        <p
          data-testid="card-ai"
          className="px-4 pt-2 text-[12px] leading-4 text-ink-600 md:px-0"
        >
          {copy.result.aiCaption}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 px-4 pt-3 md:px-0">
        <div className="min-w-[200px] flex-1">
          <div className="flex items-baseline gap-3">
            <Link
              href={`/item/${item.id}`}
              aria-label={copy.item.viewLabel(item.name)}
              className="min-w-0 flex-1 truncate text-[15px] leading-5 text-ink"
            >
              {item.name}
            </Link>
            <span className="flex-none text-[15px] leading-5 text-ink tabular-nums">
              {price}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[13px] leading-[18px] text-ink-600">
            <span data-testid="card-label">{item.label}</span>
            {item.stock.low ? (
              <span data-testid="stock" className="text-danger">
                {" · "}
                {item.stock.line}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex-none">
          {onYou ? (
            <Button
              size="md"
              onClick={() => buy(item.id)}
              data-testid="buy"
              className="!min-h-10 !px-5 !text-[14px]"
            >
              {copy.card.buy(price)}
            </Button>
          ) : (
            <TryOnButton
              itemId={item.id}
              name={item.name}
              size="md"
              className="!min-h-10 !w-auto !px-5 !text-[14px]"
            />
          )}
        </div>
      </div>
    </article>
  );
}
