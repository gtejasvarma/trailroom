"use client";
import Link from "next/link";
import { getLabel, itemsByLabel, type CatalogItem } from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { Gallery } from "./gallery";
import { PieceTile } from "./piece-tile";
import { TryOnButton } from "./tryon-button";
import { BrandRow } from "./ui/brand-row";
import { Button } from "./ui/button";
import { HeartIcon } from "./ui/icons";
import { useAccount } from "./account-provider";
import { useLists } from "./lists-provider";
import { useSaveToList } from "./save-to-list";
import { useMe } from "./me-provider";
import { ButtonLink } from "./ui/button";
import { useToast } from "./ui/toast";
import { paths } from "../lib/flow";

export function ProductView({ item }: { item: CatalogItem }) {
  const say = useToast();
  const label = getLabel(item.labelSlug)!;
  const price = copy.item.price(item.priceUsd);
  const more = itemsByLabel(item.labelSlug)
    .filter((i) => i.id !== item.id)
    .slice(0, 4);
  const openAccount = useAccount();
  const { isGuest, tryOns } = useMe();
  const mine = isGuest ? undefined : tryOns.find((t) => t.itemId === item.id);
  const buy = () =>
    isGuest
      ? openAccount("buy", { itemId: item.id })
      : say(copy.toasts.buySoon);
  const saveToList = useSaveToList();
  const { isSaved } = useLists();
  const saved = !isGuest && isSaved(item.id);
  const save = () => saveToList(item.id);

  return (
    <div className="rise mx-auto w-full max-w-[1600px] pb-12 md:px-10 md:pt-6">
      <nav
        aria-label={copy.item.breadcrumb}
        className="mb-[18px] hidden items-center gap-2 text-[13px] text-ink-600 md:flex"
      >
        <Link href="/" className="hover:text-ink">
          {copy.nav.discover}
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={`/label/${label.slug}`} className="hover:text-ink">
          {label.name}
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="text-ink">
          {item.name}
        </span>
      </nav>

      <div className="md:flex md:flex-wrap md:items-start md:gap-10">
        <div className="md:max-w-[640px] md:min-w-[300px] md:flex-[1_1_460px]">
          <Gallery item={item} />
        </div>

        <div className="p-4 md:min-w-[320px] md:flex-[1_1_380px] md:p-0">
          <p className="mb-1 text-[11px] leading-[15px] font-semibold tracking-[0.08em] text-ink-600 uppercase">
            {item.label}
          </p>
          <h1 className="mb-1 text-[24px] leading-[30px] font-medium tracking-[-0.02em] text-ink md:text-[30px] md:leading-9">
            {item.name}
          </h1>
          <p className="mb-1 text-[17px] leading-[22px] font-medium text-ink tabular-nums md:mb-5 md:text-[21px] md:leading-[27px]">
            {price}
          </p>
          <p
            data-testid="stock"
            className={`mb-3.5 text-[13px] leading-[18px] md:text-[14px] md:font-medium ${
              item.stock.low ? "text-danger" : "text-ink-700"
            }`}
          >
            {item.stock.line}
          </p>
          <p
            data-testid="description"
            className="mb-[18px] text-[15px] leading-[23px] text-ink-700"
          >
            {item.description}
          </p>
          {mine ? (
            <ButtonLink
              href={paths.tryOn(mine.jobId)}
              size="lg"
              className="w-full"
              data-testid="see-poses"
            >
              {copy.item.seePoses(mine.poses.length)}
            </ButtonLink>
          ) : (
            <TryOnButton itemId={item.id} name={item.name} />
          )}
          <p className="mt-2.5 hidden text-[13px] leading-[18px] text-ink-600 md:block">
            {copy.item.notePhoto}
          </p>
          <div className="mt-2.5 flex items-center gap-2 md:mt-5">
            <Button
              variant="outline"
              size="md"
              onClick={buy}
              className="min-h-[46px] flex-1"
            >
              {copy.card.buy(price)}
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={save}
              aria-label={saved ? copy.card.saveToList : copy.card.addToList}
              data-testid="heart"
              data-saved={saved ? "true" : "false"}
              className="size-[46px] flex-none !px-0"
            >
              <HeartIcon filled={saved} />
            </Button>
          </div>

          <div className="mt-6 border-t border-line-soft pt-[18px]">
            <BrandRow label={label} line={label.meta} avatarSize={40} />
          </div>
        </div>
      </div>

      {more.length > 0 ? (
        <section
          aria-labelledby="more-from"
          className="mx-4 mt-2 border-t border-line-soft pt-[18px] md:mx-0 md:mt-12 md:pt-7"
        >
          <h2
            id="more-from"
            className="mb-3 text-[16px] leading-6 font-medium tracking-[-0.015em] text-ink md:mb-4 md:text-[19px] md:leading-[25px]"
          >
            {copy.item.moreFrom(label.name)}
          </h2>
          <ul
            data-testid="more-from"
            className="no-scrollbar m-0 flex list-none gap-2 overflow-x-auto p-0 md:grid md:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] md:gap-5 md:overflow-visible"
          >
            {more.map((m) => (
              <li key={m.id} className="w-[104px] flex-none md:w-auto">
                <PieceTile item={m} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
