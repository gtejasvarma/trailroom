"use client";
// New pieces from labels the person follows. With the buffer off (the default) every tile is the
// label's own photograph and the ordinary "Try it on": nothing says a piece is "on you". Only a
// tile whose Front render exists, passed the gate and belongs to this person is drawn from their
// photo; it carries the "On you" chip, the AI caption beside it, and its own "Try it on" asks for
// the full set like any requested try-on. A render that failed is simply not here.
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  catalogUrl,
  registerPublishedItems,
  type CatalogItem,
} from "@trailroom/catalog";
import { api } from "../lib/api";
import { copy } from "../lib/copy";
import { peekUser } from "../lib/firebase";
import { useRenderImage } from "../lib/use-render-image";
import type { ArrivalsBody } from "../server/arrivals";
import { useMe } from "./me-provider";
import { TryOnButton } from "./tryon-button";
import { Chip } from "./ui/chip";

/** Loads the shelf for a visitor who already has a session; browsing never creates one. */
export function useArrivals(): ArrivalsBody | null {
  const { loaded, follows } = useMe();
  const [data, setData] = useState<ArrivalsBody | null>(null);
  const followKey = [...follows].sort().join(",");
  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    (async () => {
      try {
        if (!(await peekUser()) || followKey === "") {
          if (!cancelled) setData(null);
          return;
        }
        const next = await api.arrivals();
        if (cancelled) return;
        registerPublishedItems(next.pieces);
        setData(next);
      } catch {
        if (!cancelled) setData(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loaded, followKey]);
  return data;
}

function Tile({
  item,
  poseSetId,
}: {
  item: CatalogItem;
  poseSetId: string | null;
}) {
  const photo = item.photos[0]!;
  const render = useRenderImage(poseSetId, poseSetId ? "front" : null);
  const onYou = Boolean(poseSetId && render.url);
  return (
    <li
      className="w-[156px] flex-none md:w-[200px]"
      data-testid="arrival-tile"
      data-item={item.id}
      data-on-you={onYou ? "true" : undefined}
    >
      <Link href={`/item/${item.id}`} className="block text-left">
        <span className="relative block aspect-[3/4] overflow-hidden rounded-md bg-canvas md:aspect-[4/5]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={onYou ? render.url! : catalogUrl(photo.file)}
            alt={
              onYou
                ? copy.arrivals.cardAlt(item.name)
                : copy.item.imageAlt(item.name, item.label, photo.label)
            }
            className="size-full object-cover"
            style={{ objectPosition: onYou ? "50% 30%" : photo.focus }}
          />
          <Chip
            upper
            className="absolute top-2 left-2"
            data-testid="arrival-chip"
          >
            {onYou ? copy.card.onYou : copy.arrivals.shelf}
          </Chip>
        </span>
        <span className="mt-[7px] block text-[10px] leading-[14px] font-semibold tracking-[0.08em] text-ink-600 uppercase">
          {item.label}
        </span>
        <span className="block truncate text-[13px] leading-[18px] text-ink">
          {item.name}
        </span>
        <span className="block text-[13px] leading-[18px] text-ink tabular-nums">
          {copy.item.price(item.priceUsd)}
        </span>
      </Link>
      {onYou ? (
        <p
          data-testid="arrival-ai"
          className="mt-1 text-[11px] leading-[15px] text-ink-600"
        >
          {copy.result.aiCaption}
        </p>
      ) : null}
      <TryOnButton
        itemId={item.id}
        name={item.name}
        size="md"
        className="mt-2 w-full"
      />
    </li>
  );
}

export function ArrivalsShelf({ data }: { data: ArrivalsBody | null }) {
  const pieces = data?.pieces ?? [];
  const cards = (data?.cards ?? []).filter((c) =>
    pieces.some((p) => p.id === c.itemId),
  );
  const unseen = cards.filter((c) => !c.seen).map((c) => c.itemId);
  const unseenKey = unseen.join(",");

  // The cards were on screen: mark them seen, which is what lets the next batch start.
  useEffect(() => {
    if (!unseenKey) return;
    const t = setTimeout(() => {
      api.arrivalsSeen(unseenKey.split(",")).catch(() => undefined);
    }, 1500);
    return () => clearTimeout(t);
  }, [unseenKey]);

  if (pieces.length === 0) return null;
  const withCard = new Map(cards.map((c) => [c.itemId, c.poseSetId]));
  const ordered = [
    ...pieces.filter((p) => withCard.has(p.id)),
    ...pieces.filter((p) => !withCard.has(p.id)),
  ];
  const arrives = cards.length > 0;
  return (
    <section
      aria-labelledby="arrivals-title"
      data-testid="arrivals"
      data-mode={arrives ? "on-you" : "label"}
      className="mx-4 mb-6 rounded-lg border border-line py-3.5 md:mx-0"
    >
      <div className="px-4 pb-3">
        <h2
          id="arrivals-title"
          className="text-[15px] leading-5 font-semibold tracking-[-0.01em] text-ink"
        >
          {arrives ? copy.arrivals.onYouTitle : copy.arrivals.title}
        </h2>
        <p className="text-[13px] leading-[18px] text-ink-700">
          {arrives ? copy.arrivals.onYouNote : copy.arrivals.note}
        </p>
      </div>
      <ul className="no-scrollbar m-0 flex list-none gap-3 overflow-x-auto px-4">
        {ordered.map((item) => (
          <Tile
            key={item.id}
            item={item}
            poseSetId={withCard.get(item.id) ?? null}
          />
        ))}
      </ul>
    </section>
  );
}
