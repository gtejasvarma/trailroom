"use client";
// A small preview of one piece in an ask: the person's own Front render where they have a finished
// try-on (it says so beside it), else the label's photograph.
import { catalogUrl, type CatalogItem } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { useRenderImage } from "../lib/use-render-image";
import type { TryOnSummary } from "../server/try-ons";

export function ShareThumb({
  item,
  tryOn,
}: {
  item: CatalogItem;
  tryOn: TryOnSummary | undefined;
}) {
  const { url } = useRenderImage(
    tryOn?.poseSetId ?? null,
    "front",
    Boolean(tryOn),
    "tile",
  );
  const label = item.photos[0]!;
  return (
    <div
      data-testid="share-thumb"
      data-item={item.id}
      data-rendered={tryOn ? "true" : "false"}
    >
      <span className="block aspect-[3/4] overflow-hidden rounded-[10px] bg-canvas">
        {tryOn ? (
          url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={copy.listPage.onYouAlt(item.name)}
              className="size-full object-cover"
              style={{ objectPosition: "50% 30%" }}
            />
          ) : (
            <span aria-hidden="true" className="skeleton block size-full" />
          )
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={catalogUrl(label.file)}
            alt={copy.share.thumbAlt(item.name)}
            className="size-full object-cover"
            style={{ objectPosition: label.focus }}
          />
        )}
      </span>
      {tryOn ? (
        <span className="mt-1 block text-[12px] leading-4 text-ink-700">
          {copy.result.aiCaption}
        </span>
      ) : null}
    </div>
  );
}
