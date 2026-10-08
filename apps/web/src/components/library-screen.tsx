"use client";
// "Which photo?" as a screen: the person's photos for this try-on. Tap one to use it.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getItem } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { messageOf, paths, startTryOnPath } from "../lib/flow";
import { usePhotos } from "../lib/use-photos";
import { alertStyle, body, h1, page } from "../lib/ui";
import { PhotoThumb } from "./photo-thumb";
import { ButtonLink } from "./ui/button";
import { Chip } from "./ui/chip";

export function LibraryScreen({ itemId }: { itemId: string }) {
  const router = useRouter();
  const { photos, loaded, error: loadError } = usePhotos();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const item = getItem(itemId);

  async function use(photoId: string) {
    setBusy(photoId);
    setError(null);
    try {
      router.push(await startTryOnPath(itemId, photoId));
    } catch (e) {
      setError(messageOf(e));
      setBusy(null);
    }
  }

  return (
    <div className={`${page} max-w-[720px]`}>
      <h1 className={h1}>{copy.library.title}</h1>
      <p className="mt-1 mb-4 text-[15px] leading-[22px] text-ink-700">
        {copy.library.sub}
      </p>
      {busy ? (
        <p role="status" className={`mb-3 ${body}`}>
          {copy.library.starting}
        </p>
      ) : null}
      {error || loadError ? (
        <p role="alert" className={`mb-3 ${alertStyle}`}>
          {error ?? loadError}
        </p>
      ) : null}
      {loaded && photos.length === 0 ? (
        <p className={`mb-4 ${body}`}>{copy.library.empty}</p>
      ) : null}
      <ul
        data-testid="library"
        className="m-0 mb-5 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-4"
      >
        {photos.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              data-testid="library-photo"
              disabled={busy !== null}
              onClick={() => void use(p.id)}
              aria-label={copy.library.useLabel(
                copy.library.photoLabel(p.label, p.isDefault),
              )}
              className="relative block w-full text-left"
            >
              <PhotoThumb
                src={p.thumbUrl}
                alt=""
                className={`aspect-[3/4] w-full rounded-lg ${
                  p.isDefault ? "outline-2 -outline-offset-2 outline-ink" : ""
                }`}
              />
              {p.isDefault ? (
                <Chip upper className="absolute top-2 left-2 !text-[10px]">
                  {copy.whichPhoto.isDefault}
                </Chip>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      {item ? (
        <ButtonLink
          href={paths.photo(itemId)}
          variant="outline"
          size="lg"
          className="w-full"
        >
          {copy.library.add}
        </ButtonLink>
      ) : null}
      <div className="mt-4">
        <Link
          href={paths.item(itemId)}
          className="inline-flex min-h-11 items-center text-[15px] font-medium text-accent underline-offset-4 hover:underline"
        >
          {copy.item.back}
        </Link>
      </div>
    </div>
  );
}
