"use client";
import Link from "next/link";
import { catalogUrl, type CatalogItem } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { paths } from "../lib/flow";
import { useRenderImages } from "../lib/use-render-image";
import { Button } from "./ui/button";
import { HeartIcon } from "./ui/icons";
import { PhotoFrames } from "./ui/photo-frames";
import { TryOnButton } from "./tryon-button";
import { useLists } from "./lists-provider";
import { useSaveToList } from "./save-to-list";
import { useMe } from "./me-provider";
import { useToast } from "./ui/toast";

/**
 * The Discover card: brand row, swipeable label photographs, name, price, stock line, and the
 * actions. When the signed-in person has tried the piece on, the frames become their poses (the
 * on-you state: their Front first, the ON YOU chip, "4 poses") and the card opens the result.
 * A guest only ever sees the label's photographs here.
 */
export function ProductCard({ item }: { item: CatalogItem }) {
  const say = useToast();
  const save = useSaveToList();
  const { isSaved } = useLists();
  const { isGuest, tryOns } = useMe();
  const mine = isGuest ? undefined : tryOns.find((t) => t.itemId === item.id);
  const urls = useRenderImages(mine?.poseSetId ?? null, mine?.poses ?? []);
  const onYou = Boolean(mine);
  const saved = !isGuest && isSaved(item.id);
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
      className="rise flex flex-col"
      data-testid="item-card"
      data-item={item.id}
      data-on-you={onYou ? "true" : undefined}
    >
      <PhotoFrames
        name={item.name}
        state={onYou ? "onYou" : "label"}
        href={mine ? paths.tryOn(mine.jobId) : `/item/${item.id}`}
        frames={frames}
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
            <Button
              size="md"
              onClick={() => say(copy.toasts.buySoon)}
              className="flex-1"
            >
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
            onClick={() => save(item.id)}
            aria-label={saved ? copy.card.saveToList : copy.card.addToList}
            data-testid="heart"
            data-saved={saved ? "true" : "false"}
            className="size-11 flex-none !px-0"
          >
            <HeartIcon filled={saved} />
          </Button>
        </div>
      </div>
    </article>
  );
}
