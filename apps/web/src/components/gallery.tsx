"use client";
// The product gallery: swipeable frames on a phone, a thumbnail strip with a hero and arrows
// from 768px, each with the heart on the picture (the strip is what selects a photo).
import { useState } from "react";
import { catalogUrl, type CatalogItem } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { FavouriteHeart } from "./favourite-heart";
import { FadeImg } from "./ui/fade-img";
import { PhotoFrames } from "./ui/photo-frames";

export function Gallery({ item }: { item: CatalogItem }) {
  const [i, setI] = useState(0);
  const n = item.photos.length;
  const photo = item.photos[i]!;
  const frames = item.photos.map((p) => ({
    src: catalogUrl(p.file),
    alt: copy.item.imageAlt(item.name, item.label, p.label),
    focus: p.focus,
  }));
  return (
    <div data-testid="gallery">
      <div className="md:hidden">
        <PhotoFrames
          name={item.name}
          frames={frames}
          action={<FavouriteHeart itemId={item.id} className="top-3 right-3" />}
        />
      </div>
      <div className="hidden gap-4 md:flex">
        {n > 1 ? (
          <ul
            aria-label={copy.item.galleryLabel}
            className="m-0 flex w-[76px] flex-none list-none flex-col gap-2 p-0"
          >
            {item.photos.map((p, k) => (
              <li key={p.file}>
                <button
                  type="button"
                  onClick={() => setI(k)}
                  aria-label={copy.item.thumb(k + 1)}
                  aria-current={k === i}
                  className={`block h-[95px] w-[76px] overflow-hidden rounded-sm bg-canvas ${
                    k === i
                      ? "outline-2 -outline-offset-2 outline-ink"
                      : "opacity-50"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={catalogUrl(p.file)}
                    alt=""
                    className="size-full object-cover"
                    style={{ objectPosition: p.focus }}
                  />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div
          data-testid="hero"
          className="relative aspect-[4/5] min-w-0 flex-1 overflow-hidden rounded-md bg-surface"
        >
          <FadeImg
            src={catalogUrl(photo.file)}
            alt={copy.item.imageAlt(item.name, item.label, photo.label)}
            loading="eager"
            fetchPriority="high"
            className="size-full object-cover"
            style={{ objectPosition: photo.focus }}
            key={photo.file}
          />
          <FavouriteHeart itemId={item.id} className="top-3.5 right-3.5" />
        </div>
      </div>
    </div>
  );
}
