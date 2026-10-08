"use client";
import Link from "next/link";
import { catalogUrl, type CatalogItem } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { statusLine, type JobView } from "../lib/job";
import { useRenderImage } from "../lib/use-render-image";
import { body, btnLink, caption, h1, page } from "../lib/ui";

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
  const { url } = useRenderImage(job.poseSetId, pose, state === "passed");
  const poseName = copy.poses[pose] ?? pose;

  return (
    <figure
      className="m-0"
      data-testid="pose-tile"
      data-pose={pose}
      data-state={state}
    >
      <div className="relative aspect-tryon w-full overflow-hidden rounded-lg bg-canvas">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={copy.result.thumbAlt(item.name, poseName)}
            data-render
            className="reveal absolute inset-0 size-full object-cover"
          />
        ) : state === "failed" ? (
          <p
            className={`flex size-full items-center justify-center bg-canvas p-3 text-center ${caption}`}
          >
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
      <figcaption className={`mt-2 min-h-9 ${caption}`}>
        <span className="block font-medium text-ink-700">{poseName}</span>
        {url ? <span className="block">{copy.result.aiCaption}</span> : null}
      </figcaption>
    </figure>
  );
}

/** The queue: four 3:4 tiles in pose order, one honest status line, and a way to keep browsing. */
export function QueueView({ job, item }: { job: JobView; item: CatalogItem }) {
  return (
    <div className={page}>
      <h1 className={h1}>{copy.queue.title(item.name)}</h1>
      <p role="status" data-testid="status-line" className={`mt-2 ${body}`}>
        {statusLine(job)}
      </p>
      <ul
        aria-label={copy.queue.tilesLabel}
        className="mt-6 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-4 md:gap-5"
      >
        {job.poseOrder.map((pose) => (
          <li key={pose}>
            <Tile job={job} item={item} pose={pose} />
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <Link href="/" className={btnLink}>
          {copy.queue.keepBrowsing}
        </Link>
      </div>
    </div>
  );
}
