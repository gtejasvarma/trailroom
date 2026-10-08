"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { CatalogItem } from "@trailroom/catalog";
import { isGuestNow } from "../lib/account";
import { copy } from "../lib/copy";
import { passedPoses, type JobView } from "../lib/job";
import { useRenderImage } from "../lib/use-render-image";
import {
  body,
  btnIcon,
  btnPrimary,
  btnSecondary,
  caption,
  h1,
  labelStyle,
  page,
} from "../lib/ui";
import { AccountSheet } from "./account-sheet";

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
  const { url } = useRenderImage(job.poseSetId, pose);
  const poseName = copy.poses[pose] ?? pose;
  return (
    <figure className="m-0" data-testid="pose-thumb" data-pose={pose}>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={poseName}
        className={`block w-full overflow-hidden rounded-md bg-canvas p-0 ${
          selected ? "outline-2 outline-offset-2 outline-accent" : ""
        }`}
      >
        <div className={`aspect-tryon w-full ${url ? "" : "skeleton"}`}>
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={copy.result.thumbAlt(item.name, poseName)}
              data-render
              className="aspect-tryon w-full bg-canvas object-cover"
            />
          ) : null}
        </div>
      </button>
      <figcaption className={`mt-1 break-words ${caption}`}>
        <span className="block font-medium text-ink-700">{poseName}</span>
        <span className="block">{copy.result.aiCaption}</span>
      </figcaption>
    </figure>
  );
}

function SaveIcon() {
  return (
    <svg
      aria-hidden="true"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function sheetKey(jobId: string) {
  return `trailroom.account-sheet.${jobId}`;
}

/** The result: one hero, pose thumbnails, the AI caption and expectation line directly under it. */
export function ResultView({ job, item }: { job: JobView; item: CatalogItem }) {
  const poses = passedPoses(job);
  const [selected, setSelected] = useState<string | null>(null);
  const pose = selected && poses.includes(selected) ? selected : poses[0]!;
  const poseName = copy.poses[pose] ?? pose;
  const { url: heroUrl } = useRenderImage(job.poseSetId, pose);

  const [guest, setGuest] = useState<boolean | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // The sheet rises once when the result first shows for a guest.
  useEffect(() => {
    let cancelled = false;
    isGuestNow()
      .then((g) => {
        if (cancelled) return;
        setGuest(g);
        if (!g) return;
        let seen = false;
        try {
          seen = sessionStorage.getItem(sheetKey(job.jobId)) === "1";
          sessionStorage.setItem(sheetKey(job.jobId), "1");
        } catch {
          // storage unavailable: the sheet simply rises again on reload
        }
        if (!seen) setSheetOpen(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [job.jobId]);

  function locked(action: () => void) {
    if (guest) setSheetOpen(true);
    else action();
  }

  function save() {
    if (!heroUrl) return setNote(copy.result.saveFailed);
    const a = document.createElement("a");
    a.href = heroUrl;
    a.download = `trailroom-${item.id}-${pose}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setNote(copy.result.saved);
  }

  const skipped = job.qaSkipped.join(", ");

  return (
    <div className={`${page} flex flex-col items-center pb-0`}>
      <div className="w-full max-w-[560px]">
        <p className={labelStyle}>{item.label}</p>
        <h1 className={`mt-1 ${h1}`}>{copy.result.title(item.name)}</h1>

        <figure className="m-0 mt-4" data-testid="hero">
          <div
            className={`w-full overflow-hidden rounded-xl bg-canvas ${heroUrl ? "" : "skeleton"}`}
            style={{ aspectRatio: "4 / 5" }}
          >
            {heroUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={pose}
                src={heroUrl}
                alt={copy.result.heroAlt(item.name, item.label, poseName)}
                data-render
                data-hero
                className="reveal block size-full bg-canvas object-contain"
              />
            ) : null}
          </div>
          <figcaption className={`mt-2 ${caption}`}>
            <span className="block font-medium text-ink-700">
              {copy.result.aiCaption}
            </span>
            <span className="block">{copy.result.expectation}</span>
          </figcaption>
        </figure>

        {job.status === "complete_partial" ? (
          <p className={`mt-4 ${body}`} data-testid="partial-line">
            {copy.result.partial}
          </p>
        ) : null}

        <ul
          aria-label={copy.result.thumbsLabel}
          className="mt-6 grid list-none grid-cols-4 gap-2 p-0"
        >
          {poses.map((p) => (
            <li key={p}>
              <Thumb
                job={job}
                item={item}
                pose={p}
                selected={p === pose}
                onSelect={() => setSelected(p)}
              />
            </li>
          ))}
        </ul>

        {note ? (
          <p role="status" className={`mt-4 ${body}`}>
            {note}
          </p>
        ) : null}

        <p className={`mt-6 ${caption}`} data-testid="internal-note">
          {skipped
            ? copy.result.internalNote(skipped)
            : copy.result.internalNoteNone}
        </p>
      </div>

      <div className="sticky bottom-0 z-[1] mt-6 w-full border-t border-line-soft bg-canvas py-3">
        <div className="mx-auto flex w-full max-w-[560px] items-center gap-3">
          <Link href="/" className={`${btnPrimary} flex-1`}>
            {copy.result.addAnother}
          </Link>
          <button
            type="button"
            className={`${btnSecondary} flex-1`}
            aria-haspopup={guest ? "dialog" : undefined}
            onClick={() => locked(() => setNote(copy.result.listsLater))}
          >
            {copy.result.addToList}
          </button>
          <button
            type="button"
            className={btnIcon}
            aria-label={copy.result.saveLabel}
            aria-haspopup={guest ? "dialog" : undefined}
            onClick={() => locked(save)}
          >
            <SaveIcon />
          </button>
        </div>
      </div>

      <AccountSheet
        open={sheetOpen}
        poseCount={passedPoses(job).length}
        onClose={() => setSheetOpen(false)}
        onLinked={() => {
          setGuest(false);
          setSheetOpen(false);
        }}
      />
    </div>
  );
}
