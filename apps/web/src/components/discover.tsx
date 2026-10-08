"use client";
import Link from "next/link";
import { useState } from "react";
import {
  CATALOG,
  DEMO_CATALOG_NOTICE,
  SHOP_CATEGORIES,
  catalogUrl,
  startWithThese,
  type ShopCategory,
} from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { paths } from "../lib/flow";
import { btnLink, caption } from "../lib/ui";
import { useMe } from "./me-provider";
import { ProductCard } from "./product-card";
import { ProofSlider } from "./proof-slider";
import { CategoryTile } from "./ui/category-tile";
import { Chip, FilterChip } from "./ui/chip";

type Filter = "all" | ShopCategory;
const FILTERS: Filter[] = ["all", "apparel", "jewellery", "accessories"];

function StartRow() {
  const items = startWithThese();
  return (
    <section
      aria-labelledby="start-title"
      className="mx-4 mb-6 rounded-lg border border-line py-3.5 md:mx-0"
    >
      <div className="flex items-start gap-2.5 px-4 pb-3">
        <Chip tone="accent" upper className="mt-0.5 flex-none">
          {copy.discover.demoChip}
        </Chip>
        <div>
          <h2
            id="start-title"
            className="text-[15px] leading-5 font-semibold tracking-[-0.01em] text-ink"
          >
            {copy.discover.startTitle}
          </h2>
          <p className="text-[13px] leading-[18px] text-ink-700">
            {copy.discover.startNote}
          </p>
        </div>
      </div>
      <ul
        aria-label={copy.discover.startLabel}
        className="no-scrollbar m-0 flex list-none gap-3 overflow-x-auto px-4"
      >
        {items.map((item) => (
          <li key={item.id} className="w-[132px] flex-none md:w-[148px]">
            <Link
              href={`/item/${item.id}`}
              data-testid="start-item"
              className="block text-left"
            >
              <span className="relative block aspect-[4/5] overflow-hidden rounded-md bg-canvas">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={catalogUrl(item.photos[0]!.file)}
                  alt=""
                  className="size-full object-cover"
                  style={{ objectPosition: item.photos[0]!.focus }}
                />
                <Chip className="absolute bottom-[7px] left-[7px] !px-2 !py-[3px] !text-[10px]">
                  {copy.card.photos(item.photos.length)}
                </Chip>
              </span>
              <span className="mt-[7px] block text-[10px] leading-[14px] font-semibold tracking-[0.08em] text-ink-600 uppercase">
                {item.label}
              </span>
              <span className="block truncate text-[13px] leading-[18px] text-ink">
                {item.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Discover() {
  const { loaded, hasPhoto } = useMe();
  const [filter, setFilter] = useState<Filter>("all");
  const shown =
    filter === "all"
      ? CATALOG
      : CATALOG.filter((i) => i.shopCategory === filter);

  return (
    <div className="mx-auto w-full max-w-[1600px] pb-12 md:px-10">
      {loaded && !hasPhoto ? (
        <ProofSlider uploadHref={paths.photo("coat")} />
      ) : null}

      <div className="px-4 pt-3.5 md:flex md:items-end md:gap-5 md:border-b md:border-line-soft md:px-0 md:pt-7 md:pb-[18px]">
        <div className="md:flex-1">
          <h1 className="sr-only text-[32px] leading-[1.2] font-medium tracking-[-0.025em] text-ink md:not-sr-only md:mb-1">
            {copy.discover.categories[filter]}
          </h1>
          <p className="hidden text-[15px] leading-[21px] text-ink-700 md:block">
            {copy.discover.categoryIntro[filter]}
          </p>
        </div>
        <div
          role="group"
          aria-label={copy.discover.categoriesLabel}
          className="hidden flex-none gap-1.5 md:flex"
        >
          {FILTERS.map((f) => (
            <FilterChip
              key={f}
              selected={filter === f}
              onClick={() => setFilter(f)}
              data-filter={f}
            >
              {copy.discover.categories[f]}
            </FilterChip>
          ))}
        </div>
        <div className="md:hidden">
          <p className="mb-2 text-[11px] leading-[15px] font-semibold tracking-[0.1em] text-ink-600 uppercase">
            {copy.discover.lookingFor}
          </p>
          <div
            role="group"
            aria-label={copy.discover.categoriesLabel}
            className="mb-3.5 flex gap-2"
          >
            {SHOP_CATEGORIES.map((c) => (
              <CategoryTile
                key={c.id}
                label={copy.discover.categories[c.id]!}
                file={c.file}
                focus={c.focus}
                selected={filter === c.id}
                onClick={() => setFilter(filter === c.id ? "all" : c.id)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="md:mt-5">
        <StartRow />
      </div>

      {shown.length === 0 ? (
        <p className="px-4 py-10 text-[15px] leading-6 text-ink-700 md:px-0">
          {copy.discover.emptyCategory}
        </p>
      ) : (
        <ul
          aria-label={copy.discover.gridLabel}
          data-testid="feed"
          className="m-0 flex list-none flex-col gap-[26px] p-0 md:grid md:grid-cols-[repeat(auto-fill,minmax(232px,1fr))] md:gap-x-5 md:gap-y-8"
        >
          {shown.map((item) => (
            <li key={item.id}>
              <ProductCard item={item} />
            </li>
          ))}
        </ul>
      )}

      <p className={`mt-8 px-4 md:px-0 ${caption}`}>{DEMO_CATALOG_NOTICE}</p>
      <Link href="/credits" className={`${btnLink} px-4 md:px-0`}>
        {copy.discover.creditsLink}
      </Link>
    </div>
  );
}
