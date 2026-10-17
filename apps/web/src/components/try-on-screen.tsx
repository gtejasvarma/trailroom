"use client";
import Link from "next/link";
import { getItem } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { isFinished, passedPoses, type JobView } from "../lib/job";
import { arrivalSeen, markArrivalSeen } from "../lib/mirror-memory";
import { useDecoded } from "../lib/use-decoded";
import { useRenderImage } from "../lib/use-render-image";
import { useJob } from "../lib/use-job";
import type { CatalogItem } from "@trailroom/catalog";
import { useEffect, useState } from "react";
import { body, btnLink, page } from "../lib/ui";
import { FailureScreen, failureKindOf } from "./failure-screen";
import { useMe } from "./me-provider";
import { OutfitScreen } from "./outfit-screen";
import { QueueView } from "./queue-view";
import { Mirror } from "./mirror";

/**
 * A finished job for an account: the mirror. The first time (per job, remembered in this
 * browser) it opens with the arrival; until the Front render has loaded and decoded the queue
 * stays up. Every later visit opens the mirror at once, settled.
 */
function Finished({ job, item }: { job: JobView; item: CatalogItem }) {
  const [phase, setPhase] = useState<"unknown" | "arrive" | "plain">("unknown");
  useEffect(() => {
    setPhase(arrivalSeen(job.jobId) ? "plain" : "arrive");
  }, [job.jobId]);

  const poses = passedPoses(job);
  const first = poses[0] ?? null;
  const front = useRenderImage(
    job.poseSetId,
    phase === "arrive" ? first : null,
  );
  const decoded = useDecoded(front.url);
  const [started, setStarted] = useState(false);
  const show = phase === "arrive" && decoded && front.url && first;
  useEffect(() => {
    if (show && !started) {
      setStarted(true);
      markArrivalSeen(job.jobId);
    }
  }, [show, started, job.jobId]);
  // A render that cannot be fetched skips the arrival rather than holding the person on the queue.
  useEffect(() => {
    if (phase === "arrive" && (front.failed || !first)) setPhase("plain");
  }, [phase, front.failed, first]);

  if (phase === "plain")
    return <Mirror key={job.jobId} job={job} item={item} />;
  if (show)
    return (
      <Mirror
        key={job.jobId}
        job={job}
        item={item}
        arrive
        frontUrl={front.url}
      />
    );
  return <QueueView job={job} item={item} signedIn />;
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
