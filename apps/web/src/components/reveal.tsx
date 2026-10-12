"use client";
// The first sight of a finished try-on (once per job, for an account). A full-viewport layer on
// near-black: the label's own photograph of the piece, then the person's Front render wiped over
// it from the left with a white line on the edge (the hero slider's language: the model's photo
// becomes you), then the other poses rise in under it with the AI label, then one button.
// Total about 2.2s. Any tap, click, Escape, Enter or Space jumps to the end state; after that
// the same inputs (or the button) dissolve the stage into the result. There is no auto-advance.
// Reduced motion: no wipe and no movement; the render crossfades in and the rest just appears.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { catalogUrl, type CatalogItem } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import type { JobView } from "../lib/job";
import { useRenderImage } from "../lib/use-render-image";
import { Button } from "./ui/button";

const SEEN_PREFIX = "trailroom.reveal.";
const EASE_IN_OUT = "cubic-bezier(0.77, 0, 0.175, 1)";

export function revealSeen(jobId: string): boolean {
  try {
    return localStorage.getItem(SEEN_PREFIX + jobId) === "1";
  } catch {
    // No storage: say it was seen, so the reveal never loops on every visit.
    return true;
  }
}
export function markRevealSeen(jobId: string): void {
  try {
    localStorage.setItem(SEEN_PREFIX + jobId, "1");
  } catch {
    // ignore
  }
}

/** Loads and decodes an image so it can be shown without a flash. */
export function useDecoded(url: string | null): boolean {
  const [ready, setReady] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const img = new Image();
    img.src = url;
    const done = () => {
      if (!cancelled) setReady(url);
    };
    if (typeof img.decode === "function") img.decode().then(done, done);
    else img.onload = img.onerror = done;
    return () => {
      cancelled = true;
    };
  }, [url]);
  return ready === url && url !== null;
}

function Thumb({
  job,
  pose,
  name,
  index,
  on,
}: {
  job: JobView;
  pose: string;
  name: string;
  index: number;
  on: boolean;
}) {
  const { url } = useRenderImage(job.poseSetId, pose, true, "tile");
  return (
    <li
      className="rv-rise block h-[60px] w-12 overflow-hidden rounded-sm bg-ink-800"
      data-on={on}
      style={{ transitionDelay: on ? `${index * 60}ms` : "0ms" }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={copy.reveal.thumbAlt(name, copy.poses[pose] ?? pose)}
          data-testid="reveal-thumb"
          className="size-full object-cover"
          style={{ objectPosition: "50% 30%" }}
        />
      ) : null}
    </li>
  );
}

export function Reveal({
  job,
  item,
  poses,
  frontUrl,
  onDone,
}: {
  job: JobView;
  item: CatalogItem;
  /** The poses that passed, in order: the first is the one wiped in. */
  poses: string[];
  /** The first pose's render, already decoded. */
  frontUrl: string;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [reduced, setReduced] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const clip = useRef<HTMLDivElement>(null);
  const edge = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const anims = useRef<Animation[]>([]);
  const stepRef = useRef(0);
  const photo = item.photos[0]!;

  const go = useCallback((n: number) => {
    stepRef.current = n;
    setStep(n);
  }, []);

  useEffect(() => {
    setMounted(true);
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // Focus in, the page underneath inert, focus back when the stage goes.
  useEffect(() => {
    if (!mounted) return;
    const before = document.activeElement as HTMLElement | null;
    const inerted: Element[] = [];
    for (const el of Array.from(document.body.children)) {
      if (el.contains(dialog.current) || el.tagName === "SCRIPT") continue;
      if (!el.hasAttribute("inert")) {
        el.setAttribute("inert", "");
        inerted.push(el);
      }
    }
    dialog.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      for (const el of inerted) el.removeAttribute("inert");
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, [mounted]);

  // The timeline.
  useEffect(() => {
    if (!mounted) return;
    const at = (ms: number, fn: () => void) =>
      timers.current.push(setTimeout(fn, ms));
    requestAnimationFrame(() => go(1));
    if (reduced) {
      at(500, () => go(2));
      at(900, () => go(4));
    } else {
      at(500, () => go(2));
      at(1500, () => go(3));
      at(2000, () => go(4));
    }
    const all = timers.current;
    return () => {
      for (const t of all) clearTimeout(t);
    };
  }, [mounted, reduced, go]);

  // The wipe, started when step 2 begins.
  useEffect(() => {
    if (step !== 2 || reduced) return;
    const c = clip.current;
    const e = edge.current;
    if (!c || !e || typeof c.animate !== "function") return;
    const opts = {
      duration: 900,
      easing: EASE_IN_OUT,
      fill: "forwards" as const,
    };
    anims.current = [
      c.animate(
        [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)" }],
        opts,
      ),
      e.animate(
        [
          { transform: "translateX(0%)", opacity: 1 },
          { transform: "translateX(100%)", opacity: 1, offset: 0.94 },
          { transform: "translateX(100%)", opacity: 0 },
        ],
        opts,
      ),
    ];
  }, [step, reduced]);

  const finish = useCallback(() => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
    for (const a of anims.current) a.cancel();
    anims.current = [];
    go(4);
  }, [go]);

  const leave = useCallback(() => {
    setLeaving(true);
    setTimeout(onDone, reduced ? 0 : 200);
  }, [onDone, reduced]);

  // Skip: before the end it jumps to the end state; at the end it leaves.
  const skip = useCallback(() => {
    if (leaving) return;
    if (stepRef.current < 4) finish();
    else leave();
  }, [finish, leave, leaving]);

  // Escape works wherever focus is; Enter and Space only on the stage itself (on the button they
  // are the button's own click).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const onStage = e.target === dialog.current || e.target === document.body;
      if (
        e.key === "Escape" ||
        (onStage && (e.key === "Enter" || e.key === " "))
      ) {
        e.preventDefault();
        skip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [skip]);

  const rest = poses.slice(1);
  const wiped = step >= 2;
  const ease = "var(--ease-out)";
  const fade = (on: boolean, ms = 200) => ({
    opacity: on ? 1 : 0,
    transition: reduced ? "none" : `opacity ${ms}ms ${ease}`,
  });

  if (!mounted) return null;
  return createPortal(
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label={copy.reveal.dialog(item.name)}
      tabIndex={-1}
      data-testid="reveal"
      data-step={step}
      onClick={skip}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-ink px-4 text-canvas outline-none"
      style={{
        opacity: leaving ? 0 : 1,
        transition: reduced ? "none" : "opacity 200ms var(--ease-out)",
      }}
    >
      <div
        className="relative overflow-hidden rounded-lg bg-ink-800"
        style={{
          height: "min(78svh, 100svh - 276px)",
          maxHeight: "calc((100vw - 32px) * 4 / 3)",
          aspectRatio: "3 / 4",
          ...fade(step >= 1),
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={catalogUrl(photo.file)}
          alt={copy.reveal.labelPhotoAlt(item.name, item.label)}
          data-testid="reveal-label-photo"
          className="absolute inset-0 size-full object-cover"
          style={{ objectPosition: photo.focus }}
        />
        <div
          ref={clip}
          className="absolute inset-0"
          style={
            reduced
              ? fade(wiped, 300)
              : { clipPath: step >= 4 ? "none" : "inset(0 100% 0 0)" }
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={frontUrl}
            alt={copy.reveal.renderAlt(item.name, item.label)}
            data-testid="reveal-render"
            data-render
            className="absolute inset-0 size-full object-cover"
            style={{ objectPosition: "50% 30%" }}
          />
        </div>
        {reduced ? null : (
          <div
            ref={edge}
            aria-hidden="true"
            data-testid="reveal-edge"
            className="pointer-events-none absolute inset-y-0 left-0 w-full"
            style={{ opacity: 0 }}
          >
            <div className="absolute inset-y-0 -left-px w-0.5 bg-canvas" />
          </div>
        )}
      </div>

      <div className="relative mt-4 h-6 w-full text-center text-[15px] leading-6 text-ink-400">
        <span
          className="absolute inset-0"
          style={fade(step >= 1 && step < 2)}
          data-testid="reveal-caption-label"
        >
          {item.label}
        </span>
        <span
          className="absolute inset-0"
          style={fade(step >= 2)}
          data-testid="reveal-caption-you"
        >
          {copy.reveal.onYouCaption(item.name)}
        </span>
      </div>

      <p
        data-testid="reveal-ai"
        className="mt-0.5 h-5 text-[12px] leading-5 text-ink-400"
        style={fade(step >= 3)}
      >
        {copy.result.aiCaption}
      </p>

      <ul
        aria-label={copy.result.thumbsLabel}
        className="m-0 mt-3 flex h-[60px] list-none gap-2 p-0"
      >
        {rest.map((p, i) => (
          <Thumb
            key={p}
            job={job}
            pose={p}
            name={item.name}
            index={i}
            on={step >= 3}
          />
        ))}
      </ul>

      <div
        className="mt-4 h-[52px] w-full max-w-[320px]"
        style={fade(step >= 4)}
      >
        <Button
          size="lg"
          tabIndex={step >= 4 ? 0 : -1}
          aria-hidden={step >= 4 ? undefined : true}
          onClick={(e) => {
            e.stopPropagation();
            if (!leaving) leave();
          }}
          data-testid="reveal-continue"
          className="w-full !bg-canvas !text-ink active:!bg-surface"
        >
          {copy.reveal.seeAll(poses.length)}
        </Button>
      </div>
    </div>,
    document.body,
  );
}
