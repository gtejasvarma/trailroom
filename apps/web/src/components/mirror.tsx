"use client";
// The mirror: a signed-in person's finished try-on. The picture is the centre (full width and
// about two thirds of a phone's height; large and centred on desktop). Dragging across it turns
// her through the poses, a still press shows the label's own photograph, and three choices sit
// under it: Not for me, Ask a friend, Love it. Everything is saved by default, so there is no
// Keep. The arrival (once per try-on) is a focus-pull and one slow turn all the way round.
// Buy is behind BUY_ENABLED. The AI label is the name line beside the picture, never on it.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { catalogUrl, getItem, type CatalogItem } from "@trailroom/catalog";
import { ApiError, api, removeTryOnOnExit } from "../lib/api";
import { peekUser } from "../lib/firebase";
import { rememberAskLink } from "../lib/ask-links";
import { copy } from "../lib/copy";
import { createDeferred } from "../lib/deferred";
import { BUY_ENABLED } from "../lib/flags";
import { paths } from "../lib/flow";
import { passedPoses, type JobView } from "../lib/job";
import {
  ARRIVAL,
  DRAG_STEP_DESKTOP,
  DRAG_STEP_PHONE,
  EDGE_TILT_DESKTOP,
  EDGE_TILT_PHONE,
  HOLD_MS,
  SETTLE_EASE,
  TILT_DESKTOP,
  TILT_PHONE,
  arrivalEndMs,
  arrivalSteps,
  clampPose,
  decideAxis,
  movedTooFarToHold,
  poseFromDrag,
  tiltFor,
  type Gesture,
} from "../lib/mirror";
import {
  gestureLearned,
  markArrivalSeen,
  markGestureLearned,
} from "../lib/mirror-memory";
import { useRenderImage } from "../lib/use-render-image";
import { useWide } from "../lib/use-wide";
import { useCompare } from "./compare-provider";
import { useLists } from "./lists-provider";
import { useMe } from "./me-provider";
import { OutfitRow } from "./outfit-row";
import { useSaveToList } from "./save-to-list";
import { Button } from "./ui/button";
import { AskIcon, ChevronLeftIcon, CrossIcon, LoveIcon } from "./ui/icons";
import { useToast } from "./ui/toast";
import { useBuy } from "./use-buy";

/** How long Undo is on offer, and so how long a removal waits before it is sent. */
export const UNDO_MS = 5000;
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

type Stage = "intro" | "lit" | "done";

function PoseImage({
  job,
  item,
  pose,
  current,
  preloaded,
}: {
  job: JobView;
  item: CatalogItem;
  pose: string;
  current: boolean;
  /** The Front render the arrival already fetched and decoded. */
  preloaded: string | null;
}) {
  const fetched = useRenderImage(job.poseSetId, preloaded ? null : pose);
  const url = preloaded ?? fetched.url;
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={copy.result.heroAlt(
        item.name,
        item.label,
        copy.mirror.poseVerbs[pose] ?? copy.poses[pose] ?? pose,
      )}
      aria-hidden={current ? undefined : true}
      draggable={false}
      data-render
      data-hero
      data-pose={pose}
      className="absolute inset-0 size-full object-cover select-none"
      style={{
        objectPosition: "50% 30%",
        opacity: current ? 1 : 0,
        transition: `opacity 240ms ${EASE_OUT}`,
      }}
    />
  );
}

function Thumb({
  job,
  pose,
  selected,
  onSelect,
}: {
  job: JobView;
  pose: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const { url } = useRenderImage(job.poseSetId, pose, true, "tile");
  const name = copy.mirror.poseVerbs[pose] ?? copy.poses[pose] ?? pose;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={name}
      data-testid="pose-thumb"
      data-pose={pose}
      className="flex min-h-11 min-w-[52px] flex-col items-center gap-1 p-0 transition-transform duration-[120ms] ease-brand active:scale-[.97] md:min-w-[60px] md:gap-[5px]"
    >
      <span
        className={`relative block h-[58px] w-11 overflow-hidden rounded-sm bg-surface outline-2 outline-offset-2 transition-[opacity,outline-color] duration-200 md:h-[68px] md:w-[52px] ${
          selected
            ? "opacity-100 outline-ink"
            : "opacity-60 outline-transparent"
        }`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            draggable={false}
            className="size-full object-cover"
            style={{ objectPosition: "50% 30%" }}
          />
        ) : null}
      </span>
      <span
        className={`text-[11px] leading-[14px] md:text-[12px] md:leading-4 ${
          selected ? "font-semibold text-ink" : "font-medium text-ink-600"
        }`}
      >
        {name}
      </span>
    </button>
  );
}

function Choice({
  label,
  icon,
  onClick,
  pressed,
  testId,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  pressed?: boolean;
  testId: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      disabled={disabled}
      data-testid={testId}
      className="flex min-h-16 flex-col items-center justify-center gap-[5px] bg-transparent p-0 text-[13px] leading-[18px] font-medium text-ink transition-transform duration-[120ms] ease-brand active:scale-[.97] disabled:opacity-50 md:min-h-12 md:flex-row md:justify-start md:gap-3 md:text-[16px] md:leading-6"
    >
      {icon}
      {label}
    </button>
  );
}

/** The signed-in person's result. Guests never get here: the server serves them tiles only. */
export function Mirror({
  job,
  item,
  arrive = false,
  frontUrl = null,
}: {
  job: JobView;
  item: CatalogItem;
  /** Play the arrival (the caller has the Front render decoded and has marked it seen). */
  arrive?: boolean;
  frontUrl?: string | null;
}) {
  const router = useRouter();
  const say = useToast();
  const wide = useWide();
  const buy = useBuy();
  const compare = useCompare();
  const saveToList = useSaveToList();
  const { tryOns, refresh: refreshMe } = useMe();
  const { lists, setFavourite, refresh: refreshLists } = useLists();

  const poses = useMemo(() => passedPoses(job), [job]);
  const n = poses.length;
  const photo = item.photos[0]!;
  const price = copy.item.price(item.priceUsd);

  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<Stage>(arrive ? "intro" : "done");
  // Set while a horizontal drag is under way: where it started and its pixels per pose.
  const [drag, setDrag] = useState<{ base: number; step: number } | null>(null);
  const dragging = drag !== null;
  const [dx, setDx] = useState(0);
  const [holding, setHolding] = useState(false);
  const [toggled, setToggled] = useState(false);
  const [learned, setLearned] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [gone, setGone] = useState(false);
  const [asking, setAsking] = useState(false);
  const [pop, setPop] = useState(0);

  const stageRef = useRef(stage);
  stageRef.current = stage;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const skipEvent = useRef<Event | null>(null);

  // What this browser has learned, and whether it wants less motion. Read after mount so the
  // server-rendered markup and the first client render agree.
  useEffect(() => {
    setLearned(gestureLearned());
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  const learn = useCallback(() => {
    markGestureLearned();
    setLearned(true);
  }, []);

  // The label's photograph is loaded ahead, so holding swaps it in at once.
  useEffect(() => {
    const img = new Image();
    img.src = catalogUrl(photo.file);
  }, [photo.file]);

  // The arrival: the picture comes into focus, then she turns all the way round once and
  // settles. Under reduced motion it is a short cross-fade and no turn.
  useEffect(() => {
    if (!arrive) return;
    const small = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const later = (ms: number, f: () => void) =>
      timers.current.push(setTimeout(f, ms));
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setStage("lit"));
    });
    if (small) {
      later(ARRIVAL.reducedMs + 80, () => setStage("done"));
    } else {
      for (const s of arrivalSteps(n))
        later(s.atMs + 100, () => setIndex(s.pose));
      later(arrivalEndMs(n) + 100, () => setStage("done"));
    }
    const pending = timers.current;
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      pending.forEach(clearTimeout);
    };
  }, [arrive, n]);

  // Any touch or key during the arrival skips to the end state.
  useEffect(() => {
    if (!arrive || stage === "done") return;
    const skip = (e: Event) => {
      skipEvent.current = e;
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setIndex(0);
      setStage("done");
    };
    window.addEventListener("pointerdown", skip, true);
    window.addEventListener("keydown", skip, true);
    return () => {
      window.removeEventListener("pointerdown", skip, true);
      window.removeEventListener("keydown", skip, true);
    };
  }, [arrive, stage]);

  // ---- turning ------------------------------------------------------------------------------
  const g = useRef<{
    id: number;
    x0: number;
    y0: number;
    base: number;
    axis: Gesture;
    step: number;
    hold: ReturnType<typeof setTimeout> | null;
  } | null>(null);

  const endGesture = () => {
    const cur = g.current;
    if (cur?.hold) clearTimeout(cur.hold);
    g.current = null;
    setHolding(false);
    setDrag(null);
    setDx(0);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.nativeEvent === skipEvent.current) return;
    if (stageRef.current !== "done" || gone) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    g.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      base: index,
      axis: "pending",
      step: wide ? DRAG_STEP_DESKTOP : DRAG_STEP_PHONE,
      hold: setTimeout(() => {
        setHolding(true);
        learn();
      }, HOLD_MS),
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const cur = g.current;
    if (!cur || cur.id !== e.pointerId) return;
    const ddx = e.clientX - cur.x0;
    const ddy = e.clientY - cur.y0;
    if (movedTooFarToHold(ddx, ddy) && cur.hold) {
      clearTimeout(cur.hold);
      cur.hold = null;
    }
    if (holding) return;
    if (cur.axis === "pending") cur.axis = decideAxis(ddx, ddy);
    if (cur.axis !== "horizontal") return;
    if (!dragging) {
      setDrag({ base: cur.base, step: cur.step });
      learn();
    }
    setDx(ddx);
    setIndex(poseFromDrag(cur.base, ddx, cur.step, n));
  };

  const go = useCallback(
    (to: number) => {
      learn();
      setIndex(clampPose(to, n));
    },
    [learn, n],
  );

  const tilt =
    drag && !reduced
      ? tiltFor({
          base: drag.base,
          dx,
          step: drag.step,
          n,
          max: wide ? TILT_DESKTOP : TILT_PHONE,
          edgeMax: wide ? EDGE_TILT_DESKTOP : EDGE_TILT_PHONE,
        })
      : 0;

  // ---- Not for me ---------------------------------------------------------------------------
  const deferred = useState(() => createDeferred())[0];
  const alive = useRef(true);
  const next = tryOns.find((t) => t.poseSetId !== job.poseSetId) ?? null;
  const nextItem = next ? getItem(next.itemId) : undefined;

  const sendRemoval = useCallback(async () => {
    try {
      await api.removeTryOn(job.poseSetId);
    } catch (e) {
      // Already gone is as good as removed; anything else brings the picture back.
      if (!(e instanceof ApiError && e.status === 404)) {
        if (alive.current) {
          setGone(false);
          say(copy.mirror.removeFailed);
        }
        return;
      }
    }
    void refreshMe();
    if (!alive.current) return;
    if (next) markArrivalSeen(next.jobId);
    router.replace(next ? paths.tryOn(next.jobId) : paths.catalogue);
  }, [job.poseSetId, next, refreshMe, router, say]);
  const sendRef = useRef(sendRemoval);
  sendRef.current = sendRemoval;

  // A token for a page that is going away: fetched when the removal starts, used only by pagehide.
  const exitToken = useRef<string | null>(null);

  const notForMe = () => {
    if (gone) return;
    endGesture();
    void peekUser()
      .then((u) => u?.getIdToken())
      .then((t) => {
        exitToken.current = t ?? null;
      })
      .catch(() => {});
    setGone(true);
    say(
      copy.mirror.removed,
      {
        label: copy.toasts.undo,
        onClick: () => {
          if (deferred.cancel()) setGone(false);
        },
      },
      { ms: UNDO_MS },
    );
    deferred.start(UNDO_MS, () => sendRef.current());
  };

  // Leaving the screen sends a pending removal at once.
  useEffect(() => {
    alive.current = true;
    // The page itself is going: the request must outlive it.
    const leave = () => {
      const token = exitToken.current;
      if (token && deferred.cancel()) removeTryOnOnExit(job.poseSetId, token);
      else deferred.flush();
    };
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      alive.current = false;
      deferred.flush();
    };
  }, [deferred, job.poseSetId]);

  // ---- Ask a friend -------------------------------------------------------------------------
  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      say(copy.mirror.askCopied);
    } catch {
      say(copy.toasts.linkCopyFailed);
    }
  }

  async function askFriend() {
    if (asking) return;
    setAsking(true);
    try {
      const question = copy.mirror.askQuestion(item.name);
      const r = await api.createPieceAsk(job.poseSetId, question);
      rememberAskLink(r.askId, r.url);
      void refreshLists();
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({
            title: copy.mirror.askShareTitle(item.name),
            text: question,
            url: r.url,
          });
          say(copy.mirror.askSent);
        } catch (e) {
          // Closing the share sheet is not an error; anything else falls back to the clipboard.
          if (!(e instanceof DOMException && e.name === "AbortError"))
            await copyLink(r.url);
        }
      } else {
        await copyLink(r.url);
      }
    } catch (e) {
      say(
        e instanceof ApiError && e.code === "ask_limit"
          ? copy.share.limit
          : copy.mirror.askFailed,
      );
    } finally {
      setAsking(false);
    }
  }

  // ---- Love it ------------------------------------------------------------------------------
  const loved = lists.some(
    (l) => l.kind === "favourites" && l.itemIds.includes(item.id),
  );
  async function loveIt() {
    const on = !loved;
    say(on ? copy.mirror.favouritesAdded : copy.mirror.favouritesRemoved);
    if (on) setPop((p) => p + 1);
    const r = await setFavourite(item.id, on);
    if (!r.ok)
      say(
        r.code === "list_full"
          ? copy.toasts.favouritesFull
          : copy.toasts.listFailed,
      );
  }

  // ---- render -------------------------------------------------------------------------------
  const showLabel = holding || toggled;
  const intro = stage === "intro";
  const settled = stage === "done";
  const verb = (p: string) => copy.mirror.poseVerbs[p] ?? copy.poses[p] ?? p;
  const current = poses[index] ?? poses[0] ?? "front";

  const stageStyle: React.CSSProperties = gone
    ? {
        opacity: 0,
        transform: "translateY(36px) scale(0.96)",
        transition: `opacity 240ms ${EASE_OUT}, transform 240ms ${EASE_OUT}`,
      }
    : intro
      ? reduced
        ? { opacity: 0 }
        : { opacity: 0, filter: "blur(18px)", transform: "scale(1.03)" }
      : settled
        ? { opacity: 1 }
        : reduced
          ? { opacity: 1, transition: `opacity ${ARRIVAL.reducedMs}ms ease` }
          : {
              opacity: 1,
              filter: "blur(0px)",
              transform: "scale(1)",
              transition: `opacity 900ms ${EASE_OUT}, filter ${ARRIVAL.focusMs}ms ${EASE_OUT}, transform 1500ms ${EASE_OUT}`,
            };
  const bodyStyle: React.CSSProperties = gone
    ? { opacity: 0, transition: `opacity 240ms ${EASE_OUT}` }
    : intro
      ? { opacity: 0, transform: reduced ? undefined : "translateY(8px)" }
      : settled
        ? { opacity: 1 }
        : {
            opacity: 1,
            transition: reduced
              ? `opacity ${ARRIVAL.reducedMs}ms ease`
              : `opacity 600ms ${EASE_OUT} 300ms, transform 700ms ${EASE_OUT} 300ms`,
          };

  const choices = [
    <Choice
      key="not"
      testId="choice-not-for-me"
      label={copy.mirror.notForMe}
      icon={<CrossIcon />}
      onClick={notForMe}
      disabled={gone}
    />,
    <Choice
      key="ask"
      testId="choice-ask"
      label={copy.mirror.askFriend}
      icon={<AskIcon />}
      onClick={() => void askFriend()}
      disabled={asking || gone}
    />,
    <Choice
      key="love"
      testId="choice-love"
      label={
        wide
          ? loved
            ? copy.mirror.loved
            : copy.mirror.loveIt
          : copy.mirror.loveIt
      }
      pressed={loved}
      icon={
        <span
          key={pop}
          className={pop > 0 && loved ? "heart-pop block" : "block"}
        >
          <LoveIcon filled={loved} />
        </span>
      }
      onClick={() => void loveIt()}
      disabled={gone}
    />,
  ];
  // Phone: Not for me, Ask a friend, Love it. Desktop: the same three, Love it first.
  const ordered = wide ? [choices[2]!, choices[1]!, choices[0]!] : choices;

  const pictureSize =
    "h-[max(360px,min(66svh,calc(100svh-286px)))] w-full md:mx-auto md:h-auto md:w-[min(600px,calc((100svh-68px-130px)*0.8))] md:aspect-[4/5] md:rounded-lg";

  return (
    <div className="mx-auto w-full max-w-[1600px] pb-10 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,640px)_minmax(0,1fr)] md:gap-x-14 md:px-8 md:pt-4">
      <div className="hidden md:block md:self-start">
        <Link
          href={paths.tryOns}
          className="inline-flex min-h-11 items-center gap-2 text-[14px] font-medium text-ink-700 hover:text-ink"
        >
          <ChevronLeftIcon />
          {copy.mirror.back}
        </Link>
      </div>

      <div className="md:col-start-2 md:row-start-1">
        <div style={stageStyle} data-testid="mirror-stage" data-stage={stage}>
          <div
            data-testid="pose-gallery"
            role="group"
            aria-label={copy.mirror.group(item.name)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (stageRef.current !== "done" || gone) return;
              if (e.key === "ArrowRight") {
                e.preventDefault();
                go(index + 1);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                go(index - 1);
              }
            }}
            className={`${pictureSize} relative overflow-hidden bg-canvas focus-visible:outline-offset-[-3px]`}
          >
            <div
              className={`absolute inset-0 ${n > 0 ? "" : "skeleton"}`}
              style={{ perspective: wide ? 1200 : 900 }}
            >
              <div
                data-testid="pose-surface"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endGesture}
                onPointerCancel={endGesture}
                onContextMenu={(e) => e.preventDefault()}
                className="absolute inset-0 touch-pan-y select-none [-webkit-touch-callout:none] md:cursor-grab md:active:cursor-grabbing"
                style={{
                  transform: `rotateY(${tilt}deg)`,
                  transformOrigin: "50% 60%",
                  transition: dragging
                    ? "none"
                    : `transform 420ms ${SETTLE_EASE}`,
                }}
              >
                {poses.map((p, i) => (
                  <PoseImage
                    key={p}
                    job={job}
                    item={item}
                    pose={p}
                    current={i === index && !showLabel}
                    preloaded={i === 0 ? frontUrl : null}
                  />
                ))}
                {showLabel ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={catalogUrl(photo.file)}
                    alt={copy.result.labelsPhotoAlt(item.name, item.label)}
                    data-testid="label-photo"
                    draggable={false}
                    className="absolute inset-0 z-[2] size-full bg-canvas object-cover select-none"
                    style={{ objectPosition: photo.focus }}
                  />
                ) : null}
              </div>
            </div>

            {showLabel ? (
              <span
                data-testid="label-badge"
                className="pointer-events-none absolute top-[18px] left-1/2 z-[3] -translate-x-1/2 rounded-full bg-canvas/90 px-3 py-[7px] text-[13px] leading-[18px] font-medium whitespace-nowrap text-ink backdrop-blur-md"
              >
                {copy.mirror.onLabelModel}
              </span>
            ) : null}

            {n > 1 ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-3.5 z-[3] flex justify-center gap-1.5 md:bottom-[18px]"
              >
                {poses.map((p, i) => (
                  <span
                    key={p}
                    data-testid="dot"
                    data-active={i === index}
                    className="frame-dot size-1.5 rounded-full bg-canvas transition-opacity duration-200"
                    style={{ opacity: i === index ? 1 : 0.55 }}
                  />
                ))}
              </div>
            ) : null}

            {settled && !learned && n > 1 && !gone && !showLabel ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-9 z-[3] flex justify-center md:bottom-11">
                <span
                  data-testid="mirror-hint"
                  className="rounded-full bg-canvas/90 px-3.5 py-2 text-[13px] leading-[18px] font-medium text-ink shadow-2 backdrop-blur-md"
                >
                  {copy.mirror.hint}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* The pose is announced as it changes, once the arrival is over. */}
        <p className="sr-only" aria-live="polite" data-testid="pose-announce">
          {settled && n > 0
            ? copy.mirror.announce(verb(current), index + 1, n)
            : ""}
        </p>

        <div style={bodyStyle}>
          {n > 0 ? (
            <div
              role="group"
              aria-label={copy.result.thumbsLabel}
              className="mt-3 flex justify-center gap-2.5 px-4 md:mt-4 md:gap-3.5 md:px-0"
            >
              {poses.map((p, i) => (
                <Thumb
                  key={p}
                  job={job}
                  pose={p}
                  selected={i === index}
                  onSelect={() => go(i)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div
        style={bodyStyle}
        className="px-4 md:col-start-3 md:row-start-1 md:max-w-[320px] md:self-start md:px-0 md:pt-16"
      >
        <div className="pt-3 md:pt-0">
          <h1 className="text-[17px] leading-[22px] font-semibold tracking-[-0.01em] text-ink md:text-[34px] md:leading-10 md:tracking-[-0.03em]">
            {item.name}
          </h1>
          <p
            data-testid="ai-caption"
            className="text-[13px] leading-[18px] text-ink-700 md:mt-1.5 md:text-[15px] md:leading-[22px]"
          >
            {copy.mirror.nameLine(item.label, price)}
          </p>
          <p
            data-testid="mirror-note"
            className="hidden text-[12px] leading-[18px] text-ink-700 md:block"
          >
            {copy.mirror.wideNote}
          </p>
        </div>

        <div
          role="group"
          aria-label={copy.mirror.choicesLabel}
          data-testid="choices"
          className="-mx-2 mt-2 grid grid-cols-3 px-2 md:mx-0 md:mt-5 md:flex md:flex-col md:gap-1 md:px-0"
        >
          {ordered}
        </div>

        <div className="mt-5 border-t border-line-soft pt-5 md:mt-6">
          <p className="text-[15px] leading-[23px] text-ink-700">
            {item.description}
          </p>
          <p className="mt-2 text-[12px] leading-4 text-ink-600">
            {copy.result.expectation}
          </p>
          {job.status === "complete_partial" ? (
            <p
              className="mt-3 text-[14px] leading-5 text-ink-700"
              data-testid="partial-line"
            >
              {copy.result.partial(n, job.poseOrder.length)}
            </p>
          ) : null}
          {BUY_ENABLED ? (
            <Button
              size="lg"
              onClick={() => buy(item.id)}
              data-testid="buy"
              className="mt-4 w-full"
            >
              {copy.result.buy(price, item.label.toUpperCase())}
            </Button>
          ) : null}
          <OutfitRow item={item} job={job} />
          <Button
            variant="outline"
            size="md"
            onClick={() => saveToList(item.id)}
            className="mt-4 w-full min-h-12"
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
          <button
            type="button"
            aria-pressed={toggled}
            data-testid="label-toggle"
            onClick={() => {
              learn();
              setToggled((t) => !t);
            }}
            className="mt-3 inline-flex min-h-11 items-center text-[14px] leading-5 font-medium text-ink-700 underline decoration-ink-400 underline-offset-4"
          >
            {toggled
              ? copy.mirror.showingLabelPhoto
              : copy.mirror.showLabelPhoto}
          </button>
        </div>
      </div>

      {gone ? (
        <div
          data-testid="mirror-gone"
          className="pointer-events-none fixed inset-x-0 top-[30%] z-10 flex flex-col items-center gap-3 px-10 text-center"
        >
          <p className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-ink">
            {copy.mirror.gone}
          </p>
          <p className="text-[15px] leading-[22px] text-ink-700">
            {nextItem
              ? copy.mirror.nextUp(nextItem.name)
              : copy.mirror.backToDiscover}
          </p>
        </div>
      ) : null}
    </div>
  );
}
