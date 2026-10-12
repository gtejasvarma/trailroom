"use client";
import Link from "next/link";
import { getItem } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { isFinished, passedPoses, type JobView } from "../lib/job";
import { useRenderImage } from "../lib/use-render-image";
import { useJob } from "../lib/use-job";
import type { CatalogItem } from "@trailroom/catalog";
import { useEffect, useState } from "react";
import { body, btnLink, page } from "../lib/ui";
import { FailureScreen, failureKindOf } from "./failure-screen";
import { useMe } from "./me-provider";
import { OutfitScreen } from "./outfit-screen";
import { QueueView } from "./queue-view";
import { ResultView } from "./result-view";
import { Reveal, markRevealSeen, revealSeen, useDecoded } from "./reveal";

/**
 * A finished job for an account. The first time (per job, remembered in this browser) the person
 * sees the Reveal; until the Front render has loaded and decoded the queue stays up. Every later
 * visit goes straight to the result.
 */
function Finished({ job, item }: { job: JobView; item: CatalogItem }) {
  const [phase, setPhase] = useState<"unknown" | "reveal" | "result">(
    "unknown",
  );
  useEffect(() => {
    setPhase(revealSeen(job.jobId) ? "result" : "reveal");
  }, [job.jobId]);

  const poses = passedPoses(job);
  const first = poses[0] ?? null;
  const front = useRenderImage(
    job.poseSetId,
    phase === "reveal" ? first : null,
  );
  const decoded = useDecoded(front.url);
  const [started, setStarted] = useState(false);
  const show = phase === "reveal" && decoded && front.url && first;
  useEffect(() => {
    if (show && !started) {
      setStarted(true);
      markRevealSeen(job.jobId);
    }
  }, [show, started, job.jobId]);
  // A render that cannot be fetched skips the stage rather than holding the person on the queue.
  useEffect(() => {
    if (phase === "reveal" && (front.failed || !first)) setPhase("result");
  }, [phase, front.failed, first]);

  if (phase === "result") return <ResultView job={job} item={item} />;
  return (
    <>
      <QueueView job={job} item={item} signedIn />
      {show ? (
        <Reveal
          job={job}
          item={item}
          poses={poses}
          frontUrl={front.url!}
          onDone={() => setPhase("result")}
        />
      ) : null}
    </>
  );
}

/**
 * One route for a job's whole life: the queue while it renders, then (for an account) the result
 * or the honest failure. A guest whose set is ready stays on the queue screen at tile size, with
 * the account sheet: the full images are not served to a guest.
 */
export function TryOnScreen({ jobId }: { jobId: string }) {
  const { job, missing } = useJob(jobId);
  const { isGuest, loaded } = useMe();
  if (missing && !job) {
    return (
      <div className={page}>
        <p className={body}>{copy.queue.missing}</p>
        <Link href="/" className={btnLink}>
          {copy.queue.missingAction}
        </Link>
      </div>
    );
  }
  if (!job || !loaded) {
    return (
      <div className={page}>
        <p role="status" className={body}>
          {copy.queue.loading}
        </p>
      </div>
    );
  }
  if (job.kind === "outfit") return <OutfitScreen job={job} />;
  const item = getItem(job.itemId);
  if (!item) return null;
  if (job.status === "failed") {
    return (
      <FailureScreen
        kind={failureKindOf(job.failure?.code)}
        itemId={job.itemId}
      />
    );
  }
  if (isFinished(job.status) && !isGuest) {
    return <Finished job={job} item={item} />;
  }
  return <QueueView job={job} item={item} signedIn={!isGuest} />;
}
