"use client";
import Link from "next/link";
import { useState } from "react";
import {
  catalog,
  DEMO_CATALOG_NOTICE,
  type ShopCategory,
} from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { paths } from "../lib/flow";
import { btnLink, caption } from "../lib/ui";
import { ArrivalsShelf, useArrivals } from "./arrivals-shelf";
import { useMe } from "./me-provider";
import { ProductCard } from "./product-card";
import { ProofSlider } from "./proof-slider";

type Filter = "all" | ShopCategory;
const FILTERS: Filter[] = ["all", "apparel", "jewellery", "accessories"];

/**
 * `serverHasPhoto` is the `tr_hp` cookie as the server read it. Until the client knows who this
 * is, the hero follows the cookie (so a new visitor's first paint is the hero and a returning
 * one's is the feed); after that it follows the truth.
 */
export function Discover({
  serverHasPhoto = false,
}: {
  serverHasPhoto?: boolean;
}) {
  const { loaded, photoCount } = useMe();
  const [filter, setFilter] = useState<Filter>("all");
  // Read after useArrivals: it registers the pieces it learns about, so the feed includes them.
  const arrivals = useArrivals();
  const all = catalog();
  const shown =
    filter === "all" ? all : all.filter((i) => i.shopCategory === filter);
  const hero = loaded ? photoCount === 0 : !serverHasPhoto;

  return (
    <div className="mx-auto w-full max-w-[1760px] pb-14 md:px-10">
      {hero ? (
        <div className="md:-mx-10">
          <ProofSlider uploadHref={paths.upload} />
        </div>
      ) : null}

      <h1 className="sr-only">{copy.discover.title}</h1>
      <div
        role="group"
        aria-label={copy.discover.categoriesLabel}
        className="no-scrollbar flex gap-5 overflow-x-auto px-4 pt-5 md:px-0 md:pt-8"
      >
        {FILTERS.map((f) => {
          const on = filter === f;
          return (
            <button
              key={f}
              type="button"
              aria-pressed={on}
              data-filter={f}
              onClick={() => setFilter(f)}
              className={`relative flex-none py-2.5 text-[15px] leading-5 md:text-[17px] md:leading-6 ${
                on ? "font-semibold text-ink" : "text-ink-600"
              } transition-transform duration-150 ease-brand active:scale-[.97] motion-reduce:transition-none`}
            >
              {copy.discover.categories[f]}
              {on ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-ink"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <ArrivalsShelf data={arrivals} />

      {shown.length === 0 ? (
        <p className="px-4 py-10 text-[15px] leading-6 text-ink-700 md:px-0">
          {copy.discover.emptyCategory}
        </p>
      ) : (
        <ul
          aria-label={copy.discover.gridLabel}
          data-testid="feed"
          className="m-0 mt-5 feed-grid grid list-none gap-y-9 p-0 md:mt-8 md:gap-x-6 md:gap-y-12"
        >
          {shown.map((item, i) => (
            <li key={item.id}>
              <ProductCard item={item} first={i === 0} />
            </li>
          ))}
        </ul>
      )}

      <p className={`mt-10 px-4 md:px-0 ${caption}`}>{DEMO_CATALOG_NOTICE}</p>
      <Link href="/credits" className={`${btnLink} px-4 md:px-0`}>
        {copy.discover.creditsLink}
      </Link>
    </div>
  );
}
