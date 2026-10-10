"use client";
// Your photos: the Full body row (default thumbnail, count) with Manage, and under it every photo
// with Default / Make default, Remove and + Add. On a phone the row opens with Manage; in Studio
// (wide) the photos are always shown, as the desktop prototype. Face and Hand slots are not shown.
import { useState } from "react";
import { api } from "../lib/api";
import { copy } from "../lib/copy";
import { messageOf } from "../lib/flow";
import { usePhotos } from "../lib/use-photos";
import { alertStyle } from "../lib/ui";
import { PhotoAdd } from "./photo-add";
import { PhotoThumb } from "./photo-thumb";
import { Button } from "./ui/button";
import { useToast } from "./ui/toast";

const MAX_PHOTOS = 6;

export function YouPhotos({
  onChange,
  wide = false,
}: {
  onChange: (count: number) => void;
  wide?: boolean;
}) {
  const say = useToast();
  const { photos, loaded, error: loadError, reload } = usePhotos();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const def = photos.find((p) => p.isDefault) ?? photos[0];
  const showAll = wide || open;
  const full = photos.length >= MAX_PHOTOS;

  async function act(fn: () => Promise<unknown>, done: string, after?: number) {
    setError(null);
    try {
      await fn();
      say(done);
    } catch (e) {
      setError(messageOf(e));
    }
    await reload();
    if (after !== undefined) onChange(after);
  }

  if (!loaded) return null;

  const count = (
    <p
      data-testid="photo-count"
      className="text-[12px] leading-4 text-ink-600 md:text-[13px] md:leading-[18px]"
    >
      {photos.length > 0 ? copy.you.count(photos.length) : copy.you.noPhotos}
    </p>
  );

  const thumbs = (
    <ul
      className={
        wide
          ? "m-0 flex list-none flex-wrap gap-3 p-0"
          : "no-scrollbar m-0 flex list-none gap-2 overflow-x-auto p-0 pb-0.5"
      }
    >
      {photos.map((p) => (
        <li
          key={p.id}
          data-testid="manage-photo"
          className={wide ? "w-28 flex-none" : "w-[84px] flex-none"}
        >
          <span
            className={`relative block overflow-hidden bg-surface ${
              wide
                ? "h-[140px] w-28 rounded-[10px]"
                : "aspect-[3/4] w-full rounded-[10px]"
            } ${p.isDefault ? "outline-2 -outline-offset-2 outline-ink" : ""}`}
          >
            <PhotoThumb src={p.thumbUrl} alt={p.label} className="size-full" />
            {p.isDefault ? (
              <span className="absolute top-[5px] left-[5px] rounded-full bg-ink px-[7px] py-0.5 text-[9px] leading-[12px] font-semibold tracking-[0.04em] text-canvas uppercase md:top-[7px] md:left-[7px] md:px-2 md:py-[3px]">
                {copy.you.defaultBadge}
              </span>
            ) : null}
          </span>
          <p className="mt-1.5 truncate text-[11px] leading-[15px] text-ink-700 md:text-[12px] md:leading-4">
            {p.label}
          </p>
          <div className="flex flex-wrap gap-x-2.5">
            {p.isDefault ? null : (
              <button
                type="button"
                aria-label={copy.you.makeDefaultLabel(p.label)}
                onClick={() =>
                  void act(() => api.makeDefault(p.id), copy.you.defaultUpdated)
                }
                className="min-h-8 text-[12px] font-medium text-accent-dark"
              >
                {copy.you.makeDefault}
              </button>
            )}
            <button
              type="button"
              aria-label={copy.you.removeLabel(p.label)}
              onClick={() =>
                void act(
                  () => api.removePhoto(p.id),
                  copy.you.removed(p.label),
                  photos.length - 1,
                )
              }
              className="min-h-8 text-[12px] font-medium text-ink-600"
            >
              {copy.you.remove}
            </button>
          </div>
        </li>
      ))}
      {!wide && !full ? (
        <li className="w-[84px] flex-none">
          <button
            type="button"
            onClick={() => setAdding((a) => !a)}
            aria-expanded={adding}
            className="grid aspect-[3/4] w-full place-items-center rounded-[10px] border border-dashed border-line text-[12px] font-medium text-accent-dark"
          >
            {copy.you.add}
          </button>
        </li>
      ) : null}
    </ul>
  );

  const addPanel = adding ? (
    <div className="mt-4 border-t border-line-soft pt-4">
      <p className="mb-3 text-[15px] leading-5 font-medium text-ink">
        {copy.you.addTitle}
      </p>
      <PhotoAdd
        onAdded={async () => {
          setAdding(false);
          say(copy.you.added);
          await reload();
          onChange(photos.length + 1);
        }}
      />
    </div>
  ) : null;

  const problem =
    error || loadError ? (
      <p role="alert" className={`mt-3 ${alertStyle}`}>
        {error ?? loadError}
      </p>
    ) : null;

  if (wide) {
    return (
      <section
        aria-labelledby="you-photos"
        data-testid="you-photos"
        className="rounded-[14px] border border-line p-5"
      >
        <div className="mb-3.5 flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <h2
              id="you-photos"
              className="text-[17px] leading-[23px] font-semibold tracking-[-0.01em] text-ink"
            >
              {copy.you.fullBody}
            </h2>
            <p className="text-[13px] leading-[18px] text-ink-600">
              {copy.you.studioHint}
            </p>
            {count}
          </div>
          {full ? null : (
            <Button
              variant="outline"
              size="md"
              aria-expanded={adding}
              onClick={() => setAdding((a) => !a)}
              className="flex-none"
            >
              {copy.you.addPhoto}
            </Button>
          )}
        </div>
        {problem}
        {photos.length === 0 && !adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex w-full items-center justify-center gap-2.5 rounded-[11px] border-[1.5px] border-dashed border-line p-[26px] text-ink-600"
          >
            <span aria-hidden="true" className="text-[18px]">
              +
            </span>
            <span className="text-[14px] font-medium">
              {copy.you.addPhotoEmpty}
            </span>
          </button>
        ) : (
          thumbs
        )}
        {full ? (
          <p className="mt-3 text-[13px] leading-[18px] text-ink-600">
            {copy.you.full}
          </p>
        ) : null}
        {addPanel}
      </section>
    );
  }

  return (
    <section
      aria-labelledby="you-photos"
      data-testid="you-photos"
      className="rounded-lg border border-line p-3"
    >
      <h2 id="you-photos" className="sr-only">
        {copy.you.photosTitle}
      </h2>
      <div className="flex items-center gap-3">
        {def ? (
          <PhotoThumb
            src={def.thumbUrl}
            alt=""
            className="aspect-[3/4] w-11 flex-none rounded-[8px]"
          />
        ) : (
          <span className="block aspect-[3/4] w-11 flex-none rounded-[8px] bg-surface" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-5 font-semibold text-ink">
            {copy.you.fullBody}
          </p>
          {count}
        </div>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="min-h-11 flex-none px-1 text-[13px] font-semibold text-accent-dark"
        >
          {open ? copy.you.closeManage : copy.you.manage}
        </button>
      </div>
      {problem}
      {showAll ? (
        <div className="mt-3">
          {thumbs}
          <p className="mt-2.5 text-[12px] leading-[17px] text-ink-600">
            {full ? copy.you.full : copy.you.fullBodyHint}
          </p>
          {addPanel}
        </div>
      ) : null}
    </section>
  );
}
