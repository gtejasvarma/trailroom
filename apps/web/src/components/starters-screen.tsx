"use client";
// "Your photo is in": the first thing a new member sees after an upload-first sign-up. A few
// render-ready pieces (dresses and full-length pieces first) shown large like the Discover cards;
// one "Try it on" per piece starts the try-on with the photo they just added (the default photo),
// with no "Which photo?" step. A quiet link leads to the whole catalogue.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { catalogUrl, startWithThese } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { messageOf, paths, startTryOnPath } from "../lib/flow";
import { usePhotos } from "../lib/use-photos";
import { alertStyle, btnLink, h1 } from "../lib/ui";
import { PhotoThumb } from "./photo-thumb";
import { Button } from "./ui/button";
import { PhotoFrames } from "./ui/photo-frames";

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
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-8 md:py-10">
      <div className="mb-6 flex items-center gap-3.5 md:mb-8">
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
        <p role="alert" className={`mb-4 ${alertStyle}`}>
          {error}
        </p>
      ) : null}
      <ul
        data-testid="starters"
        aria-label={copy.starters.listLabel}
        className="m-0 mb-8 grid list-none grid-cols-2 gap-x-3 gap-y-8 p-0 md:grid-cols-4 md:gap-x-6"
      >
        {items.map((item) => (
          <li key={item.id} data-testid="starter" className="flex flex-col">
            <PhotoFrames
              name={item.name}
              frames={item.photos.map((p) => ({
                src: catalogUrl(p.file),
                alt: copy.item.imageAlt(item.name, item.label, p.label),
                focus: p.focus,
              }))}
              aspect="aspect-[3/4]"
              rounded="rounded-md"
            />
            <div className="flex-1">
              <div className="flex items-baseline gap-2 pt-3">
                <span className="min-w-0 flex-1 text-[15px] leading-5 text-ink">
                  {item.name}
                </span>
                <span className="flex-none text-[15px] leading-5 text-ink tabular-nums">
                  {copy.item.price(item.priceUsd)}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[13px] leading-[18px] text-ink-600">
                {item.label}
              </p>
            </div>
            <Button
              size="md"
              disabled={busy !== null || !def}
              onClick={() => void start(item.id)}
              data-testid="starter-try"
              className="mt-3 w-full md:w-auto md:self-start md:px-6"
            >
              {busy === item.id ? copy.photo.starting : copy.starters.tryOn}
              <span className="sr-only"> {item.name}</span>
            </Button>
          </li>
        ))}
      </ul>
      <Link href={paths.catalogue} className={btnLink}>
        {copy.starters.browse}
      </Link>
    </div>
  );
}
