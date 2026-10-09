"use client";
// Swipeable photo frames: horizontal scroll-snap, a count chip, dots, and a state chip. The
// "on you" state is a prop for the later phase that renders on the visitor's own photo.
import Link from "next/link";
import { useRef, useState } from "react";
import { copy } from "../../lib/copy";
import { Chip } from "./chip";

export interface Frame {
  src: string;
  alt: string;
  /** CSS object-position. */
  focus: string;
}

export function PhotoFrames({
  name,
  frames,
  state = "label",
  href,
  aspect = "aspect-[4/5]",
  rounded = "",
}: {
  name: string;
  frames: Frame[];
  /** "label": the label's own photographs. "onYou": renders on the visitor's photo. */
  state?: "label" | "onYou";
  /** Where tapping a frame goes (a pointer shortcut: the name beside the card is the real link). */
  href?: string;
  aspect?: string;
  rounded?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const n = frames.length;

  // Where the frames are heading. Clicks in quick succession build on this, not on the index
  // the scroll has reached so far.
  const target = useRef(0);
  const animating = useRef<ReturnType<typeof setTimeout>>(undefined);

  const go = (delta: number) => {
    const el = scroller.current;
    if (!el) return;
    const to = Math.max(0, Math.min(n - 1, target.current + delta));
    target.current = to;
    clearTimeout(animating.current);
    animating.current = setTimeout(() => (animating.current = undefined), 700);
    el.scrollTo({ left: to * el.clientWidth, behavior: "smooth" });
    setIndex(to);
  };

  return (
    <div
      data-testid="frames-wrap"
      className={`relative ${rounded} overflow-hidden`}
    >
      <div
        ref={scroller}
        tabIndex={0}
        role="group"
        aria-roledescription={copy.card.carousel}
        aria-label={copy.card.framesLabel(name)}
        data-testid="frames"
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
        {frames.map((f, i) => (
          <div
            key={i}
            role="group"
            aria-roledescription={copy.card.slide}
            aria-label={copy.card.frameLabel(name, i + 1, n)}
            className={`relative block w-full flex-none snap-start ${aspect} overflow-hidden bg-canvas`}
          >
            {f.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={f.src}
                alt={f.alt}
                loading={i === 0 ? "eager" : "lazy"}
                className="size-full object-cover"
                style={{ objectPosition: f.focus }}
              />
            ) : (
              <span aria-hidden="true" className="skeleton block size-full" />
            )}
            {href ? (
              <Link
                href={href}
                aria-hidden="true"
                tabIndex={-1}
                className="absolute inset-0"
              />
            ) : null}
          </div>
        ))}
      </div>
      <Chip upper className="absolute top-3 left-3" data-testid="state-chip">
        {state === "onYou" ? copy.card.onYou : copy.card.modelShot}
      </Chip>
      <Chip className="absolute top-3 right-3" data-testid="count-chip">
        {state === "onYou" ? copy.card.poses(n) : copy.card.photos(n)}
      </Chip>
      {n > 1 ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {frames.map((f, i) => (
              <span
                key={i}
                data-testid="dot"
                data-active={i === index}
                className={`size-1.5 rounded-full ${
                  i === index ? "bg-canvas" : "bg-canvas/50"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={index === 0}
            aria-label={copy.card.prev}
            className="absolute top-1/2 left-3 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-canvas/90 text-ink shadow-2 disabled:opacity-0 md:flex"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={index === n - 1}
            aria-label={copy.card.next}
            className="absolute top-1/2 right-3 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-canvas/90 text-ink shadow-2 disabled:opacity-0 md:flex"
          >
            →
          </button>
        </>
      ) : null}
    </div>
  );
}
