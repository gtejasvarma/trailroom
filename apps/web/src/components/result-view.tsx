"use client";
// The result: a full-bleed swipe gallery of the poses (dots and the On you chip, nothing else),
// the AI caption and the expectation line directly under it, a press-and-hold control that swaps
// in the label's own photograph, pose thumbnails that jump the gallery, then the piece and its
// actions. From 768px the thumbnails sit in a column beside a larger pose and the details sit to
// the right. The first sight of a finished try-on is the Reveal (reveal.tsx), not this.
// Buy opens the buy sheet; Add to a list opens the list sheet; Build the outfit opens the pair preview
// (outfit-row.tsx). On wide screens the piece can be added to Compare.
import { useRef, useState } from "react";
import type { CatalogItem } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { passedPoses, type JobView } from "../lib/job";
import { useRenderImage } from "../lib/use-render-image";
import { Button } from "./ui/button";
import { catalogUrl } from "@trailroom/catalog";
import { Chip } from "./ui/chip";
import { useBuy } from "./use-buy";
import { useCompare } from "./compare-provider";
import { useSaveToList } from "./save-to-list";
import { OutfitRow } from "./outfit-row";

function Slide({
  job,
  item,
  pose,
}: {
  job: JobView;
  item: CatalogItem;
  pose: string;
}) {
  const { url } = useRenderImage(job.poseSetId, pose);
  const poseName = copy.poses[pose] ?? pose;
  return (
    <div
      data-testid="pose-slide"
      data-pose={pose}
      className={`relative block aspect-[3/4] w-full flex-none snap-start overflow-hidden bg-canvas ${
        url ? "" : "skeleton"
      }`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={copy.result.heroAlt(item.name, item.label, poseName)}
          data-render
          data-hero
          className="block size-full bg-canvas object-cover"
        />
      ) : null}
    </div>
  );
}

function Thumb({
  job,
  item,
  pose,
  selected,
  onSelect,
}: {
  job: JobView;
  item: CatalogItem;
  pose: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const { url } = useRenderImage(job.poseSetId, pose, true, "tile");
  const poseName = copy.poses[pose] ?? pose;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={poseName}
      data-testid="pose-thumb"
      data-pose={pose}
      className="block w-16 flex-none p-0 text-center md:w-[76px]"
    >
      <span
        className={`relative block aspect-[4/5] w-full overflow-hidden rounded-[7px] bg-surface transition-opacity duration-150 ${
          selected
            ? "opacity-100 outline-2 -outline-offset-2 outline-ink"
            : "opacity-55"
        }`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            className="size-full object-cover"
            style={{ objectPosition: "50% 30%" }}
          />
        ) : null}
      </span>
      <span
        className={`mt-1 block truncate text-[10px] leading-[13px] md:text-[11px] ${
          selected ? "text-ink" : "text-ink-600"
        }`}
      >
        {poseName}
      </span>
    </button>
  );
}

/** The signed-in person's result. Guests never get here: the server serves them tiles only. */
export function ResultView({ job, item }: { job: JobView; item: CatalogItem }) {
  const saveToList = useSaveToList();
  const buy = useBuy();
  const [held, setHeld] = useState(false);
  const heldBy = useRef(false);
  const photo = item.photos[0]!;
  const compare = useCompare();
  const poses = passedPoses(job);
  const n = poses.length;
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const target = useRef(0);
  const animating = useRef<ReturnType<typeof setTimeout>>(undefined);
  const price = copy.item.price(item.priceUsd);

  const jump = (i: number) => {
    const el = scroller.current;
    if (!el) return;
    const to = Math.max(0, Math.min(n - 1, i));
    target.current = to;
    clearTimeout(animating.current);
    animating.current = setTimeout(() => {
      animating.current = undefined;
      // Scroll events during the glide were ignored: catch up with where it ended.
      const i = Math.round(el.scrollLeft / (el.clientWidth || 1));
      target.current = i;
      setIndex(i);
    }, 700);
    el.scrollTo({ left: to * el.clientWidth, behavior: "smooth" });
    setIndex(to);
  };

  const release = () => setHeld(false);
  return (
    <div className="mx-auto w-full max-w-[1600px] pb-8 md:px-10 md:pt-6">
      <div className="md:grid md:grid-cols-[76px_minmax(0,600px)_minmax(300px,1fr)] md:items-start md:gap-x-8">
        <div className="relative md:col-start-2 md:row-start-1 md:max-w-[min(600px,calc((100svh-200px)*0.75))] md:overflow-hidden md:rounded-md">
          <div
            ref={scroller}
            data-testid="pose-gallery"
            role="group"
            aria-roledescription={copy.card.carousel}
            aria-label={copy.result.galleryLabel}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                e.preventDefault();
                jump(index + 1);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                jump(index - 1);
              }
            }}
            onScroll={(e) => {
              const el = e.currentTarget;
              const i = Math.round(el.scrollLeft / (el.clientWidth || 1));
              if (animating.current === undefined) {
                target.current = i;
                setIndex(i);
              }
            }}
            className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
          >
            {poses.map((p) => (
              <Slide key={p} job={job} item={item} pose={p} />
            ))}
          </div>
          {held ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={catalogUrl(photo.file)}
              alt={copy.result.labelsPhotoAlt(item.name, item.label)}
              data-testid="label-photo"
              className="absolute inset-0 z-[5] size-full bg-canvas object-cover"
              style={{ objectPosition: photo.focus }}
            />
          ) : null}
          <Chip
            className="absolute top-3 left-3 z-[6]"
            data-testid="state-chip"
          >
            {held ? copy.result.labelsPhoto : copy.result.onYou}
          </Chip>
          {n > 1 ? (
            <>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-3 z-[6] flex justify-center gap-1.5"
              >
                {poses.map((p, i) => (
                  <span
                    key={p}
                    data-testid="dot"
                    data-active={i === index}
                    className={`frame-dot size-1.5 rounded-full ${
                      i === index ? "bg-canvas" : "bg-canvas/50"
                    }`}
                  />
                ))}
              </div>
              {(["prev", "next"] as const).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => jump(index + (dir === "next" ? 1 : -1))}
                  disabled={dir === "next" ? index === n - 1 : index === 0}
                  aria-label={copy.card[dir]}
                  className={`pointer-events-none absolute top-1/2 z-[6] grid size-10 -translate-y-1/2 place-items-center rounded-full bg-canvas/90 text-ink opacity-0 shadow-2 focus:pointer-events-auto focus:opacity-100 ${
                    dir === "next" ? "right-3" : "left-3"
                  }`}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path
                      d={dir === "next" ? "M9 5l7 7-7 7" : "M15 5l-7 7 7 7"}
                    />
                  </svg>
                </button>
              ))}
            </>
          ) : null}
        </div>

        <div className="px-4 pt-2 md:col-start-2 md:row-start-2 md:px-0">
          <p
            data-testid="ai-caption"
            className="text-[12px] leading-4 font-medium text-ink-600"
          >
            {copy.result.aiCaption}
          </p>
          <p className="text-[12px] leading-4 text-ink-600">
            {copy.result.expectation}
          </p>
          <button
            type="button"
            aria-pressed={held}
            data-testid="hold-compare"
            onPointerDown={(e) => {
              heldBy.current = true;
              e.currentTarget.setPointerCapture?.(e.pointerId);
              setHeld(true);
            }}
            onPointerUp={release}
            onPointerCancel={release}
            onLostPointerCapture={release}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                heldBy.current = true;
                setHeld(true);
              }
            }}
            onKeyUp={(e) => {
              if (e.key === " " || e.key === "Enter") release();
            }}
            onBlur={release}
            onContextMenu={(e) => e.preventDefault()}
            onClick={() => {
              // A click with no press before it is a screen reader's activation: toggle.
              if (heldBy.current) heldBy.current = false;
              else setHeld((h) => !h);
            }}
            className="mt-2.5 inline-flex min-h-11 touch-manipulation items-center text-[14px] leading-5 font-medium text-ink underline decoration-ink-400 underline-offset-4 select-none"
          >
            {copy.result.holdToCompare}
          </button>
          {job.status === "complete_partial" ? (
            <p
              className="mt-3 text-[14px] leading-5 text-ink-700"
              data-testid="partial-line"
            >
              {copy.result.partial(n, job.poseOrder.length)}
            </p>
          ) : null}
        </div>

        <div
          role="group"
          aria-label={copy.result.thumbsLabel}
          className="flex gap-1.5 px-4 pt-2 md:col-start-1 md:row-span-3 md:row-start-1 md:flex-col md:gap-2 md:px-0 md:pt-0"
        >
          {poses.map((p, i) => (
            <Thumb
              key={p}
              job={job}
              item={item}
              pose={p}
              selected={i === index}
              onSelect={() => jump(i)}
            />
          ))}
        </div>

        <div className="px-4 pt-3 md:col-start-3 md:row-span-3 md:row-start-1 md:px-0 md:pt-0">
          <p className="mb-0.5 text-[14px] leading-5 text-ink-600">
            {item.label}
          </p>
          <div className="flex items-baseline gap-2.5 md:block">
            <h1 className="flex-1 text-[22px] leading-7 font-medium tracking-[-0.02em] text-ink md:text-[30px] md:leading-9">
              {item.name}
            </h1>
            <p className="flex-none text-[18px] leading-7 font-medium text-ink tabular-nums md:mt-1 md:text-[21px]">
              {price}
            </p>
          </div>
          <p
            className={`mt-0.5 text-[13px] leading-[18px] ${item.stock.low ? "text-danger" : "text-ink-600"}`}
          >
            {item.stock.line}
          </p>
          <p className="mt-3 text-[15px] leading-[23px] text-ink-700">
            {item.description}
          </p>
          <Button
            size="lg"
            onClick={() => buy(item.id)}
            data-testid="buy"
            className="mt-3 w-full"
          >
            {copy.result.buy(price, item.label.toUpperCase())}
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={() => saveToList(item.id)}
            className="mt-2.5 w-full min-h-12"
          >
            {copy.result.addToList}
          </Button>
          {compare.enabled ? (
            <Button
              variant="outline"
              size="md"
              aria-pressed={compare.has(job.poseSetId)}
              data-testid="compare-toggle"
              onClick={() => compare.toggle(job.poseSetId)}
              className="mt-2.5 w-full min-h-12"
            >
              {compare.has(job.poseSetId)
                ? copy.compare.inCompare
                : copy.compare.add}
            </Button>
          ) : null}
          <OutfitRow item={item} job={job} />
        </div>
      </div>
    </div>
  );
}
