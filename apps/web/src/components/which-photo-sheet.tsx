"use client";
// "Which photo?": the sheet that follows Try it on when the person already has photos. It shows
// their default photo and the piece, starts the try-on, or goes to the library to pick another.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { copy } from "../lib/copy";
import { messageOf, paths, startTryOnPath } from "../lib/flow";
import { usePhotos } from "../lib/use-photos";
import { alertStyle } from "../lib/ui";
import { PhotoThumb } from "./photo-thumb";
import { Button } from "./ui/button";
import { Chip } from "./ui/chip";
import { Sheet } from "./ui/sheet";

export function WhichPhotoSheet({
  itemId,
  name,
  onClose,
}: {
  itemId: string;
  name: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { photos, loaded } = usePhotos();
  const def = photos.find((p) => p.isDefault) ?? photos[0];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      router.push(await startTryOnPath(itemId, def?.id));
    } catch (e) {
      setError(messageOf(e));
      setBusy(false);
    }
  }

  return (
    <Sheet open title={copy.whichPhoto.title} onClose={onClose}>
      <p className="mt-1 mb-3 text-[17px] leading-6 font-semibold text-ink">
        {copy.whichPhoto.tryOnThe(name)}
      </p>
      <div className="mb-4 flex items-center gap-3">
        <span className="relative block w-[76px] flex-none">
          {def ? (
            <PhotoThumb
              src={def.thumbUrl}
              alt={copy.whichPhoto.photoAlt}
              className="aspect-[3/4] w-full rounded-md"
            />
          ) : (
            <span className="block aspect-[3/4] w-full rounded-md bg-surface" />
          )}
          {def ? (
            <Chip
              upper
              className="absolute top-1 left-1 !px-1.5 !py-0.5 !text-[9px]"
            >
              {copy.whichPhoto.isDefault}
            </Chip>
          ) : null}
        </span>
        <p className="flex-1 text-[14px] leading-5 text-ink-700">
          {copy.whichPhoto.using}
        </p>
      </div>
      {error ? (
        <p role="alert" className={`mb-3 ${alertStyle}`}>
          {error}
        </p>
      ) : null}
      <Button
        size="lg"
        onClick={() => void confirm()}
        disabled={busy || !loaded || !def}
        className="w-full"
      >
        {copy.whichPhoto.confirm}
      </Button>
      <Button
        variant="outline"
        onClick={() => router.push(paths.library(itemId))}
        disabled={busy}
        className="mt-2.5 w-full"
      >
        {copy.whichPhoto.different}
      </Button>
    </Sheet>
  );
}
