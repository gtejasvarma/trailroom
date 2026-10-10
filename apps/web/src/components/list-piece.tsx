"use client";
// One piece in a list: the person's own Front render when they have a finished try-on of it
// (with the AI caption beside it, and the On you chip), otherwise the label's photograph.
import Link from "next/link";
import { catalogUrl, type CatalogItem } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { paths } from "../lib/flow";
import { useRenderImage } from "../lib/use-render-image";
import type { TryOnSummary } from "../server/try-ons";
import { Chip } from "./ui/chip";

export function ListPiece({
  item,
  tryOn,
  remove,
}: {
  item: CatalogItem;
  tryOn: TryOnSummary | undefined;
  remove?: () => void;
}) {
  const { url } = useRenderImage(
    tryOn?.poseSetId ?? null,
    "front",
    Boolean(tryOn),
  );
  const label = item.photos[0]!;
  const href = tryOn ? paths.tryOn(tryOn.jobId) : paths.item(item.id);
  return (
    <article
      data-testid="list-piece"
      data-item={item.id}
      data-on-you={tryOn ? "true" : undefined}
    >
      <div className="relative">
        <Link
          href={href}
          className="relative block aspect-[3/4] overflow-hidden rounded-[14px] bg-surface"
        >
          {tryOn ? (
            url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={copy.listPage.onYouAlt(item.name)}
                data-render
                className="reveal size-full object-cover"
                style={{ objectPosition: "50% 30%" }}
              />
            ) : (
              <span aria-hidden="true" className="skeleton block size-full" />
            )
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={catalogUrl(label.file)}
              alt={copy.item.imageAlt(item.name, item.label, label.label)}
              className="size-full object-cover"
              style={{ objectPosition: label.focus }}
            />
          )}
          {tryOn ? (
            <Chip className="absolute top-2 left-2" upper>
              {copy.card.onYou}
            </Chip>
          ) : null}
        </Link>
        {remove ? (
          <button
            type="button"
            onClick={remove}
            aria-label={copy.listPage.removePiece(item.name)}
            data-testid="remove-piece"
            className="absolute top-2 right-2 grid size-11 place-items-center rounded-full"
          >
            <span
              aria-hidden="true"
              className="grid size-[26px] place-items-center rounded-full bg-ink/70 text-[12px] text-canvas"
            >
              ✕
            </span>
          </button>
        ) : null}
      </div>
      {tryOn ? (
        <p
          className="mt-2 text-[12px] leading-4 text-ink-600"
          data-testid="ai-caption"
        >
          {copy.result.aiCaption}
        </p>
      ) : null}
      <p
        className={`${tryOn ? "" : "mt-2 "}text-[14px] leading-[19px] text-ink-800`}
      >
        {item.name}
      </p>
      <p className="text-[14px] leading-[19px] text-ink tabular-nums">
        {copy.item.price(item.priceUsd)}
      </p>
    </article>
  );
}
