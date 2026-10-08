"use client";
// "Your photo is in": the screen after an upload-first upload. Four render-ready pieces, each
// starting a try-on with the default photo, and a way back to browsing.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { catalogUrl, startWithThese } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { messageOf, paths, startTryOnPath } from "../lib/flow";
import { usePhotos } from "../lib/use-photos";
import { alertStyle, h1, labelStyle, page } from "../lib/ui";
import { PhotoThumb } from "./photo-thumb";
import { ButtonLink } from "./ui/button";

export function StartersScreen() {
  const router = useRouter();
  const { photos, loaded } = usePhotos();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const def = photos.find((p) => p.isDefault) ?? photos[0];
  const items = startWithThese().slice(0, 4);

  useEffect(() => {
    if (loaded && photos.length === 0) router.replace(paths.upload);
  }, [loaded, photos.length, router]);

  async function start(itemId: string) {
    setBusy(itemId);
    setError(null);
    try {
      router.push(await startTryOnPath(itemId, def?.id));
    } catch (e) {
      setError(messageOf(e));
      setBusy(null);
    }
  }

  return (
    <div className={`${page} max-w-[720px]`}>
      <div className="mb-5 flex items-center gap-3.5">
        {def ? (
          <PhotoThumb
            src={def.thumbUrl}
            alt={copy.starters.photoAlt}
            className="h-[84px] w-[66px] flex-none rounded-md"
          />
        ) : null}
        <div>
          <h1 className={h1}>{copy.starters.title}</h1>
          <p className="mt-1 text-[15px] leading-[21px] text-ink-700">
            {copy.starters.sub}
          </p>
        </div>
      </div>
      {error ? (
        <p role="alert" className={`mb-3 ${alertStyle}`}>
          {error}
        </p>
      ) : null}
      <p className={`mb-3 ${labelStyle}`}>{copy.starters.kicker}</p>
      <ul
        data-testid="starters"
        className="m-0 mb-6 grid list-none grid-cols-2 gap-x-3 gap-y-5 p-0 md:grid-cols-4"
      >
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              data-testid="starter"
              disabled={busy !== null || !def}
              onClick={() => void start(item.id)}
              className="block w-full text-left disabled:opacity-60"
            >
              <span className="mb-2 block aspect-[3/4] overflow-hidden rounded-lg bg-canvas">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={catalogUrl(item.photos[0]!.file)}
                  alt=""
                  className="size-full object-cover"
                  style={{ objectPosition: item.photos[0]!.focus }}
                />
              </span>
              <span className="block text-[15px] leading-5 text-ink">
                {item.name}
              </span>
              <span className="block text-[15px] leading-5 font-semibold text-accent">
                {busy === item.id ? copy.photo.starting : copy.starters.tryOn}
                <span className="sr-only"> {item.name}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <ButtonLink
        href={paths.catalogue}
        variant="outline"
        size="lg"
        className="w-full"
      >
        {copy.starters.browse}
      </ButtonLink>
    </div>
  );
}
