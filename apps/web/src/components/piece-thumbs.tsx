import { catalogUrl, getItem } from "@trailroom/catalog";

/** A few small label photographs side by side (list cards, ask cards). Decorative. */
export function PieceThumbs({
  itemIds,
  width = 44,
  max = 3,
}: {
  itemIds: string[];
  width?: number;
  max?: number;
}) {
  const items = itemIds
    .slice(0, max)
    .map((id) => getItem(id))
    .filter((i) => i !== undefined);
  return (
    <span className="flex flex-none gap-[3px]" aria-hidden="true">
      {items.length === 0 ? (
        <span
          className="block aspect-[3/4] flex-none rounded-[8px] bg-surface"
          style={{ width }}
        />
      ) : null}
      {items.map((item) => {
        const photo = item.photos[0]!;
        return (
          <span
            key={item.id}
            className="block aspect-[3/4] flex-none overflow-hidden rounded-[8px] bg-surface"
            style={{ width }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={catalogUrl(photo.file)}
              alt=""
              className="size-full object-cover"
              style={{ objectPosition: photo.focus }}
            />
          </span>
        );
      })}
    </span>
  );
}
