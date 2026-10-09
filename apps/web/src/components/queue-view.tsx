"use client";
// The queue (the prototype's `gen` screen): title and line from the job's real state, four tiles
// that fill as poses pass, a way to keep browsing, and when it is done the call to action. For a
// guest the finished state is "4 poses, ready" at tile size with the account sheet: the full
// result is only served to an account (PRD 22.1 rows 4 and 22).
import Link from "next/link";
import { useEffect, useRef } from "react";
import { catalogUrl, type CatalogItem } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { isFinished, passedPoses, queueLines, type JobView } from "../lib/job";
import { useRenderImage } from "../lib/use-render-image";
import { useAccount } from "./account-provider";
import { Button } from "./ui/button";

function Tile({
  job,
  item,
  pose,
}: {
  job: JobView;
  item: CatalogItem;
  pose: string;
}) {
  const state = job.poses[pose]?.status ?? "pending";
  const { url } = useRenderImage(
    job.poseSetId,
    pose,
    state === "passed",
    "tile",
  );
  const poseName = copy.poses[pose] ?? pose;

  return (
    <figure
      className="m-0"
      data-testid="pose-tile"
      data-pose={pose}
      data-state={state}
    >
      <div className="relative aspect-tryon w-full overflow-hidden rounded-[14px] bg-canvas">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={copy.queue.tileAlt(item.name, poseName)}
            data-render
            className="reveal absolute inset-0 size-full object-cover"
          />
        ) : state === "failed" ? (
          <p className="flex size-full items-center justify-center bg-canvas p-3 text-center text-[12px] leading-4 text-ink-600">
            {copy.queue.poseFailed}
          </p>
        ) : (
          <div className="skeleton flex size-full items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={catalogUrl(item.renderImage)}
              alt={copy.queue.garmentAlt(item.name)}
              className="aspect-tryon w-1/2 rounded-md object-cover"
            />
          </div>
        )}
      </div>
      <figcaption className="mt-[7px] text-[12px] leading-4 text-ink-600">
        <span className={`block text-[13px] leading-[18px] ${"text-ink-700"}`}>
          {url || state === "failed" ? poseName : copy.queue.rendering}
        </span>
        {url ? <span className="block">{copy.result.aiCaption}</span> : null}
      </figcaption>
    </figure>
  );
}

function sheetKey(jobId: string) {
  return `trailroom.account-sheet.${jobId}`;
}

export function QueueView({
  job,
  item,
  signedIn,
}: {
  job: JobView;
  item: CatalogItem;
  signedIn: boolean;
}) {
  const openAccount = useAccount();
  const finished = isFinished(job.status);
  const ready = passedPoses(job);
  const { title, line } = queueLines(job, item.name, signedIn);
  const first = ready[0];

  const reveal = () =>
    openAccount("reveal", {
      jobId: job.jobId,
      poseSetId: job.poseSetId,
      pose: first,
      poseCount: ready.length,
    });
  const revealRef = useRef(reveal);
  revealRef.current = reveal;

  // The sheet rises once per try-on for a guest, when it is ready (the prototype's gen -> reveal).
  useEffect(() => {
    if (!finished || signedIn || !first) return;
    let seen = false;
    try {
      seen = sessionStorage.getItem(sheetKey(job.jobId)) === "1";
      sessionStorage.setItem(sheetKey(job.jobId), "1");
    } catch {
      // storage unavailable: the sheet simply rises again on reload
    }
    if (!seen) revealRef.current();
  }, [finished, signedIn, first, job.jobId]);

  return (
    <div className="rise mx-auto w-full max-w-[720px] px-4 py-4 md:px-8 md:py-10">
      <h1
        data-testid="queue-title"
        className="text-[24px] leading-[30px] font-medium tracking-[-0.02em] text-ink md:text-[32px] md:leading-[38px]"
      >
        {title}
      </h1>
      <p
        role="status"
        data-testid="status-line"
        className="mt-1 mb-4 text-[15px] leading-[22px] text-ink-700"
      >
        {line}
      </p>
      {finished && !signedIn ? (
        <Button
          size="lg"
          onClick={reveal}
          className="mb-4 w-full"
          data-testid="see-poses"
        >
          {copy.queue.cta(ready.length)}
        </Button>
      ) : null}
      <ul
        aria-label={copy.queue.tilesLabel}
        className="m-0 mb-4 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-4 md:gap-5"
      >
        {job.poseOrder.map((pose) => (
          <li key={pose}>
            <Tile job={job} item={item} pose={pose} />
          </li>
        ))}
      </ul>
      {!finished ? (
        <Link
          href="/"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-line bg-canvas px-6 text-[15px] font-medium text-ink"
        >
          {copy.queue.keepBrowsing}
        </Link>
      ) : null}
    </div>
  );
}
