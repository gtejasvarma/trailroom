"use client";
// New pieces from labels the person follows. With the buffer off (the default) every tile is the
// label's own photograph and the ordinary "Try it on": nothing says a piece is "on you". Only a
// tile whose Front render exists, passed the gate and belongs to this person is drawn from their
// photo; it carries the "On you" chip, the AI caption beside it, and its own "Try it on" asks for
// the full set like any requested try-on. A render that failed is simply not here.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
import { FadeImg } from "./ui/fade-img";

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
      className="w-[200px] flex-none md:w-[260px]"
      data-testid="arrival-tile"
      data-item={item.id}
      data-on-you={onYou ? "true" : undefined}
    >
      <Link href={`/item/${item.id}`} className="block text-left">
        <span className="relative block aspect-[3/4] overflow-hidden rounded-md bg-surface">
          <FadeImg
            src={onYou ? render.url! : catalogUrl(photo.file)}
            alt={
              onYou
                ? copy.arrivals.cardAlt(item.name)
                : copy.item.imageAlt(item.name, item.label, photo.label)
            }
            className="size-full object-cover"
            style={{ objectPosition: onYou ? "50% 30%" : photo.focus }}
          />
          {onYou ? (
            <Chip
              className="absolute top-2.5 left-2.5"
              data-testid="arrival-chip"
            >
              {copy.card.onYou}
            </Chip>
          ) : null}
        </span>
        <span className="mt-2.5 flex items-baseline gap-3 text-[15px] leading-5 text-ink">
          <span className="min-w-0 flex-1 truncate">{item.name}</span>
          <span className="flex-none tabular-nums">
            {copy.item.price(item.priceUsd)}
          </span>
        </span>
        <span className="block truncate text-[13px] leading-[18px] text-ink-600">
          {item.label}
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

  // A card counts as seen only once it has really been looked at: its tile at least half in view
  // for a second, with the tab showing and the picture drawn. That is what lets the next batch
  // start, so a page that loads in a background tab, or is scrolled past, marks nothing.
  const listRef = useRef<HTMLUListElement>(null);
  const hasList = pieces.length > 0;
  useEffect(() => {
    if (!unseenKey || !hasList || typeof IntersectionObserver === "undefined")
      return;
    const want = new Set(unseenKey.split(","));
    const visible = new Set<Element>();
    const timers = new Map<Element, ReturnType<typeof setTimeout>>();
    const sent = new Set<string>();
    let batch: string[] = [];
    let flush: ReturnType<typeof setTimeout> | undefined;
    const idOf = (el: Element) => (el as HTMLElement).dataset.item ?? "";
    const stop = (el: Element) => {
      clearTimeout(timers.get(el));
      timers.delete(el);
    };
    const start = (el: Element) => {
      if (timers.has(el) || document.visibilityState !== "visible") return;
      timers.set(
        el,
        setTimeout(() => {
          timers.delete(el);
          const id = idOf(el);
          if (!visible.has(el) || document.visibilityState !== "visible")
            return;
          // The tile may still be showing the label's photo: wait for the render to be drawn.
          if ((el as HTMLElement).dataset.onYou !== "true") return start(el);
          if (sent.has(id)) return;
          sent.add(id);
          batch.push(id);
          clearTimeout(flush);
          flush = setTimeout(() => {
            const ids = batch;
            batch = [];
            api.arrivalsSeen(ids).catch(() => undefined);
          }, 0);
        }, 1000),
      );
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            visible.add(e.target);
            start(e.target);
          } else {
            visible.delete(e.target);
            stop(e.target);
          }
        }
      },
      { threshold: 0.5 },
    );
    const tiles = [
      ...(listRef.current?.querySelectorAll("[data-item]") ?? []),
    ].filter((el) => want.has(idOf(el)));
    for (const el of tiles) io.observe(el);
    const onVisibility = () => {
      for (const el of visible) {
        if (document.visibilityState === "visible") start(el);
        else stop(el);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      io.disconnect();
      for (const t of timers.values()) clearTimeout(t);
      clearTimeout(flush);
    };
  }, [unseenKey, hasList]);

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
      className="mt-8 md:mt-12"
    >
      <div className="px-4 pb-4 md:px-0">
        <h2
          id="arrivals-title"
          className="text-[20px] leading-7 font-semibold tracking-[-0.02em] text-ink md:text-[24px] md:leading-8"
        >
          {arrives ? copy.arrivals.onYouTitle : copy.arrivals.title}
        </h2>
        <p className="text-[14px] leading-5 text-ink-600">
          {arrives ? copy.arrivals.onYouNote : copy.arrivals.note}
        </p>
      </div>
      <ul
        ref={listRef}
        className="no-scrollbar m-0 flex list-none gap-4 overflow-x-auto px-4 md:gap-6 md:px-0"
      >
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
