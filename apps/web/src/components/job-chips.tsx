"use client";
// The persistent chip (a job is rendering) and the ready bar (it finished while the person was
// elsewhere), straight from the prototype. Both are links to the try-on's own screen, and both
// read the one job held by JobProvider, so they agree with the queue screen.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getItem } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { chipLines, isRunning, passedPoses } from "../lib/job";
import { useRenderImage } from "../lib/use-render-image";
import { useActiveJob } from "./job-provider";

const bar =
  "flex w-full items-center gap-2.5 border-b border-line-soft px-3.5 py-[9px] text-left";

export function JobChips() {
  const pathname = usePathname();
  const { job, readyJob, dismissReady } = useActiveJob();
  const first = readyJob ? passedPoses(readyJob)[0] : undefined;
  const thumb = useRenderImage(
    readyJob?.poseSetId ?? null,
    first ?? null,
    Boolean(readyJob && first),
    "tile",
  );

  if (job && isRunning(job.status) && pathname !== `/try-on/${job.jobId}`) {
    const item = getItem(job.itemId);
    const lines = chipLines(job, item?.name ?? "");
    return (
      <Link
        href={`/try-on/${job.jobId}`}
        data-testid="job-chip"
        aria-label={`${copy.chip.ariaRunning}. ${lines.title}. ${lines.sub}`}
        className={`${bar} bg-surface`}
      >
        <span
          aria-hidden="true"
          className="block size-[26px] flex-none animate-spin rounded-full border-2 border-line border-t-ink motion-reduce:animate-none"
        />
        <span className="block flex-1">
          <span className="block text-[13px] leading-[17px] font-semibold text-ink">
            {lines.title}
          </span>
          <span
            data-testid="job-chip-sub"
            className="block text-[12px] leading-4 text-ink-600"
          >
            {lines.sub}
          </span>
        </span>
        <span className="flex-none text-[12px] font-semibold text-accent">
          {copy.chip.view}
        </span>
      </Link>
    );
  }

  if (readyJob && pathname !== `/try-on/${readyJob.jobId}`) {
    const item = getItem(readyJob.itemId);
    return (
      <Link
        href={`/try-on/${readyJob.jobId}`}
        onClick={dismissReady}
        data-testid="ready-bar"
        className={`${bar} bg-accent-tint`}
      >
        <span className="block aspect-[3/4] w-[26px] flex-none overflow-hidden rounded-[6px] bg-canvas">
          {thumb.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb.url} alt="" className="size-full object-cover" />
          ) : null}
        </span>
        <span className="flex-1 text-[13px] leading-[17px] font-semibold text-accent">
          {copy.chip.readyLine(item?.name ?? "", passedPoses(readyJob).length)}
        </span>
        <span className="flex-none text-[12px] font-semibold text-accent">
          {copy.chip.seeIt}
        </span>
      </Link>
    );
  }
  return null;
}
