"use client";
// You: the Full body row (default thumbnail and count) and, under Manage, every photo with
// Default / Make default, Remove and + Add. Face and Hand slots are not shown.
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

export function YouPhotos({ onChange }: { onChange: (count: number) => void }) {
  const say = useToast();
  const { photos, loaded, error: loadError, reload } = usePhotos();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const def = photos.find((p) => p.isDefault) ?? photos[0];

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
  return (
    <section
      aria-labelledby="you-photos"
      data-testid="you-photos"
      className="mt-5 rounded-lg border border-line p-4"
    >
      <h2 id="you-photos" className="sr-only">
        {copy.you.photosTitle}
      </h2>
      <div className="flex items-center gap-3">
        {def ? (
          <PhotoThumb
            src={def.thumbUrl}
            alt=""
            className="h-16 w-12 flex-none rounded-sm"
          />
        ) : (
          <span className="block h-16 w-12 flex-none rounded-sm bg-surface" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[16px] leading-[22px] font-medium text-ink">
            {copy.you.fullBody}
          </p>
          <p
            data-testid="photo-count"
            className="text-[14px] leading-5 text-ink-700"
          >
            {photos.length > 0
              ? copy.you.count(photos.length)
              : copy.you.noPhotos}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? copy.you.closeManage : copy.you.manage}
        </Button>
      </div>

      {error || loadError ? (
        <p role="alert" className={`mt-3 ${alertStyle}`}>
          {error ?? loadError}
        </p>
      ) : null}

      {open ? (
        <div className="mt-4 border-t border-line-soft pt-4">
          <p className="mb-3 text-[13px] leading-[18px] text-ink-600">
            {copy.you.fullBodyHint}
          </p>
          <ul className="m-0 grid list-none grid-cols-3 gap-3 p-0 md:grid-cols-4">
            {photos.map((p) => (
              <li key={p.id} data-testid="manage-photo">
                <PhotoThumb
                  src={p.thumbUrl}
                  alt={p.label}
                  className={`aspect-[3/4] w-full rounded-md ${
                    p.isDefault ? "outline-2 -outline-offset-2 outline-ink" : ""
                  }`}
                />
                {p.isDefault ? (
                  <p className="mt-1.5 min-h-8 text-[13px] leading-8 font-semibold text-ink">
                    {copy.you.default}
                  </p>
                ) : (
                  <button
                    type="button"
                    aria-label={copy.you.makeDefaultLabel(p.label)}
                    onClick={() =>
                      void act(
                        () => api.makeDefault(p.id),
                        copy.you.defaultUpdated,
                      )
                    }
                    className="mt-1.5 min-h-8 text-[13px] font-semibold text-accent-dark underline-offset-4 hover:underline"
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
                  className="block min-h-8 text-[13px] font-medium text-ink-700 underline-offset-4 hover:underline"
                >
                  {copy.you.remove}
                </button>
              </li>
            ))}
          </ul>
          {photos.length < MAX_PHOTOS ? (
            <Button
              variant="outline"
              onClick={() => setAdding((a) => !a)}
              aria-expanded={adding}
              className="mt-4 w-full"
            >
              {copy.you.add}
            </Button>
          ) : (
            <p className="mt-4 text-[13px] leading-[18px] text-ink-600">
              {copy.you.full}
            </p>
          )}
          {adding ? (
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
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
