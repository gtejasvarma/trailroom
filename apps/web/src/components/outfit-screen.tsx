"use client";
// An outfit's whole life on /try-on/[jobId]: the one-image queue while it renders, the honest
// failure if it does not pass, and the outfit screen (the prototype's `outfit`) when it has: the
// single render large with the OUTFIT · ON YOU chip and the AI caption beside it, the title, the
// two pieces with their prices (each linking to its own page), the total, Buy the outfit and
// Add outfit to a list. Departure from the prototype: the pieces are NOT silently given their own
// four-pose try-on; a piece the person has not tried on offers "Try it on" instead.
import Link from "next/link";
import { catalogUrl, type CatalogItem } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { isFinished, type JobView } from "../lib/job";
import { outfitPieces, outfitTitle } from "../lib/outfit";
import { paths } from "../lib/flow";
import { useRenderImage } from "../lib/use-render-image";
import { FailureScreen, failureKindOf } from "./failure-screen";
import { useMe } from "./me-provider";
import { useSaveToList } from "./save-to-list";
import { TryOnButton } from "./tryon-button";
import { useBuy } from "./use-buy";
import { Button } from "./ui/button";
import { Chip } from "./ui/chip";

function PieceRow({ item }: { item: CatalogItem }) {
  const { tryOns } = useMe();
  const tried = tryOns.some((t) => t.itemId === item.id);
  const photo = item.photos[0]!;
  return (
    <li
      data-testid="outfit-piece"
      data-item={item.id}
      className="border-b border-line-soft py-2.5"
    >
      <Link
        href={paths.item(item.id)}
        aria-label={copy.outfit.openPiece(item.name)}
        className="flex items-center gap-3"
      >
        <span className="block aspect-[3/4] w-11 flex-none overflow-hidden rounded-[8px] bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={catalogUrl(photo.file)}
            alt=""
            className="size-full object-cover"
            style={{ objectPosition: photo.focus }}
          />
        </span>
        <span className="block min-w-0 flex-1">
          <span className="block text-[14px] leading-[19px] text-ink">
            {item.name}
          </span>
          <span className="block text-[13px] leading-[18px] text-ink-600 uppercase">
            {item.label}
          </span>
        </span>
        <span className="flex-none text-[14px] leading-[19px] font-medium text-ink tabular-nums">
          {copy.item.price(item.priceUsd)}
        </span>
      </Link>
      {tried ? null : (
        <div className="mt-2 pl-14">
          <TryOnButton
            itemId={item.id}
            name={item.name}
            size="sm"
            className="!w-auto"
          />
        </div>
      )}
    </li>
  );
}

function Queue({
  job,
  pieces,
}: {
  job: JobView;
  pieces: [CatalogItem, CatalogItem];
}) {
  const [a, b] = pieces;
  return (
    <div
      data-testid="outfit-queue"
      className="rise mx-auto w-full max-w-[720px] px-4 py-4 md:px-8 md:py-10"
    >
      <h1
        data-testid="queue-title"
        className="text-[24px] leading-[30px] font-medium tracking-[-0.02em] text-ink md:text-[32px] md:leading-[38px]"
      >
        {copy.outfit.queueTitle}
      </h1>
      <p
        role="status"
        data-testid="status-line"
        className="mt-1 mb-4 text-[15px] leading-[22px] text-ink-700"
      >
        {copy.outfit.queueLine(a.name, b.name)}
      </p>
      <div
        data-state={job.status}
        className="skeleton mb-4 flex aspect-[3/4] w-full max-w-[360px] items-center justify-center gap-2 overflow-hidden rounded-[14px]"
      >
        {pieces.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.id}
            src={catalogUrl(p.renderImage)}
            alt={copy.queue.garmentAlt(p.name)}
            className="aspect-tryon w-2/5 rounded-md object-cover"
          />
        ))}
      </div>
      <Link
        href="/"
        className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-line bg-canvas px-6 text-[15px] font-medium text-ink"
      >
        {copy.outfit.keepBrowsing}
      </Link>
    </div>
  );
}

function Result({
  job,
  pieces,
}: {
  job: JobView;
  pieces: [CatalogItem, CatalogItem];
}) {
  const buy = useBuy();
  const saveToList = useSaveToList();
  const { url } = useRenderImage(job.poseSetId, "front");
  const title = outfitTitle(pieces);
  const total = copy.item.price(pieces[0].priceUsd + pieces[1].priceUsd);
  const ids = pieces.map((p) => p.id);
  return (
    <div
      data-testid="outfit-screen"
      className="rise mx-auto w-full max-w-[1600px] pb-8 md:px-10 md:pt-6"
    >
      <div className="md:grid md:grid-cols-[minmax(0,520px)_minmax(300px,480px)] md:items-start md:justify-center md:gap-x-10">
        <div>
          <div
            className={`relative aspect-[3/4] w-full overflow-hidden bg-canvas md:rounded-md ${url ? "" : "skeleton"}`}
          >
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={copy.outfit.heroAlt(title)}
                data-render
                data-hero
                className="reveal block size-full bg-canvas object-cover"
              />
            ) : null}
            <Chip
              upper
              className="absolute top-3 left-3"
              data-testid="state-chip"
            >
              {copy.outfit.chip}
            </Chip>
          </div>
          <p
            data-testid="ai-caption"
            className="mt-2 px-4 text-[12px] leading-4 font-medium text-ink-600 md:px-0"
          >
            {copy.result.aiCaption}
          </p>
        </div>
        <div className="px-4 pt-4 md:px-0 md:pt-0">
          <h1
            data-testid="outfit-title"
            className="mb-3.5 text-[22px] leading-7 font-medium tracking-[-0.02em] text-ink md:text-[30px] md:leading-9"
          >
            {title}
          </h1>
          <ul
            aria-label={copy.outfit.piecesLabel}
            className="m-0 list-none p-0"
          >
            {pieces.map((p) => (
              <PieceRow key={p.id} item={p} />
            ))}
          </ul>
          <p className="flex items-baseline justify-between pt-3">
            <span className="text-[14px] leading-[19px] text-ink-700">
              {copy.outfit.both}
            </span>
            <span
              data-testid="outfit-total"
              className="text-[18px] leading-6 font-semibold text-ink tabular-nums"
            >
              {total}
            </span>
          </p>
          <Button
            size="lg"
            data-testid="buy-outfit"
            onClick={() => buy(ids)}
            className="mt-3.5 w-full"
          >
            {copy.outfit.buy}
          </Button>
          <Button
            variant="outline"
            size="md"
            data-testid="outfit-to-list"
            onClick={() => saveToList(ids)}
            className="mt-2.5 w-full min-h-12"
          >
            {copy.outfit.addToList}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function OutfitScreen({ job }: { job: JobView }) {
  const { isGuest } = useMe();
  const pieces = outfitPieces(job.itemIds);
  if (!pieces) return null;
  if (job.status === "failed") {
    return (
      <FailureScreen
        kind={failureKindOf(job.failure?.code)}
        itemId={job.itemId}
        outfit={{ itemIds: [pieces[0].id, pieces[1].id], photoId: job.photoId }}
      />
    );
  }
  if (isFinished(job.status) && !isGuest) {
    return <Result job={job} pieces={pieces} />;
  }
  return <Queue job={job} pieces={pieces} />;
}
