"use client";
// Swipeable photo frames. A phone swipes (scroll-snap). A fine pointer scrubs: the image is
// divided into one vertical zone per frame and the frame changes instantly as the pointer moves
// (no animation: it happens constantly), returning to the first frame on leave. The arrow keys
// change frame; previous and next stay in the accessibility tree but only show on keyboard focus.
// Dots are the only visible position indicator (a window of five when there are more frames).
// The "On you" chip is the only chip, and only on the person's own renders.
import Link from "next/link";
import { useRef, useState } from "react";
import { copy } from "../../lib/copy";
import { dotWindow } from "../../lib/dots";
import { Chip } from "./chip";
import { FadeImg } from "./fade-img";

export interface Frame {
  src: string;
  alt: string;
  /** CSS object-position. */
  focus: string;
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
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
      <path d={dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

export function PhotoFrames({
  name,
  frames,
  state = "label",
  href,
  aspect = "aspect-[4/5]",
  rounded = "",
  action,
}: {
  name: string;
  frames: Frame[];
  /** "label": the label's own photographs. "onYou": renders on the visitor's photo. */
  state?: "label" | "onYou";
  /** Where tapping a frame goes (a pointer shortcut: the name beside the card is the real link). */
  href?: string;
  aspect?: string;
  rounded?: string;
  /** Sits on the image, top right (the heart). */
  action?: React.ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [warm, setWarm] = useState(false);
  const n = frames.length;

  // Where the frames are heading. Keys in quick succession build on this, not on the index the
  // scroll has reached so far.
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

  const show = (to: number) => {
    const el = scroller.current;
    if (!el || to === target.current) return;
    clearTimeout(animating.current);
    animating.current = undefined;
    target.current = to;
    el.scrollTo({ left: to * el.clientWidth, behavior: "instant" });
    setIndex(to);
  };

  const dots = dotWindow(index, n);
  const arrow =
    "pointer-events-none absolute top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-canvas/90 text-ink opacity-0 shadow-2 focus:pointer-events-auto focus:opacity-100";

  return (
    <div
      data-testid="frames-wrap"
      className={`relative ${rounded} overflow-hidden bg-surface`}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") setWarm(true);
      }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || n < 2) return;
        const r = e.currentTarget.getBoundingClientRect();
        const zone = Math.floor(((e.clientX - r.left) / (r.width || 1)) * n);
        show(Math.max(0, Math.min(n - 1, zone)));
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse" && n > 1) show(0);
      }}
    >
      <div
        ref={scroller}
        tabIndex={0}
        role="group"
        aria-roledescription={copy.card.carousel}
        aria-label={copy.card.framesLabel(name)}
        data-testid="frames"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            go(1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            go(-1);
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
        {frames.map((f, i) => (
          <div
            key={i}
            role="group"
            aria-roledescription={copy.card.slide}
            aria-label={copy.card.frameLabel(name, i + 1, n)}
            className={`relative block w-full flex-none snap-start ${aspect} overflow-hidden`}
          >
            {f.src ? (
              <FadeImg
                src={f.src}
                alt={f.alt}
                loading={i === 0 || warm ? "eager" : "lazy"}
                decoding="async"
                draggable={false}
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
      {state === "onYou" ? (
        <Chip className="absolute top-3 left-3" data-testid="state-chip">
          {copy.card.onYou}
        </Chip>
      ) : null}
      {action}
      {n > 1 ? (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5"
          >
            {dots.map((i) => (
              <span
                key={i}
                data-testid="dot"
                data-active={i === index}
                className={`frame-dot size-1.5 rounded-full ${
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
            data-testid="prev"
            className={`${arrow} left-3`}
          >
            <Chevron dir="left" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={index === n - 1}
            aria-label={copy.card.next}
            data-testid="next"
            className={`${arrow} right-3`}
          >
            <Chevron dir="right" />
          </button>
        </>
      ) : null}
    </div>
  );
}
