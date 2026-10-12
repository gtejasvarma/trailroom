"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  PROOF_MODEL_FILE,
  PROOF_ON_PERSON_FILE,
  catalogUrl,
} from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { ButtonLink } from "./ui/button";

// Where the divider rests before it moves, and where it glides to.
const START = 78;
const END = 50;
const GLIDE_MS = 900;
const EASE_IN_OUT = "cubic-bezier(0.77, 0, 0.175, 1)";
// The glide plays once per page load, not once per mount.
let glided = false;

function Handle() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />
    </svg>
  );
}

/**
 * The hero for a visitor with no photo: the label's photograph and the same piece rendered on
 * Maya, under a divider. It is in the server's HTML, so it paints first, with no entrance. Once
 * both pictures have loaded the divider glides from 78% to the middle to show that it moves;
 * any touch of the slider cancels the glide. The control is a real range input, so it works by
 * pointer, touch and keyboard.
 */
export function ProofSlider({ uploadHref }: { uploadHref: string }) {
  const [x, setX] = useState(START);
  const [ready, setReady] = useState(false);
  const clip = useRef<HTMLSpanElement>(null);
  const divider = useRef<HTMLSpanElement>(null);
  const anims = useRef<Animation[]>([]);
  const done = useRef({ model: false, person: false });

  const mark = useCallback((k: "model" | "person") => {
    done.current[k] = true;
    if (done.current.model && done.current.person) setReady(true);
  }, []);
  // An image that finished before React hydrated never fires onLoad: check it on attach.
  const ref = (k: "model" | "person") => (el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth > 0) mark(k);
  };

  // Stops the glide where it is and hands the position to the state.
  const cancelGlide = useCallback(() => {
    if (anims.current.length === 0) return;
    const el = divider.current;
    if (el) {
      const m = new DOMMatrix(getComputedStyle(el).transform);
      const w = el.offsetWidth || 1;
      setX(Math.max(2, Math.min(98, (m.m41 / w) * 100)));
    }
    for (const a of anims.current) a.cancel();
    anims.current = [];
  }, []);

  useEffect(() => {
    if (!ready || glided) return;
    const c = clip.current;
    const d = divider.current;
    if (!c || !d || typeof c.animate !== "function") return;
    glided = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setX(END);
      return;
    }
    const opts = {
      duration: GLIDE_MS,
      easing: EASE_IN_OUT,
      fill: "forwards" as const,
    };
    const a = [
      d.animate(
        [
          { transform: `translateX(${START}%)` },
          { transform: `translateX(${END}%)` },
        ],
        opts,
      ),
      c.animate(
        [
          { clipPath: `inset(0 ${100 - START}% 0 0)` },
          { clipPath: `inset(0 ${100 - END}% 0 0)` },
        ],
        opts,
      ),
    ];
    anims.current = a;
    a[0]!.onfinish = () => {
      if (anims.current !== a) return;
      setX(END);
      // The state now holds the final position: let go of the animation a frame later.
      requestAnimationFrame(() => {
        if (anims.current !== a) return;
        for (const an of a) an.cancel();
        anims.current = [];
      });
    };
  }, [ready]);

  const img = "absolute inset-0 size-full object-cover";
  // Both files are cut to this 4:5 frame; the focus only matters if the frame ever changes.
  const focus = { objectPosition: "50% 20%" };
  return (
    <section
      data-testid="proof"
      className="mx-auto md:grid md:max-w-[1760px] md:grid-cols-2 md:items-center md:gap-10 md:px-10 md:pt-8 md:pb-4 lg:gap-16"
    >
      <div className="proof relative aspect-[4/5] overflow-hidden bg-surface md:order-2 md:w-full md:max-w-[496px] md:justify-self-center md:rounded-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={ref("model")}
          onLoad={() => mark("model")}
          src={catalogUrl(PROOF_MODEL_FILE)}
          alt={copy.discover.proofModelAlt}
          className={img}
          style={focus}
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
        <span
          ref={clip}
          className="absolute inset-0"
          style={{ clipPath: `inset(0 ${100 - x}% 0 0)` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={ref("person")}
            onLoad={() => mark("person")}
            src={catalogUrl(PROOF_ON_PERSON_FILE)}
            alt={copy.discover.proofOnPersonAlt}
            className={img}
            style={focus}
            loading="eager"
            decoding="async"
          />
        </span>
        <span
          ref={divider}
          aria-hidden="true"
          className="hero-divider pointer-events-none absolute inset-y-0 left-0 w-full"
          style={{ transform: `translateX(${x}%)` }}
        >
          <span className="absolute inset-y-0 -left-px w-0.5 bg-canvas shadow-4" />
          <span className="absolute top-1/2 -left-[22px] grid size-11 -translate-y-1/2 place-items-center rounded-full bg-canvas text-ink shadow-4">
            <Handle />
          </span>
        </span>
        <input
          type="range"
          min={2}
          max={98}
          value={x}
          onPointerDown={cancelGlide}
          onKeyDown={cancelGlide}
          onChange={(e) => {
            cancelGlide();
            setX(Number(e.target.value));
          }}
          aria-label={copy.discover.proofSlider}
          data-testid="proof-range"
          className="proof-range absolute inset-0 m-0 size-full cursor-ew-resize opacity-0"
        />
        <span className="pointer-events-none absolute top-3.5 left-3.5 rounded-full bg-ink/70 px-2.5 py-1 text-[12px] leading-4 font-medium text-canvas">
          {copy.discover.proofOnHer}
        </span>
        <span className="pointer-events-none absolute top-3.5 right-3.5 rounded-full bg-canvas/90 px-2.5 py-1 text-[12px] leading-4 font-medium text-ink">
          {copy.discover.proofModel}
        </span>
      </div>
      <div className="px-4 pt-6 pb-2 md:order-1 md:max-w-[560px] md:justify-self-start md:px-0 md:py-0">
        <h2 className="text-[28px] leading-8 font-semibold tracking-[-0.03em] text-ink md:text-[clamp(38px,4vw,56px)] md:leading-[1.06] md:tracking-[-0.035em] md:text-balance">
          {copy.discover.proofTitle}
        </h2>
        <p className="mt-2 text-[15px] leading-6 text-ink-700 md:mt-5 md:max-w-[440px] md:text-[18px] md:leading-7">
          {copy.discover.proofBody}
        </p>
        <ButtonLink
          href={uploadHref}
          size="lg"
          className="mt-5 w-full md:mt-8 md:w-auto md:px-9"
        >
          {copy.discover.upload}
        </ButtonLink>
        <p
          data-testid="proof-ai"
          className="mt-4 text-[12px] leading-4 text-ink-600"
        >
          {copy.discover.proofAi}
        </p>
      </div>
    </section>
  );
}
