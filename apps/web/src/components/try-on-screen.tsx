"use client";
import Link from "next/link";
import { getItem } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { isFinished } from "../lib/job";
import { useJob } from "../lib/use-job";
import { body, btnLink, page } from "../lib/ui";
import { FailureScreen, failureKindOf } from "./failure-screen";
import { QueueView } from "./queue-view";
import { ResultView } from "./result-view";

/** One route for a job's whole life: queue while it renders, then result or honest failure. */
export function TryOnScreen({ jobId }: { jobId: string }) {
  const { job, missing } = useJob(jobId);
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
  if (!job) {
    return (
      <div className={page}>
        <p role="status" className={body}>
          {copy.queue.loading}
        </p>
      </div>
    );
  }
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
  if (isFinished(job.status)) return <ResultView job={job} item={item} />;
  return <QueueView job={job} item={item} />;
}
